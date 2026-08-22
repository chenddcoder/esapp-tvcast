<template>
  <div class="app-root" id="root">
    <es-router-view></es-router-view>
    <!-- 投屏播放覆盖层：不依赖 es3-router 页面导航（3.x web 端 push 不触发页面渲染），
         收到 ACTION_DLNA 投屏请求后直接全屏渲染 casting 播放层 -->
    <CastingPage
      v-if="castingActive"
      :url="castingUrl"
      :title="castingTitle"
      @exit="onCastingExit"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue'
import {
  markDlnaReady,
  initDlnaActionListener,
  setPendingPlay,
  DlnaPlayPayload,
} from './tools/dlna-bridge'
import CastingPage from './pages/casting/index.vue'

/**
 * 快应用根组件。
 * DLNA 对接（对齐 esapp-xiaoyoucast 契约）：
 *  - 启动即声明快应用 DLNA 就绪（sendRemoteEvent('tvcast_ready')），
 *    desktop overlay 收到 Rust 转发的 app-ready 后补发缓存的投屏请求。
 *  - 全局监听原生广播 ACTION_DLNA（actionType=playerUrl）：收到后经全屏覆盖层
 *    渲染 casting 播放页（不走 es3-router push —— 3.x 在 web-renderer 下
 *    push 后 RouterView 不切换，页面实例机制未在 web 端实现，实测 pushResolved
 *    但 DOM 无新页面节点）。覆盖层方案跨端一致（真机同样适用）。
 *  - 播放控制（ACTION_DLNA_STATUS）由 casting 播放层自身监听。
 */
export default defineComponent({
  name: 'App',
  components: { CastingPage },
  /** 捕获子组件（casting/ESPlayerManager）渲染/播放错误：记录并放行，避免播放层崩掉整个页面 */
  errorCaptured(err: unknown, instance: unknown, info: string) {
    console.error('[App] errorCaptured:', err, info)
    return false
  },
  setup() {
    // 投屏播放覆盖层状态
    const castingActive = ref(false)
    const castingUrl = ref('')
    const castingTitle = ref('')

    const onCastingExit = () => {
      castingActive.value = false
      castingUrl.value = ''
      castingTitle.value = ''
    }

    const onPlayerUrl = (payload: DlnaPlayPayload) => {
      const url = payload?.url
      if (!url) return
      console.log('[App] 收到投屏请求 → casting 播放层', { url, title: payload.title })
      // 模块级待播参数兜底（casting 组件 route/props 均未携带时读取）
      setPendingPlay({ url, title: payload.title || '' })
      // 已在播放中收到新投屏：更新 url（casting 组件 watch 后重播）
      castingUrl.value = url
      castingTitle.value = payload.title || ''
      castingActive.value = true
    }

    let removeActionListener: (() => void) | null = null
    let removeKeyHandler: (() => void) | null = null

    onMounted(() => {
      removeActionListener = initDlnaActionListener({ onPlayerUrl })
      markDlnaReady()

      // 返回键兜底（仅桌面/web 环境有 window：Esc/Backspace 退出投屏；
      // 真机 TV 返回键由 es3-router 分发到页面 onBackPressed，此分支不生效）
      if (typeof window !== 'undefined') {
        const onKey = (e: KeyboardEvent) => {
          if ((e.key === 'Escape' || e.key === 'Backspace') && castingActive.value) {
            console.log('[App] 返回键退出投屏')
            onCastingExit()
          }
        }
        window.addEventListener('keydown', onKey)
        removeKeyHandler = () => window.removeEventListener('keydown', onKey)
      }
    })

    onUnmounted(() => {
      if (removeActionListener) removeActionListener()
      if (removeKeyHandler) removeKeyHandler()
    })

    return {
      castingActive,
      castingUrl,
      castingTitle,
      onCastingExit,
    }
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
