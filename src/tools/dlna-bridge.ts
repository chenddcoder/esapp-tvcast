/**
 * DLNA 播放器桥接（与 esapp-xiaoyoucast 的 EsNativeModule.sendRemoteEvent 契约对齐）
 *
 * 上行：快应用播放器（ESPlayerManager）状态 → Native.callNative("EsNativeModule",
 *       "sendRemoteEvent", 事件名, 参数)。web-renderer 的 EsNativeModule.sendRemoteEvent
 *       会把事件转发给 desktop-runtime 的 Rust DLNA DMR（dlna_send_remote_event 命令），
 *       后者更新 AVTransport 状态机 → 手机端 DLNA 客户端轮询 GetTransportInfo /
 *       GetPositionInfo 即可感知播放状态与进度。
 *
 * 事件集（与 xiaoyoucast dlna-play.vue / player-manager-view.vue 完全一致）：
 *   play / pause / stop / position / duration / next / tvcast_ready
 *
 * 下行：手机端控制指令由原生 DLNA 层广播 EventBus 事件（对齐 xiaoyoucast 契约）：
 *   - ACTION_DLNA        ：投屏请求（actionType=playerUrl，带 url/title）
 *   - ACTION_DLNA_STATUS ：播放控制（actionType=playerStatus，action=play/pause/stop/seekTo）
 *   payload 统一为 JSON 字符串（真机原生广播格式）。desktop-runtime 由注入的
 *   dlna_overlay.js 经 EventDispatcher.receiveNativeEvent 模拟原生广播。
 *
 * 注意：本模块不依赖 window / CustomEvent —— 快应用真机环境（es3/hippy）没有浏览器 DOM。
 */
import { Native, EventBus } from '@extscreen/es3-vue'

/** 上行事件名（与原生 EsNativeModule.sendRemoteEvent 契约一致） */
export const DLNA_REMOTE_EVENT = {
  PLAY: 'play',
  PAUSE: 'pause',
  STOP: 'stop',
  POSITION: 'position',
  DURATION: 'duration',
  NEXT: 'next',
  /**
   * 强制完成信号（TV 下键/手动切集）：Rust 侧在 GetPositionInfo 响应时做
   * 渐进处理——客户端上次回报 <1s 先给 >1s 过渡值确认在播，下次轮询再返回
   * 总时长；上次 ≥1s 直接返回总时长。不再由前端直接上报 position=duration
   *（上层感知不到客户端轮询节奏，直接跳变会被抖音"未确认在播"逻辑忽略）。
   */
  FORCE_COMPLETE: 'force_complete',
  /** 快应用 DLNA 就绪信号：desktop overlay 收到后补发缓存的投屏请求 */
  READY: 'tvcast_ready',
} as const

/** 下行原生广播事件名（对齐 xiaoyoucast：真机由 EsApp 原生广播，desktop 由 overlay 模拟） */
export const DLNA_ACTION_EVENT = 'ACTION_DLNA' // 投屏请求
export const DLNA_STATUS_EVENT = 'ACTION_DLNA_STATUS' // 播放控制

export interface DlnaPlayPayload {
  /** 被投视频/音频 URL */
  url?: string
  /** 可选标题 */
  title?: string
}

/** 模块级待播参数（替代 window.__tvcastPendingPlay 兜底，route.params 未携带时读取） */
let pendingPlay: DlnaPlayPayload | null = null

/**
 * 声明 DLNA 就绪/广播契约（对齐 esapp-xiaoyoucast + Android 真机）：
 * 下行（手机→TV）事件经原生 EventDispatcher 注入（receiveNativeEvent：
 *  desktop-runtime 的 dlna_overlay.js 经 web-renderer 的 EventDispatcher 注入
 *  [eventName, payload]；真机由 EsApp 原生层广播），es3-vue 3.x 的
 *  EventDispatcher(Un) 收到后自动 se.$emit 到本模块的 EventBus，业务侧
 *  EventBus.$on 即可收到 —— 与真机同一契约，业务层无需感知环境差异。
 */

export function setPendingPlay(p: DlnaPlayPayload | null): void {
  pendingPlay = p
}

