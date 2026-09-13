/**
 * 生成投屏页控制条 / 胶囊用的线性图标 SVG（单色 #e8edf5，深色 scrim / coral 按钮上通用）。
 *
 * 与 gen-nav-icons.cjs 同款约定：24×24 viewBox、stroke 1.8；播放/暂停/停止
 * 用 fill 实心（40px 渲染下实心比描边清楚）。快应用 <img> 不能上色，所以
 * 每种状态一个文件（play/pause、volume/mute 各自独立）。
 *
 * 用法：node proto/gen-control-icons.cjs
 * 产物：proto/control-icons-dist/*.svg（文件名即线上 URL 名）
 */
const fs = require('fs')
const path = require('path')

const FG = '#e8edf5'

/** 内联 body 可自带 fill/stroke 属性覆盖默认（默认描边、无填充） */
const ICONS = {
  // 左上返回圆钮
  'ctrl-back': '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  // 上一个 / 下一个（skip-back / skip-forward）
  'ctrl-prev':
    '<path d="M17.5 5.8v12.4c0 .7-.8 1.1-1.4.7l-8-6.2c-.5-.4-.5-1.2 0-1.6l8-6c.6-.4 1.4 0 1.4.7z"/>' +
    '<path d="M6.2 5.5v13" stroke-width="2.2"/>',
  'ctrl-next':
    '<path d="M6.5 5.8v12.4c0 .7.8 1.1 1.4.7l8-6.2c.5-.4.5-1.2 0-1.6l-8-6c-.6-.4-1.4 0-1.4.7z"/>' +
    '<path d="M17.8 5.5v13" stroke-width="2.2"/>',
  // 播放 / 暂停（实心）
  'ctrl-play': '<path d="M8 5.6v12.8c0 .9 1 1.4 1.7.9l9.4-6.4c.6-.4.6-1.4 0-1.8L9.7 4.7c-.7-.5-1.7 0-1.7.9z" fill="' + FG + '" stroke="none"/>',
  'ctrl-pause':
    '<rect x="6.4" y="5.2" width="4" height="13.6" rx="1.4" fill="' + FG + '" stroke="none"/>' +
    '<rect x="13.6" y="5.2" width="4" height="13.6" rx="1.4" fill="' + FG + '" stroke="none"/>',
  // 音量三态（批次 2 的音量条也用 low/high）
  'ctrl-volume-low':
    '<path d="M4 9.6v4.8h3.2L12 18.6V5.4L7.2 9.6z" fill="' + FG + '" stroke="none"/>' +
    '<path d="M15.4 9.6a3.6 3.6 0 0 1 0 4.8"/>',
  'ctrl-volume-high':
    '<path d="M4 9.6v4.8h3.2L12 18.6V5.4L7.2 9.6z" fill="' + FG + '" stroke="none"/>' +
    '<path d="M15 9.4a4 4 0 0 1 0 5.2"/><path d="M17.4 7a7.2 7.2 0 0 1 0 10"/>',
  'ctrl-volume-mute':
    '<path d="M4 9.6v4.8h3.2L12 18.6V5.4L7.2 9.6z" fill="' + FG + '" stroke="none"/>' +
    '<path d="M15.6 9.8l4.6 4.4M20.2 9.8l-4.6 4.4"/>',
  // 全屏（批次 2）
  'ctrl-fullscreen':
    '<path d="M4 9.2V4h5.2M14.8 4H20v5.2M20 14.8V20h-5.2M9.2 20H4v-5.2"/>',
  // 停止投屏（实心 coral 按钮上用白色方块）
  'ctrl-stop': '<rect x="6.2" y="6.2" width="11.6" height="11.6" rx="2.2" fill="' + FG + '" stroke="none"/>',
}

const svg = (body, color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" ` +
  `fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" ` +
  `stroke-linejoin="round">${body}</svg>\n`

const outDir = path.join(__dirname, 'control-icons-dist')
fs.mkdirSync(outDir, { recursive: true })

const written = []
for (const [name, body] of Object.entries(ICONS)) {
  const file = path.join(outDir, `${name}.svg`)
  fs.writeFileSync(file, svg(body, FG))
  written.push(`${name}.svg`)
}

console.log(`wrote ${written.length} files → ${outDir}`)
console.log(written.join('\n'))
