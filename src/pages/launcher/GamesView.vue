<template>
  <!-- 游戏中心 tab：切到本视图（组件挂载）时读缓存/按过期策略拉取游戏库。
       数据来自 www.chenddccoder.cn /api/game/list（与游戏中心快应用同一后端、同一契约）。
       版式按设计稿 03 屏：标题行 + 两张推荐大卡 + 全部游戏磁贴 + 能力标签行。 -->
  <div class="games" :focusable="false">
    <top-bar :height="96">
      <template #left>
        <div class="title-group" :focusable="false">
          <span class="page-title" :focusable="false">游戏中心</span>
          <span class="page-sub" :focusable="false">下班来一局，随手就开玩</span>
        </div>
      </template>
      <template #right>
        <!-- 右侧胶囊只放真实状态（缓存时间 / 加载中），没有数据就整颗隐藏 -->
        <div v-if="freshText" class="fresh-pill" :focusable="false">
          <div class="fresh-dot" :focusable="false"></div>
          <span class="fresh-text" :focusable="false">{{ freshText }}</span>
        </div>
      </template>
    </top-bar>

    <div class="body" :focusable="false">
      <div v-if="loading" class="msg" :focusable="false">
        <span class="msg-text" :focusable="false">正在加载游戏库…</span>
      </div>
      <template v-else>
        <div v-if="!games.length" class="msg" :focusable="false">
          <span class="msg-text" :focusable="false">{{ emptyText }}</span>
        </div>

        <template v-else>
          <!-- 推荐位取游戏库前两款（真实数据，不写死游戏名） -->
          <div class="rec-row" :focusable="false">
            <div
              v-for="(c, i) in featured"
              :key="c.key"
              class="rec-card"
              :class="i === 0 ? 'rec-green' : 'rec-purple rec-second'"
              :focusable="false"
            >
              <div class="rec-tag" :focusable="false">
                <span class="rec-tag-text" :focusable="false">{{ c.tag }}</span>
              </div>
              <span class="rec-title" :focusable="false">{{ c.game.name }}</span>
              <span class="rec-desc" :focusable="false">{{ c.desc }}</span>
              <div
                class="rec-btn"
                :focusable="true"
                :enableFocusBorder="true"
                eventClick
                eventFocus
                :name="'rec-' + c.key"
                @click="$emit('open', c.game)"
              >
                <span class="rec-btn-text" :class="i === 0 ? 'rec-btn-green' : 'rec-btn-purple'" :focusable="false">
                  立即开玩
                </span>
              </div>
            </div>
          </div>

          <div class="section" :focusable="false">
            <div class="sec-head" :focusable="false">
              <span class="sec-title" :focusable="false">全部游戏</span>
              <!-- 「共 N 款」同时作为手动刷新入口（设计稿的箭头即交互位） -->
              <div
                class="sec-link"
                :focusable="true"
                :enableFocusBorder="true"
                eventClick
                eventFocus
                name="gamesRefresh"
                @click="reload(true)"
              >
                <span class="sec-link-text" :focusable="false">共 {{ total }} 款</span>
                <span class="sec-link-arrow" :focusable="false">›</span>
              </div>
            </div>

            <div class="grid" :focusable="false">
              <app-tile
                v-for="t in tiles"
                :key="t.key"
                :app="t.item"
                variant="game"
                :mr="19"
                :mb="19"
                @open="$emit('open', t.game)"
              />
            </div>
          </div>

          <div class="caps" :focusable="false">
            <div v-for="cap in caps" :key="cap" class="cap" :focusable="false">
              <div class="cap-dot" :focusable="false"></div>
              <span class="cap-text" :focusable="false">{{ cap }}</span>
            </div>
          </div>
        </template>
      </template>
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
  type GameItem,
  type GamesState,
} from './gamesApi'
import type { TileItem } from './appTypes'

