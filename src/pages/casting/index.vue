<template>
  <!-- 全屏覆盖层（App 根级组件，非路由页面）：
       控制条按钮与进度条均为 focusable（对齐真机 Hippy 焦点契约，web-renderer
       按 Android 焦点树语义收集覆盖层内焦点元素）；进度条 autofocus 获得初始
       焦点（对齐 xiaoyoucast：seekbar 聚焦后左右键=快进快退、OK=播放/暂停）。
       左右/OK/下键在捕获阶段拦截（等价于真机 onKeyDown 返回 true 阻断框架），
       防止焦点系统把按键移动/点击到底层页面元素。 -->
  <div class="casting-root" ref="rootRef" :focusable="false">
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

    <!-- 底部控制条：进度条用标准 qt-seek-bar 组件（quicktvui3，真机契约，
         渲染 TVSeekBarViewComponent；web-renderer 由 QtSeekBar.js 模拟）。
         遥控器交互对齐 xiaoyoucast：seekbar 初始聚焦 → 左右键长按快进/快退
         （组件 startSeek 逐步进 + 系统 keydown 自动重复）、OK=播放/暂停、
         下键=抖音切集、返回/Esc=断开。按钮仅鼠标/触屏使用（不参与遥控焦点）。 -->
    <div class="control-bar" v-if="!errorText" :focusable="false">
      <div class="ctrl-btn" :focusable="false" eventClick name="play" @click="onTogglePlay">
        <span class="ctrl-icon" :focusable="false">{{ playing ? '❚❚' : '▶' }}</span>
        <span class="ctrl-label" :focusable="false">{{ playing ? '暂停' : '播放' }}</span>
      </div>
      <div class="ctrl-btn" :focusable="false" eventClick name="mute" @click="onToggleMute">
        <span class="ctrl-icon" :focusable="false">{{ muted ? '🔇' : '🔊' }}</span>
        <span class="ctrl-label" :focusable="false">{{ muted ? '取消静音' : '静音' }}</span>
      </div>

      <!-- 进度条（seekbar 焦点目标，遥控器左右键快进/快退、OK 播放/暂停） -->
      <div class="seekbar-wrap" :focusable="false">
        <qt-seek-bar
          ref="seekBarRef"
          class="seek-bar"
          name="seekbar"
          eventFocus
          :focusable="true"
          @onSeekStart="onSeekStart"
          @onSeekStop="onSeekStop"
          @onSeekChanged="onSeekChanged"
          @onFocusChanged="onSeekbarFocusChanged"
        />
        <span class="seek-time-text" :focusable="false">{{ progressText }} / {{ durationText }}</span>
      </div>

      <div class="ctrl-spacer" :focusable="false"></div>
      <div class="ctrl-btn stop" :focusable="false" eventClick name="stop" @click="onStop">
        <span class="ctrl-icon" :focusable="false">⏹</span>
        <span class="ctrl-label" :focusable="false">断开</span>
      </div>
      <div class="ctrl-btn home" :focusable="false" eventClick name="home" @click="onBackHome">
        <span class="ctrl-icon" :focusable="false">⌂</span>
        <span class="ctrl-label" :focusable="false">返回主页</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, markRaw, ref, onMounted, onUnmounted } from 'vue'