export function getPendingPlay(): DlnaPlayPayload | null {
  return pendingPlay
}

/** EventBus 广播 payload 统一为 JSON 字符串（真机契约）；兼容对象形态 */
function parsePayload<T>(raw: unknown): T | null {
  if (raw == null) return null
  try {
    if (typeof raw === 'string') {
      const s = raw.trim()
      return s ? (JSON.parse(s) as T) : null
    }
    return raw as T
  } catch (e) {
    console.warn('[dlna-bridge] parsePayload failed:', raw, e)
    return null
  }
}

/**
 * 上报播放状态到原生 DLNA 服务端。
 * @param eventName play/pause/stop/position/duration/next/tvcast_ready
 * @param data     载荷（position/duration 单位为毫秒，与 xiaoyoucast 一致）
 */
export function sendRemoteEvent(eventName: string, data?: Record<string, unknown>): void {
  try {
    Native.callNative('EsNativeModule', 'sendRemoteEvent', eventName, data ?? {})
  } catch (e) {
    console.warn('[dlna-bridge] sendRemoteEvent failed:', eventName, e)
  }
}

/**
 * 声明快应用 DLNA 就绪（App.vue 启动时调用）：
 * 经 sendRemoteEvent('tvcast_ready') 上报，desktop-runtime 的 Rust 收到后
 * emit 'dlna://app-ready' 给 overlay 补发缓存的投屏请求（不依赖 window 全局）。
 */
export function markDlnaReady(): void {
  try {
    sendRemoteEvent(DLNA_REMOTE_EVENT.READY, {})
    console.log('[dlna-bridge] markDlnaReady: 快应用 DLNA 就绪')
  } catch (e) {
    console.warn('[dlna-bridge] markDlnaReady failed:', e)
  }
}

/**
 * 下行投屏请求监听（App.vue 注册）：
 * 收 ACTION_DLNA（actionType=playerUrl）→ 路由到 casting 播放页。
 */
export interface DlnaActionHandlers {
  onPlayerUrl?: (payload: DlnaPlayPayload) => void
}

export function initDlnaActionListener(handlers: DlnaActionHandlers): () => void {
  const cb = (event: unknown) => {
    const data = parsePayload<{ actionType?: string; url?: string; title?: string }>(event)
    if (!data) return
    if (data.actionType === 'playerUrl') {
      handlers.onPlayerUrl?.({ url: data.url, title: data.title })
    }
  }
  // EventBus（与真机原生广播同一契约：es3-vue 3.x EventDispatcher 收到
  // receiveNativeEvent 注入后自动 $emit 到此）
  EventBus.$on(DLNA_ACTION_EVENT, cb as never)
  return () => EventBus.$off(DLNA_ACTION_EVENT, cb as never)
}

/**
 * 下行播放控制监听（casting 播放页注册）：
 * 收 ACTION_DLNA_STATUS（actionType=playerStatus）→ 回调播放器。
 * 手机端暂停/停止/拖动进度 → 快应用播放器跟随。
 */
export interface DlnaControlHandlers {
  onPlay?: (payload: DlnaPlayPayload) => void
  onSeek?: (positionSeconds: number) => void
  onStop?: () => void
  onPause?: () => void
}

export function initDlnaControlListener(handlers: DlnaControlHandlers): () => void {
  const cb = (event: unknown) => {
    const data = parsePayload<{
      actionType?: string
      action?: string
      position?: number
    }>(event)
    if (!data || data.actionType !== 'playerStatus') return
    switch (data.action) {
      case 'play':
        handlers.onPlay?.({})
        break
      case 'pause':
        handlers.onPause?.()
        break
      case 'stop':
        handlers.onStop?.()
        break
      case 'seekTo': {
        const pos = Number(data.position)
        if (Number.isFinite(pos)) handlers.onSeek?.(pos) // 秒
        break
      }
      default:
        break
    }
  }
  // EventBus（与真机原生广播同一契约）
  EventBus.$on(DLNA_STATUS_EVENT, cb as never)
  return () => EventBus.$off(DLNA_STATUS_EVENT, cb as never)
}
