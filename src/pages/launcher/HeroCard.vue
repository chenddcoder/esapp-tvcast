<template>
  <!-- 首页主视觉卡（设计稿 1034×455，左 44 内边距，文案压在左下暗角上）。
       设计稿底图是真实照片（不随包分发，见决策点「hero 底图」）——
       P0 用基础色 + 暖色光晕 + 左侧/底部双层 scrim 模拟同一构图与暗角。
       空态：还没有投屏记录时给引导文案；有记录时由父级传入 eyebrow/title/sub。 -->
  <div class="hero" :focusable="false">
    <div class="ly-base" :focusable="false"></div>
    <div class="ly-warm" :focusable="false"></div>
    <div class="ly-left" :focusable="false"></div>
    <div class="ly-bottom" :focusable="false"></div>

    <div class="hero-body" :focusable="false">
      <span class="eyebrow" :focusable="false">{{ eyebrow }}</span>
      <span class="hero-title" :focusable="false">{{ title }}</span>
      <span class="hero-sub" :focusable="false">{{ sub }}</span>
      <div
        class="cta"
        :focusable="true"
        :enableFocusBorder="true"
        eventClick
        eventFocus
        name="heroCast"
        @click="$emit('cast')"
      >
        <img
          v-if="!iconFailed"
          :src="icon"
          class="cta-img"
          @error="iconFailed = true"
          :focusable="false"
        />
        <span class="cta-text" :focusable="false">{{ ctaText }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { ICON_BASE } from '../../styles/tokens'

export default defineComponent({
  name: 'HeroCard',
  props: {
    eyebrow: { type: String, default: '等待投屏' },
    title: { type: String, default: '还没有投屏记录' },
    sub: { type: String, default: '手机点投屏，画面就出现在这里' },
    ctaText: { type: String, default: '开始投屏' },
    icon: { type: String, default: `${ICON_BASE}/cast-icon.svg` },
  },
  emits: ['cast'],
  setup() {
    const iconFailed = ref(false)
    return { iconFailed }
  },
})
</script>

<style scoped>
.hero {
  position: relative;
  width: 1034px;
  height: 455px;
  border-radius: 24px;
  background-color: #0d1425;
  border-width: 1px;
  border-color: #1c2440;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.ly-base {
  position: absolute;
  left: 0;
  top: 0;
  width: 1034px;
  height: 455px;
  background: linear-gradient(160deg, #1b2440, #0d1425);
}

.ly-warm {
  position: absolute;
  left: 0;
  top: 0;
  width: 1034px;
  height: 455px;
  background: linear-gradient(215deg, rgba(251, 97, 90, 0.32), rgba(11, 16, 30, 0));
}

/* 左侧恒暗：保证文案对比度不依赖底图明暗（评审修订项） */
.ly-left {
  position: absolute;
  left: 0;
  top: 0;
  width: 1034px;
  height: 455px;
  background: linear-gradient(90deg, rgba(9, 13, 26, 0.94), rgba(9, 13, 26, 0));
}

.ly-bottom {
  position: absolute;
  left: 0;
  top: 0;
  width: 1034px;
  height: 455px;
  background: linear-gradient(0deg, rgba(9, 13, 26, 0.88), rgba(9, 13, 26, 0));
}

.hero-body {
  width: 482px;
  padding: 44px;
  display: flex;
  flex-direction: column;
}

.eyebrow {
  font-size: 19px;
  color: #8194a4;
  letter-spacing: 2.66px;
}

.hero-title {
  margin-top: 20px;
  font-size: 44px;
  font-weight: 600;
  color: #e8edf5;
}

.hero-sub {
  margin-top: 16px;
  font-size: 22px;
  color: #8194a4;
}

.cta {
  margin-top: 26px;
  width: 211px;
  height: 72px;
  border-radius: 16px;
  background-color: #fb615a;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  focus-scale: 1.05;
  focus-border-width: 2px;
  focus-border-color: rgba(255, 249, 248, 0.5);
}

.cta-img { width: 26px; height: 26px; margin-right: 12px; }
.cta-text { font-size: 25px; font-weight: 600; color: #fff9f8; }
</style>
