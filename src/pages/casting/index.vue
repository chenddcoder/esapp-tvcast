<template>
  <div class="casting-root" :focusable="false" ref="rootRef">
    <!-- 投屏播放层：ESPlayerManager 管理 ESVideoPlayer（web 端 = HTML5 video） -->
    <ESPlayerManager
      ref="playerManagerRef"
      class="player-layer"
      :focusable="false"
      :initPlayerWindowType="playerWindowType"
      :playerList="playerListRef"
      :playerViewList="playerViewListRef"
      playerBackgroundColor="black"
      @onPlayerInitialized="onPlayerInitialized"
      @onPlayerPrepared="onPlayerPrepared"
      @onPlayerPlaying="onPlayerPlaying"
      @onPlayerPaused="onPlayerPaused"
      @onPlayerStopped="onPlayerStopped"
      @onPlayerCompleted="onPlayerCompleted"
      @onPlayerError="onPlayerError"
      @onPlayerDurationChanged="onPlayerDurationChanged"
      @onPlayerProgressChanged="onPlayerProgressChanged"
    />

    <!-- loading -->
    <div class="loading-mask" v-if="loading" :focusable="false">
      <div class="loading-spinner" :focusable="false"></div>
      <span class="loading-text" :focusable="false">正在投屏中…</span>
    </div>

    <!-- 播放错误 -->
    <div class="error-mask" v-if="errorText" :focusable="false">
      <span class="error-text" :focusable="false">{{ errorText }}</span>
    </div>

    <!-- 顶部来源条 -->
    <div class="source-bar" v-if="!errorText" :focusable="false">
      <div class="live-dot" :focusable="false" :class="{ paused: !playing }"></div>
      <span class="source-text" :focusable="false">{{ title || '投屏播放中' }}</span>
      <span class="res-text" :focusable="false">{{ source }}</span>
    </div>

    <!-- 底部控制条 -->
    <div class="control-bar" v-if="!errorText" :focusable="false">
      <div class="ctrl-btn" :focusable="true" eventClick eventFocus name="play" @click="onTogglePlay">
        <span class="ctrl-icon" :focusable="false">{{ playing ? '❚❚' : '▶' }}</span>
        <span class="ctrl-label" :focusable="false">{{ playing ? '暂停' : '播放' }}</span>
      </div>
      <div class="ctrl-btn" :focusable="true" eventClick eventFocus name="mute" @click="onToggleMute">
        <span class="ctrl-icon" :focusable="false">{{ muted ? '🔇' : '🔊' }}</span>
        <span class="ctrl-label" :focusable="false">{{ muted ? '取消静音' : '静音' }}</span>
      </div>

      <!-- 进度：当前 / 总时长 -->
      <div class="progress-wrap" :focusable="false">
        <div class="progress-track" :focusable="false">
          <div class="progress-fill" :focusable="false" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="progress-time" :focusable="false">{{ progressText }} / {{ durationText }}</span>
      </div>

      <div class="ctrl-spacer" :focusable="false"></div>
      <div class="ctrl-btn stop" :focusable="true" eventClick eventFocus name="stop" @click="onStop">
        <span class="ctrl-icon" :focusable="false">⏹</span>
        <span class="ctrl-label" :focusable="false">断开</span>
      </div>
      <div class="ctrl-btn home" :focusable="true" eventClick eventFocus name="home" @click="onBackHome">
        <span class="ctrl-icon" :focusable="false">⌂</span>
        <span class="ctrl-label" :focusable="false">返回主页</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, markRaw, ref, watch, onMounted, onUnmounted } from 'vue'
import { useESRouter, useESRoute } from '@extscreen/es3-router'
import { ESPlayerWindowType, ESPlayerPlayMode, ESPlayerRate } from '@extscreen/es3-player'
import { ESMediaItemList, ESMediaItem } from '@extscreen/es3-player-manager'
import { ESVideoPlayer } from '@extscreen/es3-video-player'
import {
  sendRemoteEvent,
  DLNA_REMOTE_EVENT,
  initDlnaActionListener,
  initDlnaControlListener,
  getPendingPlay,
  DlnaPlayPayload,
} from '../../tools/dlna-bridge'

