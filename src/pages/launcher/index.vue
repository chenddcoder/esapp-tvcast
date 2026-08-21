<template>
  <div class="launcher-root" :focusable="false" ref="rootRef">
    <!-- 背景 -->
    <div class="bg" :focusable="false"></div>
    <div class="bg-glow" :focusable="false"></div>

    <!-- 顶部状态栏 -->
    <div class="status-bar" :focusable="false">
      <div class="sb-left" :focusable="false">
        <div class="brand" :focusable="false">
          <span class="brand-mark" :focusable="false">投</span>
          <span class="brand-text" :focusable="false">投屏显象</span>
        </div>
        <span class="device-name" :focusable="false">{{ deviceName }}</span>
      </div>
      <div class="sb-right" :focusable="false">
        <div class="cast-ready" :focusable="false">
          <div class="dot" :focusable="false"></div>
          <span class="cast-ready-text" :focusable="false">可投屏</span>
        </div>
        <span class="wifi" :focusable="false">Wi-Fi</span>
        <span class="clock" :focusable="false">{{ clock }}</span>
      </div>
    </div>

    <!-- 主体 -->
    <div class="body" :focusable="false">
      <!-- 最近打开 -->
      <div class="section" :focusable="false">
        <div class="section-title" :focusable="false"><span class="bar"></span><span class="st-text">最近打开</span></div>
        <div class="recent-row" :focusable="false">
          <div v-for="(app, i) in recent" :key="'r' + i"
               class="app-card recent"
               :focusable="true" eventClick eventFocus
               name="recentApp"
               @click="onOpenApp(app)"
               @focus="onFocus">
            <div class="app-icon" :style="{ backgroundColor: app.color }" :focusable="false"><span class="glyph">{{ app.glyph }}</span></div>
            <span class="app-name" :focusable="false">{{ app.name }}</span>
          </div>
        </div>
      </div>

      <!-- 全部应用 -->
      <div class="section" :focusable="false">
        <div class="section-title" :focusable="false"><span class="bar"></span><span class="st-text">全部应用</span></div>
        <div class="app-grid" :focusable="false">
          <div v-for="(app, i) in allApps" :key="'a' + i"
               class="app-card grid"
               :focusable="true" eventClick eventFocus
               name="allApp"
               @click="onOpenApp(app)"
               @focus="onFocus">
            <div class="app-icon" :style="{ backgroundColor: app.color }" :focusable="false"><span class="glyph">{{ app.glyph }}</span></div>
            <span class="app-name" :focusable="false">{{ app.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 dock -->
    <div class="dock" :focusable="false">
      <div class="dock-item" :focusable="true" eventClick eventFocus name="market" @click="onMarket">
        <div class="dock-icon" :focusable="false"><span class="glyph">店</span></div>
        <span class="dock-text" :focusable="false">应用商店</span>
      </div>
      <div class="dock-item" :focusable="true" eventClick eventFocus name="search" @click="onSearch">
        <div class="dock-icon" :focusable="false"><span class="glyph">搜</span></div>
        <span class="dock-text" :focusable="false">搜索</span>
      </div>
      <div class="dock-item" :focusable="true" eventClick eventFocus name="settings" @click="onSettings">
        <div class="dock-icon" :focusable="false"><span class="glyph">设</span></div>
        <span class="dock-text" :focusable="false">设置</span>
      </div>
      <div class="dock-spacer" :focusable="false"></div>
      <span class="cast-hint" :focusable="false">同一 Wi-Fi 下，手机扫码即可投屏</span>
      <div class="dock-item cast-btn" :focusable="true" eventClick eventFocus name="cast" @click="onCast">
        <div class="dock-icon cast" :focusable="false"><span class="glyph">投</span></div>
        <span class="dock-text" :focusable="false">开始投屏</span>
      </div>
    </div>

    <!-- 轻提示 -->
    <div class="toast" v-if="toast" :focusable="false"><span>{{ toast }}</span></div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter, useESNativeRouter } from '@extscreen/es3-router'
import { ref, onMounted, onUnmounted } from 'vue'

interface AppItem {
  name: string
  glyph: string
  color: string
  castable: boolean
  /** 个人快应用包名：有值则点击时通过 nativeRouter（EsNativeModule.launchEsPage）拉起该快应用 */
  pkg?: string
}

export default defineComponent({
  name: 'LauncherPage',
  setup() {
    const router = useESRouter()
    const nativeRouter = useESNativeRouter()
    const rootRef = ref()
    const deviceName = ref('投屏显象·我的电脑')
    const clock = ref('')
    const toast = ref('')
    let toastTimer: any = -1
    let clockTimer: any = -1

    const recent = ref<AppItem[]>([
      { name: '相册', glyph: '册', color: '#7c5cff', castable: true },
      { name: '视频', glyph: '影', color: '#ff6a88', castable: true },
      { name: '音乐', glyph: '音', color: '#22c1c3', castable: true },
      { name: '文件', glyph: '档', color: '#f7971e', castable: true },
      { name: '浏览器', glyph: '浏', color: '#43cea2', castable: false },
    ])

    const allApps = ref<AppItem[]>([
      { name: '视频', glyph: '影', color: '#ff6a88', castable: true },
      { name: '音乐', glyph: '音', color: '#22c1c3', castable: true },
      { name: '相册', glyph: '册', color: '#7c5cff', castable: true },
      { name: '文件', glyph: '档', color: '#f7971e', castable: true },
      { name: '游戏', glyph: '戏', color: '#ee0979', castable: true },
      { name: '浏览器', glyph: '浏', color: '#43cea2', castable: false },
      { name: '天气', glyph: '天', color: '#56ccf2', castable: false, pkg: 'cn.chenddcoder.weather' },
      { name: '计算器', glyph: '算', color: '#8e9eab', castable: false },
      { name: '应用商店', glyph: '店', color: '#11998e', castable: false },
      { name: '设置', glyph: '设', color: '#667eea', castable: false },
    ])

    const showToast = (msg: string) => {
      toast.value = msg
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => (toast.value = ''), 1600)
    }

    const tickClock = () => {
      const d = new Date()
      const p = (n: number) => (n < 10 ? '0' + n : '' + n)
      clock.value = `${p(d.getHours())}:${p(d.getMinutes())}`
    }

    const onFocus = () => {}

    const onOpenApp = (app: AppItem) => {
      // 个人快应用：交给 nativeRouter（EsNativeModule.launchEsPage）按包名拉起，
      // native 端统一走 es_pkg 解析加载，并正确维护返回栈
      if (app.pkg) {
        nativeRouter.push({ pkg: app.pkg })
        return
      }
      if (app.castable) {
        router.push({ name: 'casting', params: { source: app.name } })
      } else {
        showToast(`「${app.name}」即将接入`)
      }
    }

    const onMarket = () => showToast('应用商店（后续接入）')
    const onSearch = () => showToast('搜索（后续接入）')
    const onSettings = () => router.push({ name: 'settings' })
    const onCast = () => router.push({ name: 'casting', params: { source: '手机' } })

    onMounted(() => {
      tickClock()
      clockTimer = setInterval(tickClock, 1000 * 20)
    })
    onUnmounted(() => {
      clearInterval(clockTimer)
      clearTimeout(toastTimer)
    })

    return {
      rootRef,
      deviceName,
      clock,
      toast,
      recent,
      allApps,
      onFocus,
      onOpenApp,
      onMarket,
      onSearch,
      onSettings,
      onCast,
    }
  },
})
</script>

