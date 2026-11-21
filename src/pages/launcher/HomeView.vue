<template>
  <div class="home" :focusable="false">
    <top-bar :height="84">
      <template #left>
        <div class="greet-wrap" :focusable="false">
          <span class="greeting" :focusable="false">{{ greeting }}</span>
          <div class="pills" :focusable="false">
            <div class="pill" :focusable="false">
              <div class="pill-dot" :style="{ backgroundColor: stateReady ? '#4CB782' : '#A08B78' }" :focusable="false"></div>
              <span class="pill-text" :focusable="false">{{ deviceName }}</span>
            </div>
            <div class="pill pill-warm" :focusable="false">
              <div class="pill-dot pill-dot-warm" :focusable="false"></div>
              <span class="pill-warm-text" :focusable="false">{{ stateText }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #right>
        <span class="clock" :focusable="false">{{ clock }}</span>
        <span class="date" :focusable="false">{{ date }}</span>
      </template>
    </top-bar>

    <div class="body" :focusable="false">
      <hero-card @cast="$emit('cast')" @guide="$emit('guide')" />

      <div class="section" :focusable="false">
        <div class="sec-head" :focusable="false">
          <span class="sec-title" :focusable="false">我的应用</span>
          <div
            class="sec-link"
            :focusable="true"
            :enableFocusBorder="true"
            eventClick
            eventFocus
            name="moreApps"
            @click="$emit('nav', 'apps')"
          >
            <span class="sec-link-text" :focusable="false">全部应用</span>
            <span class="sec-link-arrow" :focusable="false">›</span>
          </div>
        </div>

        <div class="tiles" :focusable="false">
          <app-tile
            v-for="app in installed"
            :key="app.name"
            :app="app"
            variant="recent"
            :mr="20"
            :mb="0"
            @open="$emit('open', $event)"
          />
        </div>
      </div>

      <div class="hint" :focusable="false">
        <span class="hint-text" :focusable="false">键盘：方向键移动 · Enter 打开 · Esc 返回上一层</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TopBar from './TopBar.vue'
import HeroCard from './HeroCard.vue'
import AppTile from './AppTile.vue'
import { INSTALLED_APPS } from './appCatalog'

/** 按时段给问候语（设计稿为「下午好，开始投屏吧」） */
function greetingByHour(hour: number): string {
  if (hour >= 5 && hour < 11) return '早上好，开始投屏吧'
  if (hour >= 11 && hour < 13) return '中午好，开始投屏吧'
  if (hour >= 13 && hour < 18) return '下午好，开始投屏吧'
  return '晚上好，开始投屏吧'
}

export default defineComponent({
  name: 'HomeView',
  components: { TopBar, HeroCard, AppTile },
  props: {
    deviceName: { type: String, default: 'PC投屏 · 我的电脑' },
    clock: { type: String, default: '--:--' },
    date: { type: String, default: '' },
    /** DLNA 投屏就绪状态（真实状态，非静态文案） */
    stateReady: { type: Boolean, default: false },
    stateText: { type: String, default: 'DLNA 已就绪' },
  },
  emits: ['cast', 'guide', 'open', 'nav'],
  setup() {
    return {
      greeting: greetingByHour(new Date().getHours()),
      installed: INSTALLED_APPS,
    }
  },
})
</script>

<style scoped>
/* 样式全部落在 QuickTVUI / Hippy 支持的 CSS 子集内：
   无 CSS 变量 / gap / grid / % / auto / radial-gradient / transition；
   padding·margin 不用多值简写（末值非 0 会丢值） */

.home {
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

.greet-wrap {
  display: flex;
  flex-direction: column;
}

.greeting { font-size: 34px; font-weight: 700; color: #2E241B; }

.pills {
  margin-top: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.pill {
  height: 44px;
  padding-left: 18px;
  padding-right: 18px;
  border-radius: 22px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.pill-warm {
  margin-left: 10px;
  background-color: #FFF1E2;
  border-color: #FFF1E2;
}

.pill-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  margin-right: 8px;
}

.pill-dot-warm { background-color: #FF7A2F; }

.pill-text { font-size: 20px; font-weight: 500; color: #5E4C3C; }
.pill-warm-text { font-size: 20px; font-weight: 500; color: #E9661E; }

.clock { font-size: 56px; font-weight: 700; color: #2E241B; }
.date { margin-left: 22px; font-size: 21px; color: #8A7A6B; }

.body {
  width: 1656px;
  margin-top: 26px;
  display: flex;
  flex-direction: column;
}

.section {
  width: 1656px;
  margin-top: 26px;
  display: flex;
  flex-direction: column;
}

.sec-head {
  height: 44px;
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

.sec-link-text { font-size: 22px; font-weight: 500; color: #8A7A6B; }
.sec-link-arrow { margin-left: 6px; font-size: 20px; color: #8A7A6B; }

/* 1560 = 7×200 + 7×20：flex-wrap 会把末位磁贴的右间距也算进换行判断，
   容器取「含末位列距」的总宽，一行正好 7 个。 */
.tiles {
  width: 1560px;
  margin-top: 18px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.hint {
  height: 40px;
  margin-top: 26px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.hint-text { font-size: 20px; color: #A08B78; }
</style>
