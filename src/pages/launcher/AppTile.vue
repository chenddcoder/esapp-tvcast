<template>
  <!-- 应用磁贴（设计稿磁贴：无卡片框，图标槽 148 + 名称 26px + 副标题 21px）。
       variant=recent（首页 185×272，带副标题） / grid（全部应用 185×212）。
       图标未接入时用 c1→c2 渐变块 + glyph 字形兜底（图标策略：远端 → 本地兜底）。

       ⚠️ 变体类名必须带 tile- 前缀：web-renderer 按「类名」扁平合并 scoped 样式，
       变体若直接叫 `grid`，会和父级容器类 `.grid`（AppsView）撞名 →
       磁贴被额外套上容器的 `margin-top:36px` 与 `flex-direction:row`，
       实测后果是行距 244→280、三行整体下移并把底行压到提示条上。 -->
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
      <img
        v-if="app.icon && !failed"
        :src="app.icon"
        class="slot-img"
        @error="failed = true"
        :focusable="false"
      />
      <span v-else class="slot-glyph" :focusable="false">{{ app.glyph }}</span>
    </div>
    <span class="name" :focusable="false">{{ app.name }}</span>
    <span v-if="variant === 'recent'" class="meta" :focusable="false">{{ app.meta || app.category }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'
import type { TileItem } from './appTypes'

export default defineComponent({
  name: 'AppTile',
  props: {
    app: { type: Object as () => TileItem, required: true },
    /** recent = 首页「我的应用」（带副标题） / grid = 全部应用网格 */
    variant: { type: String, default: 'grid' },
    /** 右间距（列距），由父级控制以免用 :deep */
    mr: { type: Number, default: 24 },
    /** 下间距（行距），首页单行传 0 */
    mb: { type: Number, default: 0 },
  },
  emits: ['open'],
  setup(props) {
    const failed = ref(false)
    // 有图标 → 深色槽底（设计稿形态，图标自带品牌色）；无图标 → 品牌渐变块 + 字形兜底
    const slotBg = computed(() =>
      props.app.icon && !failed.value
        ? '#020409'
        : `linear-gradient(145deg, ${props.app.c1}, ${props.app.c2})`
    )
    return { failed, slotBg }
  },
})
</script>

<style scoped>
.tile {
  border-radius: 20px;
  padding-left: 8px;
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  focus-scale: 1.06;
  focus-border-width: 2px;
  focus-border-color: rgba(232, 237, 245, 0.34);
  focus-background-color: rgba(232, 237, 245, 0.06);
}

.tile.tile-grid {
  width: 185px;
  height: 212px;
  padding-top: 12px;
}

.tile.tile-recent {
  width: 185px;
  height: 272px;
  padding-top: 12px;
}

.slot {
  width: 148px;
  height: 148px;
  border-radius: 33px;
  background-color: #020409;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.slot-img { width: 148px; height: 148px; }
.slot-glyph { font-size: 62px; font-weight: 800; color: #e8edf5; }

.name {
  margin-top: 10px;
  font-size: 26px;
  font-weight: 600;
  color: #e8edf5;
}

.meta {
  margin-top: 12px;
  font-size: 21px;
  color: #8194a4;
}
</style>