<style scoped>
.launcher-root {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background: #0b1220;
  overflow: hidden;
}
.bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1200px 700px at 80% -10%, rgba(91, 140, 255, 0.18), transparent 60%),
    radial-gradient(900px 600px at 0% 110%, rgba(124, 92, 255, 0.16), transparent 60%),
    linear-gradient(180deg, #0d1426 0%, #0a0f1c 100%);
}
.bg-glow {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 1100px;
  height: 1100px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(124, 92, 255, 0.10), transparent 60%);
  pointer-events: none;
}

/* 状态栏 */
.status-bar {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 96px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-left: 60px;
  padding-right: 60px;
  box-sizing: border-box;
}
.sb-left {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.brand {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-right: 24px;
}
.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
  color: #fff;
  font-size: 26px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(124, 92, 255, 0.45);
  margin-right: 14px;
}
.brand-text {
  font-size: 32px;
  font-weight: 700;
  color: #eaf0ff;
  letter-spacing: 2px;
}
.device-name {
  font-size: 26px;
  color: #9fb0d0;
  padding-left: 24px;
  border-left: 2px solid rgba(255, 255, 255, 0.12);
}
.sb-right {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.cast-ready {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-right: 28px;
}
.cast-ready .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #38ef7d;
  box-shadow: 0 0 12px #38ef7d;
  margin-right: 10px;
}
.cast-ready-text {
  font-size: 24px;
  color: #38ef7d;
}
.wifi {
  font-size: 24px;
  color: #9fb0d0;
  margin-right: 28px;
}
.clock {
  font-size: 28px;
  color: #eaf0ff;
  font-variant-numeric: tabular-nums;
  min-width: 76px;
  text-align: right;
}

