<template>
  <!-- 页面壳：左侧导航轨 + 内容区（首页 / 全部应用 / 游戏中心，视图切换不走路由）。
       为什么用 v-if 视图切换而不是新增路由页：es3-router 3.x 在 web-renderer 下
       push 后 RouterView 不切换（页面实例机制未在 web 端实现，见 casting 页注释），
       真机/桌面双端一致的成本最低；同时导航切换零页面开销。
       投屏页仍走既有路由/覆盖层方案，设置页保持独立路由页（返回时带 view 参数）。 -->
  <div class="launcher-root" :focusable="false">
    <nav-rail
      :active="view"
      :status="dlnaReady ? '等待投屏' : '启动中'"
      :ready="dlnaReady"
      @nav="onNav"
    />

    <home-view
      v-if="view === 'home'"
      :device-name="deviceName"
      :clock="clock"
      :date="date"
      :state-ready="dlnaReady"
      :state-text="dlnaReady ? 'DLNA 已就绪' : '正在启动'"
      @cast="onCast"
      @guide="onGuide"
      @open="onOpenApp"
      @nav="onNav"
    />
    <apps-view v-else-if="view === 'apps'" @open="onOpenApp" @search="onSearch" />
    <!-- 游戏中心：挂载即按缓存/过期策略取游戏库（见 GamesView + gamesApi） -->
    <games-view v-else @open="onOpenGame" />

    <div class="toast-wrap" :focusable="false">
      <div class="toast" v-if="toast" :focusable="false">
        <span class="toast-text" :focusable="false">{{ toast }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter, useESNativeRouter, useESRoute } from '@extscreen/es3-router'
import { Native } from '@extscreen/es3-vue'
import { ref, onMounted, onUnmounted } from 'vue'
import NavRail from './NavRail.vue'
import HomeView from './HomeView.vue'
import AppsView from './AppsView.vue'
import GamesView from './GamesView.vue'
import { readGameToken, type GameItem } from './gamesApi'
import { loadCatalog, catalogState } from './appCatalog'
import type { AppItem } from './appTypes'

type ViewKey = 'home' | 'apps' | 'games'

/** 设置页经路由参数回传要展示的视图（导航轨「首页/应用/游戏」） */
function initialView(): ViewKey {
  try {
    const route = useESRoute() as unknown as { params?: Record<string, unknown> }
    const v = String(route?.params?.view || '')
    if (v === 'apps' || v === 'games' || v === 'home') return v as ViewKey
  } catch (e) {
    // web/桌面环境拿不到路由参数时回首页
  }
  return 'home'
}

export default defineComponent({
  name: 'LauncherPage',
  components: { NavRail, HomeView, AppsView, GamesView },
  setup() {
    const router = useESRouter()
    const nativeRouter = useESNativeRouter()
    const view = ref<ViewKey>(initialView())
    const deviceName = ref('PC投屏 · 我的电脑')
    const clock = ref('--:--')
    const date = ref('')
    const dlnaReady = ref(false)
    const toast = ref('')
    let toastTimer: any = -1
    let clockTimer: any = -1

    const showToast = (msg: string) => {
      toast.value = msg
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => (toast.value = ''), 1600)
    }

    const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
    const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const tickClock = () => {
      const d = new Date()
      clock.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`
      date.value = `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEK[d.getDay()]}`
    }

    const onNav = (key: string) => {
      if (key === 'home' || key === 'apps' || key === 'games') {
        view.value = key as ViewKey
        return
      }
      if (key === 'settings') {
        router.push({ name: 'settings' })
      }
      // 「投屏」导航项已移除（tokens.ts NAV_ITEMS）；投屏入口只剩首页 hero CTA。
    }

    /** 投屏入口：真正的内容由手机端推送（DMR 接收端无法自选内容） */
    const onCast = () => showToast('请从手机相册或视频应用推送到本设备')

    /** 「怎么用」→ 连接帮助浮层（同一套浅色主题） */
    const onGuide = () => router.push({ name: 'guide' })

    /** 应用磁贴点击：本机个人快应用按包名拉起（EsNativeModule.launchEsPage → es_pkg 解析加载） */
    const onOpenApp = (app: AppItem) => {
      if (app.pkg) {
        nativeRouter.push({ pkg: app.pkg })
        return
      }
      showToast(`「${app.name}」尚未接入`)
    }

    /**
     * 游戏磁贴点击：带 token / gameId / source 拉起游戏包。
     * token 与游戏中心同源（同一 runtime 下 localStorage 共享 gc_token）：有则结算自动上报，
     * 没有就按游客跑；source 决定游戏内返回去向，'launcher' 表示回到本启动器。
     */
    const onOpenGame = async (game: GameItem) => {
      if (!game.pkg) {
        showToast(`「${game.name}」暂不可启动`)
        return
      }
      // token 读取是异步的（web-renderer 下 localStorage 为 Promise 版，见 tools/storage）
      const token = await readGameToken()
      nativeRouter.push({
        pkg: game.pkg,
        args: { params: { token, gameId: game.id, source: 'launcher' } },
      })
    }

    const onSearch = () => showToast('搜索待接入')

    /** 读取真实 DLNA 广播设备名；成功即视为投屏接收就绪 */
    const loadDeviceState = async () => {
      try {
        const name = await Native.callNativeWithPromise('ProcessBridgeModule', 'getDlnaName')
        if (name) {
          deviceName.value = name
          dlnaReady.value = true
        }
      } catch (e) {
        // 读取失败保留默认值（web/桌面未接原生桥时走这里）
      }
    }

    onMounted(() => {
      tickClock()
      clockTimer = setInterval(tickClock, 1000 * 30)
      loadDeviceState()
      // 应用目录来自线上 catalog 接口：发过版的快应用自动出现在启动器里。
      // 失败不抛（保留兜底两款），只在 catalogState 里标 fallback。
      loadCatalog()
    })
    onUnmounted(() => {
      clearInterval(clockTimer)
      clearTimeout(toastTimer)
    })

    return {
      view, deviceName, clock, date, dlnaReady, toast, catalogState,
      onNav, onCast, onGuide, onOpenApp, onOpenGame, onSearch,
    }
  },
})
</script>

<style scoped>
/* 样式全部落在 QuickTVUI / Hippy 支持的 CSS 子集内：
   无 CSS 变量 / gap / grid / % / auto / radial-gradient / transition；
   padding·margin 不用多值简写（末值非 0 会丢值） */

.launcher-root {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background-color: #FFF8EE;
  overflow: hidden;
}

/* 提示 toast：底部居中（提示条已并入首页内容区，不再绝对定位占位） */
.toast-wrap {
  position: absolute;
  left: 152px;
  top: 952px;
  width: 1768px;
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.toast {
  padding-left: 34px;
  padding-right: 34px;
  padding-top: 16px;
  padding-bottom: 16px;
  border-radius: 18px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  box-shadow: 0 12px 30px rgba(90, 60, 30, 0.12);
}

.toast-text { font-size: 24px; color: #2E241B; }
</style>
