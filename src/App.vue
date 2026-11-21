<template>
  <div class="app-root" id="root">
    <es-router-view></es-router-view>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted } from 'vue'
import { useESRouter, ESRouteLaunchMode } from '@extscreen/es3-router'
import routes from './routes'
import { markDlnaReady, initDlnaActionListener, setPendingPlay, DlnaPlayPayload } from './tools/dlna-bridge'

/**
 * 快应用根组件。
 * DLNA 对接（对齐 esapp-xiaoyoucast 契约）：
 *  - 启动即声明快应用 DLNA 就绪（sendRemoteEvent('tvcast_ready')），
 *    desktop overlay 收到 Rust 转发的 app-ready 后补发缓存的投屏请求。
 *  - 全局监听原生广播 ACTION_DLNA（actionType=playerUrl）：收到后 push 到
 *    casting 路由页面（标准 es3-router 页面导航，页面实例机制可用——
 *    onKeyDown/onKeyUp/onBackPressed 均由框架回调），url/title 经 route.params
 *    传入，另存模块级 pendingPlay 兜底（防止 push 时序问题丢参）。
 *  - 播放控制（ACTION_DLNA_STATUS）由 casting 播放页自身监听。
 */
export default defineComponent({
  name: 'App',
  /** 捕获子组件（casting/ESPlayerManager）渲染/播放错误：记录并放行，避免播放层崩掉整个页面 */
  errorCaptured(err: unknown, instance: unknown, info: string) {
    console.error('[App] errorCaptured:', err, info)
    return false
  },
  setup() {
    let router: { push?: (x: unknown) => Promise<unknown> } | null = null
    try {
      router = useESRouter() as unknown as { push?: (x: unknown) => Promise<unknown> }
    } catch (e) {
      console.warn('[App] useESRouter unavailable:', e)
    }

    const onPlayerUrl = (payload: DlnaPlayPayload) => {
      const url = payload?.url
      if (!url) return
      // mediaType 透传（'image' 时 casting 页走图片层）——Rust 侧按 DIDL 判定，
      // 缺省为空串，由 casting 页按 URL 扩展名兜底。
      const mediaType = String(payload?.mediaType || '')
      console.log('[App] 收到投屏请求 → push casting 播放页', { url, title: payload.title, mediaType })
      // 模块级待播参数兜底（casting 组件 route.params 未携带时读取）
      setPendingPlay({ url, title: payload.title || '', mediaType })
      pushRoute({ name: 'casting', params: { url, title: payload.title || '', mediaType } })
    }

    /**
     * 单例页面（launchMode=SINGLE_TASK）去重 push：
     * 目标页面已在页面栈顶时不重复 push，避免同一投屏事件被两条路径同时
     * 重播（实测 2026-08-25）：
     *   ① casting 页自身监听的 ACTION_DLNA(playerUrl)（onDlnaPlay）→ initPlay
     *   ② 本处 push → es3-router SINGLE_TASK 复用 → onESNewIntent → initPlay
     * 同一个 url 被 initPlay 两次 → 两个播放器实例 → **多个播放声音**。
     * 跳过 push 后由当前页面的 onDlnaPlay 单路径重播，事件不丢失。
     */
    const pushRoute = (route: { name: string; params?: Record<string, unknown> }): boolean => {
      if (!router?.push) return false
      const matched = routes.find((r: any) => r.name === route.name)
      const isSingleTask =
        !!matched && matched.launchMode === ESRouteLaunchMode.ES_ROUTE_LAUNCH_MODE_SINGLE_TASK
      const currentRoute: any = (router as any).currentRoute?.value
      if (isSingleTask && currentRoute && currentRoute.name === route.name) {
        console.log(`[App] ${route.name} 为单例页面且已在栈顶，跳过重复 push（由当前页单路径重播）`)
        return false
      }
      router
        .push(route as never)
        .catch((e) => console.warn('[App] push failed:', e))
      return true
    }

    let removeActionListener: (() => void) | null = null

    onMounted(() => {
      removeActionListener = initDlnaActionListener({ onPlayerUrl })
      markDlnaReady()
    })

    onUnmounted(() => {
      if (removeActionListener) removeActionListener()
    })

    return {}
  },
})
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  background: #0b101e;
  overflow: hidden;
}

.app-root {
  width: 100%;
  height: 100%;
}
</style>