export default defineComponent({
  name: 'GamesView',
  components: { TopBar, AppTile },
  emits: ['open'],
  setup() {
    const state = ref<GamesState>({ ...EMPTY_GAMES_STATE })
    const loading = ref(true)
    /** 卸载后不写状态（切 tab 很快时避免旧结果覆盖新视图） */
    let alive = true

    const reload = async (force = false) => {
      loading.value = true
      const next = await loadGames(force)
      if (!alive) return
      state.value = next
      loading.value = false
    }

    const games = computed<GameItem[]>(() => flattenGames(state.value.list))
    const total = computed(() => games.value.length)

    /** 分类名（推荐卡副标签用真实分类，不写死） */
    const categoryName = (id: number): string =>
      state.value.list.find((c) => c.id === id)?.name || '推荐'

    /** 推荐位：游戏库前两款，文案全部取接口字段 */
    const featured = computed(() =>
      games.value.slice(0, 2).map((g) => ({
        key: 'g' + g.id,
        game: g,
        tag: `${categoryName(g.category_id)} · 即点即玩`,
        desc: g.description || '键盘与手柄都能玩，点开即开局',
      }))
    )

    /** 游戏 → 磁贴数据（图标失败退名称首字） */
    const tiles = computed(() =>
      games.value.map((g) => ({
        key: 'g' + g.id,
        game: g,
        item: {
          name: g.name,
          glyph: g.name.charAt(0),
          c1: '#C3A8F5',
          c2: '#8B6FE0',
          pkg: g.pkg,
          icon: g.icon,
          meta: `${g.rating === '12+' ? '12+' : '全年龄'} · ${categoryName(g.category_id)}`,
        } as TileItem,
      }))
    )

    const emptyText = computed(() =>
      state.value.error ? `游戏库加载失败：${state.value.error}` : '游戏库暂时没有内容'
    )

    const hhmm = (ts: number) => {
      const d = new Date(ts)
      const p = (n: number) => (n < 10 ? '0' + n : '' + n)
      return `${p(d.getHours())}:${p(d.getMinutes())}`
    }

    /** 右上胶囊：只在有真实缓存时间时显示；失败信息留给正文空态，不塞胶囊 */
    const freshText = computed(() => {
      if (loading.value) return '加载中…'
      if (state.value.error || !state.value.updatedAt) return ''
      const prefix = state.value.fromCache ? (state.value.expired ? '缓存已过期 · ' : '本地缓存 · ') : ''
      return `${prefix}更新于 ${hhmm(state.value.updatedAt)}`
    })

    const caps = ['支持键盘与手柄', '本地双人同屏', '免下载，秒开即玩']

    // 挂载即加载 = 「切 tab 时拉取」；缓存未过期则不发请求
    onMounted(() => reload(false))

    return {
      loading,
      games,
      total,
      featured,
      tiles,
      caps,
      emptyText,
      freshText,
      reload,
    }
  },
})
</script>

<style scoped>
/* 样式全部落在 QuickTVUI / Hippy 支持的 CSS 子集内（同 HomeView 约定） */

.games {
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

.fresh-pill {
  height: 52px;
  padding-left: 22px;
  padding-right: 22px;
  border-radius: 26px;
  background-color: #FFF1E2;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.fresh-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background-color: #FF7A2F;
  margin-right: 8px;
}

.fresh-text { font-size: 21px; font-weight: 600; color: #E9661E; }

.body {
  width: 1656px;
  margin-top: 24px;
  display: flex;
  flex-direction: column;
}

/* 推荐大卡：815×360，两张 + 26 列距 = 1656 */
.rec-row {
  width: 1656px;
  display: flex;
  flex-direction: row;
}

.rec-card {
  width: 815px;
  height: 360px;
  padding: 36px;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
}

.rec-second { margin-left: 26px; }

.rec-green { background: linear-gradient(135deg, #5BC98F, #2F9468); }
.rec-purple { background: linear-gradient(135deg, #A98CF0, #7357C9); }

.rec-tag {
  height: 42px;
  padding-left: 16px;
  padding-right: 16px;
  border-radius: 21px;
  background-color: rgba(255, 255, 255, 0.24);
  display: flex;
  flex-direction: row;
  align-items: center;
  align-self: flex-start;
}

.rec-tag-text { font-size: 20px; font-weight: 600; color: #FFFFFF; }

.rec-title {
  margin-top: 30px;
  font-size: 54px;
  font-weight: 800;
  color: #FFFFFF;
}

.rec-desc {
  margin-top: 10px;
  font-size: 23px;
  color: #EAF8F0;
  max-width: 700px;
}

.rec-btn {
  margin-top: 18px;
  width: 190px;
  height: 58px;
  border-radius: 29px;
  background-color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  focus-scale: 1.04;
  focus-border-width: 2px;
  focus-border-color: rgba(255, 255, 255, 0.6);
}

.rec-btn-text { font-size: 22px; font-weight: 700; }
.rec-btn-green { color: #2F9468; }
.rec-btn-purple { color: #7357C9; }

.section {
  width: 1656px;
  margin-top: 24px;
  display: flex;
  flex-direction: column;
}

.sec-head {
  height: 48px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.sec-title { font-size: 34px; font-weight: 700; color: #2E241B; }

.sec-link {
  height: 40px;
  padding-left: 12px;
  padding-right: 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  focus-scale: 1.04;
  focus-border-width: 1px;
  focus-border-color: #FFC08A;
  focus-background-color: #FFF7EC;
}

.sec-link-text { font-size: 22px; color: #8A7A6B; }
.sec-link-arrow { margin-left: 6px; font-size: 20px; color: #8A7A6B; }

/* 1674 = 6×260 + 6×19：含末位列距，一行 6 款 */
.grid {
  width: 1674px;
  margin-top: 18px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.caps {
  margin-top: 24px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.cap {
  height: 52px;
  margin-right: 14px;
  padding-left: 20px;
  padding-right: 20px;
  border-radius: 26px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.cap-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background-color: #E9661E;
  margin-right: 10px;
}

.cap-text { font-size: 21px; color: #5E4C3C; }

.msg {
  width: 1656px;
  height: 240px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.msg-text { font-size: 23px; color: #8A7A6B; }
</style>
