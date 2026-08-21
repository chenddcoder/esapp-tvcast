<template>
  <div class="casting-root" :focusable="false" ref="rootRef">
    <!-- 投屏画面（占位，真实流由 desktop-runtime 的 DLNA DMR 注入） -->
    <div class="screen" :focusable="false">
      <div class="screen-center" :focusable="false">
        <div class="screen-icon" :focusable="false"><span class="glyph">投</span></div>
        <span class="screen-title" :focusable="false">正在接收投屏</span>
        <span class="screen-sub" :focusable="false">来自「{{ source }}」的画面将在此显示</span>
      </div>
      <!-- 顶部来源条 -->
      <div class="source-bar" :focusable="false">
        <div class="live-dot" :focusable="false"></div>
        <span class="source-text" :focusable="false">直播中 · 来源：{{ source }}</span>
        <span class="res-text" :focusable="false">{{ resolution }}</span>
      </div>
    </div>

    <!-- 底部控制条 -->
    <div class="control-bar" :focusable="false">
      <div class="ctrl-btn" :focusable="true" eventClick eventFocus name="play" @click="onTogglePlay">
        <span class="ctrl-icon" :focusable="false">{{ playing ? '❚❚' : '▶' }}</span>
        <span class="ctrl-label" :focusable="false">{{ playing ? '暂停' : '播放' }}</span>
      </div>
      <div class="ctrl-btn" :focusable="true" eventClick eventFocus name="vol" @click="onToggleMute">
        <span class="ctrl-icon" :focusable="false">{{ muted ? '🔇' : '🔊' }}</span>
        <span class="ctrl-label" :focusable="false">{{ muted ? '取消静音' : '静音' }}</span>
      </div>
      <div class="ctrl-spacer" :focusable="false"></div>
      <div class="ctrl-btn stop" :focusable="true" eventClick eventFocus name="stop" @click="onStop">
        <span class="ctrl-icon" :focusable="false">⏹</span>
        <span class="ctrl-label" :focusable="false">断开</span>
      </div>
      <div class="ctrl-btn home" :focusable="true" eventClick eventFocus name="home" @click="onBackHome">
        <span class="ctrl-icon" :focusable="false">⌂</span>
        <span class="ctrl-label" :focusable="false">返回主页</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useESRouter, useESRoute } from '@extscreen/es3-router'
import { ref, onMounted } from 'vue'

export default defineComponent({
  name: 'CastingPage',
  setup() {
    const router = useESRouter()
    const route = useESRoute()
    const rootRef = ref()

    const source = ref('手机')
    const resolution = ref('1920 × 1080')
    const playing = ref(true)
    const muted = ref(false)

    const onTogglePlay = () => (playing.value = !playing.value)
    const onToggleMute = () => (muted.value = !muted.value)
    const onStop = () => router.push({ name: 'home' })
    const onBackHome = () => router.push({ name: 'home' })

    onMounted(() => {
      const params: any = route.params || {}
      if (params.source) source.value = params.source as string
    })

    return {
      rootRef,
      source,
      resolution,
      playing,
      muted,
      onTogglePlay,
      onToggleMute,
      onStop,
      onBackHome,
    }
  },
})
</script>

<style scoped>
.casting-root {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background: #000;
  overflow: hidden;
}
.screen {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1000px 600px at 50% 40%, rgba(124, 92, 255, 0.18), transparent 60%),
    linear-gradient(180deg, #0a0f1c, #05080f);
  display: flex;
  align-items: center;
  justify-content: center;
}
.screen-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.screen-icon {
  width: 120px;
  height: 120px;
  border-radius: 30px;
  background: linear-gradient(135deg, #7c5cff, #5b8cff);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 18px 44px rgba(124, 92, 255, 0.5);
}
.screen-icon .glyph {
  font-size: 56px;
  font-weight: 800;
  color: #fff;
}
.screen-title {
  font-size: 40px;
  font-weight: 700;
  color: #eaf0ff;
  margin-top: 18px;
}
.screen-sub {
  font-size: 26px;
  color: #9fb0d0;
  margin-top: 18px;
}
.source-bar {
  position: absolute;
  left: 48px;
  top: 44px;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  padding-top: 12px;
  padding-bottom: 12px;
  padding-left: 22px;
  padding-right: 22px;
  border-radius: 14px;
}
.live-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ff4d4f;
  box-shadow: 0 0 12px #ff4d4f;
  animation: blink 1.4s infinite;
  margin-right: 16px;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.source-text {
  font-size: 26px;
  color: #eaf0ff;
}
.res-text {
  font-size: 24px;
  color: #9fb0d0;
  margin-left: 6px;
}

.control-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1920px;
  height: 150px;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: 60px;
  padding-right: 60px;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.85) 60%);
}
.ctrl-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120px;
  height: 110px;
  border-radius: 20px;
  justify-content: center;
  transition: transform 0.15s ease, background 0.15s ease;
  margin-right: 24px;
}
.ctrl-btn[focused],
.ctrl-btn:focus {
  transform: scale(1.06);
  background: rgba(124, 92, 255, 0.18);
}
.ctrl-icon {
  font-size: 40px;
  color: #eaf0ff;
}
.ctrl-label {
  font-size: 22px;
  color: #c7d2ea;
  margin-top: 8px;
}
.ctrl-spacer {
  flex: 1;
}
.ctrl-btn.stop .ctrl-icon {
  color: #ff7875;
}
.ctrl-btn.home .ctrl-icon {
  color: #5b8cff;
}
</style>
