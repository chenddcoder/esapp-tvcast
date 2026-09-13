<template>
  <!-- 页面壳：左侧导航轨 + 内容区（首页 / 全部应用 / 游戏中心，视图切换不走路由）+ 底部提示条。
       为什么用 v-if 视图切换而不是新增路由页：es3-router 3.x 在 web-renderer 下
       push 后 RouterView 不切换（页面实例机制未在 web 端实现，见 casting 页注释），
       真机/桌面双端一致的成本最低；同时导航切换零页面开销。
       投屏页仍走既有路由/覆盖层方案（P3 重做），设置页保持独立路由页。 -->
  <div class="launcher-root" :focusable="false">
    <nav-rail :active="view" :status="railStatus" @nav="onNav" />

    <home-view
      v-if="view === 'home'"
      :device-name="deviceName"
      :clock="clock"
      :date="date"
      :state-ready="dlnaReady"
      :state-text="dlnaReady ? '投屏就绪' : '正在启动'"
      net-text="已连接"
      @cast="onCast"
      @open="onOpenApp"
      @nav="onNav"
    />
    <apps-view v-else-if="view === 'apps'" @open="onOpenApp" @search="onSearch" />
    <!-- 游戏中心：挂载即按缓存/过期策略取游戏库（见 GamesView + gamesApi） -->
    <games-view v-else @open="onOpenGame" />

    <!-- 提示条必须自己绝对定位：.launcher-root 是 column flex，而 rail / view / toast
         全走 position:absolute 脱离了文档流，剩下的 static 子元素会被排到容器 y=0
         （实测：未定位时提示条顶在页面最上方，压住 TopBar 的设备名与时钟）。 -->
    <div class="hint-wrap" :focusable="false">
      <hint-bar :hints="hints" :brandline="brandline" />
    </div>

    <div class="toast-wrap" :focusable="false">
      <div class="toast" v-if="toast" :focusable="false">
        <span class="toast-text" :focusable="false">{{ toast }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter, useESNativeRouter } from '@extscreen/es3-router'
import { Native } from '@extscreen/es3-vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import NavRail from './NavRail.vue'
import HomeView from './HomeView.vue'
import AppsView from './AppsView.vue'
import GamesView from './GamesView.vue'
import HintBar from './HintBar.vue'
import { readGameToken, type GameItem } from './gamesApi'
import type { AppItem } from './appTypes'

type ViewKey = 'home' | 'apps' | 'games'

export default defineComponent({
  name: 'LauncherPage',
  components: { NavRail, HomeView, AppsView, GamesView, HintBar },
  setup() {
    const router = useESRouter()
    const nativeRouter = useESNativeRouter()
    const view = ref<ViewKey>('home')
    const deviceName = ref('投屏显象')
    const clock = ref('--:--')
    const date = ref('')
    const dlnaReady = ref(false)
    const toast = ref('')
    let toastTimer: any = -1
    let clockTimer: any = -1

    const railStatus = computed(() => (dlnaReady.value ? '待投屏' : '启动中'))

    /** 两屏按键一致（应用少时 02 屏没有搜索，所以不必按 view 分支） */
    const hints = [
      { kbd: '↑ ↓ ← →', label: '移动焦点' },
      { kbd: '确定', label: '打开' },
      { kbd: '返回', label: '上一层' },
    ]

    const BRANDS: Record<ViewKey, string> = {
      home: '客厅投屏中心 · HOME',
      apps: '客厅投屏中心 · APPS',
      games: '客厅投屏中心 · GAMES',
    }
    const brandline = computed(() => BRANDS[view.value] || BRANDS.home)

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
    })
    onUnmounted(() => {
      clearInterval(clockTimer)
      clearTimeout(toastTimer)
    })

    return {
      view, deviceName, clock, date, dlnaReady, toast,
      railStatus, hints, brandline,
      onNav, onCast, onOpenApp, onOpenGame, onSearch,
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
  background-color: #0b101e;
  overflow: hidden;
}

/* 底部提示条容器：设计稿 y=1008，高 72（1080 底边贴齐） */
.hint-wrap {
  position: absolute;
  left: 132px;
  top: 1008px;
  width: 1788px;
  height: 72px;
}

.toast-wrap {
  position: absolute;
  left: 132px;
  top: 872px;
  width: 1788px;
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
  background-color: rgba(19, 23, 48, 0.94);
  border-width: 1px;
  border-color: rgba(251, 97, 90, 0.42);
}

.toast-text { font-size: 24px; color: #e8edf5; }
</style>