import { useESRouter, useESRoute } from '@extscreen/es3-router'
import { ESPlayerWindowType, ESPlayerPlayMode, ESPlayerRate } from '@extscreen/es3-player'
import { ESMediaItemList, ESMediaItem } from '@extscreen/es3-player-manager'
import { ESVideoPlayer } from '@extscreen/es3-video-player'
import { QTSeekBarMode, QTISeekBar } from '@quicktvui/quicktvui3'
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
    // 路由页面模式：参数经 useESRoute（route.params）与 onESCreate 注入。
    // 兼容 props 直传（覆盖层遗留用法，未来可移除）。
    let router: { back?: () => void; push?: (x: unknown) => unknown } | null = null
    let route: { params?: Record<string, unknown> } | null = null
    try {
      router = useESRouter() as unknown as { back?: () => void; push?: (x: unknown) => unknown }
    } catch (e) {
      console.warn('[casting] useESRouter unavailable:', e)
    }
    try {
      route = useESRoute() as unknown as { params?: Record<string, unknown> }
    } catch (e) {
      console.warn('[casting] useESRoute unavailable:', e)
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
    const curProgress = ref(-1) // 毫秒；初始 -1 保证首轮 pos=0 也上报（链路从 0 即有数据流）
    const curDuration = ref(0) // 毫秒
    const lastPositionReport = ref(0) // 上次 position 上报时间戳（节流）
    let cUrl = ''
    let isStopped = false
    let stopDelayTimer: any = -1
    // 手机端 Stop → 延迟退出页面定时器（2026-08-25 切集兼容）：
    // iPhone 抖音切集流程 = Stop → SetAVTransportURI → Play，首个 Stop 若立即退出
    // 页面，后续 Play(新集) 到达时页面已销毁（App 单例去重还会跳过 push）→ 新视频
    // 无人播放。延迟 400ms 退出，换集 Play 在窗口内到达则取消退出。
    let stopExitTimer: any = -1
    // initPlay 换源延迟定时器（2026-08-25）：先 stop 复位播放器，延迟 200ms 后
    // playMediaList 起新流——播放中直接 playMediaList 不触发 video 换 src。
    let playMediaTimer: any = -1
    // 下键 forceComplete 防抖窗口 + 切集间隙补发（2026-08-25 实测）：
    // 无效场景"当前进度跟着播放进度走"= forceComplete 未执行 UI 置总时长分支——
    // ① 切集后立即再按落入 1500ms 防抖窗口被吞（最可能，切集流程可 <1.5s 完成）；
    // ② 切集间隙 dur=0（onPlayerStopped 清时长）走了空分支。
    // 修复：initPlay 换集时重置 lastForceComplete（切集后第一下必生效）；
    // dur<=0 时按下记 pending，时长就绪后由 applyProgress 补发 next + UI 置总进度。
    let lastForceComplete = 0
    let pendingForceComplete = false

    // ---------- 快进/快退 seek（qt-seek-bar 组件契约，对齐 xiaoyoucast） ----------
    // 交互：seekbar 聚焦后，左右键调组件 startSeek(forward)（组件内部每次调用
    // 步进 maxProgress*1%*加速系数，长按靠系统 keydown 自动重复连续步进），
    // 松手 keyup → stopSeek → 组件 emit onSeekStop(progress) → 真正 seekTo。
    // 组件 step 时经 callUIFunction setProgress 实时更新进度条 UI。
    const seeking = ref(false) // 是否处于 seek 态（onSeekStart→onSeekStop）
    const seekBarFocused = ref(false) // seekbar 是否聚焦（onFocusChanged 更新）
    let wasPlayingBeforeSeek = false // seek 前是否在播放（seek 结束恢复播放依据）
    let seekResumeTimer: any = -1 // seek 结束恢复播放延迟定时器（用户手动操作可取消）

    const seekBarRef = ref<QTISeekBar>()

    /** 初始化 seekbar（对齐 xiaoyoucast initSeekBar） */
    const initSeekBar = () => {
      const sb = seekBarRef.value
      if (!sb) return
      try {
        sb.setSeekBarMode(QTSeekBarMode.QT_SEEK_BAR_MODE_SINGLE)
        sb.setProgressHeight(12)
        sb.setProgressRadius(6)
        sb.setProgressColor('#7c5cff')
        sb.setProgressDefaultColor('rgba(255,255,255,0.18)')
        sb.setThumbWidth(40)
        sb.setThumbHeight(40)
        // 聚焦后把遥控焦点落在进度条上（真机/桌面一致：左右键=快进快退、OK=播放暂停）
        setTimeout(() => {
          try {
            sb.requestFocus()
          } catch (e) {}
        }, 200)
      } catch (e) {
        console.warn('[casting] initSeekBar error:', e)
      }
    }

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
      // 换集/重播：重置进度基准（applyProgress 倒退保护不误伤新集从 0 起播）
      curProgress.value = -1
      // 换集/重播：重置下键防抖窗口——切集后第一下按键必生效，
      // 不被上次按下（<1.5s 前）的防抖吞掉（"切集后按键无效"根因）。
      lastForceComplete = 0
      // 清间隙补发标志：客户端已切集到达新 url，无需再补发（防连环切集）
      pendingForceComplete = false
      const manager = playerManagerRef.value
      if (!manager) return
      try {
        // 切集/重播换源（2026-08-25 实测，Playwright 实证）：**播放中直接
        // playMediaList 不触发 video 换 src**（切集后 video.src 仍是旧 url，
        // 前端 JS 状态已切但画面/声音停留在上一集）。先 stop 复位播放器释放
        // 旧流，延迟 200ms 后再 playMediaList 起新流——对齐 xiaoyoucast
        // toPlay 的"参数重置 + 200ms 延迟"节奏，确保 ESPlayerManager 从干净
        // 状态重新走 setVideoPath 链路。
        clearTimeout(playMediaTimer)
        try {
          manager.stop()
        } catch (e) {}
        playMediaTimer = setTimeout(() => {
          try {
            manager.initialize()
            manager.setPlayMediaListMode(ESPlayerPlayMode.ES_PLAYER_PLAY_MODE_ONCE)
            manager.setPlayRate(ESPlayerRate.ES_PLAYER_RATE_1)
            manager.setSize(1920, 1080)
            // 换源策略（2026-08-25 Playwright 实证，可播视频复现）：
            //  - playMediaList 在"已有播放器实例"时 web 端不触发 video 换 src
            //    （onPlayerPrepared/Playing 假派发，video.src 仍旧 url——JS 状态
            //    已切但画面/声音停留上一集）
            //  - playMediaSourceList 直接走 IJKPlayerComponent.setVideoPath，但
            //    **仅适用于已有 media item 上下文**（首次起播用它不会创建 view）
            // 因此：播放器已初始化（playerInited）→ 切集换源用 playMediaSourceList；
            // 首次起播 → playMediaList 完整流程。
            if (playerInited) {
              try {
                manager.playMediaSourceList({ index: 0, list: [{ uri: url, definition: 1 }] } as never)
                console.log('[casting] 切集换源：playMediaSourceList')
              } catch (e) {
                console.warn('[casting] playMediaSourceList failed, fallback playMediaList:', e)
                manager.playMediaList(buildPlayList(url))
              }
            } else {
              manager.playMediaList(buildPlayList(url))
              console.log('[casting] 首次起播：playMediaList')
            }
            // 发起播放即上报 play，让客户端立即进入播放态（预加载阶段）
            sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
          } catch (e) {
            console.warn('[casting] initPlay(playMediaList) error:', e)
          }
        }, 200)
      } catch (e) {
        console.warn('[casting] initPlay error:', e)
      }
    }

    // ---------- 进度同步定时器（xiaoyoucast startProgressTimer 同款） ----------
    let progressTimer: any = -1

    /**
     * 读取播放进度/时长（毫秒）——纯快应用契约（ESPlayerManager API），
     * 不使用 document/window 等浏览器对象（快应用真机 Hippy 环境无这些对象）。
     * 进度轮询走 manager.getCurrentPosition()/getDuration()：ESPlayerManager
     * 内部 Me()（播放器实例获取）在 playing 事件触发瞬间可能返回 null →
     * undefined → 0，因此**不要在 playing 事件里立即上报 position**（偶发 0
     * 会把 AvTransport pos 重置，客户端进度条恒 0）；定时器轮询（播放状态
     * 稳定后）实测返回真实值，稳定可靠。
     */
    const readProgress = (): { pos: number; dur: number } => {
      let pos = -1
      let dur = -1
      const manager = playerManagerRef.value
      if (manager) {
        try {
          const p = Number(manager.getCurrentPosition())
          if (isFinite(p) && p >= 0) pos = p
        } catch (e) {}
        try {
          const d = Number(manager.getDuration())
          if (isFinite(d) && d > 0) dur = d
        } catch (e) {}
      }
      // 全部无效（新流未就绪/流式 Infinity）：duration 保持已有值，不闪 0
      if (dur <= 0 && curDuration.value > 0) dur = curDuration.value
      return { pos: pos < 0 ? 0 : pos, dur: dur < 0 ? 0 : dur }
    }

    /** 同步进度条组件（时长/进度；seek 模式组件自管，不打扰） */
    const syncSeekBarMax = (dur: number) => {
      const sb = seekBarRef.value
      if (sb && typeof sb.setMaxProgress === 'function' && dur > 0) {
        try {
          sb.setMaxProgress(dur)
        } catch (e) {}
      }
    }
    const syncSeekBarProgress = (pos: number) => {
      if (seeking.value) return // seek 模式组件内部管理进度
      const sb = seekBarRef.value
      if (sb && typeof sb.setProgress === 'function' && pos >= 0) {
        try {
          sb.setProgress(pos)
        } catch (e) {}
      }
    }

    /**
     * 统一应用进度到 UI（progressText/durationText/progressPercent）并上报 DLNA。
     * 定时器与 onPlayerPlaying 立即上报共用 —— 两边必须都更新 UI：
     * 否则一边先抢占 curDuration/curProgress，另一边 `!==` 判断不再成立，
     * UI 文本（尤其 durationText 总时长）会永远卡在初始 00:00。
     */
    const applyProgress = (dur: number, pos: number) => {
      if (dur > 0 && dur !== curDuration.value) {
        curDuration.value = dur
        durationText.value = fmtTime(dur)
        syncSeekBarMax(dur)
        sendRemoteEvent(DLNA_REMOTE_EVENT.DURATION, { duration: dur })
      }
      // position 上报：进度倒退保护 —— ESPlayerManager 内部 Me()（播放器实例
      // 获取）间歇返回 null 时 getCurrentPosition() 会假 0（进度突然归 0/倒退），
      // 若上报会把 AvTransport pos 重置，客户端（抖音）进度条倒退/停 0。
      // 正常播放进度只前进；seek/换集由 onDlnaSeek/initPlay 重置 curProgress，
      // 倒退保护不会误伤（seek 后 curProgress 已是新值、换集置 -1）。
      if (pos >= 0 && pos !== curProgress.value) {
        const regress = curProgress.value > 0 && pos < curProgress.value - 500
        if (!regress) {
          curProgress.value = pos
          progressText.value = fmtTime(pos)
          if (dur > 0) progressPercent.value = Math.min(100, (pos / dur) * 100)
          syncSeekBarProgress(pos)
          sendRemoteEvent(DLNA_REMOTE_EVENT.POSITION, { position: pos })
        }
      }
      // 切集间隙按键补发（2026-08-25）：dur 未就绪时按下的 next 在 Rust 侧
      // 因 dur=0 被忽略（force_complete && dur>0 条件不满足），时长就绪后
      // 补发一次 + UI 置总进度（用户立即可见"当前进度=总时长"反馈，与正常
      // 按下一致）。仅补发一次（清标志），且 initPlay 换集时已清——客户端
      // 切集流程中不会连环触发。
      flushPendingForceComplete()
    }

    /**
     * 补发切集间隙丢失的 next：forceComplete 在 dur 未就绪时记 pending 并停了
     * progress timer（applyProgress 不再跑），因此补发点必须挂在"时长就绪"的
     * 独立触发路径上：onPlayerPlaying / onPlayerDurationChanged / applyProgress
     * （timer 重启后每 tick）三处都调用，保证任意路径都能补发。
     */
    const flushPendingForceComplete = () => {
      const dur = curDuration.value
      if (pendingForceComplete && dur > 0) {
        pendingForceComplete = false
        curProgress.value = dur
        progressPercent.value = 100
        progressText.value = fmtTime(dur)
        syncSeekBarProgress(dur)
        console.log('[casting] 时长就绪 → 补发 next（切集间隙按键未丢）')
        sendRemoteEvent(DLNA_REMOTE_EVENT.NEXT, {})
      }
    }

    const startProgressTimer = () => {
      clearInterval(progressTimer)
      // 播完兜底状态（每次重启定时器即重置，重播/换集不受影响）
      let stallTick = 0
      let endNotified = false
      progressTimer = setInterval(() => {
        try {
          const { dur: rawDur, pos } = readProgress()
          applyProgress(rawDur, pos)
          // 播完兜底（不依赖 video ended 事件）：
          // 部分 mp4（抖音 ott_cast 投屏 URL）在 HTML5 video 播到末尾不触发
          // ended → onPlayerCompleted 不执行 → 不上报"超过时长"的 position →
          // 客户端判定未播完 → 不切集、进度停末尾。
          // 判定：pos 到达 dur-500ms 内连续 2 tick 即视为播完（不要求停滞——
          //   HLS/seek 时 currentTime 末尾抖动幅度可达数百 ms，停滞检测会被
          //   抖动重置；只要 pos 稳定在末尾区域内即可）。
          // 暂停场景由 onPlayerPaused 停定时器兜住，不会误判。
          //
          // ⚠️ 勿用每次 readProgress 的裸 pos / dur 做判定：
          //   短视频/ott_cast 播完瞬间 manager.getCurrentPosition()/getDuration()
          //   会失效返回 0/NaN（Me() 抖动），若用裸 pos，假 0 会把 stallTick 反复
          //   清零 → 永远攒不到 2 → 播完兜底不触发 → 不切集、进度恒 ==dur。
          //   因此进度用"倒退保护后的有效值" curProgress（假 0 已被 applyProgress
          //   过滤且不再回写），时长用已缓存的 curDuration 兜底（播完后 dur 失效时
          //   不闪 0、不回退，稳定保持真实总时长）。
          // 触发后【停止定时器锁死进度】：AvTransport pos 稳定保持 dur+1000，
          // 客户端多轮轮询稳定看到 RelTime>TrackDuration → 必然判定播完切集。
          const dur = rawDur > 0 ? rawDur : (curDuration.value > 0 ? curDuration.value : rawDur)
          const effectivePos = curProgress.value >= 0 ? curProgress.value : pos
          if (dur > 0 && effectivePos >= dur - 500) {
            stallTick++
            if (stallTick >= 2 && !endNotified) {
              endNotified = true
              console.log('[casting] 播完兜底 → 锁进度并上报 position=', dur + 1000)
              sendRemoteEvent(DLNA_REMOTE_EVENT.POSITION, { position: dur + 1000 })
              stopProgressTimer()
            }
          } else {
            stallTick = 0
          }
        } catch (e) {}
      }, 1000)
    }

    const stopProgressTimer = () => {
      clearInterval(progressTimer)
      progressTimer = -1
    }

    // 播放器是否已初始化（首次起播 onPlayerInitialized 置位；切集换源依据——
    // playMediaList 只在首次创建 view，切集须用 playMediaSourceList 换 src）
    let playerInited = false

    const onPlayerInitialized = () => {
      console.log('[casting] onPlayerInitialized')
      playerInited = true
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
      // 立即上报 duration（getDuration 稳定，让客户端尽快有 TrackDuration）。
      // ⚠️ 不在 playing 事件里立即上报 position：ESPlayerManager 内部 Me()
      // 在 playing 触发瞬间可能返回 null → 0，偶发假 0 会把 AvTransport pos
      // 重置、客户端进度条恒 0。position 由定时器轮询上报（播放状态稳定后
      // 返回真实值）；Rust 侧 RelTime 毫秒小数（00:00:00.226）也能让客户端
      // 在 <1s 时就看到非零进度，无需立即上报。
      const manager = playerManagerRef.value
      if (manager) {
        try {
          const d = Number(manager.getDuration())
          if (isFinite(d) && d > 0 && d !== curDuration.value) {
            curDuration.value = d
            durationText.value = fmtTime(d)
            syncSeekBarMax(d)
            sendRemoteEvent(DLNA_REMOTE_EVENT.DURATION, { duration: d })
          }
        } catch (e) {}
      }
      // 切集间隙按键补发（onPlayerPlaying 是"时长就绪"的可靠触发点——
      // forceComplete 停掉 progress timer 后，此事件重启 timer 并补发）
      flushPendingForceComplete()
      // 进度同步定时器（对齐 xiaoyoucast dlna-play 的 startProgressTimer）：
      // 主动轮询 getCurrentPosition/getDuration 上报，不依赖 callback 时序
      //（web 端 ESPlayerManager 的 setProgressCallback 可能在播放器组件
      //  未就绪时错过设置 → 进度/时长不上报，DLNA 客户端进度条不动）。
      startProgressTimer()
    }

    const onPlayerPaused = () => {
      console.log('[casting] onPlayerPaused')
      playing.value = false
      // 暂停即停止进度上报：避免 pos 停滞在末尾时误触发播完兜底；
      // 恢复播放时 onPlayerPlaying → startProgressTimer 重启（lastPos/stallTick 全新）。
      // 同时上报 pause 让客户端 GetTransportInfo 显示 PAUSED_PLAYBACK。
      stopProgressTimer()
      sendRemoteEvent(DLNA_REMOTE_EVENT.PAUSE, {})
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
      // 进度条复位
      const sb = seekBarRef.value
      if (sb) {
        try {
          if (typeof sb.setMaxProgress === 'function') sb.setMaxProgress(0)
          if (typeof sb.setProgress === 'function') sb.setProgress(0)
        } catch (e) {}
      }
    }

    const onPlayerDurationChanged = (d: number) => {
      console.log('[casting] onPlayerDurationChanged:', d)
      if (d > 0) {
        curDuration.value = d
        durationText.value = fmtTime(d)
        syncSeekBarMax(d)
        sendRemoteEvent(DLNA_REMOTE_EVENT.DURATION, { duration: d })
        // 切集间隙按键补发（onPlayerDurationChanged 也是"时长就绪"触发点）
        flushPendingForceComplete()
      }
    }

    const onPlayerProgressChanged = (p: number) => {
      // seek 预览中：进度条/时间由组件 seek 目标驱动，真实进度回调不覆盖 UI、
      // 不上报（暂停态一般无 timeupdate，防御性保护）
      if (seeking.value) return
      curProgress.value = p
      progressText.value = fmtTime(p)
      if (curDuration.value > 0) {
        progressPercent.value = Math.min(100, (p / curDuration.value) * 100)
      }
      syncSeekBarProgress(p)
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
      clearSeekState()
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
      clearSeekState()
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
        // 同 url：区分"重投同源恢复播放"与"重复事件幂等"——
        // 换集后 overlay 缓存补发可能重复送达同一 url，若此时正在播放，
        // start(0) 会把刚 initPlay 的新视频重置回开头（假象"还在播上一集"）。
        // 正在播 → 忽略（幂等）；已停止/暂停 → 恢复播放（手机端重投同源）。
        if (playing.value) {
          console.log('[casting] 同 url 且正在播放，忽略重复 playerUrl（幂等）', url.slice(0, 60))
          return
        }
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
      // 切集兼容：换集 Play(新 url) 到达 → 取消 onDlnaStop 的延迟退出
      if (stopExitTimer !== -1) {
        clearTimeout(stopExitTimer)
        stopExitTimer = -1
        console.log('[casting] 切集新视频到达，取消延迟退出')
      }
      initPlay(url)
      // 切集/重播后显式启动进度定时器（不依赖 onPlayerPlaying 是否触发）：
      // 播完兜底锁死定时器后切集，若播放器未重新派发 playing 事件，定时器
      // 不会自动重启 → AvTransport pos 停留在 0 → 客户端进度条不更新。
      startProgressTimer()
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
      // 切集兼容（2026-08-25 实测）：iPhone 抖音切集流程为 Stop→SetAVTransportURI→Play。
      // ① **不能立即 manager.stop()**——切集 Play(新 url) 在 ~100ms 内到达，播放器
      //   先被 stop 后 initPlay(playMediaList) 可能起不来（状态残留），表现为
      //   "客户端已切集但 tvcast 还停在上一个视频"。播放器停止延迟到退出确认时再做。
      // ② 延迟退出窗口（2000ms，2026-08-25 实测加长）：抖音**自动投下一条**时
      //   Stop→SetAVTransportURI→Play 的间隔可能远超 400ms，窗口太短页面先退出，
      //   下一条 Play 到达时页面已销毁（重建页面有闪屏/播放器重建开销）。
      //   2000ms 覆盖自动连播间隔；窗口内新 url 到达由 onDlnaPlay 取消退出 + 换源。
      sendRemoteEvent(DLNA_REMOTE_EVENT.STOP, {})
      clearTimeout(stopExitTimer)
      stopExitTimer = setTimeout(() => {
        stopExitTimer = -1
        // 统一走 stopAndExit（幂等 + router.back() 退出路由页），避免与
        // onESStop 的 stopAndExit 各退一次把 launcher 也退出
        stopAndExit()
      }, 2000)
    }

    // ---------- 快进/快退 seek（组件事件驱动，对齐 xiaoyoucast 契约） ----------
    /**
     * seek 目标范围保护：0 ~ 真实时长。不做尾部回退——拖拽到头（组件 progress 可达
     * maxProgress=时长）就精确 seek 到该位置，seekTo 后恢复播放自然播到末尾触发播完
     * （用户拖到头就是想看结尾，观感不应倒退几秒）。播放完成由 onPlayerCompleted
     * 统一兜底（上报 dur+1000 + 1.2s 后 STOP），无需在 seek 阶段预留尾部。
     */
    const clampSeekTarget = (ms: number): number => {
      const dur = curDuration.value
      if (dur > 0) return Math.max(0, Math.min(ms, dur))
      return Math.max(0, ms)
    }

    /** 组件 emit onSeekStart(progress)：seek 开始 → 暂停播放并上报（对齐 xiaoyoucast onSeekBarSeekStart）。
     *  注意：qt-seek-bar 的 startSeek 在每次 keydown（含系统长按自动重复）都会 emit onSeekStart，
     *  只有【首次进入 seek 态】才记录 wasPlayingBeforeSeek 并暂停——否则重复 keydown 会把
     *  wasPlayingBeforeSeek 覆盖成 false（首次 pause 后 playing.value 已为假），导致松手
     *  onSeekStop 时误判"seek 前未在播放"而不恢复播放。 */
    const onSeekStart = (p: number) => {
      if (!seeking.value) {
        wasPlayingBeforeSeek = playing.value
        seeking.value = true
        if (wasPlayingBeforeSeek) {
          const manager = playerManagerRef.value
          if (manager) {
            try {
              manager.pause()
              playing.value = false
              sendRemoteEvent(DLNA_REMOTE_EVENT.PAUSE, {})
            } catch (e) {}
          }
        }
        // 停掉真实进度定时器：避免 1s 轮询上报真实 position 干扰 seek（组件进度由
        // setProgress 驱动）；也避免 seek 值接近末尾时误触发播完兜底
        stopProgressTimer()
      }
      if (p >= 0) {
        progressText.value = fmtTime(p)
        if (curDuration.value > 0) {
          progressPercent.value = Math.min(100, (p / curDuration.value) * 100)
        }
      }
      console.log('[casting] onSeekStart:', p)
    }

    /** 组件 emit onSeekStop(progress)：seek 结束 → 真正 seekTo + 上报 + 恢复播放 */
    const onSeekStop = (p: number) => {
      seeking.value = false
      const target = clampSeekTarget(p >= 0 ? p : curProgress.value)
      const manager = playerManagerRef.value
      if (manager) {
        try {
          manager.seekTo(target)
          console.log('[casting] onSeekStop → seekTo', target)
        } catch (e) {
          console.warn('[casting] seekTo error:', e)
        }
      }
      // 更新本地基准（倒退保护基准跟进，避免 seek 后首轮真实进度被误判倒退）
      curProgress.value = target
      progressText.value = fmtTime(target)
      if (curDuration.value > 0) {
        progressPercent.value = Math.min(100, (target / curDuration.value) * 100)
      }
      sendRemoteEvent(DLNA_REMOTE_EVENT.POSITION, { position: target })
      if (wasPlayingBeforeSeek) {
        seekResumeTimer = setTimeout(() => {
          seekResumeTimer = -1
          if (isStopped) return
          try {
            manager.start(0)
            playing.value = true
            loading.value = false
            sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
            // 兜底启动进度定时器（不依赖 onPlayerPlaying 是否触发）
            startProgressTimer()
          } catch (e) {}
        }, 120)
      }
    }

    /** 组件 emit onSeekChanged(progress)：拖动/步进中进度预览（触摸拖动场景，电视步进也走 setProgress） */
    const onSeekChanged = (p: number) => {
      if (p >= 0) {
        progressText.value = fmtTime(p)
        if (curDuration.value > 0) {
          progressPercent.value = Math.min(100, (p / curDuration.value) * 100)
        }
      }
    }

    /** 组件 emit onFocusChanged(focused)：聚焦时高亮提示可操作 */
    const onSeekbarFocusChanged = (focused: boolean) => {
      seekBarFocused.value = focused
    }

    /** 切集/停止/退出时清理 seek 状态 */
    const clearSeekState = () => {
      if (seekResumeTimer !== -1) {
        clearTimeout(seekResumeTimer)
        seekResumeTimer = -1
      }
      seeking.value = false
      // 组件复位（未在 seek 态时无副作用）
      const sb = seekBarRef.value
      if (sb && typeof sb.stopSeek === 'function') {
        try {
          sb.stopSeek()
        } catch (e) {}
      }
    }

    // ---------- TV 遥控控制条 ----------
    const onTogglePlay = () => {
      const manager = playerManagerRef.value
      if (!manager) return
      // seek 结束恢复播放的延迟定时器未执行前用户手动按 OK：取消自动恢复，
      // 交给下面的播放/暂停逻辑处理，避免 120ms 后二次 start
      if (seekResumeTimer !== -1) {
        clearTimeout(seekResumeTimer)
        seekResumeTimer = -1
      }
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
          // 兜底启动进度定时器（对齐 onDlnaPlay 的做法）
          startProgressTimer()
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
      // 幂等（2026-08-25 实测）：Esc → onKeyDown 兜底 + onBackPressed 双通道触发，
      // 页面卸载又触发 onESStop → stopAndExit 可能被调用多次，每次 router.back()
      // 都会退一层——二次 back 会把 launcher 也退掉（应用整体白屏）。只执行一次。
      if (isStopped) return
      isStopped = true
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
      clearSeekState()
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

    // ---------- 下键：通知抖音进度到头，触发自动切下一集 ----------
    // 原理：抖音连续剧投屏靠轮询 GetPositionInfo 判断"当前集播完"
    //（RelTime >= TrackDuration 阈值）→ 自动 SetAVTransportURI 下一集 + Play。
    // TV 端按下键时，把 position 上报为总时长，抖音下次轮询即判定播完 → 换集。
    //（lastForceComplete 声明在 setup 顶部，initPlay 换集时重置）
    const forceComplete = () => {
      // seek 预览中按下键：先落位 seek（避免切集与 seek 定时器并发冲突）
      clearSeekState()
      const dur = curDuration.value // 毫秒（可能为 0：切集后新集时长未就绪）
      const now = Date.now()
      if (now - lastForceComplete < 1500) return // 防抖：抖音轮询周期 ~1s
      lastForceComplete = now
      // 锁定进度同步：停掉真实进度上报，避免下一轮 position 覆盖"到头"值
      // 造成抖音判定竞态（刚判定播完又被真实进度拉回）。
      // 抖音 SetAVTransportURI 换集后 position 重置 0，播放新集时
      // onPlayerPlaying 会重新 startProgressTimer。
      stopProgressTimer()
      if (dur > 0) {
        curProgress.value = dur
        progressPercent.value = 100
        progressText.value = fmtTime(dur)
      } else {
        // dur 未就绪（切集间隙/新集 loading）→ 记 pending，等时长就绪后
        // 由 applyProgress 补发 next + UI 置总进度（否则按键无任何反馈，
        // 表现为"当前进度跟着播放进度走"）。
        pendingForceComplete = true
        console.log('[casting] 下键 → dur 未就绪，等时长就绪后补发 next')
      }
      // 发 next 事件（复用 xiaoyoucast 契约，不新增事件名）——Rust 侧在
      // GetPositionInfo 响应时渐进处理：客户端上次回报 <1s 先给 2s 过渡值
      // 确认在播，之后持续返回总时长（不能只返回一次——下一轮回退到真实
      // 进度会被抖音判定"进度倒退"而不切集），直到抖音 SetAVTransportURI
      // 换集或 20s 超时兜底。上层（前端）感知不到客户端轮询节奏。
      sendRemoteEvent(DLNA_REMOTE_EVENT.NEXT, {})
      console.log('[casting] 下键 → 发 next（Rust 渐进持续导向总时长）')
    }

    /**
     * 按键处理（纯快应用契约，无 window/DOM hack）：
     * 真机由框架（页面实例机制）调用；web-renderer 经 TVFocusManager
     * _callCurrentPageMethod 回调，携带 ESKeyEvent（{keyCode, key, repeat, ...}）。
     * 返回 true = 事件已消费（等价真机 View 拦截）。
     *  keyCode：DPAD_LEFT=21 / DPAD_RIGHT=22 → seekbar 聚焦时快退/快进（长按连续）
     *          DPAD_CENTER=23 / ENTER=66 / MEDIA_PLAY_PAUSE=85 → 播放/暂停
     *          DPAD_DOWN=20 → 抖音切下一集
     * 注意：不过滤 repeat——qt-seek-bar 组件 startSeek 每次调用只步进一格，
     * 长按连续快进依赖系统 keydown 自动重复驱动（组件内部 seekCount 加速）。
     */
    const onKeyDown = (keyEvent: any): boolean => {
      // 兼容两种调用形态：es3 框架传 ESKeyEvent 对象；历史调用可能传裸 keyCode
      const kc = typeof keyEvent === 'number' ? keyEvent : Number(keyEvent?.keyCode)
      const sb = seekBarRef.value
      const seekbarFocused = !!sb && typeof sb.isSeekBarFocused === 'function' && sb.isSeekBarFocused()
      if (kc === 21 || kc === 22) {
        // 仅 seekbar 聚焦且时长已知（非直播/流式）时消费左右键做快进/快退
        if (seekbarFocused && curDuration.value > 0) {
          try {
            sb.startSeek(kc === 22)
          } catch (e) {}
          return true
        }
        return false // 未聚焦 seekbar：不消费，交给焦点系统移动焦点
      }
      if (kc === 23 || kc === 66 || kc === 85 || kc === 13) {
        if (seekbarFocused) {
          onTogglePlay()
          return true
        }
        return false // 未聚焦 seekbar：不消费（如焦点在按钮上时触发按钮点击）
      }
      if (kc === 20 || kc === 40) {
        forceComplete()
        return true
      }
      return false
    }

    /** 按键抬起：左右键松手 → 组件 stopSeek（emit onSeekStop → 真正 seekTo） */
    const onKeyUp = (keyEvent: any): boolean => {
      const kc = typeof keyEvent === 'number' ? keyEvent : Number(keyEvent?.keyCode)
      if (kc === 21 || kc === 22) {
        const sb = seekBarRef.value
        if (sb && typeof sb.stopSeek === 'function') {
          try {
            sb.stopSeek()
          } catch (e) {}
        }
        return true
      }
      return false
    }

    /**
     * 返回键（框架回调：web-renderer 先分发 App 根级组件 onBackPressed，返回 true
     * 即消费，不再派发底层页面）：投屏中按返回 = 断开投屏：停播 + 上报 stop + 收起播放层。
     */
    const onBackPressed = (): boolean => {
      console.log('[casting] onBackPressed → 断开投屏')
      stopAndExit()
      return true
    }

    /** 页面被切到后台（Home/切应用）：同样停播断开，防止静默继续占网/出声 */
    const onESStop = () => {
      console.log('[casting] onESStop → 断开投屏')
      stopAndExit()
    }

    // ---------- 生命周期 ----------
    let removeActionListener: (() => void) | null = null
    let removeControlListener: (() => void) | null = null

    /** 用投屏参数起播（同 URL 已在播则跳过，防 onESCreate/onMounted 双触发重播） */
    const playWithParams = (params: any): boolean => {
      const url = params && params.url
      if (!url) return false
      if (url === cUrl && playing.value) return true
      if (params.source) source.value = params.source as string
      if (params.title) title.value = params.title as string
      initPlay(url)
      return true
    }

    const initPlaySource = () => {
      // props 直传（兼容）
      if (props.url) {
        if (props.title) title.value = props.title
        initPlay(props.url)
        return
      }
      // route.params
      const params: any = (route && route.params) || {}
      if (playWithParams(params)) return
      // 模块级待播参数兜底（App.vue 收到 playerUrl 时写入，防 push 时序丢参）
      const pending = getPendingPlay()
      if (pending && pending.url) {
        if (pending.title) title.value = pending.title
        initPlay(pending.url)
      }
    }

    /** 路由页创建回调（es3-router 创建页面时注入 route.params） */
    const onESCreate = (params: any) => {
      console.log('[casting] onESCreate:', params)
      playWithParams(params)
    }

    /** 路由页重复打开回调（SINGLE_TASK：新投屏/换源 URL 重播） */
    const onESNewIntent = (params: any) => {
      console.log('[casting] onESNewIntent:', params)
      playWithParams(params)
    }

    onMounted(() => {
      console.log('[casting] mounted')
      // 初始化进度条组件（模式/样式/thumb），聚焦落在 seekbar 上
      initSeekBar()
      // 路由页模式参数由 onESCreate 注入；此处兜底（框架未回调 onESCreate 的环境）
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
      // 按键处理走页面实例回调（onKeyDown/onKeyUp/onBackPressed，框架分发，
      // web-renderer 经 TVFocusManager._callCurrentPageMethod 调用；真机由原生
      // 页面实例机制调用）——不使用 window/DOM hack，业务层与真机同一契约。
    })

    onUnmounted(() => {
      if (removeActionListener) removeActionListener()
      if (removeControlListener) removeControlListener()
      clearTimeout(stopDelayTimer)
      clearTimeout(stopExitTimer)
      clearTimeout(playMediaTimer)
      stopProgressTimer()
      clearSeekState()
    })

    return {
      rootRef,
      playerManagerRef,
      seekBarRef,
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
      seeking,
      seekBarFocused,
      onSeekStart,
      onSeekStop,
      onSeekChanged,
      onSeekbarFocusChanged,
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
      onKeyDown,
      onKeyUp,
      onBackPressed,
      onESCreate,
      onESNewIntent,
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
.ctrl-btn:focus,
.ctrl-btn:hover {
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

/* 进度条（qt-seek-bar 组件，TVSeekBarViewComponent 渲染） */
.seekbar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 620px;
  margin-left: 30px;
}
.seek-bar {
  width: 620px;
  height: 60px;
}
.seek-time-text {
  font-size: 22px;
  color: #c7d2ea;
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}
</style>
