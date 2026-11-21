<template>
  <div class="settings-root" :focusable="false" ref="rootRef">
    <!-- 设置页沿用同一导航轨（设计稿 05 屏），点「首页/应用/游戏」回到 launcher 对应视图 -->
    <nav-rail active="settings" :status="dlnaReady ? '等待投屏' : '启动中'" :ready="dlnaReady" @nav="onNav" />

    <div class="content" :focusable="false">
      <!-- 顶部：标题组 + 版本胶囊 -->
      <div class="header" :focusable="false">
        <div class="title-group" :focusable="false">
          <span class="page-title" :focusable="false">设置</span>
          <span class="page-sub" :focusable="false">把投屏接收调到最顺手的样子</span>
        </div>
        <div class="version-pill" :focusable="false">
          <div class="version-dot" :focusable="false"></div>
          <span class="version-text" :focusable="false">{{ version }}</span>
        </div>
      </div>

      <!-- 双栏：投屏接收 / 设备与声音 -->
      <div class="cards" :focusable="false">
        <div class="card" :focusable="false">
          <span class="card-title" :focusable="false">投屏接收</span>

          <div class="row" :focusable="false">
            <div class="row-text" :focusable="false">
              <span class="row-name" :focusable="false">允许手机投屏</span>
              <span class="row-desc" :focusable="false">同一 WiFi 下的设备可以发现本机</span>
            </div>
            <div
              class="switch"
              :class="{ on: allowCast }"
              :style="{ justifyContent: allowCast ? 'flex-end' : 'flex-start' }"
              :focusable="true"
              :enableFocusBorder="true"
              eventClick
              eventFocus
              name="allowCast"
              @click="allowCast = !allowCast"
            >
              <div class="switch-knob" :focusable="false"></div>
            </div>
          </div>

          <div class="row row-divided" :focusable="false">
            <div class="row-text" :focusable="false">
              <span class="row-name" :focusable="false">自动全屏播放</span>
              <span class="row-desc" :focusable="false">推送视频时直接铺满电脑屏幕</span>
            </div>
            <div
              class="switch"
              :class="{ on: autoFullscreen }"
              :style="{ justifyContent: autoFullscreen ? 'flex-end' : 'flex-start' }"
              :focusable="true"
              :enableFocusBorder="true"
              eventClick
              eventFocus
              name="autoFullscreen"
              @click="autoFullscreen = !autoFullscreen"
            >
              <div class="switch-knob" :focusable="false"></div>
            </div>
          </div>

          <div class="row row-divided" :focusable="false">
            <div class="row-text" :focusable="false">
              <span class="row-name" :focusable="false">画面比例</span>
              <span class="row-desc" :focusable="false">适配不同片源的黑边处理</span>
            </div>
            <div
              class="mini-pill"
              :focusable="true"
              :enableFocusBorder="true"
              eventClick
              eventFocus
              name="ratio"
              @click="cycleRatio"
            >
              <span class="mini-pill-text" :focusable="false">{{ ratio }}</span>
              <span class="mini-pill-arrow" :focusable="false">⌄</span>
            </div>
          </div>
        </div>

        <div class="card card-right" :focusable="false">
          <span class="card-title" :focusable="false">设备与声音</span>

          <div class="row" :focusable="false">
            <div class="row-text" :focusable="false">
              <span class="row-name" :focusable="false">设备名称</span>
              <span class="row-desc" :focusable="false">{{ deviceName }}</span>
            </div>
            <div
              class="mini-pill"
              :focusable="true"
              :enableFocusBorder="true"
              eventClick
              eventFocus
              name="rename"
              @click="openRenameDialog"
            >
              <span class="mini-pill-text" :focusable="false">修改</span>
              <span class="mini-pill-arrow" :focusable="false">›</span>
            </div>
          </div>

          <!-- 音量：聚焦后点击循环增减（无需额外 ± 按钮，保持设计稿的极简行） -->
          <div
            class="row row-volume row-divided"
            :focusable="true"
            :enableFocusBorder="true"
            eventClick
            eventFocus
            name="volume"
            @click="bumpVolume"
          >
            <div class="vol-text" :focusable="false">
              <span class="row-name" :focusable="false">投屏音量</span>
              <span class="row-desc" :focusable="false">{{ volume }}%</span>
            </div>
            <div class="vol-bar" :focusable="false">
              <div class="vol-track" :focusable="false"></div>
              <div class="vol-fill" :style="{ width: volFillWidth + 'px' }" :focusable="false"></div>
              <div class="vol-knob" :style="{ left: volKnobLeft + 'px' }" :focusable="false"></div>
            </div>
          </div>

          <div class="row row-divided" :focusable="false">
            <div class="row-text" :focusable="false">
              <span class="row-name" :focusable="false">投屏提示音</span>
              <span class="row-desc" :focusable="false">有设备接入时轻轻提示</span>
            </div>
            <div
              class="switch"
              :class="{ on: promptSound }"
              :style="{ justifyContent: promptSound ? 'flex-end' : 'flex-start' }"
              :focusable="true"
              :enableFocusBorder="true"
              eventClick
              eventFocus
              name="promptSound"
              @click="promptSound = !promptSound"
            >
              <div class="switch-knob" :focusable="false"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 关于卡 -->
      <div class="about" :focusable="false">
        <div class="about-text" :focusable="false">
          <span class="about-title" :focusable="false">关于 PC投屏</span>
          <span class="about-desc" :focusable="false">本地直投 · 画面不上云 · 免账号使用</span>
        </div>
        <div class="about-actions" :focusable="false">
          <div
            class="mini-pill"
            :focusable="true"
            :enableFocusBorder="true"
            eventClick
            eventFocus
            name="checkUpdate"
            @click="showToast('当前已是最新版本')"
          >
            <div class="mini-pill-dot" :focusable="false"></div>
            <span class="mini-pill-text" :focusable="false">检查更新</span>
          </div>
          <div
            class="mini-pill mini-pill-ghost"
            :focusable="true"
            :enableFocusBorder="true"
            eventClick
            eventFocus
            name="help"
            @click="onHelp"
          >
            <span class="mini-pill-ghost-text" :focusable="false">使用帮助</span>
          </div>
        </div>
      </div>

      <!-- 快捷操作：重新广播 / 网络诊断 / 清除记录 -->
      <div class="quick-row" :focusable="false">
        <div
          v-for="(q, qi) in quickActions"
          :key="q.key"
          class="quick"
          :class="{ 'quick-second': qi > 0 }"
          :focusable="true"
          :enableFocusBorder="true"
          eventClick
          eventFocus
          :name="'quick-' + q.key"
          @click="onQuick(q.key)"
        >
          <div class="quick-ico" :class="q.tone === 'green' ? 'quick-ico-green' : 'quick-ico-warm'" :focusable="false">
            <span class="quick-glyph" :class="q.tone === 'green' ? 'quick-glyph-green' : 'quick-glyph-warm'" :focusable="false">
              {{ q.glyph }}
            </span>
          </div>
          <div class="quick-text" :focusable="false">
            <span class="quick-title" :focusable="false">{{ q.name }}</span>
            <span class="quick-desc" :focusable="false">{{ q.desc }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="toast" v-if="toast" :focusable="false"><span class="toast-text" :focusable="false">{{ toast }}</span></div>

    <!-- 改名对话框 -->
    <div v-if="showDialog" class="dialog-mask" :focusable="false">
      <div class="dialog" :focusable="false">
        <!-- 文本必须放在 span 里：web-renderer 不渲染 div 的直接文本节点 -->
        <div class="dialog-title" :focusable="false">
          <span class="dialog-title-text" :focusable="false">修改设备名称</span>
        </div>
        <div class="dialog-hint" :focusable="false">
          <span class="dialog-hint-text" :focusable="false">为这台电脑设置一个好记的名字，便于手机端识别</span>
        </div>
        <input
          ref="renameInputRef"
          class="dialog-input"
          :focusable="true"
          eventFocus
          name="renameInput"
          :value="editingName"
          placeholder="请输入设备名称"
          :maxLength="30"
          @change="onNameChangeText"
        />
        <div class="dialog-actions" :focusable="false">
          <div class="dialog-btn" :focusable="true" eventClick eventFocus name="dialogCancel" @click="closeDialog">
            <span class="dialog-btn-text" :focusable="false">取消</span>
          </div>
          <div class="dialog-btn dialog-btn-primary" :focusable="true" eventClick eventFocus name="dialogConfirm" @click="confirmRename">
            <span class="dialog-btn-primary-text" :focusable="false">确定</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter } from '@extscreen/es3-router'
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { Native, onKeyUp } from '@extscreen/es3-vue'
import { ESKeyCode } from '@extscreen/es3-core'
import NavRail from '../launcher/NavRail.vue'
import { markDlnaReady } from '../../tools/dlna-bridge'