/**
 * 投屏播放宿主层（DLNA 接收端播放管理）。
 *
 * 两种使用方式：
 *  1. 覆盖层（推荐，desktop/web）：App.vue 收到 ACTION_DLNA 后以 props(url/title)
 *     直接渲染本组件（es3-router 3.x 在 web-renderer 下 push 后 RouterView 不切换，
 *     页面实例机制未在 web 端实现，不能用路由导航投屏播放页）。
 *  2. 路由页（真机/未来）：routes.ts 的 casting 路由渲染，url/title 从 route.params
 *     或模块级 pendingPlay 读取（props 为空时兜底）。
 *
 * 对接方式（参考 esapp-xiaoyoucast dlna-play.vue）：
 *  - 播放管理：<ESPlayerManager>（es3-player-manager）+ ESVideoPlayer（web 端由
 *    web-renderer 的 IJKPlayerComponent 适配为 HTML5 video）。
 *  - 状态上报：play/pause/stop/position/duration 经 sendRemoteEvent 回传 Rust
 *    DLNA DMR（AvTransport 状态机）→ 手机端进度条/状态跟随。
 *  - 进度同步：onPlayerDurationChanged/onPlayerProgressChanged（web 端 timeupdate
 *    驱动，position 节流 1s 上报）→ 手机端 GetPositionInfo。
 *  - 播放控制：下行 ACTION_DLNA_STATUS（手机端遥控 play/pause/stop/seekTo）
 *    → seekTo/pause/stop/start；上行 TV 遥控播放/暂停/断开 → sendRemoteEvent。
 */
