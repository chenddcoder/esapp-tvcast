<template>
  <!-- 底部按键提示条（设计稿 72 高，顶部 1px 描边，gap 36）。
       kbd 方块 = surface3A88 底 + 1px 描边 + 17px 前景字；说明为 21px 次要字。
       最右为品牌行（如「客厅投屏中心 · HOME」）。 -->
  <div class="hintbar" :focusable="false">
    <div v-for="(h, i) in hints" :key="i" class="hint" :focusable="false">
      <div class="kbd" :focusable="false">
        <span class="kbd-text" :focusable="false">{{ h.kbd }}</span>
      </div>
      <span class="hint-label" :focusable="false">{{ h.label }}</span>
    </div>
    <div class="spacer" :focusable="false"></div>
    <span class="brandline" :focusable="false">{{ brandline }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export interface HintItem {
  kbd: string
  label: string
}

export default defineComponent({
  name: 'HintBar',
  props: {
    hints: { type: Array as () => HintItem[], default: () => [] },
    brandline: { type: String, default: '客厅投屏中心' },
  },
})
</script>

<style scoped>
.hintbar {
  width: 1788px;
  height: 72px;
  padding-left: 64px;
  padding-right: 64px;
  border-top-width: 1px;
  border-top-color: #1c2440;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.hint {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-right: 36px;
}

.kbd {
  height: 35px;
  padding-left: 10px;
  padding-right: 10px;
  margin-right: 10px;
  border-radius: 8px;
  background-color: rgba(30, 35, 60, 0.88);
  border-width: 1px;
  border-color: #1c2440;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kbd-text { font-size: 17px; color: #e8edf5; }
.hint-label { font-size: 21px; color: #8194a4; }

.spacer { flex: 1; }

.brandline {
  font-size: 17px;
  color: #8194a4;
  letter-spacing: 1.02px;
}
</style>