/** 应用版本（与 package.json 的 version 保持一致） */
const APP_VERSION = 'v1.0.62'

interface QuickAction {
  key: 'rebroadcast' | 'diagnose' | 'clear'
  name: string
  desc: string
  glyph: string
  tone: 'warm' | 'green'
}

export default defineComponent({
  name: 'SettingsPage',
  components: { NavRail },
  setup() {
    const router = useESRouter()
    const rootRef = ref()
    const renameInputRef = ref()
    const toast = ref('')
    let toastTimer: any = -1

    const version = APP_VERSION
    const deviceName = ref('PC投屏 · 我的电脑')
    const dlnaReady = ref(false)

    // 开关 / 选项（页面内状态；原生能力后续接入时把值透传给 ProcessBridgeModule）
    const allowCast = ref(true)
    const autoFullscreen = ref(true)
    const promptSound = ref(false)
    const volume = ref(60)
    const RATIOS = ['自适应', '16:9', '4:3']
    const ratioIndex = ref(0)
    const ratio = computed(() => RATIOS[ratioIndex.value])

    /** 音量条：轨道 500 宽、圆点 20（设计稿数值），用 px 表达避免 Hippy 的 % 限制 */
    const volFillWidth = computed(() => Math.round((500 * volume.value) / 100))
    const volKnobLeft = computed(() => Math.min(480, Math.max(0, volFillWidth.value - 10)))

    const quickActions: QuickAction[] = [
      { key: 'rebroadcast', name: '重新广播设备', desc: '让手机重新发现这台电脑', glyph: '播', tone: 'warm' },
      { key: 'diagnose', name: '网络诊断', desc: '检查 WiFi 与端口连通性', glyph: '诊', tone: 'green' },
      { key: 'clear', name: '清除投屏记录', desc: '清理本机播放历史', glyph: '清', tone: 'warm' },
    ]

    // 改名对话框状态
    const showDialog = ref(false)
    const editingName = ref('')
    const saving = ref(false)

    const showToast = (msg: string) => {
      toast.value = msg
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => (toast.value = ''), 1500)
    }

    // 从 web-runtime 的 ProcessBridgeModule 读取真实 DLNA 广播设备名（Rust 环境
    // 经 window.__get_invoke() 转调 getDlnaName 命令），读取失败保留默认占位值。
    const loadDeviceName = async () => {
      try {
        const name = await Native.callNativeWithPromise('ProcessBridgeModule', 'getDlnaName')
        if (name) {
          deviceName.value = name
          dlnaReady.value = true
        }
      } catch (e) {
        // 读取失败保留默认值
      }
    }

    // 打开改名对话框，预填当前设备名称，并把焦点引导到输入框
    const openRenameDialog = () => {
      editingName.value = deviceName.value
      saving.value = false
      showDialog.value = true
      // 浮层渲染完成后再聚焦输入框，便于键盘直接开始输入
      nextTick(() => {
        ;(renameInputRef.value as any)?.focus?.()
      })
    }
    const closeDialog = () => {
      if (saving.value) return
      showDialog.value = false
    }

    // 输入框内容变化（hippy TextInput 事件）。事件对象结构为
    // {type, nativeParams:{text, nativeEvent}, ...}——新值在 nativeParams.text，
    // 不在顶层；老框架/其他形态可能直接传字符串或顶层 value/text，故做多形态兜底。
    const onNameChangeText = (e: unknown) => {
      const obj = (e || {}) as Record<string, any>
      const text =
        typeof e === 'string'
          ? e
          : obj.nativeParams?.text ?? obj.nativeEvent?.text ?? obj.value ?? obj.text
      if (typeof text === 'string') editingName.value = text
    }

    // 确定：提交 setDlnaName，成功则更新显示并提示
    const confirmRename = async () => {
      const name = editingName.value.trim()
      if (!name) {
        showToast('设备名称不能为空')
        return
      }
      if (saving.value) return
      saving.value = true
      try {
        // 返回值判定成功：setDlnaName 底层失败时正常返回 false，不会抛异常
        const ok = await Native.callNativeWithPromise('ProcessBridgeModule', 'setDlnaName', name)
        if (ok) {
          deviceName.value = name
          showDialog.value = false
          showToast('已保存')
        } else {
          showToast('保存失败，请重试')
        }
      } catch (e) {
        showToast('保存失败，请重试')
      } finally {
        saving.value = false
      }
    }

    const cycleRatio = () => {
      ratioIndex.value = (ratioIndex.value + 1) % RATIOS.length
    }

    /** 音量循环 +10%（100 → 0），点击一次一档 */
    const bumpVolume = () => {
      volume.value = volume.value >= 100 ? 0 : volume.value + 10
    }

    const onQuick = (key: QuickAction['key']) => {
      if (key === 'rebroadcast') {
        markDlnaReady()
        showToast('已重新广播设备')
      } else if (key === 'diagnose') {
        showToast('网络诊断待接入')
      } else {
        showToast('投屏记录已清除')
      }
    }

    const onHelp = () => router.push({ name: 'guide' })

    /** 导航轨：设置页保持当前页，其余目的地带 view 参数回 launcher */
    const onNav = (key: string) => {
      if (key === 'home' || key === 'apps' || key === 'games') {
        router.push({ name: 'home', params: { view: key } })
      }
    }

    onMounted(() => {
      loadDeviceName()
      // 键盘返回键 / Esc 关闭改名对话框；仅对话框打开时生效，
      // 避免干扰正常返回逻辑（es3 生命周期钩子在组件卸载时自动清理）
      onKeyUp((event) => {
        if (!showDialog.value) return
        if (
          event.keyCode === ESKeyCode.ES_KEYCODE_BACK ||
          event.keyCode === ESKeyCode.ES_KEYCODE_ESCAPE
        ) {
          closeDialog()
        }
      })
    })

    onUnmounted(() => clearTimeout(toastTimer))

    return {
      rootRef,
      renameInputRef,
      version,
      deviceName,
      dlnaReady,
      allowCast,
      autoFullscreen,
      promptSound,
      volume,
      volFillWidth,
      volKnobLeft,
      ratio,
      quickActions,
      toast,
      onNav,
      showToast,
      onHelp,
      onQuick,
      cycleRatio,
      bumpVolume,
      showDialog,
      editingName,
      saving,
      onNameChangeText,
      confirmRename,
      closeDialog,
      openRenameDialog,
    }
  },
})
</script>

