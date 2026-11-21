<template>
  <div class="apps" :focusable="false">
    <top-bar :height="96">
      <template #left>
        <div class="title-group" :focusable="false">
          <span class="page-title" :focusable="false">全部应用</span>
          <span class="page-sub" :focusable="false">{{ total }} 个应用，想看什么就选什么</span>
        </div>
      </template>
      <template #right>
        <!-- 应用少（< SEARCH_MIN_APPS）时不摆搜索框：对两三个应用做搜索是无意义交互，
             且键盘输入文字体验很差。目录长大后会自动出现。
             分类 chips 不设阈值、永远显示（见下方 .head 注释）。 -->
        <div
          v-if="showSearch"
          class="search"
          :focusable="true"
          :enableFocusBorder="true"
          eventClick
          eventFocus
          name="search"
          @click="$emit('search')"
        >
          <img
            v-if="!searchIconFailed"
            :src="icons.search"
            class="search-ico"
            @error="searchIconFailed = true"
            :focusable="false"
          />
          <span class="search-text" :focusable="false">搜索应用名称</span>
        </div>
      </template>
    </top-bar>

    <div class="body" :focusable="false">
      <!-- 分类筛选行：**永远显示**（分类 tab 保留，方便后面扩展）。
           高度固定 56，有无 chips 都占这一格，网格原点因此稳定。 -->
      <div class="head" :focusable="false">
        <div
          v-for="c in counts"
          :key="c.key"
          class="chip"
          :class="{ active: c.key === active }"
          :style="{ width: (c.key === 'all' ? 136 : 125) + 'px' }"
          :focusable="true"
          :enableFocusBorder="true"
          eventClick
          eventFocus
          :name="'chip-' + c.key"
          @click="active = c.key"
        >
          <span class="chip-text" :focusable="false">{{ c.label }}</span>
          <span class="chip-count" :focusable="false">{{ c.count }}</span>
        </div>
      </div>

      <div class="grid" :focusable="false">
        <app-tile
          v-for="app in filtered"
          :key="app.name"
          :app="app"
          variant="grid"
          :mr="22"
          :mb="24"
          @open="$emit('open', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'
import TopBar from './TopBar.vue'
import AppTile from './AppTile.vue'
import { ALL_APPS, CATEGORY_COUNTS, showSearch } from './appCatalog'
import { ICON_BASE } from '../../styles/tokens'
import type { AppCategory } from './appTypes'

export default defineComponent({
  name: 'AppsView',
  components: { TopBar, AppTile },
  emits: ['open', 'search'],
  setup() {
    const active = ref<AppCategory | 'all'>('all')
    const searchIconFailed = ref(false)
    const filtered = computed(() =>
      active.value === 'all'
        ? ALL_APPS.value
        : ALL_APPS.value.filter((x) => x.category === active.value)
    )
    const total = computed(() => ALL_APPS.value.length)
    return {
      active,
      searchIconFailed,
      filtered,
      counts: CATEGORY_COUNTS,
      total,
      showSearch,
      icons: { search: `${ICON_BASE}/search-icon.svg` },
    }
  },
})
</script>

<style scoped>
/* 样式全部落在 QuickTVUI / Hippy 支持的 CSS 子集内（同 HomeView 约定） */

.apps {
  position: absolute;
  left: 152px;
  top: 0;
  width: 1768px;
  height: 1080px;
  padding-top: 34px;
  padding-left: 56px;
  padding-right: 56px;
  display: flex;
  flex-direction: column;
}

.title-group {
  display: flex;
  flex-direction: column;
}

.page-title { font-size: 46px; font-weight: 700; color: #2E241B; }
.page-sub { margin-top: 6px; font-size: 22px; color: #8A7A6B; }

.search {
  width: 520px;
  height: 64px;
  padding-left: 24px;
  padding-right: 24px;
  border-radius: 32px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: row;
  align-items: center;
  focus-scale: 1.02;
  focus-border-width: 2px;
  focus-border-color: #FFC08A;
}

.search-ico { width: 24px; height: 24px; margin-right: 12px; }
.search-text { font-size: 22px; color: #A08B78; }

.body {
  width: 1656px;
  margin-top: 22px;
  display: flex;
  flex-direction: column;
}

/* 分类筛选行：高度固定 56，保证下面网格原点不变 */
.head {
  width: 1656px;
  height: 56px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.chip {
  height: 52px;
  margin-right: 14px;
  border-radius: 26px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  focus-scale: 1.04;
  focus-border-width: 2px;
  focus-border-color: #FFC08A;
}

.chip.active {
  background-color: #FF7A2F;
  border-color: #FF7A2F;
}

.chip-text { font-size: 22px; color: #5E4C3C; }
.chip-count { margin-left: 8px; font-size: 20px; color: #A08B78; }

.chip.active .chip-text { font-weight: 600; color: #FFFFFF; }
.chip.active .chip-count { font-weight: 600; color: #FFE7D6; }

/* 1656 = 8×185 + 8×22：flex-wrap 会把末位磁贴的右间距也算进换行判断，
   所以容器取「含末位列距」的总宽，一行正好 8 个。 */
.grid {
  width: 1656px;
  margin-top: 22px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
</style>
