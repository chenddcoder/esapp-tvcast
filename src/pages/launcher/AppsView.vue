<template>
  <div class="apps" :focusable="false">
    <top-bar>
      <template #left>
        <span class="page-title" :focusable="false">全部应用</span>
        <span class="page-count" :focusable="false">共 {{ total }} 个应用</span>
      </template>
      <template #right>
        <!-- 应用少（< SEARCH_MIN_APPS）时不摆搜索框：对两三个应用做搜索是无意义交互，
             且 TV 遥控器输入文字体验很差。目录长大后会自动出现。
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
      <!-- 分类筛选行：**永远显示**（陈兄 2026-09-12：分类 tab 保留，方便后面扩展）。
           高度固定 60，有无 chips 都占这一格，网格原点因此始终落在设计稿的 232px。 -->
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
          <span class="chip-text" :focusable="false">{{ c.label }}{{ c.count }}</span>
        </div>
      </div>

      <div class="grid" :focusable="false">
        <app-tile
          v-for="app in filtered"
          :key="app.name"
          :app="app"
          variant="grid"
          :mr="24"
          :mb="32"
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
      active.value === 'all' ? ALL_APPS : ALL_APPS.filter((x) => x.category === active.value)
    )
    return {
      active,
      searchIconFailed,
      filtered,
      counts: CATEGORY_COUNTS,
      total: ALL_APPS.length,
      showSearch,
      icons: { search: `${ICON_BASE}/search-icon.svg` },
    }
  },
})
</script>

<style scoped>
.apps {
  position: absolute;
  left: 132px;
  top: 0;
  width: 1788px;
  height: 1080px;
  display: flex;
  flex-direction: column;
}

.page-title { font-size: 36px; font-weight: 600; color: #e8edf5; }
.page-count { margin-left: 18px; font-size: 21px; color: #8194a4; }

.search {
  width: 480px;
  height: 60px;
  padding-left: 23px;
  padding-right: 23px;
  border-radius: 16px;
  background-color: rgba(19, 23, 48, 0.88);
  border-width: 1px;
  border-color: #1c2440;
  display: flex;
  flex-direction: row;
  align-items: center;
  focus-scale: 1.02;
  focus-border-width: 1px;
  focus-border-color: rgba(251, 97, 90, 0.55);
}

.search-ico { width: 24px; height: 24px; margin-right: 14px; }
.search-text { font-size: 21px; color: #8194a4; }

.body {
  width: 1788px;
  padding-left: 64px;
  padding-right: 64px;
  padding-top: 32px;
  display: flex;
  flex-direction: column;
}

/* 分类筛选行：高度固定 60，保证下面网格原点不变 */
.head {
  width: 1660px;
  height: 60px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.chip {
  height: 60px;
  margin-right: 14px;
  border-radius: 999px;
  background-color: #0f1428;
  border-width: 1px;
  border-color: #1c2440;
  display: flex;
  align-items: center;
  justify-content: center;
  focus-scale: 1.04;
  focus-border-width: 1px;
  focus-border-color: rgba(232, 237, 245, 0.34);
}

.chip.active {
  background-color: rgba(30, 35, 60, 0.88);
  border-color: rgba(232, 237, 245, 0.34);
}

.chip-text { font-size: 22px; font-weight: 500; color: #8194a4; }
.chip.active .chip-text { font-weight: 600; color: #e8edf5; }

/* 1684 = 8×(185 磁贴 + 24 列距)：flex-wrap 会把末位磁贴的右间距算进换行判断，
   容器需比内容净宽 1660 多出一个列距，否则一行只放得下 7 个（8×209=1672>1660）。 */
.grid {
  width: 1684px;
  margin-top: 36px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
</style>
