<template>
  <div class="settings-root" :focusable="false" ref="rootRef">
    <div class="bg" :focusable="false"></div>

    <!-- 顶部 -->
    <div class="header" :focusable="false">
      <span class="title" :focusable="false">设置</span>
      <div class="back" :focusable="true" eventClick eventFocus name="back" @click="onBack">
        <span class="back-icon" :focusable="false">⌂</span>
        <span class="back-text" :focusable="false">返回主页</span>
      </div>
    </div>

    <!-- 列表 -->
    <div class="list" :focusable="false">
      <div v-for="(item, i) in items" :key="i"
           class="row"
           :focusable="true" eventClick eventFocus
           name="settingRow"
           @click="onItem(item)">
        <div class="row-left" :focusable="false">
          <span class="row-icon" :focusable="false">{{ item.icon }}</span>
          <span class="row-name" :focusable="false">{{ item.name }}</span>
        </div>
        <div class="row-right" :focusable="false">
          <span class="row-value" :focusable="false">{{ item.value }}</span>
          <span class="row-arrow" :focusable="false">›</span>
        </div>
      </div>
    </div>

    <div class="toast" v-if="toast" :focusable="false"><span>{{ toast }}</span></div>

    <!-- 改名对话框 -->
    <div v-if="showDialog" class="dialog-mask" :focusable="false">
      <div class="dialog" :focusable="false">
        <div class="dialog-title" :focusable="false">修改设备名称</div>
        <div class="dialog-hint" :focusable="false">为电视设置一个好记的名字，便于手机端识别</div>
        <input
          ref="renameInputRef"
          class="dialog-input"
          :focusable="true"
          eventFocus
          name="renameInput"
          :value="editingName"
          placeholder="请输入设备名称"
          :maxLength="30"
          @changeText="onNameChangeText"
        />
        <div class="dialog-actions" :focusable="false">
          <div class="dialog-btn" :focusable="true" eventClick eventFocus name="dialogCancel" @click="closeDialog">
            <span :focusable="false">取消</span>
          </div>
          <div class="dialog-btn primary" :focusable="true" eventClick eventFocus name="dialogConfirm" @click="confirmRename">
            <span :focusable="false">确定</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter } from '@extscreen/es3-router'
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { Native, onKeyUp } from '@extscreen/es3-vue'
import { ESKeyCode } from '@extscreen/es3-core'

interface SettingItem {
  name: string
  icon: string
  value: string
}

export default defineComponent({
  name: 'SettingsPage',
  setup() {
    const router = useESRouter()
    const rootRef = ref()
    const renameInputRef = ref()
    const toast = ref('')
    let toastTimer: any = -1

    const items = ref<SettingItem[]>([
      { name: '设备名称', icon: '台', value: '投屏显象_00.00' },
      { name: '网络', icon: '网', value: 'Wi-Fi · 已连接' },
      { name: '投屏分辨率', icon: '清', value: '1920 × 1080' },
      { name: '自动接收投屏', icon: '接', value: '开启' },
      { name: '连接帮助', icon: '帮', value: '扫码引导' },
      { name: '关于', icon: '关', value: 'v1.0.0' },
    ])

    // 改名对话框状态
    const showDialog = ref(false)
    const editingName = ref('')
    const saving = ref(false)

    // 更新「设备名称」一行的显示值
    const updateDeviceName = (name: string) => {
      const row = items.value.find((it) => it.name === '设备名称')
      if (row) row.value = name
    }

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
        if (name) updateDeviceName(name)
      } catch (e) {
        // 读取失败保留默认值
      }
    }

    // 打开改名对话框，预填当前设备名称，并把焦点引导到输入框
    const openRenameDialog = () => {
      const row = items.value.find((it) => it.name === '设备名称')
      editingName.value = row ? row.value : ''
      saving.value = false
      showDialog.value = true
      // 浮层渲染完成后再聚焦输入框，便于遥控器/键盘直接开始输入
      nextTick(() => {
        ;(renameInputRef.value as any)?.focus?.()
      })
    }
    const closeDialog = () => {
      if (saving.value) return
      showDialog.value = false
    }

    // 输入框内容变化（hippy TextInput 事件）。es3-vue 3.x 的事件对象结构为
    // {type, nativeParams:{text, nativeEvent}, ...}——新值在 nativeParams.text，
    // 不在顶层。老框架（es-vue2）与部分形态可能直接传字符串或顶层 value/text，
    // 故做多形态解析兜底，确保任何形态下都能把用户输入同步到 editingName
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
        // 返回值判定成功：setDlnaName 底层失败时正常返回 false，不会抛异常，
        // 故成功与否要以返回值 boolean 为准
        const ok = await Native.callNativeWithPromise(
          'ProcessBridgeModule',
          'setDlnaName',
          name
        )
        if (ok) {
          updateDeviceName(name)
          showDialog.value = false
          showToast('已保存')
        } else {
          showToast('保存失败，请重试')
        }
      } catch (e) {
        // 桥接调用抛异常同样视为失败
        showToast('保存失败，请重试')
      } finally {
        saving.value = false
      }
    }

    const onItem = (item: SettingItem) => {
      if (item.name === '设备名称') {
        openRenameDialog()
      } else if (item.name === '连接帮助') {
        router.push({ name: 'guide' })
      } else {
        showToast(`「${item.name}」设置（后续接入）`)
      }
    }
    const onBack = () => router.push({ name: 'home' })

    onMounted(() => {
      loadDeviceName()
      // 键盘返回键（遥控器返回 / ESC）关闭改名对话框；仅对话框打开时生效，
      // 对话框未打开时不做处理，避免干扰正常返回逻辑（es3 生命周期钩子在组件卸载时自动清理）
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
      toast,
      items,
      onItem,
      onBack,
      showDialog,
      editingName,
      saving,
      onNameChangeText,
      confirmRename,
      closeDialog,
    }
  },
})
</script>

