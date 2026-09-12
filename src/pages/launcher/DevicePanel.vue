<template>
  <!-- 首页右侧面板（设计稿 600×455）：标题 + 设备行 + 底部说明。
       设计稿列的是 iPhone / MacBook Pro / iPad Air 三台「可投屏设备」，但
       tvcast 是 DLNA 接收端（DMR）——枚举不到源设备，照抄会做成假列表。
       P0 只列两条真实状态（本机 / 手机投屏），P1 按决策点「首页设备区」
       换成扫码投屏引导卡或 Rust 侧「最近投屏来源」记录。 -->
  <div class="panel" :focusable="false">
    <span class="panel-title" :focusable="false">可投屏设备</span>

    <div class="rows" :focusable="false">
      <div class="row" :focusable="false">
        <div class="row-ico" :focusable="false">
          <img
            v-if="!failed['tv']"
            :src="icons.tv"
            class="row-img"
            @error="onFail('tv')"
            :focusable="false"
          />
          <span v-else class="row-glyph" :focusable="false">本</span>
        </div>
        <span class="row-name" :focusable="false">{{ deviceName }}</span>
        <div class="row-state" :focusable="false">
          <div class="dot" :style="{ backgroundColor: ready ? '#61cb7c' : '#8194a4' }" :focusable="false"></div>
          <span class="state-text" :focusable="false">{{ ready ? '在线' : '未就绪' }}</span>
        </div>
      </div>

      <div class="row row-divided" :focusable="false">
        <div class="row-ico" :focusable="false">
          <img
            v-if="!failed['phone']"
            :src="icons.phone"
            class="row-img"
            @error="onFail('phone')"
            :focusable="false"
          />
          <span v-else class="row-glyph" :focusable="false">机</span>
        </div>
        <span class="row-name" :focusable="false">手机投屏</span>
        <span class="state-text muted" :focusable="false">等待接入</span>
      </div>
    </div>

    <div class="spacer" :focusable="false"></div>

    <div class="note" :focusable="false">
      <span class="note-text" :focusable="false">让设备接入同一个 Wi-Fi，就能把画面投到这台电视上。</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { ICON_BASE } from '../../styles/tokens'

export default defineComponent({
  name: 'DevicePanel',
  props: {
    /** 本机 DLNA 广播名 */
    deviceName: { type: String, default: '投屏显象' },
    /** 广播是否就绪（真实状态，非设计稿的静态绿点） */
    ready: { type: Boolean, default: false },
  },
  setup() {
    const failed = ref<Record<string, boolean>>({})
    const onFail = (key: string) => {
      failed.value[key] = true
    }
    return {
      failed,
      onFail,
      icons: { tv: `${ICON_BASE}/nav-tv.svg`, phone: `${ICON_BASE}/nav-phone.svg` },
    }
  },
})
</script>

<style scoped>
.panel {
  width: 600px;
  height: 455px;
  /* Hippy 无 gap，hero(1034) 与面板(600) 之间设计稿留 26 列距：
     1034 + 26 + 600 = 1660 = 内容净宽，面板右缘才落在 1856 对齐时钟 */
  margin-left: 26px;
  padding: 33px;
  border-radius: 24px;
  background-color: #131730;
  border-width: 1px;
  border-color: #1c2440;
  display: flex;
  flex-direction: column;
}

.panel-title { font-size: 26px; font-weight: 600; color: #e8edf5; }

.rows {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
}

.row {
  height: 84px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.row-divided {
  height: 85px;
  border-top-width: 1px;
  border-top-color: #1c2440;
}

.row-ico {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background-color: rgba(30, 35, 60, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-img { width: 26px; height: 26px; }
.row-glyph { font-size: 24px; color: #8194a4; }

.row-name {
  width: 308px;
  margin-left: 16px;
  font-size: 23px;
  font-weight: 500;
  color: #e8edf5;
}

.row-state {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  margin-right: 10px;
}

.state-text { font-size: 21px; color: #e8edf5; }
.state-text.muted { color: #8194a4; }

.spacer { flex: 1; }

.note {
  height: 50px;
  padding-top: 20px;
  border-top-width: 1px;
  border-top-color: #1c2440;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.note-text { font-size: 21px; color: #8194a4; }
</style>