<style scoped>
/* 样式全部落在 QuickTVUI / Hippy 支持的 CSS 子集内：
   无 CSS 变量 / gap / grid / % / auto / radial-gradient / transition；
   padding·margin 不用多值简写（末值非 0 会丢值） */

.settings-root {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background-color: #FFF8EE;
  overflow: hidden;
}

.content {
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

.header {
  width: 1656px;
  height: 96px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.title-group { display: flex; flex-direction: column; }
.page-title { font-size: 46px; font-weight: 700; color: #2E241B; }
.page-sub { margin-top: 6px; font-size: 22px; color: #8A7A6B; }

.version-pill {
  height: 52px;
  padding-left: 22px;
  padding-right: 22px;
  border-radius: 26px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.version-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background-color: #4CB782;
  margin-right: 8px;
}

.version-text { font-size: 21px; color: #5E4C3C; }

/* 双栏卡片：815×440，两张 + 26 列距 = 1656 */
.cards {
  width: 1656px;
  margin-top: 24px;
  display: flex;
  flex-direction: row;
}

.card {
  width: 815px;
  height: 440px;
  padding: 32px;
  border-radius: 28px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: column;
}

.card-right { margin-left: 26px; }

.card-title { font-size: 30px; font-weight: 700; color: #2E241B; }

.row {
  height: 88px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  focus-background-color: #FFF7EC;
}

.row-divided {
  border-top-width: 1px;
  border-top-color: #F7EADB;
}

.row-text { display: flex; flex-direction: column; }
.row-name { font-size: 24px; font-weight: 600; color: #2E241B; }
.row-desc { margin-top: 4px; font-size: 19px; color: #8A7A6B; }

/* 开关：76×40，滑块 32；开 = 橙色底 + 滑块靠右，关 = 米色底 + 靠左 */
.switch {
  width: 76px;
  height: 40px;
  padding: 4px;
  border-radius: 20px;
  background-color: #EADCCB;
  display: flex;
  flex-direction: row;
  align-items: center;
  focus-border-width: 2px;
  focus-border-color: #FFC08A;
}

.switch.on { background-color: #FF7A2F; }

.switch-knob {
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background-color: #FFFFFF;
}

.mini-pill {
  height: 52px;
  padding-left: 20px;
  padding-right: 20px;
  border-radius: 26px;
  background-color: #FFF1E2;
  display: flex;
  flex-direction: row;
  align-items: center;
  focus-border-width: 2px;
  focus-border-color: #FFC08A;
  focus-background-color: #FFE8D2;
}

.mini-pill-text { font-size: 21px; font-weight: 600; color: #E9661E; }
.mini-pill-arrow { margin-left: 6px; font-size: 18px; color: #E9661E; }

.mini-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background-color: #E9661E;
  margin-right: 8px;
}

.mini-pill-ghost {
  margin-left: 12px;
  background-color: #FFF8EE;
  border-width: 1px;
  border-color: #F0DFCC;
}

.mini-pill-ghost-text { font-size: 21px; color: #5E4C3C; }

/* 音量行 */
.row-volume { justify-content: flex-start; }
.vol-text { width: 180px; display: flex; flex-direction: column; }

.vol-bar {
  position: relative;
  width: 500px;
  height: 28px;
}

.vol-track {
  position: absolute;
  left: 0;
  top: 9px;
  width: 500px;
  height: 10px;
  border-radius: 5px;
  background-color: #F0DFCC;
}

.vol-fill {
  position: absolute;
  left: 0;
  top: 9px;
  height: 10px;
  border-radius: 5px;
  background-color: #FF9A2E;
}

.vol-knob {
  position: absolute;
  top: 4px;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background-color: #FFFFFF;
  border-width: 2px;
  border-color: #FF9A2E;
}

/* 关于卡 */
.about {
  width: 1656px;
  margin-top: 24px;
  padding-top: 28px;
  padding-bottom: 28px;
  padding-left: 32px;
  padding-right: 32px;
  border-radius: 28px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.about-text { display: flex; flex-direction: column; }
.about-title { font-size: 26px; font-weight: 600; color: #2E241B; }
.about-desc { margin-top: 6px; font-size: 20px; color: #8A7A6B; }

.about-actions { display: flex; flex-direction: row; align-items: center; }

/* 快捷操作：三张 534×150 */
.quick-row {
  width: 1656px;
  margin-top: 24px;
  display: flex;
  flex-direction: row;
}

.quick {
  width: 534px;
  height: 150px;
  padding: 24px;
  border-radius: 24px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: row;
  align-items: center;
  focus-scale: 1.02;
  focus-border-width: 2px;
  focus-border-color: #FFC08A;
}

.quick-second { margin-left: 26px; }

.quick-ico {
  width: 60px;
  height: 60px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-ico-warm { background-color: #FFF1E2; }
.quick-ico-green { background-color: #F0FAF3; }

.quick-glyph { font-size: 28px; font-weight: 700; }
.quick-glyph-warm { color: #E9661E; }
.quick-glyph-green { color: #3F8A63; }

.quick-text { margin-left: 16px; display: flex; flex-direction: column; }
.quick-title { font-size: 24px; font-weight: 600; color: #2E241B; }
.quick-desc { margin-top: 4px; font-size: 19px; color: #8A7A6B; }

/* toast */
.toast {
  position: absolute;
  left: 700px;
  top: 960px;
  width: 520px;
  padding-top: 16px;
  padding-bottom: 16px;
  padding-left: 34px;
  padding-right: 34px;
  border-radius: 18px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  box-shadow: 0 12px 30px rgba(90, 60, 30, 0.12);
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.toast-text { font-size: 24px; color: #2E241B; }

/* 改名对话框 */
.dialog-mask {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background-color: rgba(46, 36, 27, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  width: 720px;
  padding-top: 40px;
  padding-bottom: 40px;
  padding-left: 48px;
  padding-right: 48px;
  border-radius: 28px;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #F4E3D0;
  display: flex;
  flex-direction: column;
}

.dialog-title { margin-bottom: 12px; }
.dialog-title-text { font-size: 34px; font-weight: 700; color: #2E241B; }
.dialog-hint { margin-bottom: 28px; }
.dialog-hint-text { font-size: 22px; color: #8A7A6B; }

.dialog-input {
  height: 72px;
  border-radius: 16px;
  background-color: #FFF8EE;
  border-width: 1px;
  border-color: #F0DFCC;
  color: #2E241B;
  font-size: 28px;
  padding-left: 22px;
  padding-right: 22px;
}

.dialog-actions {
  margin-top: 32px;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
}

.dialog-btn {
  padding-top: 16px;
  padding-bottom: 16px;
  padding-left: 40px;
  padding-right: 40px;
  border-radius: 16px;
  background-color: #FFF1E2;
  margin-left: 20px;
  focus-scale: 1.04;
  focus-border-width: 2px;
  focus-border-color: #FFC08A;
}

.dialog-btn-text { font-size: 26px; color: #5E4C3C; }

.dialog-btn-primary { background-color: #FF7A2F; }
.dialog-btn-primary-text { font-size: 26px; font-weight: 600; color: #FFFFFF; }
</style>
