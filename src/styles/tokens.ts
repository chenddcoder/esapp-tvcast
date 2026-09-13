/**
 * 设计 token —— 取自 `docs/pen/tvcast.pen`（Dark 主题一套）。
 *
 * 快应用（Hippy / QuickTVUI）样式层不支持 var()，所以组件 `<style>` 里只能写静态
 * 字面量；本文件只收敛**能被 JS 引用**的值（进度条颜色、图标地址、导航定义），
 * 避免同一语义在多处散落成魔法值。
 *
 * 尺寸基准（同为设计 token，样式里直接用字面量）：
 *   radius 16 / radius-lg 24 / radius-pill 999 / rail 132 / gutter 64
 *   topbar 104 / hintbar 72 / 屏 1920×1080
 * 字号：eyebrow 19 / rail 17 / meta 21 / body 22 / chip 22 / kbd 17 / h3 26 /
 *   应用名 26 / 设备名 23 / 页标题 36 / 段标题 34 / hero 44 / 时钟 48
 */
export const C = {
  /** 页面底 */
  bg: '#0b101e',
  /** 卡片面 */
  surface: '#131730',
  /** 导航轨 / 次级面 */
  surface2: '#0f1428',
  /** 三级面（选中态底色） */
  surface3: '#1e233c',
  /** 主前景 */
  fg: '#e8edf5',
  /** 次要前景 */
  muted: '#8194a4',
  /** 描边 */
  border: '#1c2440',
  /** 品牌强调色（珊瑚红）—— 全站唯一主动作色 */
  accent: '#fb615a',
  /** 强调色上的前景 */
  accentOn: '#fff9f8',
  /** 在线 / 投屏中 */
  live: '#61cb7c',
} as const

/** 静态资源根（nginx `/upload/` → /opt/upFiles/） */
export const ICON_BASE = 'https://www.chenddcoder.cn/upload'

/** 导航轨目的地 */
export interface NavItem {
  key: 'home' | 'apps' | 'games' | 'cast' | 'settings'
  label: string
  glyph: string
  /** 未选中态图标（muted 色，见 proto/gen-nav-icons.cjs） */
  icon: string
  /** 选中态图标（fg 色）—— Hippy 无法给 <img> 上色，只能整套换文件 */
  iconOn: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: '首页',
    glyph: '首',
    icon: `${ICON_BASE}/nav-home.svg`,
    iconOn: `${ICON_BASE}/nav-home-on.svg`,
  },
  {
    key: 'apps',
    label: '全部应用',
    glyph: '全',
    icon: `${ICON_BASE}/nav-apps.svg`,
    iconOn: `${ICON_BASE}/nav-apps-on.svg`,
  },
  {
    key: 'games',
    label: '游戏中心',
    glyph: '游',
    icon: `${ICON_BASE}/nav-game.svg`,
    iconOn: `${ICON_BASE}/nav-game-on.svg`,
  },
  // 「投屏」导航项已移除（2026-09-13 陈兄：DMR 接收端无法自选内容，该 tab 点开只有
  // 一句提示 toast，没有实际功能）；投屏入口保留在首页 hero 的「开始投屏」CTA。
  {
    key: 'settings',
    label: '设置',
    glyph: '设',
    icon: `${ICON_BASE}/nav-settings.svg`,
    iconOn: `${ICON_BASE}/nav-settings-on.svg`,
  },
]
