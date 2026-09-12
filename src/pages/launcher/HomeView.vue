<template>
  <div class="home" :focusable="false">
    <top-bar>
      <template #left>
        <span class="device-name" :focusable="false">{{ deviceName }}</span>
        <div class="pill" :focusable="false">
          <img
            v-if="!wifiFailed"
            :src="icons.wifi"
            class="pill-ico"
            @error="wifiFailed = true"
            :focusable="false"
          />
          <span class="pill-text" :focusable="false">{{ netText }}</span>
        </div>
        <div class="pill" :focusable="false">
          <div class="pill-dot" :style="{ backgroundColor: stateReady ? '#61cb7c' : '#8194a4' }" :focusable="false"></div>
          <span class="pill-text" :focusable="false">{{ stateText }}</span>
        </div>
      </template>
      <template #right>
        <span class="clock" :focusable="false">{{ clock }}</span>
        <span class="date" :focusable="false">{{ date }}</span>
      </template>
    </top-bar>

    <div class="body" :focusable="false">
      <div class="hero-row" :focusable="false">
        <hero-card @cast="$emit('cast')" />
        <device-panel :device-name="deviceName" :ready="stateReady" />
      </div>

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
            :mr="25"
            :mb="0"
            @open="$emit('open', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import TopBar from './TopBar.vue'
import HeroCard from './HeroCard.vue'
import DevicePanel from './DevicePanel.vue'
import AppTile from './AppTile.vue'
import { INSTALLED_APPS } from './appCatalog'
import { ICON_BASE } from '../../styles/tokens'

export default defineComponent({
  name: 'HomeView',
  components: { TopBar, HeroCard, DevicePanel, AppTile },
  props: {
    deviceName: { type: String, default: '投屏显象' },
    clock: { type: String, default: '--:--' },
    date: { type: String, default: '' },
    /** DLNA 投屏就绪状态（真实状态，非静态文案） */
    stateReady: { type: Boolean, default: false },
    stateText: { type: String, default: '投屏就绪' },
    /** 网络状态：拿不到 SSID / 频段，只报连接状态 */
    netText: { type: String, default: '已连接' },
  },
  emits: ['cast', 'open', 'nav'],
  setup() {
    const wifiFailed = ref(false)
    return {
      wifiFailed,
      installed: INSTALLED_APPS,
      icons: { wifi: `${ICON_BASE}/wifi-icon.svg` },
    }
  },
})
</script>

<style scoped>
.home {
  position: absolute;
  left: 132px;
  top: 0;
  width: 1788px;
  height: 1080px;
  display: flex;
  flex-direction: column;
}

.device-name { font-size: 27px; font-weight: 600; color: #e8edf5; }

.pill {
  height: 52px;
  margin-left: 12px;
  padding-left: 23px;
  padding-right: 23px;
  border-radius: 999px;
  background-color: rgba(19, 23, 48, 0.88);
  border-width: 1px;
  border-color: #1c2440;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.pill-ico { width: 20px; height: 20px; margin-right: 11px; }

.pill-dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  margin-right: 11px;
}

.pill-text { font-size: 21px; color: #8194a4; }

.clock { font-size: 48px; font-weight: 600; color: #e8edf5; }
.date { margin-left: 26px; font-size: 21px; color: #8194a4; }

.body {
  width: 1788px;
  padding-left: 64px;
  padding-right: 64px;
  padding-top: 32px;
  display: flex;
  flex-direction: column;
}

.hero-row {
  width: 1660px;
  display: flex;
  flex-direction: row;
}

.section {
  width: 1660px;
  margin-top: 36px;
}

.sec-head {
  height: 48px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.sec-title { font-size: 34px; font-weight: 600; color: #e8edf5; }

.sec-link {
  height: 40px;
  padding-left: 12px;
  padding-right: 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  focus-scale: 1.05;
  focus-border-width: 1px;
  focus-border-color: rgba(232, 237, 245, 0.34);
  focus-background-color: rgba(232, 237, 245, 0.06);
}

.sec-link-text { font-size: 23px; font-weight: 500; color: #8194a4; }
.sec-link-arrow { margin-left: 10px; font-size: 26px; color: #8194a4; }

/* 1685 = 8×(185 磁贴 + 25 列距)：flex-wrap 会把末位磁贴的右间距也算进换行判断，
   所以容器要比内容净宽 1660 多出「一个列距」，否则第 8 个磁贴会被挤到第二行。
   多出的 25px 落在 body 的 padding-right 空白区，视觉上无影响。 */
.tiles {
  width: 1685px;
  margin-top: 24px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
</style>
