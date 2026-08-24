<template>
  <div class="app-root" id="root">
    <es-router-view></es-router-view>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted } from 'vue'
import { useESRouter } from '@extscreen/es3-router'
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
      console.log('[App] 收到投屏请求 → push casting 播放页', { url, title: payload.title })
      // 模块级待播参数兜底（casting 组件 route.params 未携带时读取）
      setPendingPlay({ url, title: payload.title || '' })
      if (router?.push) {
        router
          .push({ name: 'casting', params: { url, title: payload.title || '' } })
          .catch((e) => console.warn('[App] push casting failed:', e))
      }
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
  background: #0b1220;
  overflow: hidden;
}

.app-root {
  width: 100%;
  height: 100%;
}
</style>
