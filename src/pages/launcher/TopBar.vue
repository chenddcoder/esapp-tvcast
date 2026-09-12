<template>
  <!-- 主区顶栏（设计稿 104 高，左右留白 64，底部 1px 描边）。
       两种形态差异全部由插槽内容承担：首页 = 设备名/状态胶囊/大时钟，
       全部应用 = 页面标题/计数/搜索框。此处只负责容器与分隔线。 -->
  <div class="topbar" :focusable="false">
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

export default defineComponent({ name: 'TopBar' })
</script>

<style scoped>
.topbar {
  width: 1788px;
  height: 104px;
  padding-left: 64px;
  padding-right: 64px;
  border-bottom-width: 1px;
  border-bottom-color: #1c2440;
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
