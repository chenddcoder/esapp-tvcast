<template>
  <div class="guide-mask" :focusable="false" ref="rootRef">
    <div class="guide-card" :focusable="false">
      <div class="guide-header" :focusable="false">
        <span class="guide-title" :focusable="false">连接帮助</span>
        <div class="guide-close" :focusable="true" eventClick eventFocus name="close" @click="onClose">
          <span :focusable="false">✕</span>
        </div>
      </div>

      <div class="guide-body" :focusable="false">
        <!-- 左：二维码 -->
        <div class="qr-wrap" :focusable="false">
          <div class="qr" :focusable="false">
            <span v-for="(c, i) in qrCells" :key="i"
                  class="qr-cell" :focusable="false"
                  :style="{ backgroundColor: c ? '#0b1220' : 'transparent' }"></span>
          </div>
          <span class="qr-tip" :focusable="false">微信 / 相机扫码连接</span>
        </div>

        <!-- 右：步骤 -->
        <div class="steps" :focusable="false">
          <div class="step" :focusable="false">
            <span class="step-num" :focusable="false">1</span>
            <span class="step-text" :focusable="false">手机与电脑连接同一 Wi-Fi</span>
          </div>
          <div class="step" :focusable="false">
            <span class="step-num" :focusable="false">2</span>
            <span class="step-text" :focusable="false">手机扫码或输入投屏码</span>
          </div>
          <div class="step" :focusable="false">
            <span class="step-num" :focusable="false">3</span>
            <span class="step-text" :focusable="false">选择要投屏的内容即可</span>
          </div>

          <div class="code-box" :focusable="false">
            <span class="code-label" :focusable="false">投屏码</span>
            <span class="code-value" :focusable="false">{{ castCode }}</span>
          </div>

          <div class="guide-confirm" :focusable="true" eventClick eventFocus name="confirm" @click="onClose">
            <span :focusable="false">我知道了</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter } from '@extscreen/es3-router'
import { ref, onMounted } from 'vue'

export default defineComponent({
  name: 'GuidePage',
  setup() {
    const router = useESRouter()
    const rootRef = ref()
    const castCode = ref('8 2 4 9 1 6')
    // 伪二维码点阵（占位，真实场景由后端生成）
    const qrCells = ref<boolean[]>([])

    const onClose = () => router.back()

    onMounted(() => {
      const n = 21 * 21
      const arr: boolean[] = []
      for (let i = 0; i < n; i++) {
        arr.push(Math.random() > 0.5)
      }
      qrCells.value = arr
    })

    return { rootRef, castCode, qrCells, onClose }
  },
})
</script>

<style scoped>
.guide-mask {
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.guide-card {
  width: 1180px;
  background: linear-gradient(180deg, #121a30, #0c1322);
  border: 1px solid rgba(124, 92, 255, 0.35);
  border-radius: 28px;
  padding-top: 40px;
  padding-bottom: 48px;
  padding-left: 48px;
  padding-right: 48px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
}
.guide-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
}
.guide-title {
  font-size: 36px;
  font-weight: 800;
  color: #eaf0ff;
}
.guide-close {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  color: #c7d2ea;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, background 0.15s ease;
}
.guide-close[focused],
.guide-close:focus {
  transform: scale(1.06);
  background: rgba(124, 92, 255, 0.22);
}
.guide-body {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 50px;
}
.qr {
  width: 320px;
  height: 320px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: #fff;
  border-radius: 18px;
}
.qr-cell {
  width: 13.5px;
  height: 13.5px;
  border-radius: 2px;
}
.qr-tip {
  font-size: 24px;
  color: #9fb0d0;
  margin-top: 18px;
}
.steps {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.step {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 22px;
}
.step-num {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
  color: #fff;
  font-size: 26px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 18px;
}
.step-text {
  font-size: 28px;
  color: #eaf0ff;
}
.code-box {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 6px;
  padding-top: 18px;
  padding-bottom: 18px;
  padding-left: 26px;
  padding-right: 26px;
  border-radius: 16px;
  background: rgba(124, 92, 255, 0.12);
}
.code-label {
  font-size: 26px;
  color: #9fb0d0;
  margin-right: 18px;
}
.code-value {
  font-size: 40px;
  font-weight: 800;
  color: #eaf0ff;
  letter-spacing: 6px;
  font-variant-numeric: tabular-nums;
}
.guide-confirm {
  align-self: flex-start;
  margin-top: 10px;
  padding-top: 16px;
  padding-bottom: 16px;
  padding-left: 44px;
  padding-right: 44px;
  border-radius: 16px;
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  transition: transform 0.15s ease;
}
.guide-confirm[focused],
.guide-confirm:focus {
  transform: scale(1.05);
}
</style>