export default defineComponent({
  name: 'CastingPage',
  props: {
    /** 覆盖层模式：被投资源 URL */
    url: { type: String, default: '' },
    /** 覆盖层模式：标题 */
    title: { type: String, default: '' },
  },
  emits: ['exit'],
  /** 渲染/播放错误兜底：ESPlayerManager web 端兼容异常不崩掉播放层 */
  errorCaptured(err: unknown, instance: unknown, info: string) {
    console.error('[casting] errorCaptured:', err, info)
    return false
  },
  setup(props, { emit }) {
    // 覆盖层模式（App.vue v-if 直接渲染，非路由页实例）下 useESRoute/useESRouter
    // 可能没有注入上下文而抛错，必须容错：路由仅作为兜底（真机路由页模式）。
    let router: { back?: () => void; push?: (x: unknown) => unknown } | null = null
    let route: { params?: Record<string, unknown> } | null = null
    try {
      router = useESRouter() as unknown as { back?: () => void; push?: (x: unknown) => unknown }
    } catch (e) {
      console.warn('[casting] useESRouter unavailable（覆盖层模式）:', e)
    }
    try {
      route = useESRoute() as unknown as { params?: Record<string, unknown> }
    } catch (e) {
      console.warn('[casting] useESRoute unavailable（覆盖层模式）:', e)
    }
    const rootRef = ref()
    const playerManagerRef = ref<any>()

    const playerWindowType = ESPlayerWindowType.ES_PLAYER_WINDOW_TYPE_FULL
    const playerList = [markRaw(ESVideoPlayer)]
    const playerListRef = ref(playerList)
    const playerViewList: any[] = []
    const playerViewListRef = ref(playerViewList)

    // 播放状态
    const source = ref('手机')
    const title = ref(props.title || '')
    const playing = ref(false)
    const muted = ref(false)
    const loading = ref(true)
    const errorText = ref('')
    const curProgress = ref(0) // 毫秒
    const curDuration = ref(0) // 毫秒
    const lastPositionReport = ref(0) // 上次 position 上报时间戳（节流）
    let cUrl = ''
    let isStopped = false
    let stopDelayTimer: any = -1

    const fmtTime = (ms: number): string => {
      const s = Math.max(0, Math.floor(ms / 1000))
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      const sec = s % 60
      const mm = m < 10 ? '0' + m : '' + m
      const ss = sec < 10 ? '0' + sec : '' + sec
      return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
    }
    const progressText = ref('00:00')
    const durationText = ref('00:00')
    const progressPercent = ref(0)

    // ---------- 播放管理 ----------
    const buildPlayList = (url: string): ESMediaItemList => ({
      index: 0,
      list: [
        {
          playerType: 1,
          id: new Date().getTime() + '',
          index: 0,
          title: title.value,
          mediaSourceList: {
            index: 0,
            list: [{ uri: url, definition: 1 }],
          },
          position: { position: 0, support: false },
        } as unknown as ESMediaItem,
      ],
    })

    const initPlay = (url: string) => {
      if (!url) return
      cUrl = url
      loading.value = true
      errorText.value = ''
      isStopped = false
      const manager = playerManagerRef.value
      if (!manager) return
      try {
        manager.initialize()
        manager.setPlayMediaListMode(ESPlayerPlayMode.ES_PLAYER_PLAY_MODE_ONCE)
        manager.setPlayRate(ESPlayerRate.ES_PLAYER_RATE_1)
        manager.setSize(1920, 1080)
        const list = buildPlayList(url)
        manager.playMediaList(list)
        // 发起播放即上报 play，让客户端立即进入播放态（预加载阶段）
        sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
      } catch (e) {
        console.warn('[casting] initPlay error:', e)
      }
    }

    // ---------- 进度同步定时器（xiaoyoucast startProgressTimer 同款） ----------
    let progressTimer: any = -1

    const startProgressTimer = () => {
      clearInterval(progressTimer)
      progressTimer = setInterval(() => {
        const manager = playerManagerRef.value
        if (!manager) return
        try {
          const dur = Number(manager.getDuration()) || 0
          const pos = Number(manager.getCurrentPosition()) || 0
          if (dur > 0) {
            if (dur !== curDuration.value) {
              curDuration.value = dur
              durationText.value = fmtTime(dur)
              sendRemoteEvent(DLNA_REMOTE_EVENT.DURATION, { duration: dur })
            }
            if (pos >= 0 && pos !== curProgress.value) {
              curProgress.value = pos
              progressText.value = fmtTime(pos)
              progressPercent.value = Math.min(100, (pos / dur) * 100)
              sendRemoteEvent(DLNA_REMOTE_EVENT.POSITION, { position: pos })
            }
          }
        } catch (e) {}
      }, 1000)
    }

    const stopProgressTimer = () => {
      clearInterval(progressTimer)
      progressTimer = -1
    }

    const onPlayerInitialized = () => {
      console.log('[casting] onPlayerInitialized')
    }

    const onPlayerPrepared = () => {
      console.log('[casting] onPlayerPrepared')
      loading.value = false
      sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
    }

    const onPlayerPlaying = () => {
      console.log('[casting] onPlayerPlaying')
      playing.value = true
      loading.value = false
      sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
      // 进度同步定时器（对齐 xiaoyoucast dlna-play 的 startProgressTimer）：
      // 主动轮询 getCurrentPosition/getDuration 上报，不依赖 callback 时序
      //（web 端 ESPlayerManager 的 setProgressCallback 可能在播放器组件
      //  未就绪时错过设置 → 进度/时长不上报，DLNA 客户端进度条不动）。
      startProgressTimer()
    }

    const onPlayerPaused = () => {
      console.log('[casting] onPlayerPaused')
      playing.value = false
    }

    const onPlayerStopped = () => {
      console.log('[casting] onPlayerStopped')
      playing.value = false
      loading.value = false
      curProgress.value = 0
      curDuration.value = 0
      progressPercent.value = 0
      progressText.value = '00:00'
      durationText.value = '00:00'
    }

    const onPlayerDurationChanged = (d: number) => {
      console.log('[casting] onPlayerDurationChanged:', d)
      if (d > 0) {
        curDuration.value = d
        durationText.value = fmtTime(d)
        sendRemoteEvent(DLNA_REMOTE_EVENT.DURATION, { duration: d })
      }
    }

    const onPlayerProgressChanged = (p: number) => {
      curProgress.value = p
      progressText.value = fmtTime(p)
      if (curDuration.value > 0) {
        progressPercent.value = Math.min(100, (p / curDuration.value) * 100)
      }
      // 节流：position 最多 1s 上报一次（web 端 timeupdate 约 250ms 一次）
      const now = Date.now()
      if (curDuration.value > 0 && now - lastPositionReport.value >= 1000) {
        lastPositionReport.value = now
        sendRemoteEvent(DLNA_REMOTE_EVENT.POSITION, { position: p })
      }
    }

    const onPlayerCompleted = () => {
      console.log('[casting] onPlayerCompleted')
      playing.value = false
      // 进度播到末尾：position 上报 duration+1000（与 xiaoyoucast 一致），随后 stop
      if (curDuration.value > 0) {
        sendRemoteEvent(DLNA_REMOTE_EVENT.POSITION, { position: curDuration.value + 1000 })
      }
      clearTimeout(stopDelayTimer)
      stopDelayTimer = setTimeout(() => {
        sendRemoteEvent(DLNA_REMOTE_EVENT.STOP, {})
      }, 1200)
    }

    const onPlayerError = (e: any) => {
      console.warn('[casting] onPlayerError:', e)
      playing.value = false
      loading.value = false
      sendRemoteEvent(DLNA_REMOTE_EVENT.STOP, {})
      errorText.value = '播放失败，请在手机端重新投屏'
    }

    // ---------- 下行控制（手机端遥控） ----------
    const onDlnaPlay = (payload: DlnaPlayPayload) => {
      const url = payload?.url
      if (!url) {
        // 无 url：ACTION_DLNA_STATUS play（恢复播放）
        const manager = playerManagerRef.value
        if (manager) {
          try {
            manager.start(0)
            playing.value = true
            loading.value = false
            sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
          } catch (e) {}
        }
        return
      }
      if (url === cUrl) {
        // 同源：恢复播放
        const manager = playerManagerRef.value
        if (manager) {
          try {
            manager.start(0)
            playing.value = true
            loading.value = false
            sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
          } catch (e) {}
        }
        return
      }
      // 新投屏：重播
      if (payload.title) title.value = payload.title
      initPlay(url)
    }

    const onDlnaSeek = (positionSeconds: number) => {
      const manager = playerManagerRef.value
      if (!manager) return
      try {
        manager.seekTo(positionSeconds * 1000) // 秒 → 毫秒
        sendRemoteEvent(DLNA_REMOTE_EVENT.POSITION, { position: positionSeconds * 1000 })
        console.log('[casting] onDlnaSeek:', positionSeconds)
      } catch (e) {
        console.warn('[casting] seek error:', e)
      }
    }

    const onDlnaPause = () => {
      const manager = playerManagerRef.value
      if (!manager) return
      try {
        manager.pause()
        playing.value = false
        sendRemoteEvent(DLNA_REMOTE_EVENT.PAUSE, {})
      } catch (e) {}
    }

    const onDlnaStop = () => {
      const manager = playerManagerRef.value
      if (manager) {
        try {
          manager.stop()
        } catch (e) {}
      }
      sendRemoteEvent(DLNA_REMOTE_EVENT.STOP, {})
      emit('exit')
      try {
        if (!props.url) router?.back?.()
      } catch (e) {}
    }

    // ---------- TV 遥控控制条 ----------
    const onTogglePlay = () => {
      const manager = playerManagerRef.value
      if (!manager) return
      if (playing.value) {
        try {
          manager.pause()
          playing.value = false
          sendRemoteEvent(DLNA_REMOTE_EVENT.PAUSE, {})
        } catch (e) {}
      } else {
        try {
          manager.start(0)
          playing.value = true
          loading.value = false
          sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
        } catch (e) {}
      }
    }

    const onToggleMute = () => {
      const manager = playerManagerRef.value
      if (!manager) return
      muted.value = !muted.value
      // ESPlayerManager 无 setMute，用 setVolume(0/1) 实现静音
      try {
        manager.setVolume(muted.value ? 0 : 1)
      } catch (e) {}
    }

    const stopAndExit = () => {
      const manager = playerManagerRef.value
      if (manager) {
        try {
          manager.pause()
          manager.stop()
          manager.reset()
        } catch (e) {}
      }
      clearTimeout(stopDelayTimer)
      stopProgressTimer()
      sendRemoteEvent(DLNA_REMOTE_EVENT.PAUSE, {})
      // 音乐类先 pause 再 stop（对齐 xiaoyoucast 音乐处理），视频直接 stop
      setTimeout(() => {
        sendRemoteEvent(DLNA_REMOTE_EVENT.STOP, {})
      }, 120)
      // 覆盖层模式：通知 App.vue 收起播放层（不再依赖 router.back）
      emit('exit')
      // 路由模式兜底（真机若仍走路由页）：回退路由
      try {
        if (props.url) {
          // 覆盖层模式已 emit exit，路由模式才 back
        } else {
          router?.back?.()
        }
      } catch (e) {}
    }

    const onStop = () => stopAndExit()
    const onBackHome = () => stopAndExit()

    /**
     * 返回键（es3-router dispatchBackPressed 会优先调用页面实例的 onBackPressed）：
     * 投屏中按返回 = 断开投屏：停播 + 上报 stop + 收起播放层。
     */
    const onBackPressed = () => {
      console.log('[casting] onBackPressed → 断开投屏')
      stopAndExit()
    }

    /** 页面被切到后台（Home/切应用）：同样停播断开，防止静默继续占网/出声 */
    const onESStop = () => {
      console.log('[casting] onESStop → 断开投屏')
      stopAndExit()
    }

    // ---------- 生命周期 ----------
    let removeActionListener: (() => void) | null = null
    let removeControlListener: (() => void) | null = null

    const initPlaySource = () => {
      // 覆盖层模式：props.url 优先
      if (props.url) {
        if (props.title) title.value = props.title
        initPlay(props.url)
        return
      }
      // 路由模式兜底：route.params
      const params: any = (route && route.params) || {}
      if (params.source) source.value = params.source as string
      if (params.title) title.value = params.title as string
      if (params.url) {
        initPlay(params.url as string)
        return
      }
      // 模块级待播参数兜底（App.vue 收到 playerUrl 时写入）
      const pending = getPendingPlay()
      if (pending && pending.url) {
        if (pending.title) title.value = pending.title
        initPlay(pending.url)
      }
    }

    // 覆盖层模式：App.vue 更新 props.url（新投屏/换源）→ 重播
    watch(
      () => props.url,
      (newUrl, oldUrl) => {
        if (!newUrl) return
        if (newUrl === oldUrl) return
        console.log('[casting] props.url 变化 → 重播', newUrl)
        if (props.title) title.value = props.title
        initPlay(newUrl)
      }
    )

    onMounted(() => {
      console.log('[casting] mounted', { url: props.url, title: props.title })
      initPlaySource()
      // 下行投屏请求（ACTION_DLNA playerUrl，已在播放时的重播）
      removeActionListener = initDlnaActionListener({ onPlayerUrl: onDlnaPlay })
      // 下行播放控制（ACTION_DLNA_STATUS playerStatus）
      removeControlListener = initDlnaControlListener({
        onPlay: onDlnaPlay,
        onSeek: onDlnaSeek,
        onPause: onDlnaPause,
        onStop: onDlnaStop,
      })
    })

    onUnmounted(() => {
      if (removeActionListener) removeActionListener()
      if (removeControlListener) removeControlListener()
      clearTimeout(stopDelayTimer)
      stopProgressTimer()
    })

    return {
      rootRef,
      playerManagerRef,
      playerWindowType,
      playerListRef,
      playerViewListRef,
      source,
      title,
      playing,
      muted,
      loading,
      errorText,
      progressText,
      durationText,
      progressPercent,
      onPlayerInitialized,
      onPlayerPrepared,
      onPlayerPlaying,
      onPlayerPaused,
      onPlayerStopped,
      onPlayerCompleted,
      onPlayerError,
      onPlayerDurationChanged,
      onPlayerProgressChanged,
      onTogglePlay,
      onToggleMute,
      onStop,
      onBackHome,
      onBackPressed,
      onESStop,
    }
  },
})
</script>

