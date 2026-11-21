<template>
  <!-- 全屏覆盖层（App 根级组件，非路由页面）：
       控制条按钮与进度条均为 focusable（对齐真机 Hippy 焦点契约，web-renderer
       按 Android 焦点树语义收集覆盖层内焦点元素）；进度条 autofocus 获得初始
       焦点（对齐 xiaoyoucast：seekbar 聚焦后左右键=快进快退、OK=播放/暂停）。
       左右/OK/下键在捕获阶段拦截（等价于真机 onKeyDown 返回 true 阻断框架），
       防止焦点系统把按键移动/点击到底层页面元素。 -->
  <div class="casting-root" ref="rootRef" :focusable="false" @click="onRootClick">
    <!-- 投屏播放层：ESPlayerManager 管理 ESVideoPlayer（web 端 = HTML5 video）。
         ⚠️ 图片投屏时**不卸载**它（不加 v-if）：卸载后切回视频要重建播放器组件，
         而 initPlay 是同步流程，那一刻 ref 仍是 undefined（组件下一轮渲染才创建）
         → 视频永远起不来（Playwright 实证 ⑩ 图→视频切回 video=0）。
         常驻即可：图片层放在它后面（DOM 顺序=绘制顺序）自然盖在上层，无需 z-index。 -->
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

    <!-- 图片投屏层：被投内容是图片时盖在播放器之上（华为图库「投屏播放」推的是
         JPEG，用 <video> 播必然 error → 兜底 stop → 手机端显示「投屏失败」）。
         位置必须在播放器之后：web-renderer 无 z-index 时按 DOM 顺序绘制。 -->
    <cast-image-layer v-if="isImage" :url="imageUrl" @error="onImageError" />

    <!-- loading -->
    <div class="loading-mask" v-if="loading" :focusable="false">
      <div class="loading-spinner" :focusable="false"></div>
      <span class="loading-text" :focusable="false">正在投屏中…</span>
    </div>

    <!-- 播放错误 -->
    <div class="error-mask" v-if="errorText" :focusable="false">
      <span class="error-text" :focusable="false">{{ errorText }}</span>
    </div>

    <!-- 设计稿 03 屏：双层渐变 scrim（顶部 90deg / 底部 180deg，评审定稿）。
         所有控制 UI 挂在 scrim 上，亮画面下可读。
         控制层自动隐藏（2026-09-13）：播放中 5s 无操作整层隐藏；任意按键/点击/seek
         交互唤醒；暂停/停止/错误时保持可见。
         ⚠️ 隐藏用 opacity 而非 v-show：实测 web-renderer 对 div 的 v-show
         （display:none）不生效（Hippy 布局引擎强制 display），opacity 跨运行时可靠。
         隐藏期间按键全部被 onKeyDown 唤醒分支消费，不会落到不可见元素上。 -->
    <template v-if="!errorText">
      <div
        class="controls-layer"
        name="controlsLayer"
        :style="{ opacity: controlsVisible ? 1 : 0 }"
        :focusable="false"
      >
      <!-- name 属性必加：web-renderer 渲染的 DOM 不保留业务 class 名，
           自动化验收/诊断一律按 [name=...] 定位（与导航轨/磁贴同一约定） -->
      <div class="scrim-top" name="scrimTop" :focusable="false"></div>
      <div class="scrim-bottom" name="scrimBottom" :focusable="false"></div>

      <!-- 左上一行：返回圆钮 +「正在投屏」胶囊 + 标题 + 来源（2026-09-13 陈兄：
           纵排三层太高，收成单行垂直居中；标题超宽省略号，不挤压右侧） -->
      <div class="head-cluster" name="headCluster" :focusable="false">
        <div class="back-btn" :focusable="false" eventClick name="castBack" @click="onStop">
          <img class="back-ico" :src="icons.back" :focusable="false" />
        </div>
        <div class="live-pill" name="livePill" :focusable="false">
          <div class="live-dot" :class="{ paused: !playing }" :focusable="false"></div>
          <span class="live-text" :focusable="false">正在投屏</span>
        </div>
        <span class="cast-title" name="castTitle" :focusable="false">{{ title || '投屏播放中' }}</span>
        <span class="cast-source" name="castSource" :focusable="false">{{ source }}</span>
      </div>

      <!-- 右上信息胶囊（只放真实数据：分辨率取不到就整颗隐藏，不做假值） -->
      <div class="info-pills" name="infoPills" :focusable="false">
        <div class="pill" v-if="resolutionText" name="pillResolution" :focusable="false">
          <span class="pill-text" :focusable="false">{{ resolutionText }} · DLNA</span>
        </div>
        <div class="pill" name="pillElapsed" :focusable="false">
          <span class="pill-text" :focusable="false">已投屏 {{ elapsedText }}</span>
        </div>
      </div>

      <!-- 右栏「投屏信息」卡已移除（2026-09-13 陈兄：电视上信息重复且挡画面；
           标题/来源/分辨率/时长在左上单行与右上胶囊里都有） -->

      <!-- 控制条（设计稿 992×90 居中悬浮；遥控器契约不变：seekbar 聚焦 →
           左右键快进/快退、OK 播放/暂停、下键切集；按钮仅鼠标/触屏用） -->
      <div
        class="control-bar"
        name="controlBar"
        :focusable="false"
        :style="controlBarStyle"
      >
        <!-- 播放/暂停用字形而非图标：设计稿是「白底橙图标」，
             远端图标是白色 SVG（Hippy 无法上色），换图会看不见。 -->
        <div class="ctrl-btn" v-if="!isImage" :focusable="false" eventClick name="play" @click="onTogglePlay">
          <span class="ctrl-glyph" :focusable="false">{{ playing ? '❚❚' : '▶' }}</span>
        </div>
        <!-- 进度组：轨道在上、时间在下（设计稿 04 屏），整体固定 694 宽。
             clipChildren=false：seekbar 聚焦时 scale(1.05) 外溢，避免左圆角被裁平。 -->
        <div class="seekbar-wrap" v-if="!isImage" :focusable="false" :clipChildren="false">
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
        <div class="ctrl-btn ctrl-btn-ghost" v-if="!isImage" :focusable="false" eventClick name="mute" @click="onToggleMute">
          <img class="ctrl-ico" :src="muted ? icons.volumeMute : icons.volumeHigh" :focusable="false" />
        </div>
        <div class="stop-btn" :focusable="false" eventClick name="stop" @click="onStop">
          <img class="ctrl-ico stop-ico" :src="icons.stop" :focusable="false" />
          <span class="stop-text" :focusable="false">停止投屏</span>
        </div>
      </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, markRaw, ref, computed, onMounted, onUnmounted } from 'vue'
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
  resolveMediaType,
  DlnaPlayPayload,
  DlnaMediaType,
} from '../../tools/dlna-bridge'
import CastImageLayer from '../../components/cast-image-layer.vue'
import { ICON_BASE } from '../../styles/tokens'

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
 *  - 图片分支（2026-09-13 新增）：被投内容为图片时改用 cast-image-layer 渲染，
 *    播放器完全不参与。华为图库「投屏播放」推的是 JPEG
 *    （.../upnp/service/local/<id>/0/0.jpg，DIDL class=object.item.imageItem.photo），
 *    旧实现一律走 <video> → 加载 jpg 必然 error → 本页兜底上报 stop →
 *    手机端显示「投屏失败」（真机实测 4 连败即此因）。媒体类型由 Rust 侧
 *    dlna/media_kind.rs 判定，经 dlna://play.mediaType → ACTION_DLNA → 本页。
 *  - 状态上报：play/pause/stop/position/duration 经 sendRemoteEvent 回传 Rust
 *    DLNA DMR（AvTransport 状态机）→ 手机端进度条/状态跟随。
 *    ⚠️ 图片态的渲染失败**不**上报 stop：主动断开会把「电视解不了这张图」
 *    变成手机端的「投屏失败」，正是上述 Bug 的成因。
 *  - 进度同步：onPlayerDurationChanged/onPlayerProgressChanged（web 端 timeupdate
 *    驱动，position 节流 1s 上报）→ 手机端 GetPositionInfo。
 *  - 播放控制：下行 ACTION_DLNA_STATUS（手机端遥控 play/pause/stop/seekTo）
 *    → seekTo/pause/stop/start；上行 TV 遥控播放/暂停/断开 → sendRemoteEvent。
 */