<style scoped>
.settings-root {
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
    radial-gradient(900px 600px at 90% 0%, rgba(124, 92, 255, 0.16), transparent 60%),
    linear-gradient(180deg, #0d1426, #0a0f1c);
}
.header {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 120px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-left: 60px;
  padding-right: 60px;
  box-sizing: border-box;
}
.title {
  font-size: 40px;
  font-weight: 800;
  color: #eaf0ff;
}
.back {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-top: 14px;
  padding-bottom: 14px;
  padding-left: 26px;
  padding-right: 26px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  transition: transform 0.15s ease, background 0.15s ease;
}
.back[focused],
.back:focus {
  transform: scale(1.05);
  background: rgba(124, 92, 255, 0.2);
}
.back-icon {
  font-size: 28px;
  color: #5b8cff;
  margin-right: 10px;
}
.back-text {
  font-size: 24px;
  color: #c7d2ea;
}
.list {
  position: absolute;
  left: 60px;
  top: 160px;
  width: 1200px;
  display: flex;
  flex-direction: column;
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 96px;
  padding-left: 30px;
  padding-right: 30px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  transition: transform 0.15s ease, background 0.15s ease;
  margin-bottom: 16px;
}
.row[focused],
.row:focus {
  transform: scale(1.01);
  background: rgba(124, 92, 255, 0.18);
}
.row-left {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.row-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18px;
}
.row-name {
  font-size: 28px;
  color: #eaf0ff;
}
.row-right {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.row-value {
  font-size: 26px;
  color: #9fb0d0;
  margin-right: 14px;
}
.row-arrow {
  font-size: 30px;
  color: #6b7aa0;
}
.toast {
  position: absolute;
  left: 50%;
  bottom: 80px;
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
.dialog-mask {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background: rgba(5, 8, 18, 0.6);
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
  border-radius: 24px;
  background: #141b2e;
  border: 1px solid rgba(124, 92, 255, 0.35);
  display: flex;
  flex-direction: column;
}
.dialog-title {
  font-size: 34px;
  font-weight: 800;
  color: #eaf0ff;
  margin-bottom: 12px;
}
.dialog-hint {
  font-size: 22px;
  color: #9fb0d0;
  margin-bottom: 28px;
}
.dialog-input {
  height: 72px;
  border-radius: 14px;
  background: #0d1426;
  border: 1px solid rgba(124, 92, 255, 0.4);
  color: #eaf0ff;
  font-size: 28px;
  padding-left: 22px;
  padding-right: 22px;
}
.dialog-input[focused],
.dialog-input:focus {
  border-color: #7c5cff;
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
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  margin-left: 20px;
  transition: transform 0.15s ease, background 0.15s ease;
}
.dialog-btn[focused],
.dialog-btn:focus {
  transform: scale(1.05);
  background: rgba(124, 92, 255, 0.28);
}
.dialog-btn span {
  font-size: 26px;
  color: #eaf0ff;
}
.dialog-btn.primary {
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
}
.dialog-btn.primary span {
  color: #fff;
}
</style>
