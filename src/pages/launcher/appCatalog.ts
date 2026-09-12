/**
 * 应用目录 = **本机真实可拉起的个人快应用**。
 *
 * 数据来源：各工程 `.deploy.env`（PACKAGE_NAME / APP_NAME 是发版时的权威值），
 * 已在线上 RuntimeController 登记、可按 es_pkg 解析加载的只有下面两个：
 *   cn.chenddcoder.game     游戏中心   （内部再跳 cn.chenddcoder.hongjian 鸿渐冒险等小游戏）
 *   cn.chenddcoder.weather  天气
 *
 * 注意「鸿渐冒险」(cn.chenddcoder.hongjian) **不是**一级入口 —— 它由游戏中心带 token/gameId
 * 跳转拉起（见 esapp-game/src/pages/detail/index.vue 的 nativeRouter.push），
 * 放在启动器里会缺参数直接报错，所以不列入。
 *
 * ⚠️ 图标命名规范（2026-09-12 起）：应用图标文件名 = **`<包名>.<ext>`**，
 *    例 `/upload/cn.chenddcoder.game.svg`（彩色方角 512×512 满幅，矢量）与
 *    同名 `.png`（1024 位图）。历史名 `-app.svg` / `-icon.svg` 不再新增使用：
 *    其中 `-icon.svg` 在 2026-09-09 被应用内部 UI 的白色线条字形覆盖过（同文件名），
 *    那个 URL 同时被应用内 UI 与 RuntimeController 应用列表使用，**不要动**；
 *    `-circle.svg` 是圆形彩色版，仅少量场景使用。
 *    c1/c2 取各应用自身图标的渐变起止色，作为图标加载失败时的兜底底。
 *
 * 新增一个应用 = 加一条记录（name / pkg / icon / category），页面无需改动。
 * 设计稿的 24 个手机侧应用（哔哩哔哩/抖音/…）在 tvcast 上无法安装也无法投屏，已整体移除。
 */
import { ICON_BASE } from '../../styles/tokens'
import type { AppCategory, AppItem } from './appTypes'

export const ALL_APPS: AppItem[] = [
  {
    name: '游戏中心',
    glyph: '游',
    c1: '#1c2a4a',
    c2: '#0b1220',
    category: '游戏',
    pkg: 'cn.chenddcoder.game',
    icon: `${ICON_BASE}/cn.chenddcoder.game.svg`,
  },
  {
    name: '天气',
    glyph: '天',
    c1: '#2e6fb7',
    c2: '#1b4f86',
    category: '工具',
    pkg: 'cn.chenddcoder.weather',
    icon: `${ICON_BASE}/cn.chenddcoder.weather.svg`,
  },
]

/** 首页那一行：现在等于「本机已安装的应用」（P1 接真实使用记录后再按最近使用排序） */
export const INSTALLED_APPS: AppItem[] = ALL_APPS

/** 分类出现顺序（只列目录里真实存在的分类） */
export const CATEGORY_ORDER: AppCategory[] = (['游戏', '工具'] as AppCategory[]).filter((c) =>
  ALL_APPS.some((x) => x.category === c)
)

/**
 * 搜索框阈值：少于这个数时「全部应用」不摆搜索框 ——
 * 对两三个应用做搜索是无意义交互（元素不过载），且 TV 遥控器输入文字体验很差。
 * 目录长到 6 个以上，搜索框会自动出现。
 *
 * ⚠️ **分类 chips 不设阈值，永远显示**（陈兄 2026-09-12 明确要求：分类 tab 保留着，方便后面扩展）。
 *    即使当前只有「游戏 / 工具」两个分类、各 1 个应用也照常展示 ——
 *    chips 行高度固定 60，显示与否都不影响下面网格原点（设计稿 232px）。
 */
export const SEARCH_MIN_APPS = 6

/** 是否显示搜索框（分类 chips 无条件显示，见上） */
export const showSearch = ALL_APPS.length >= SEARCH_MIN_APPS

/** 分类计数（含「全部」），用于 02 屏 chips */
export const CATEGORY_COUNTS: { key: AppCategory | 'all'; label: string; count: number }[] = [
  { key: 'all', label: '全部', count: ALL_APPS.length },
  ...CATEGORY_ORDER.map((c) => ({
    key: c,
    label: c,
    count: ALL_APPS.filter((x) => x.category === c).length,
  })),
]
