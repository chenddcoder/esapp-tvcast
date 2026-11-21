<template>
  <!-- 主区顶栏（浅色暖调，无分隔线）：只负责容器与左右分布。
       首页 = 问候语/状态胶囊/大时钟（84 高），
       全部应用 / 游戏中心 = 页面标题组 + 搜索框 / 胶囊（96 高）。 -->
  <div class="topbar" :style="{ height: height + 'px' }" :focusable="false">
    <div class="tb-left" :focusable="false">
      <slot name="left"></slot>
    </div>
    <div class="tb-right" :focusable="false">
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'TopBar',
  props: {
    /** 顶栏高度（首页 84 / 应用与游戏 96） */
    height: { type: Number, default: 96 },
  },
})
</script>

<style scoped>
.topbar {
  width: 1656px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.tb-left {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.tb-right {
  display: flex;
  flex-direction: row;
  align-items: center;
}
</style>
