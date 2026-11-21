/**
 * 设计 token —— 取自 `docs/pen/pc-touping-v3.op`（PC投屏 · 阳光合家欢 v3）。
 *
 * 产品面向桌面端（电脑屏幕 + 键盘），文案不使用「电视 / 客厅 / 遥控器」等口径。
 * 快应用（Hippy / QuickTVUI）样式层不支持 var()，所以组件 `<style>` 里只能写静态
 * 字面量；本文件只收敛**能被 JS 引用**的值（进度条颜色、图标地址、导航定义），
 * 避免同一语义在多处散落成魔法值。
 *
 * 尺寸基准（同为设计 token，样式里直接用字面量）：
 *   屏 1920×1080 / 导航轨 152 / 内容区 padding 34（上下）56（左右）
 *   卡片圆角 24–36 / 胶囊圆角 999 / 图标底 32–36
 *   字号：导航 18 / 辅助 17–20 / 正文 22–25 / 区块标题 34 / 页面标题 46 / 主标题 68
 */
export const C = {
  /** 页面底色（暖米白） */
  bg: '#FFF8EE',
  /** 卡片面 */
  surface: '#FFFFFF',
  /** 浅橙面（选中态 / 次级胶囊） */
  surfaceWarm: '#FFF1E2',
  /** 卡片描边 */
  border: '#F4E3D0',
  /** 行分隔线 */
  divider: '#F7EADB',
  /** 主前景 */
  fg: '#2E241B',
  /** 次前景（说明 / 设备名） */
  fgSoft: '#5E4C3C',
  /** 次要文字 */
  muted: '#8A7A6B',
  /** 更浅的辅助文字 */
  faint: '#A08B78',
  /** 品牌橙 —— 全站唯一主动作色 */
  accent: '#FF7A2F',
  /** 强调色上的前景 */
  accentOn: '#FFFFFF',
  /** 深一档的橙（选中文字） */
  accentDeep: '#E9661E',
  /** 浅一档的橙（进度条） */
  accentSoft: '#FF9A2E',
  /** 品牌黄 */
  yellow: '#FFC83D',
  /** 在线 / 就绪 */
  live: '#4CB782',
  /** 就绪文字 */
  liveText: '#3F8A63',
  /** 就绪胶囊底 */
  liveBg: '#F0FAF3',
  /** 停止投屏 / 投屏中 */
  danger: '#FF5A45',
  /** 开关关闭态底色 */
  switchOff: '#EADCCB',
  /** 音量轨道 */
  track: '#F0DFCC',
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
  /**
   * 选中态图标。
   * ⚠️ 历史 `nav-*-on.svg` 是近白色（为深色导航轨准备的），在浅色导航轨上
   * 会完全看不见；Hippy 又无法给 <img> 上色。因此选中/未选中都使用 muted 版，
   * 选中态靠「浅橙底 + 深橙 600 字重」表达。
   */
  iconOn: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: '首页',
    glyph: '首',
    icon: `${ICON_BASE}/nav-home.svg`,
    iconOn: `${ICON_BASE}/nav-home.svg`,
  },
  {
    key: 'apps',
    label: '应用',
    glyph: '应',
    icon: `${ICON_BASE}/nav-apps.svg`,
    iconOn: `${ICON_BASE}/nav-apps.svg`,
  },
  {
    key: 'games',
    label: '游戏',
    glyph: '游',
    icon: `${ICON_BASE}/nav-game.svg`,
    iconOn: `${ICON_BASE}/nav-game.svg`,
  },
  // 「投屏」导航项已移除（2026-09-13 陈兄：DMR 接收端无法自选内容，该 tab 点开只有
  // 一句提示 toast，没有实际功能）；投屏入口保留在首页 hero 的「开始投屏」CTA。
  {
    key: 'settings',
    label: '设置',
    glyph: '设',
    icon: `${ICON_BASE}/nav-settings.svg`,
    iconOn: `${ICON_BASE}/nav-settings.svg`,
  },
]