<style scoped>
.casting-root {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background: #000;
  overflow: hidden;
  z-index: 9999;
}
.player-layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
}

/* loading */
.loading-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}
.loading-spinner {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 5px solid rgba(124, 92, 255, 0.25);
  border-top-color: #7c5cff;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.loading-text {
  font-size: 26px;
  color: #c7d2ea;
  margin-top: 20px;
}

/* 错误 */
.error-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
}
.error-text {
  font-size: 32px;
  color: #ff7875;
}

/* 顶部来源条 */
.source-bar {
  position: absolute;
  left: 48px;
  top: 44px;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: rgba(0, 0, 0, 0.45);
  padding-top: 12px;
  padding-bottom: 12px;
  padding-left: 22px;
  padding-right: 22px;
  border-radius: 14px;
  max-width: 1200px;
}
.live-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ff4d4f;
  box-shadow: 0 0 12px #ff4d4f;
  animation: blink 1.4s infinite;
  margin-right: 16px;
}
.live-dot.paused {
  background: #9fb0d0;
  box-shadow: none;
  animation: none;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.source-text {
  font-size: 26px;
  color: #eaf0ff;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.res-text {
  font-size: 24px;
  color: #9fb0d0;
  margin-left: 6px;
}

/* 底部控制条 */
.control-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1920px;
  height: 150px;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 60px;
  padding-right: 60px;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.85) 60%);
}
.ctrl-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120px;
  height: 110px;
  border-radius: 20px;
  justify-content: center;
  transition: transform 0.15s ease, background 0.15s ease;
  margin-right: 24px;
}
.ctrl-btn[focused],
.ctrl-btn:focus {
  transform: scale(1.06);
  background: rgba(124, 92, 255, 0.18);
}
.ctrl-icon {
  font-size: 40px;
  color: #eaf0ff;
}
.ctrl-label {
  font-size: 22px;
  color: #c7d2ea;
  margin-top: 8px;
}
.ctrl-spacer {
  flex: 1;
}
.ctrl-btn.stop .ctrl-icon {
  color: #ff7875;
}
.ctrl-btn.home .ctrl-icon {
  color: #5b8cff;
}

/* 进度 */
.progress-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 560px;
  margin-left: 30px;
}
.progress-track {
  width: 560px;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #7c5cff, #5b8cff);
  transition: width 0.3s ease;
}
.progress-time {
  font-size: 22px;
  color: #c7d2ea;
  margin-top: 10px;
}
</style>
