<template>
  <!-- 左侧导航轨（设计稿 132×1080）：品牌标 + 4 个目的地 + 底部当前状态胶囊。
       选中态 = surface3A88 底 + 左侧 4×44 前景色指示条 + 前景色 600 字重。 -->
  <div class="rail" :focusable="false">
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
      <div v-if="item.key === active" class="nav-indicator" :focusable="false"></div>
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

    <div class="rail-foot" :focusable="false">
      <div class="status-pill" :focusable="false">
        <span class="status-text" :focusable="false">{{ status }}</span>
      </div>
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
    /** 底部状态胶囊文案（真实状态，非设计稿的 HDMI 占位） */
    status: { type: String, default: '待投屏' },
    /** 品牌标图标（默认 cast 图标） */
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
.rail {
  position: absolute;
  left: 0;
  top: 0;
  width: 132px;
  height: 1080px;
  background-color: #0f1428;
  border-right-width: 1px;
  border-right-color: #1c2440;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand {
  width: 62px;
  height: 62px;
  margin-top: 30px;
  margin-bottom: 36px;
  border-radius: 20px;
  background-color: #fb615a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-img { width: 32px; height: 32px; }
.brand-glyph { font-size: 30px; font-weight: 800; color: #fff9f8; }

.nav-item {
  position: relative;
  width: 100px;
  height: 88px;
  margin-bottom: 6px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  focus-scale: 1.06;
  focus-border-width: 1px;
  focus-border-color: rgba(232, 237, 245, 0.34);
  focus-background-color: rgba(30, 35, 60, 0.88);
}

.nav-item.active {
  background-color: rgba(30, 35, 60, 0.88);
}

/* 选中指示条：设计稿 x=-14 → 相对导航轨 left 1.5px */
.nav-indicator {
  position: absolute;
  left: -14px;
  top: 22px;
  width: 4px;
  height: 44px;
  border-radius: 999px;
  background-color: #e8edf5;
}

.nav-icon { width: 30px; height: 30px; margin-bottom: 9px; }
.nav-glyph { font-size: 24px; color: #8194a4; margin-bottom: 9px; }

.nav-label { font-size: 17px; font-weight: 500; color: #8194a4; }
.nav-item.active .nav-label { font-weight: 600; color: #e8edf5; }

.rail-foot {
  position: absolute;
  left: 0;
  bottom: 30px;
  width: 132px;
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.status-pill {
  height: 46px;
  padding-left: 16px;
  padding-right: 16px;
  border-radius: 12px;
  background-color: rgba(30, 35, 60, 0.88);
  border-width: 1px;
  border-color: #1c2440;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-text { font-size: 17px; color: #e8edf5; }
</style>
