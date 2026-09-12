<template>
  <!-- 游戏中心 tab：切到本视图（组件挂载）时读缓存/按过期策略拉取游戏库。
       数据来自 www.chenddcoder.cn /api/game/list（与游戏中心快应用同一后端、同一契约）。
       分类 chips 只在「有游戏的分类 ≥ 2」时出现 —— 一个分类时筛选没有意义，
       该 60px 格位改显示说明，网格原点因此始终对齐设计稿的 232px。
       （注意与「全部应用」的差异：那边 chips **无条件常显**，是陈兄 2026-09-12 明确要求
         「分类 tab 保留着，方便后面扩展」；这里不照搬，是因为只有一个分类时
         会出现「全部1」这种无任何替代选项的孤零零一颗 chip，纯噪声。） -->
  <div class="games" :focusable="false">
    <top-bar>
      <template #left>
        <span class="page-title" :focusable="false">游戏中心</span>
        <span class="page-count" :focusable="false">共 {{ total }} 个游戏</span>
      </template>
      <template #right>
        <span class="cache-note" :focusable="false">{{ statusText }}</span>
        <div
          class="refresh"
          :focusable="true"
          :enableFocusBorder="true"
          eventClick
          eventFocus
          name="gamesRefresh"
          @click="reload(true)"
        >
          <span class="refresh-text" :focusable="false">刷新</span>
        </div>
      </template>
    </top-bar>

    <div class="body" :focusable="false">
      <div class="head" :focusable="false">
        <template v-if="chips.length > 2">
          <div
            v-for="c in chips"
            :key="c.id"
            class="chip"
            :class="{ active: c.id === activeCat }"
            :style="{ width: (c.id === 0 ? 136 : 125) + 'px' }"
            :focusable="true"
            :enableFocusBorder="true"
            eventClick
            eventFocus
            :name="'gchip-' + c.id"
            @click="activeCat = c.id"
          >
            <span class="chip-text" :focusable="false">{{ c.name }}{{ c.count }}</span>
          </div>
        </template>
        <span v-else class="head-note" :focusable="false">
          游戏库持续更新，新游戏上架后会自动出现在这里
        </span>
      </div>

      <div v-if="loading" class="msg" :focusable="false">
        <span class="msg-text" :focusable="false">正在加载游戏库…</span>
      </div>
      <div v-else-if="!tiles.length" class="msg" :focusable="false">
        <span class="msg-text" :focusable="false">{{ emptyText }}</span>
      </div>
      <div v-else class="grid" :focusable="false">
        <app-tile
          v-for="t in tiles"
          :key="t.key"
          :app="t.item"
          variant="grid"
          :mr="24"
          :mb="32"
          @open="$emit('open', t.game)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, onMounted, ref } from 'vue'
import TopBar from './TopBar.vue'
import AppTile from './AppTile.vue'
import {
  loadGames,
  EMPTY_GAMES_STATE,
  flattenGames,
  categoriesWithGames,
  type GameItem,
  type GamesState,
} from './gamesApi'
import type { TileItem } from './appTypes'

export default defineComponent({
  name: 'GamesView',
  components: { TopBar, AppTile },
  emits: ['open'],
  setup(_props, { emit }) {
    const state = ref<GamesState>({ ...EMPTY_GAMES_STATE })
    const loading = ref(true)
    /** 0 = 全部分类 */
    const activeCat = ref(0)
    /** 卸载后不写状态（切 tab 很快时避免旧结果覆盖新视图） */
    let alive = true

    const reload = async (force = false) => {
      loading.value = true
      const next = await loadGames(force)
      if (!alive) return
      state.value = next
      // 选中的分类可能因刷新消失，回落「全部」
      if (activeCat.value !== 0 && !next.list.some((c) => c.id === activeCat.value)) {
        activeCat.value = 0
      }
      loading.value = false
    }

    const games = computed<GameItem[]>(() => flattenGames(state.value.list))
    const total = computed(() => games.value.length)

    const visible = computed<GameItem[]>(() =>
      activeCat.value === 0
        ? games.value
        : games.value.filter((g) => g.category_id === activeCat.value)
    )

    /** 游戏 → 磁贴数据（图标是该游戏的彩色方角图标，失败退名称首字） */
    const tiles = computed(() =>
      visible.value.map((g) => ({
        key: 'g' + g.id,
        game: g,
        item: {
          name: g.name,
          glyph: g.name.charAt(0),
          c1: '#2c3a63',
          c2: '#121a33',
          pkg: g.pkg,
          icon: g.icon,
        } as TileItem,
      }))
    )

    /** chips：全部 + 有游戏的分类（调用方按数量决定是否显示） */
    const chips = computed(() => {
      const cats = categoriesWithGames(state.value.list)
      return [
        { id: 0, name: '全部', count: total.value },
        ...cats.map((c) => ({ id: c.id, name: c.name, count: c.games.length })),
      ]
    })

    const emptyText = computed(() =>
      state.value.error ? `游戏库加载失败：${state.value.error}` : '游戏库暂时没有内容'
    )

    const hhmm = (ts: number) => {
      const d = new Date(ts)
      const p = (n: number) => (n < 10 ? '0' + n : '' + n)
      return `${p(d.getHours())}:${p(d.getMinutes())}`
    }

    /** 缓存状态如实标注：命中缓存的标"缓存"，过期的标"已过期"，失败标原因 */
    const statusText = computed(() => {
      if (loading.value) return '加载中…'
      if (state.value.error) return state.value.error
      if (!state.value.updatedAt) return ''
      const prefix = state.value.fromCache ? (state.value.expired ? '缓存已过期 · ' : '缓存 · ') : ''
      return `${prefix}更新于 ${hhmm(state.value.updatedAt)}`
    })

    // 挂载即加载 = 「切 tab 时拉取」；缓存未过期则不发请求
    onMounted(() => reload(false))

    return {
      state,
      loading,
      activeCat,
      chips,
      tiles,
      total,
      emptyText,
      statusText,
      reload,
      onOpen: (g: GameItem) => emit('open', g),
    }
  },
})
</script>

<style scoped>
.games {
  position: absolute;
  left: 132px;
  top: 0;
  width: 1788px;
  height: 1080px;
  display: flex;
  flex-direction: column;
}

/* 与 AppsView 的页标题同款（同名同声明，撞名无害） */
.page-title { font-size: 36px; font-weight: 600; color: #e8edf5; }
.page-count { margin-left: 18px; font-size: 21px; color: #8194a4; }

.cache-note { margin-right: 16px; font-size: 19px; color: #8194a4; }

.refresh {
  width: 124px;
  height: 60px;
  border-radius: 16px;
  background-color: rgba(19, 23, 48, 0.88);
  border-width: 1px;
  border-color: #1c2440;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  focus-scale: 1.02;
  focus-border-width: 1px;
  focus-border-color: rgba(251, 97, 90, 0.55);
}

.refresh-text { font-size: 22px; font-weight: 500; color: #e8edf5; }

.body {
  width: 1788px;
  padding-left: 64px;
  padding-right: 64px;
  padding-top: 32px;
  display: flex;
  flex-direction: column;
}

/* 分类 chips 行 / 说明行共用这一格：高度固定 60，保证下面网格原点不变 */
.head {
  width: 1660px;
  height: 60px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.head-note { font-size: 21px; color: #8194a4; }

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
   容器需比内容净宽 1660 多出一个列距，否则一行只放得下 7 个。 */
.grid {
  width: 1684px;
  margin-top: 36px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.msg {
  width: 1660px;
  margin-top: 36px;
  height: 240px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.msg-text { font-size: 23px; color: #8194a4; }
</style>
