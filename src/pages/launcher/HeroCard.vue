<template>
  <!-- 首页主视觉卡（设计稿 1656×460，橙色渐变整卡 + 右侧太阳装饰）。
       左列文案：标签胶囊 → 68px 主标题 → 副标题 → 主/次按钮。
       右列装饰全部用圆形拼出太阳，不依赖图片资源。 -->
  <div class="hero" :focusable="false">
    <div class="hero-body" :focusable="false">
      <div class="tag" :focusable="false">
        <div class="tag-dot" :focusable="false"></div>
        <span class="tag-text" :focusable="false">{{ label }}</span>
      </div>
      <span class="hero-title" :focusable="false">{{ title }}</span>
      <span class="hero-sub" :focusable="false">{{ sub }}</span>
      <div class="cta-row" :focusable="false">
        <div
          class="cta"
          :focusable="true"
          :enableFocusBorder="true"
          eventClick
          eventFocus
          name="heroCast"
          @click="$emit('cast')"
        >
          <span class="cta-text" :focusable="false">{{ ctaText }}</span>
        </div>
        <div
          class="cta-ghost"
          :focusable="true"
          :enableFocusBorder="true"
          eventClick
          eventFocus
          name="heroGuide"
          @click="$emit('guide')"
        >
          <span class="cta-ghost-text" :focusable="false">{{ guideText }}</span>
        </div>
      </div>
    </div>

    <div class="art" :focusable="false">
      <div class="halo-outer" :focusable="false"></div>
      <div class="halo-mid" :focusable="false"></div>
      <div class="sun" :focusable="false">
        <img class="sun-img" :src="icon" :focusable="false" />
      </div>
      <div class="spark spark-a" :focusable="false"></div>
      <div class="spark spark-b" :focusable="false"></div>
      <div class="spark spark-c" :focusable="false"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ICON_BASE } from '../../styles/tokens'

export default defineComponent({
  name: 'HeroCard',
  props: {
    /** 标签胶囊文案 */
    label: { type: String, default: '手机投屏 · 一碰即投' },
    title: { type: String, default: '手机一点，电脑上就看' },
    sub: { type: String, default: '把手机里的电影、照片和游戏，直接投到电脑屏幕' },
    ctaText: { type: String, default: '开始投屏' },
    guideText: { type: String, default: '怎么用' },
    /** 太阳圆盘上的白色投屏图标 */
    icon: { type: String, default: `${ICON_BASE}/cast-icon.svg` },
  },
  emits: ['cast', 'guide'],
})
</script>

<style scoped>
/* 渐变 / 阴影 / 绝对定位均在既有组件里验证过（Hippy CSS 子集） */

.hero {
  position: relative;
  width: 1656px;
  height: 460px;
  border-radius: 36px;
  background: linear-gradient(135deg, #FFC83D, #FFA32F, #FF7A2F);
  display: flex;
  flex-direction: row;
  padding-top: 44px;
  padding-bottom: 44px;
  padding-left: 52px;
  padding-right: 52px;
  overflow: hidden;
}

.hero-body {
  width: 880px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tag {
  height: 40px;
  padding-left: 16px;
  padding-right: 16px;
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.24);
  display: flex;
  flex-direction: row;
  align-items: center;
  /* 列容器里默认 stretch，会把胶囊拉成整行宽 */
  align-self: flex-start;
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background-color: #FFFFFF;
  margin-right: 8px;
}

.tag-text { font-size: 20px; font-weight: 600; color: #FFFFFF; }

.hero-title {
  margin-top: 16px;
  font-size: 68px;
  font-weight: 800;
  color: #FFFFFF;
}

.hero-sub {
  margin-top: 16px;
  font-size: 25px;
  color: #FFF6EA;
}

.cta-row {
  margin-top: 20px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.cta {
  width: 216px;
  height: 68px;
  border-radius: 34px;
  background-color: #FFFFFF;
  box-shadow: 0 10px 24px rgba(180, 80, 20, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  focus-scale: 1.04;
  focus-border-width: 2px;
  focus-border-color: #FFE0A8;
}

.cta-text { font-size: 25px; font-weight: 700; color: #FF7A2F; }

.cta-ghost {
  width: 168px;
  height: 68px;
  margin-left: 14px;
  border-radius: 34px;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  focus-scale: 1.04;
  focus-border-width: 2px;
  focus-border-color: #FFFFFF;
  focus-background-color: rgba(255, 255, 255, 0.16);
}

.cta-ghost-text { font-size: 25px; font-weight: 600; color: #FFFFFF; }

/* 右侧太阳装饰：外层/中层光晕 + 白色圆盘 + 三颗光点 */
.art {
  position: relative;
  width: 672px;
  height: 340px;
  margin-top: 16px;
}

.halo-outer {
  position: absolute;
  left: 300px;
  top: 0;
  width: 340px;
  height: 340px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.16);
}

.halo-mid {
  position: absolute;
  left: 370px;
  top: 70px;
  width: 200px;
  height: 200px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.28);
}

.sun {
  position: absolute;
  left: 410px;
  top: 110px;
  width: 120px;
  height: 120px;
  border-radius: 60px;
  background-color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sun-img { width: 58px; height: 58px; }

.spark {
  position: absolute;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.7);
}

.spark-a { left: 120px; top: 30px; width: 16px; height: 16px; background-color: rgba(255, 255, 255, 0.8); }
.spark-b { left: 430px; top: 40px; width: 10px; height: 10px; }
.spark-c { left: 470px; top: 230px; width: 14px; height: 14px; background-color: rgba(255, 255, 255, 0.6); }
</style>
