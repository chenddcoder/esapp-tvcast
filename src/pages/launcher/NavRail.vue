<template>
  <!-- 左侧导航轨（设计稿 152×1080）：白色底 + 暖色右描边。
       顶部渐变太阳品牌标；中部 4 个目的地（120×88，选中 = 浅橙底 + 深橙文字）；
       底部「等待投屏」状态胶囊（浅绿底 + 绿点）。 -->
  <div class="rail" :focusable="false">
    <div class="rail-main" :focusable="false">
      <div class="brand" :focusable="false">
        <img
          v-if="!brandFailed"
          :src="brandIcon"
          class="brand-img"
          @error="brandFailed = true"
          :focusable="false"
        />
        <span v-else class="brand-glyph" :focusable="false">投</span>
      </div>

      <div
        v-for="item in items"
        :key="item.key"
        class="nav-item"
        :class="{ active: item.key === active }"
        :focusable="true"
        :enableFocusBorder="true"
        eventClick
        eventFocus
        :name="'rail-' + item.key"
        @click="$emit('nav', item.key)"
      >
        <img
          v-if="!failed[item.key]"
          :src="item.key === active ? item.iconOn : item.icon"
          class="nav-icon"
          @error="onFail(item.key)"
          :focusable="false"
        />
        <span v-else class="nav-glyph" :focusable="false">{{ item.glyph }}</span>
        <span class="nav-label" :focusable="false">{{ item.label }}</span>
      </div>
    </div>

    <div class="status-pill" :focusable="false">
      <div class="status-dot" :style="{ backgroundColor: ready ? '#4CB782' : '#A08B78' }" :focusable="false"></div>
      <span class="status-text" :focusable="false">{{ status }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { ICON_BASE, NAV_ITEMS } from '../../styles/tokens'
import type { NavItem } from '../../styles/tokens'

export default defineComponent({
  name: 'NavRail',
  props: {
    /** 当前目的地 key，决定哪一项为选中态 */
    active: { type: String, default: 'home' },
    /** 底部状态胶囊文案（真实状态） */
    status: { type: String, default: '等待投屏' },
    /** 投屏接收是否就绪（决定状态点颜色，真实状态） */
    ready: { type: Boolean, default: false },
    /** 品牌标图标（白色 cast 图标，压在橙色渐变上） */
    brandIcon: { type: String, default: `${ICON_BASE}/cast-icon.svg` },
    /** 目的地列表，默认设计稿 4 项 */
    items: { type: Array as () => NavItem[], default: () => NAV_ITEMS },
  },
  emits: ['nav'],
  setup() {
    const brandFailed = ref(false)
    const failed = ref<Record<string, boolean>>({})
    const onFail = (key: string) => {
      failed.value[key] = true
    }
    return { brandFailed, failed, onFail }
  },
})
</script>

<style scoped>
/* 样式全部落在 QuickTVUI / Hippy 支持的 CSS 子集内：
   无 CSS 变量 / gap / grid / % / auto / radial-gradient / transition；
   padding·margin 不用多值简写（末值非 0 会丢值） */

.rail {
  position: absolute;
  left: 0;
  top: 0;
  width: 152px;
  height: 1080px;
  background-color: #FFFFFF;
  border-right-width: 1px;
  border-right-color: #F4E3D0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding-top: 30px;
  padding-bottom: 30px;
  padding-left: 16px;
  padding-right: 16px;
}

.rail-main {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand {
  width: 76px;
  height: 76px;
  margin-bottom: 20px;
  border-radius: 26px;
  background: linear-gradient(135deg, #FFC83D, #FF7A2F);
  box-shadow: 0 10px 24px rgba(255, 122, 47, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-img { width: 40px; height: 40px; }
.brand-glyph { font-size: 34px; font-weight: 800; color: #FFFFFF; }

.nav-item {
  width: 120px;
  height: 88px;
  margin-bottom: 10px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  focus-scale: 1.04;
  focus-border-width: 1px;
  focus-border-color: #FFC08A;
  focus-background-color: #FFF7EC;
}

.nav-item.active {
  background-color: #FFF1E2;
}

.nav-icon { width: 28px; height: 28px; margin-bottom: 6px; }
.nav-glyph { font-size: 26px; color: #A08B78; margin-bottom: 6px; }

.nav-label { font-size: 18px; font-weight: 500; color: #A08B78; }
.nav-item.active .nav-label { font-weight: 600; color: #E9661E; }

.status-pill {
  width: 120px;
  height: 52px;
  border-radius: 16px;
  background-color: #F0FAF3;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  margin-right: 8px;
}

.status-text { font-size: 17px; font-weight: 500; color: #3F8A63; }
</style>
