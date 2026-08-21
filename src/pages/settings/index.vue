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
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter } from '@extscreen/es3-router'
import { ref, onUnmounted } from 'vue'

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
    const toast = ref('')
    let toastTimer: any = -1

    const items = ref<SettingItem[]>([
      { name: '设备名称', icon: '台', value: '投屏显象·我的电脑' },
      { name: '网络', icon: '网', value: 'Wi-Fi · 已连接' },
      { name: '投屏分辨率', icon: '清', value: '1920 × 1080' },
      { name: '自动接收投屏', icon: '接', value: '开启' },
      { name: '连接帮助', icon: '帮', value: '扫码引导' },
      { name: '关于', icon: '关', value: 'v1.0.0' },
    ])

    const showToast = (msg: string) => {
      toast.value = msg
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => (toast.value = ''), 1500)
    }

    const onItem = (item: SettingItem) => {
      if (item.name === '连接帮助') {
        router.push({ name: 'guide' })
      } else {
        showToast(`「${item.name}」设置（后续接入）`)
      }
    }
    const onBack = () => router.push({ name: 'home' })

    onUnmounted(() => clearTimeout(toastTimer))

    return { rootRef, toast, items, onItem, onBack }
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
</style>
