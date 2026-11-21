<template>
  <!-- 图片投屏层：被投内容是图片时替代播放器渲染（华为图库「投屏播放」推的就是 JPEG，
       一律走 <video> 必然 error → 业务层兜底 stop → 手机端显示「投屏失败」）。
       2026-09-13 真机实测 4 次投屏全为 .jpg，本层即为该链路的修复。

       渲染契约：`<img resizeMode="contain">` —— web-renderer 的 QtImage 把
       resizeMode 映射为 CSS object-fit（contain/cover/center/origin/fitxy），
       照片一律 contain 留黑边不裁剪（电视上看照片不能裁）。
       定位/自动化验收一律按 [name=...]（web-renderer DOM 不保留业务 class 名）。 -->
  <div class="cast-image-layer" name="castImageLayer" :focusable="false">
    <!-- ⚠️ img 只按 url 存在与否渲染，**不**因 failed 卸载：兜底超时不等于加载失败，
         把已显示的照片卸掉会直接黑屏。真失败时 img 本身就是空的，留着无害。 -->
    <img
      v-if="url"
      class="cast-image"
      name="castImage"
      :src="url"
      :resizeMode="resizeMode"
      :focusable="false"
      @onLoadEnd="onLoadEnd"
    />
    <!-- 提示条放画面底部、无底色：即便「图片其实已显示但加载事件没送达」的
         退化情形被超时兜底误触发，也只是底部多一行小字，不会盖住照片主体。
         提示**不**向上报 stop —— 主动断开会把「电脑解码不了这张图」变成手机端的
         「投屏失败」，正是上一轮 Bug 的成因。留在投屏态，用户可继续翻下一张。 -->
    <div v-if="failed" class="image-hint" name="imageHint" :focusable="false">
      <span class="hint-text" :focusable="false">这张图片未能在电脑上显示 · 可在手机切换下一张，或按返回键断开投屏</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onUnmounted } from 'vue'

/**
 * 投屏图片层。
 *
 * 为什么单独成组件（不塞进 casting/index.vue）：index.vue 已 1584 行，
 * 远超项目 800 行硬阈值，图片渲染+加载态自带一套状态机，按职责拆出来，
 * casting 页只保留一个分支接线。
 *
 * 加载结果判定：web-renderer 的 QtImage 在 <img> load/error 时派发
 * onLoadEnd({ success, width, height })。事件送达则立即定态；送达不了
 * （运行时差异）由超时兜底——兜底提示刻意做得不打扰（底部一行小字），
 * 因为「没收到事件」不等于「加载失败」。
 */
export default defineComponent({
  name: 'CastImageLayer',
  props: {
    /** 被投图片 URL（手机端 DLNA 服务地址） */
    url: { type: String, default: '' },
    /** 缩放模式：contain 留黑边不裁剪（默认）/ cover 铺满会裁剪 */
    resizeMode: { type: String, default: 'contain' },
    /** 无加载结果时的兜底提示延时（毫秒）；<=0 关闭 */
    timeout: { type: Number, default: 15000 },
  },
  emits: ['error'],
  setup(props, { emit }) {
    const failed = ref(false)
    let timer: any = -1

    const clearTimer = () => {
      if (timer !== -1) {
        clearTimeout(timer)
        timer = -1
      }
    }

    const markFailed = (why: string) => {
      clearTimer()
      if (failed.value) return
      failed.value = true
      console.warn('[cast-image] 图片未能显示:', why, props.url)
      emit('error', { url: props.url, reason: why })
    }

    /** 换图（图库连播会连续投同一相册的不同图）→ 重置失败态与兜底计时 */
    const arm = () => {
      clearTimer()
      failed.value = false
      if (props.url && props.timeout > 0) {
        timer = setTimeout(() => markFailed('no-load-report'), props.timeout)
      }
    }

    const onLoadEnd = (e: any) => {
      const params = (e && (e.params || e)) || {}
      // 显式失败：直接定态
      if (params.success === false) {
        markFailed('load-error')
        return
      }
      // 显式成功 → 撤掉兜底计时
      if (params.success === true) {
        clearTimer()
        return
      }
      // 只回尺寸：有尺寸即已解码显示
      const w = Number(params.width)
      const h = Number(params.height)
      if ((isFinite(w) && w > 0) || (isFinite(h) && h > 0)) clearTimer()
    }

    watch(() => props.url, arm, { immediate: true })
    onUnmounted(clearTimer)

    return { failed, onLoadEnd }
  },
})
</script>

<style scoped>
.cast-image-layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background: #000;
  overflow: hidden;
}
.cast-image {
  width: 1920px;
  height: 1080px;
}
.image-hint {
  position: absolute;
  left: 0;
  bottom: 150px;
  width: 1920px;
  height: 40px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
.hint-text {
  font-size: 22px;
  color: #8194a4;
}
</style>
