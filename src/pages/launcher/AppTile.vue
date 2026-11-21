<template>
  <!-- 应用 / 游戏磁贴（浅色暖调）：
       recent = 首页「我的应用」200×226（图标 132 + 名称 24 + 副标 18）
       grid   = 全部应用 185×200（图标 120 + 名称 23）
       game   = 游戏中心 260×246（图标 120 + 名称 24 + 类型 19）
       图标未接入时用 c1→c2 渐变块 + glyph 字形兜底（图标策略：远端 → 本地兜底）。

       ⚠️ 变体类名必须带 tile- 前缀：web-renderer 按「类名」扁平合并 scoped 样式，
       变体若直接叫 `grid`，会和父级容器类 `.grid`（AppsView）撞名 →
       磁贴被额外套上容器的 `margin-top` 与 `flex-direction:row`。 -->
  <div
    class="tile"
    :class="'tile-' + variant"
    :style="{ marginRight: mr + 'px', marginBottom: mb + 'px' }"
    :focusable="true"
    :enableFocusBorder="true"
    eventClick
    eventFocus
    :name="'tile-' + app.name"
    @click="$emit('open', app)"
  >
    <div class="slot" :style="{ background: slotBg }" :focusable="false">
      <!-- 字形垫底 + 图标覆盖：线上个别图标地址返回的是 HTML 兜底页（HTTP 200），
           <img> 既不报错也不显示，只留一个空槽；垫底字形可保证磁贴永远有内容。
           不透明图标会完整盖住字形，透明线稿图标才会透出（可接受的降级）。 -->
      <span class="slot-glyph" :focusable="false">{{ app.glyph }}</span>
      <img
        v-if="app.icon && !failed"
        :src="app.icon"
        class="slot-img"
        @error="failed = true"
        :focusable="false"
      />
    </div>
    <span class="name" :focusable="false">{{ app.name }}</span>
    <span v-if="metaText" class="meta" :focusable="false">{{ metaText }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'
import type { TileItem } from './appTypes'

export default defineComponent({
  name: 'AppTile',
  props: {
    app: { type: Object as () => TileItem, required: true },
    /** recent = 首页 / grid = 全部应用 / game = 游戏中心 */
    variant: { type: String, default: 'grid' },
    /** 右间距（列距），由父级控制以免用 :deep */
    mr: { type: Number, default: 22 },
    /** 下间距（行距），首页单行传 0 */
    mb: { type: Number, default: 0 },
  },
  emits: ['open'],
  setup(props) {
    const failed = ref(false)
    // 有图标 → 深色槽底（线上图标多为白色线稿，浅底会看不见）；无图标 → 品牌渐变块 + 字形兜底
    const slotBg = computed(() =>
      props.app.icon && !failed.value
        ? '#2E241B'
        : `linear-gradient(145deg, ${props.app.c1}, ${props.app.c2})`
    )
    // recent / game 变体展示副标题；grid 只有名称
    const metaText = computed(() => {
      if (props.variant === 'grid') return ''
      const category = (props.app as unknown as { category?: string }).category
      return category || props.app.meta || ''
    })
    return { failed, slotBg, metaText }
  },
})
</script>

<style scoped>
.tile {
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  focus-scale: 1.05;
  focus-border-width: 2px;
  focus-border-color: #FFC08A;
  focus-background-color: #FFF7EC;
}

.tile.tile-recent {
  width: 200px;
  height: 226px;
  padding-top: 14px;
  padding-bottom: 14px;
  padding-left: 8px;
  padding-right: 8px;
}

.tile.tile-grid {
  width: 185px;
  height: 200px;
  padding-top: 12px;
  padding-bottom: 12px;
  padding-left: 6px;
  padding-right: 6px;
  border-radius: 26px;
}

.tile.tile-game {
  width: 260px;
  height: 246px;
  padding-top: 16px;
  padding-bottom: 16px;
  padding-left: 8px;
  padding-right: 8px;
}

.slot {
  position: relative;
  border-radius: 36px;
  background-color: #FFF1E2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 各变体图标槽尺寸（设计稿 132/120/120） */
.tile-recent .slot { width: 132px; height: 132px; border-radius: 36px; }
.tile-grid .slot { width: 120px; height: 120px; border-radius: 32px; }
.tile-game .slot { width: 120px; height: 120px; border-radius: 34px; }

/* 图标绝对定位覆盖在字形之上；尺寸与图标槽一致 */
.slot-img {
  position: absolute;
  left: 0;
  top: 0;
}

.tile-recent .slot-img { width: 132px; height: 132px; }
.tile-grid .slot-img { width: 120px; height: 120px; }
.tile-game .slot-img { width: 120px; height: 120px; }

.slot-glyph { font-size: 56px; font-weight: 800; color: #FFFFFF; }

.name {
  margin-top: 12px;
  font-weight: 600;
  color: #2E241B;
}

.tile-recent .name { font-size: 24px; }
.tile-grid .name { font-size: 23px; }
.tile-game .name { font-size: 24px; }

.meta {
  margin-top: 12px;
  color: #8A7A6B;
}

.tile-recent .meta { font-size: 18px; }
.tile-game .meta { font-size: 19px; }
</style>