/* 主体 */
.body {
  position: absolute;
  left: 0;
  top: 96px;
  width: 1920px;
  height: 852px;
  padding: 24px 60px 0;
  box-sizing: border-box;
}
.section {
  margin-bottom: 28px;
}
.section-title {
  display: flex;
  flex-direction: row;
  align-items: center;
  font-size: 30px;
  font-weight: 700;
  color: #eaf0ff;
  margin-bottom: 18px;
}
.section-title .bar {
  width: 8px;
  height: 30px;
  border-radius: 4px;
  background: linear-gradient(180deg, #7c5cff, #5b8cff);
  margin-right: 14px;
}
.st-text {
  font-size: 30px;
  font-weight: 700;
  color: #eaf0ff;
}
.recent-row {
  display: flex;
  flex-direction: row;
}
.app-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
.app-card {
  width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  border-radius: 18px;
  transition: transform 0.15s ease;
}
.app-card.recent {
  margin-right: 26px;
}
.app-card.grid {
  margin-right: 30px;
  margin-bottom: 26px;
}
.app-card[focused],
.app-card:focus {
  transform: scale(1.08);
}
.app-icon {
  width: 110px;
  height: 110px;
  border-radius: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}
.app-icon .glyph {
  font-size: 46px;
  font-weight: 800;
  color: #fff;
}
.app-card[focused] .app-icon,
.app-card:focus .app-icon {
  box-shadow: 0 0 0 5px rgba(124, 92, 255, 0.55), 0 14px 30px rgba(124, 92, 255, 0.45);
}
.app-name {
  font-size: 24px;
  color: #c7d2ea;
  margin-top: 14px;
}

/* 底部 dock */
.dock {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1920px;
  height: 132px;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 60px;
  padding-right: 60px;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(10, 15, 28, 0), rgba(10, 15, 28, 0.92) 55%);
}
.dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 110px;
  height: 96px;
  border-radius: 18px;
  transition: transform 0.15s ease;
  margin-right: 22px;
}
.dock-item[focused],
.dock-item:focus {
  transform: scale(1.06);
  background: rgba(124, 92, 255, 0.16);
}
.dock-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.10);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dock-icon .glyph {
  font-size: 28px;
  font-weight: 700;
  color: #eaf0ff;
}
.dock-icon.cast {
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
  box-shadow: 0 8px 20px rgba(124, 92, 255, 0.5);
}
.dock-text {
  font-size: 22px;
  color: #c7d2ea;
  margin-top: 8px;
}
.dock-spacer {
  flex: 1;
}
.cast-hint {
  font-size: 24px;
  color: #9fb0d0;
  margin-right: 10px;
}
.cast-btn {
  width: 170px;
}

/* 轻提示 */
.toast {
  position: absolute;
  left: 50%;
  bottom: 170px;
  transform: translateX(-50%);
  background: rgba(20, 28, 48, 0.95);
  color: #eaf0ff;
  font-size: 26px;
  padding-top: 16px;
  padding-bottom: 16px;
  padding-left: 36px;
  padding-right: 36px;
  border-radius: 14px;
  border: 1px solid rgba(124, 92, 255, 0.4);
}
.toast span {
  font-size: 26px;
  color: #eaf0ff;
}
</style>