export default defineComponent({
  name: 'CastingPage',
  // 图片投屏层按职责单独成文件（本页已超 800 行硬阈值，不再往里堆渲染逻辑）
  components: { CastImageLayer },
  props: {
    /** 覆盖层模式：被投资源 URL */
    url: { type: String, default: '' },
    /** 覆盖层模式：标题 */
    title: { type: String, default: '' },
    /** 覆盖层模式：媒体类型（video/audio/image，Rust 侧判定下发；空则按扩展名兜底） */
    mediaType: { type: String, default: '' },
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

    // ---------- 批 1 UI 状态：分辨率胶囊 / 已投屏时长 / 图标 ----------
    /** 真实分辨率文案（1080P / 720P / 4K）；取不到保持 ''，胶囊整体隐藏，不做假值 */
    const resolutionText = ref('')
    /** 已投屏时长（会话墙钟时间，从本层挂载起算） */
    const elapsedText = ref('00:00')
    const castStartAt = Date.now()
    let elapsedTimer: any = -1
    let sizeTimer: any = -1
    let sizeTries = 0

    const icons = {
      back: `${ICON_BASE}/ctrl-back.svg`,
      play: `${ICON_BASE}/ctrl-play.svg`,
      pause: `${ICON_BASE}/ctrl-pause.svg`,
      stop: `${ICON_BASE}/ctrl-stop.svg`,
      volumeHigh: `${ICON_BASE}/ctrl-volume-high.svg`,
      volumeMute: `${ICON_BASE}/ctrl-volume-mute.svg`,
      volumeLow: `${ICON_BASE}/ctrl-volume-low.svg`,
      prev: `${ICON_BASE}/ctrl-prev.svg`,
      next: `${ICON_BASE}/ctrl-next.svg`,
      fullscreen: `${ICON_BASE}/ctrl-fullscreen.svg`,
    }

    // ---------- 控制层自动隐藏（2026-09-13）：播放中 5s 无操作 → 整层隐藏 ----------
    // 规则：
    //  - 起播/恢复播放（onPlayerPlaying）起算 5s，到点且仍在播放 → controlsVisible=false；
    //  - 任意用户操作（遥控按键/鼠标点击/seek 交互）→ wakeControls()：立即显示并重新计时；
    //  - 暂停/停止/播完/出错时保持显示，不计时（onPlayerPaused 清定时器并强制显示）；
    //  - 隐藏时焦点树随 display:none 摘除（v-show），唤醒后 requestFocus 把焦点还给
    //    seekbar，遥控契约（左右=快进快退、OK=播放暂停、下=切集）不变。
    const HIDE_DELAY_MS = 5000
    const controlsVisible = ref(true)
    let controlsHideTimer: any = -1

    /** 播放中起算 5s 隐藏定时器（重复调用安全：先清旧定时器） */
    const scheduleControlsHide = () => {
      clearTimeout(controlsHideTimer)
      controlsHideTimer = -1
      if (!playing.value) return
      controlsHideTimer = setTimeout(() => {
        controlsHideTimer = -1
        if (playing.value && !errorText.value) {
          controlsVisible.value = false
          console.log('[casting] 播放中 5s 无操作 → 隐藏控制层')
        }
      }, HIDE_DELAY_MS)
    }

    /** 用户操作唤醒：显示控制层 + 重新计时；refocus=true 时补一次 seekbar 聚焦
     *  （opacity 方案下 seekbar 仍在焦点树，此项为兜底；隐藏期间按键全被
     *  onKeyDown 唤醒分支消费，不会误触不可见元素） */
    const wakeControls = (refocus = false) => {
      controlsVisible.value = true
      scheduleControlsHide()
      if (refocus) {
        setTimeout(() => {
          const sb = seekBarRef.value
          if (sb && typeof sb.requestFocus === 'function') {
            try {
              sb.requestFocus()
            } catch (e) {}
          }
        }, 200)
      }
    }

    /** 暂停/停止/播完/出错：保持显示并取消隐藏计时 */
    const showControlsSteady = () => {
      clearTimeout(controlsHideTimer)
      controlsHideTimer = -1
      controlsVisible.value = true
    }

    /** 鼠标/触屏点击画面任意处（含控制层空白区）= 用户操作，唤醒控制层 */
    const onRootClick = () => {
      wakeControls(false)
    }

    /**
     * 读真实视频分辨率。
     * 契约：ESVideoPlayer/ESPlayerManager 的 getMediaMeta() 返回 **Promise**
     * （内部经 callUIFunction 回调包装，web 端由 IJKPlayerComponent 返回
     * {duration, width, height}；真机由原生实现）。
     * ⚠️ 不能同步读：拿到的是 Promise 对象，meta.width 是 NaN（与 localStorage
     * 异步坑同族——同步读 Promise 一律拿不到业务值）。
     * 全部防御性调用，拿不到返回 0 —— UI 侧以 '' 处理（隐藏胶囊），绝不编造。
     */
    const readVideoSize = async (): Promise<{ w: number; h: number }> => {
      const manager: any = playerManagerRef.value
      if (!manager) return { w: 0, h: 0 }
      // ① manager 直读（内部委托当前播放器）
      try {
        if (typeof manager.getMediaMeta === 'function') {
          const meta = await Promise.resolve(manager.getMediaMeta())
          const w = Number(meta && meta.width)
          const h = Number(meta && meta.height)
          if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { w, h }
        }
      } catch (e) {}
      // ② 兜底：player 实例的同名 Promise API
      try {
        const p = manager.getPlayer?.()
        if (p && typeof p.getMediaMeta === 'function') {
          const meta = await Promise.resolve(p.getMediaMeta())
          const w = Number(meta && meta.width)
          const h = Number(meta && meta.height)
          if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { w, h }
        }
      } catch (e) {}
      return { w: 0, h: 0 }
    }

    const resolutionLabel = (h: number): string => {
      if (h >= 2160) return '4K'
      if (h >= 1080) return '1080P'
      if (h >= 720) return '720P'
      if (h >= 480) return '480P'
      return h > 0 ? `${h}P` : ''
    }

    /** 轮询分辨率（前 15s 每秒一次；loadedmetadata 后 getMediaMeta 才有值） */
    const startSizePoll = () => {
      stopSizePoll()
      sizeTries = 0
      sizeTimer = setInterval(async () => {
        sizeTries++
        const { h } = await readVideoSize()
        if (h > 0) {
          resolutionText.value = resolutionLabel(h)
          stopSizePoll()
        } else if (sizeTries >= 15) {
          stopSizePoll()
        }
      }, 1000)
    }
    const stopSizePoll = () => {
      clearInterval(sizeTimer)
      sizeTimer = -1
    }

    /** 已投屏时长每秒刷新（会话级，不从换集重置） */
    elapsedTimer = setInterval(() => {
      elapsedText.value = fmtTime(Date.now() - castStartAt)
    }, 1000)
    const curProgress = ref(-1) // 毫秒；初始 -1 保证首轮 pos=0 也上报（链路从 0 即有数据流）
    const curDuration = ref(0) // 毫秒
    const lastPositionReport = ref(0) // 上次 position 上报时间戳（节流）
    let cUrl = ''
    let isStopped = false
    /**
     * 是否为图片投屏（模板分支 + 各处行为守卫的唯一开关）。
     * 媒体类型由 Rust 侧按 DIDL-Lite/URI 判定后经 mediaType 下发，缺失时
     * resolveMediaType 按 URL 扩展名兜底。'image' → 走 cast-image-layer
     * 图片层：不启播放器、不起进度定时器、渲染失败也不上报 stop
     * （2026-09-13 华为图库「投屏播放」推 JPEG 的修复）。
     */
    const isImage = ref(false)
    /** 图片层当前 URL（cUrl 是普通变量，模板读不到，故另存一份响应式） */
    const imageUrl = ref('')
    /**
     * 控制条样式：视频态 1100×96 居中长条（值取自 CSS，这里显式再写一遍）；
     * 图片态只剩一颗「停止投屏」（无进度/音量）→ 收成 220 并水平居中
     * （left=(1920-220)/2=850）。
     * ⚠️ 两个分支都把尺寸显式写全，不依赖「回落到 CSS 值」——内联样式一旦设过，
     * 切回视频时若只给空对象，框架未必会清除旧的 width/left，控制条会卡在 260。
     * 用 :style 内联而非状态类：web-renderer 构建期把业务 CSS 内联抽取，运行时
     * 按 class 的状态规则不可靠（本文件 controls-layer 的 opacity 同理）。
     */
    const controlBarStyle = computed(() =>
      isImage.value
        ? { left: '850px', width: '220px', justifyContent: 'center', paddingLeft: '0px', paddingRight: '0px' }
        : { left: '410px', width: '1100px', justifyContent: 'flex-start', paddingLeft: '26px', paddingRight: '26px' }
    )
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
        sb.setProgressHeight(12)
        sb.setProgressRadius(6)
        sb.setProgressColor('#FFA32F')
        sb.setProgressDefaultColor('rgba(255,255,255,0.24)')
        // 2026-09-13：单模式枚举走 quicktvui3 标准值（web-renderer 已修正 0/1/2 语义错位）；
        // 白色圆点 thumb 用 thumbWidth/Height=0 隐藏（web-renderer 已允许 0，旧 `||30` 会吞 0）。
        sb.setSeekBarMode(QTSeekBarMode.QT_SEEK_BAR_MODE_SINGLE)
        sb.setThumbWidth(0)
        sb.setThumbHeight(0)
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

    /**
     * 图片投屏起播（华为图库「投屏播放」走这条）。
     *
     * 关键：**播放器全程不参与**。不去 initialize/setVideoPath 指向 JPEG ——
     * web 端 HTML5 video 加载 jpg 必然 error → onPlayerError → 上报 stop →
     * 手机端显示「投屏失败」（2026-09-13 实测 4 连败即此因）。
     * 进度/时长对图片无意义（Rust GetPositionInfo 恒 0/0），但 play 必须上报：
     * 手机端据此把 AvTransport 置为 PLAYING，否则它同样认为投屏失败。
     * 本分支**永不**因渲染问题上报 stop —— 图片在电视上解不了不该让手机端断链。
     */
    const startImagePlay = (url: string) => {
      isImage.value = true
      imageUrl.value = url
      loading.value = false
      playing.value = true
      errorText.value = ''
      // 图片无时间轴：停进度/分辨率轮询，清干净进度文案（胶囊里不留假数据）
      stopProgressTimer()
      stopSizePoll()
      curProgress.value = -1
      curDuration.value = 0
      progressText.value = '00:00'
      durationText.value = '00:00'
      // 视频→图片切换：停掉上一段视频（播放器组件常驻不卸载，只停流；
      // playerInited 保持 true，图片层没有动过播放器实例）。
      try {
        const manager = playerManagerRef.value
        if (manager) manager.stop()
      } catch (e) {}
      sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
      // 对齐视频：图片也算「播放中」，5s 无操作自动收控制层
      wakeControls(false)
      console.log('[casting] 图片投屏起播:', url)
    }

    /** 图片层渲染失败：只记日志 + 本地提示（层内自带提示条），不上报 stop、不弹错误页 */
    const onImageError = (e: any) => {
      console.warn('[casting] 图片未能显示（保持投屏态，不断链）:', e)
    }

    const initPlay = (url: string, mediaType?: DlnaMediaType | string) => {
      if (!url) return
      cUrl = url
      // 媒体类型：Rust 侧按 DIDL-Lite/URI 判定并下发，缺省按 URL 扩展名兜底
      const media = resolveMediaType({ url, mediaType })
      errorText.value = ''
      isStopped = false
      // 换集/重播：分辨率可能变化 → 清空并重新轮询（取不到继续隐藏胶囊）
      resolutionText.value = ''
      // 换集/重播：重置进度基准（applyProgress 倒退保护不误伤新集从 0 起播）
      curProgress.value = -1
      // 换集/重播：重置下键防抖窗口——切集后第一下按键必生效，
      // 不被上次按下（<1.5s 前）的防抖吞掉（"切集后按键无效"根因）。
      lastForceComplete = 0
      // 清间隙补发标志：客户端已切集到达新 url，无需再补发（防连环切集）
      pendingForceComplete = false

      // 图片分支：不碰播放器，直接进图片层
      if (media === 'image') {
        startImagePlay(url)
        return
      }

      // 视频/音频分支：退出图片态（图→视频切换）
      isImage.value = false
      imageUrl.value = ''
      loading.value = true
      startSizePoll()
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
      // 播放中 5s 无操作自动隐藏控制层（从起播/恢复播放起算）
      scheduleControlsHide()
    }

    const onPlayerPaused = () => {
      console.log('[casting] onPlayerPaused')
      playing.value = false
      // 暂停即停止进度上报：避免 pos 停滞在末尾时误触发播完兜底；
      // 恢复播放时 onPlayerPlaying → startProgressTimer 重启（lastPos/stallTick 全新）。
      // 同时上报 pause 让客户端 GetTransportInfo 显示 PAUSED_PLAYBACK。
      stopProgressTimer()
      sendRemoteEvent(DLNA_REMOTE_EVENT.PAUSE, {})
      // 暂停时保持控制层可见（用户大概率要操作），取消隐藏计时
      showControlsSteady()
    }

    const onPlayerStopped = () => {
      console.log('[casting] onPlayerStopped')
      playing.value = false
      loading.value = false
      // 停止后保持控制层可见，取消隐藏计时
      showControlsSteady()
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
      showControlsSteady()
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
      // 图片态守卫（2026-09-13 华为图库投屏失败的直接成因）：
      // 图片不需要播放器，播放器任何错误都不该被当成「投屏失败」上报 stop——
      // 旧实现就是 <video> 加载 jpg 报错 → 这里 stop → 手机端显示投屏失败。
      // 图片层有自己的加载失败提示（底部一行小字），不上报、不断链。
      if (isImage.value) {
        console.warn('[casting] 图片投屏中，忽略播放器错误（不上报 stop）')
        return
      }
      playing.value = false
      loading.value = false
      showControlsSteady()
      clearSeekState()
      sendRemoteEvent(DLNA_REMOTE_EVENT.STOP, {})
      errorText.value = '播放失败，请在手机端重新投屏'
    }

    // ---------- 下行控制（手机端遥控） ----------
    const onDlnaPlay = (payload: DlnaPlayPayload) => {
      const url = payload?.url
      if (!url) {
        // 无 url：ACTION_DLNA_STATUS play（恢复播放）
        // 图片态：没有暂停/恢复的概念，把状态标记回播放并回报 play 即可。
        if (isImage.value) {
          playing.value = true
          sendRemoteEvent(DLNA_REMOTE_EVENT.PLAY, {})
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
      if (url === cUrl) {
        // 同 url：区分"重投同源恢复播放"与"重复事件幂等"——
        // 换集后 overlay 缓存补发可能重复送达同一 url，若此时正在播放，
        // start(0) 会把刚 initPlay 的新视频重置回开头（假象"还在播上一集"）。
        // 正在播 → 忽略（幂等）；已停止/暂停 → 恢复播放（手机端重投同源）。
        if (playing.value) {
          console.log('[casting] 同 url 且正在播放，忽略重复 playerUrl（幂等）', url.slice(0, 60))
          return
        }
        // 图片态：同 url 重投 = 重新显示这张图（无播放器可 start）
        if (isImage.value) {
          startImagePlay(url)
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
      initPlay(url, payload.mediaType)
      // 图片态：图片层无需进度定时器（startImagePlay 已停表并清进度文案），到此为止
      if (isImage.value) return
      // 切集/重播后显式启动进度定时器（不依赖 onPlayerPlaying 是否触发）：
      // 播完兜底锁死定时器后切集，若播放器未重新派发 playing 事件，定时器
      // 不会自动重启 → AvTransport pos 停留在 0 → 客户端进度条不更新。
      startProgressTimer()
    }

    const onDlnaSeek = (positionSeconds: number) => {
      // 图片无时间轴：手机端进度条对图片本不该出现，真收到也直接忽略
      if (isImage.value) return
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
      // 用户 seek 交互 = 唤醒控制层并重新计时（播放暂停时 showControlsSteady 接管）
      wakeControls(false)
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
      // 拖动/步进中也是用户操作：唤醒控制层并重新计时
      wakeControls(false)
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
      // 焦点落到 seekbar = 用户在导航（遥控方向键/唤醒后补聚焦）：唤醒控制层
      if (focused) wakeControls(false)
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
      // 按钮点击 = 用户操作：唤醒控制层并重新计时（暂停态转常显由 onPlayerPaused 接管）
      wakeControls(false)
      // 图片态：无播放/暂停语义（按钮本身也已隐藏），只唤醒控制层
      if (isImage.value) return
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
      // 按钮点击 = 用户操作：唤醒控制层并重新计时
      wakeControls(false)
      // 图片态：无音量语义（按钮本身也已隐藏）
      if (isImage.value) return
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
      // 控制层隐藏时：任意按键先唤醒（消费事件，防止按键落到底层 launcher 页面），
      // 并把焦点还给 seekbar —— 下一发左右键即可快进/快退、OK 即播放/暂停。
      if (!controlsVisible.value) {
        console.log('[casting] 按键唤醒控制层 kc=', kc)
        wakeControls(true)
        return true
      }
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
        // 图片态：无「切下一集」概念（相册翻页由手机端驱动），下键不消费
        if (isImage.value) return false
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
      // mediaType 经 route.params 从 App.vue 透传（Rust 判定 → ACTION_DLNA → 这里）
      initPlay(url, params.mediaType)
      return true
    }

    const initPlaySource = () => {
      // props 直传（兼容）
      if (props.url) {
        if (props.title) title.value = props.title
        initPlay(props.url, props.mediaType)
        return
      }
      // route.params
      const params: any = (route && route.params) || {}
      if (playWithParams(params)) return
      // 模块级待播参数兜底（App.vue 收到 playerUrl 时写入，防 push 时序丢参）
      const pending = getPendingPlay()
      if (pending && pending.url) {
        if (pending.title) title.value = pending.title
        initPlay(pending.url, pending.mediaType)
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
      stopSizePoll()
      clearInterval(elapsedTimer)
      clearTimeout(controlsHideTimer)
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
      controlsVisible,
      onRootClick,
      // 图片投屏分支（华为图库「投屏播放」推 JPEG）：模板分支 + 控制条样式
      isImage,
      imageUrl,
      controlBarStyle,
      onImageError,
      resolutionText,
      elapsedText,
      icons,
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
  border: 5px solid rgba(255, 122, 47, 0.25);
  border-top-color: #FF7A2F;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.loading-text {
  font-size: 26px;
  color: #FFF6EA;
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
  color: #FFD8CF;
}

/* ===== 控制层（自动隐藏容器）：全屏壳承载 scrim/导播簇/信息卡/控制条 =====
   子元素 absolute 坐标相对本层（1920×1080 与根一致，视觉不变）；
   隐藏 = opacity 0（v-show 的 display:none 在 web-renderer 对 div 不生效，
   实测 Hippy 布局引擎强制 display，故用 opacity 跨运行时统一） */
.controls-layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
}

/* ===== 双层 scrim（设计稿 04 屏：顶部 340 / 底部 380，暖黑 scrim） ===== */
.scrim-top {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 340px;
  background: linear-gradient(180deg, rgba(11, 9, 6, 0.85), rgba(11, 9, 6, 0));
}
.scrim-bottom {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1920px;
  height: 380px;
  background: linear-gradient(180deg, rgba(11, 9, 6, 0), rgba(11, 9, 6, 0.9));
}

/* 左上一行：返回圆钮 + 正在投屏胶囊 + 标题 + 来源（单行垂直居中）
   ⚠️ web-renderer 坑：align-items: flex-start 会被吞成 center——但本行用的是
   align-items: center（垂直居中，row 的 cross 轴），实测支持正常。
   纵向 flex column + flex-start 的坑见 git 历史（曾致整簇居中散开）。 */
.head-cluster {
  position: absolute;
  left: 64px;
  top: 48px;
  width: 1500px;
  height: 64px;
  display: flex;
  flex-direction: row;
  align-items: center;
}
.back-btn {
  width: 60px;
  height: 60px;
  border-radius: 30px;
  background-color: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18px;
}
.back-ico { width: 26px; height: 26px; }
.live-pill {
  height: 46px;
  border-radius: 23px;
  background-color: rgba(255, 90, 69, 0.92);
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 18px;
  padding-right: 18px;
}
/* 投屏中白点（设计稿 04 屏），暂停转灰 */
.live-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background-color: #FFFFFF;
  animation: blink 1.4s infinite;
}
.live-dot.paused {
  background-color: rgba(255, 255, 255, 0.55);
  animation: none;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.live-text { font-size: 21px; font-weight: 600; color: #FFFFFF; margin-left: 8px; }
.cast-title {
  margin-left: 18px;
  font-size: 34px;
  font-weight: 600;
  color: #FFFFFF;
  /* 超宽标题省略号：不把来源挤出屏幕 */
  max-width: 640px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cast-source { margin-left: 18px; font-size: 22px; color: rgba(255, 255, 255, 0.68); }

/* 右上信息胶囊（真实数据：分辨率取不到就隐藏整颗） */
.info-pills {
  position: absolute;
  right: 64px;
  top: 56px;
  display: flex;
  flex-direction: row;
  align-items: center;
}
.pill {
  height: 46px;
  border-radius: 23px;
  background-color: rgba(20, 15, 10, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 18px;
  padding-right: 18px;
  margin-left: 12px;
}
.pill-text { font-size: 21px; font-weight: 500; color: #FFFFFF; }

/* 右栏「投屏信息」卡已移除（2026-09-13 陈兄），CSS 一并清理 */

/* 控制条（设计稿 1100×96 居中悬浮；left = (1920-1100)/2 = 410，底距 48） */
.control-bar {
  position: absolute;
  left: 410px;
  bottom: 48px;
  width: 1100px;
  height: 96px;
  border-radius: 28px;
  background-color: rgba(35, 26, 18, 0.74);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 26px;
  padding-right: 26px;
  box-sizing: border-box;
}
/* 主播放钮：白色圆底 + 橙色字形（设计稿 64×64 圆） */
.ctrl-btn {
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background-color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 22px;
}
.ctrl-glyph { font-size: 24px; font-weight: 700; color: #FF7A2F; }
.ctrl-ico { width: 28px; height: 28px; }
/* 次要按钮（音量）：半透明白底 56×56 */
.ctrl-btn-ghost {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: rgba(255, 255, 255, 0.12);
}
.seekbar-wrap {
  width: 694px;
  margin-right: 22px;
  display: flex;
  flex-direction: column;
}
.seek-bar { width: 694px; height: 30px; }
.seek-time-text {
  margin-top: 2px;
  font-size: 19px;
  color: rgba(255, 255, 255, 0.75);
  font-variant-numeric: tabular-nums;
}
/* 停止投屏：实心红主按钮（设计稿 168×60） */
.stop-btn {
  width: 168px;
  height: 60px;
  border-radius: 30px;
  background-color: #FF5A45;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
.stop-ico { width: 20px; height: 20px; }
.stop-text { font-size: 22px; font-weight: 600; color: #FFFFFF; margin-left: 8px; }

</style>

<style>
/* 非 scoped：QtSeekBar 的 dom 由 web-renderer JS 创建、不带 data-v 属性，
   scoped 选择器打不中。本规则仅 web 宿主页有意义——屏蔽宿主 index.html
   [focusable].focused 的绿色辉光（在深色控制条上晕成一大块暗框）；
   clipChildren=false 放开裁剪后才暴露（2026-09-13）。原生端无此样式。 */
.seek-bar.focused {
  box-shadow: none !important;
}
</style>
