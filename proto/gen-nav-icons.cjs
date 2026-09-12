/**
 * 生成导航轨 / 面板用的线性图标 SVG（两种颜色变体：muted 未选中、fg 选中）。
 *
 * 为什么需要两个变体：快应用（Hippy）不支持 CSS var 也不支持给 <img> 上色，
 * 远端 SVG 只能整套换文件——所以每个需要「未选中/选中」两态的图标出两份。
 *
 * 用法：node proto/gen-nav-icons.cjs
 * 产物：proto/nav-icons-dist/*.svg（文件名即线上 URL 名，可直接 scp 发布）
 */
const fs = require('fs')
const path = require('path')

const MUTED = '#8194a4'
const FG = '#e8edf5'

/** 24×24 线性图标路径表 */
const ICONS = {
  home:
    '<path d="M3 10.6 12 3.4l9 7.2"/><path d="M5.6 9.4V20h12.8V9.4"/><path d="M10 20v-5.6h4V20"/>',
  apps:
    '<rect x="4" y="4" width="7" height="7" rx="2.2"/><rect x="13" y="4" width="7" height="7" rx="2.2"/><rect x="4" y="13" width="7" height="7" rx="2.2"/><rect x="13" y="13" width="7" height="7" rx="2.2"/>',
  cast:
    '<rect x="2.5" y="4" width="19" height="12.5" rx="3"/><path d="M9 20.5h6"/><path d="M7 14.4a4.5 4.5 0 0 1 4.5-4.5"/><path d="M7 17.6a7.8 7.8 0 0 1 7.8-7.8"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.4v2.3M12 18.3v2.3M4.9 7.5l2 1.1M17.1 15.4l2 1.1M4.9 16.5l2-1.1M17.1 8.6l2-1.1"/>',
  game: '<path d="M7.6 8h8.8a5 5 0 0 1 4.9 5.9l-.6 3.3a2.9 2.9 0 0 1-2.9 2.4l-2.5-.7a2 2 0 0 1-1.1-3l.9-1.5H8.9l.9 1.5a2 2 0 0 1-1.1 3l-2.5.7a2.9 2.9 0 0 1-2.9-2.4l-.6-3.3A5 5 0 0 1 7.6 8z"/><path d="M7.2 11.6v3.2"/><path d="M5.6 13.2h3.2"/><circle cx="16.1" cy="11.8" r="1"/><circle cx="18.1" cy="13.8" r="1"/>',
  tv: '<rect x="2.5" y="4" width="19" height="13" rx="3"/><path d="M8 20.5h8"/><path d="M12 17v3.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M10.5 18.4h3"/>',
}

/** 需要「未选中 / 选中」两态变体的图标（导航轨用） */
const TWO_TONE = ['home', 'apps', 'game', 'cast', 'settings']
/** 单色（次要）图标：面板用 */
const MUTED_ONLY = ['tv', 'phone']

const svg = (body, color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" ` +
  `fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" ` +
  `stroke-linejoin="round">${body}</svg>\n`

const outDir = path.join(__dirname, 'nav-icons-dist')
fs.mkdirSync(outDir, { recursive: true })

const written = []
for (const name of TWO_TONE) {
  const body = ICONS[name]
  fs.writeFileSync(path.join(outDir, `nav-${name}.svg`), svg(body, MUTED))
  fs.writeFileSync(path.join(outDir, `nav-${name}-on.svg`), svg(body, FG))
  written.push(`nav-${name}.svg`, `nav-${name}-on.svg`)
}
for (const name of MUTED_ONLY) {
  fs.writeFileSync(path.join(outDir, `nav-${name}.svg`), svg(ICONS[name], MUTED))
  written.push(`nav-${name}.svg`)
}

console.log(`wrote ${written.length} files → ${outDir}`)
console.log(written.join('\n'))
