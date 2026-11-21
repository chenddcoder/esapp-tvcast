/**
 * 应用目录 = **线上 RuntimeController 的 catalog 接口**（不是硬编码列表）。
 *
 * 数据来源：`GET /api/runtime/catalog`（RuntimeController.list，按 created_at DESC）。
 * 只要某个快应用走过 `/api/runtime/packages` 发版，它就会自动出现在投屏显象的启动器里 ——
 * 新增应用不需要改这份代码，也不需要重新发版 tvcast。
 *
 * ## 为什么还要一张本地元数据表
 * 接口只给 `packageName / version / appName / icon / description`，没有分类和配色。
 * 分类决定 02 屏 chips，配色是图标加载失败时的兜底底 —— 这两样属于产品决策，
 * 不适合让后端下发（陈兄「不轻易新增字段」原则）。所以按包名在本地补，
 * 没登记过的应用自动落到「工具」+ 中性底，不会因为新增包而白屏。
 *
 * ## 过滤
 * · `cn.chenddcoder.tvcast` —— 就是本 launcher 自己，列出来会套娃。
 * · `cn.chenddcoder.hongjian` —— 二级入口，必须带 token/gameId 由游戏中心拉起，
 *   直接从启动器进会缺参数报错（见 esapp-game 的 nativeRouter.push）。
 *
 * ## ⚠️ 网络三端差异（踩过的坑，别改回去）
 * · 运行时页面（runtime.chenddcoder.cn）：catalog 与页面**同源**，相对路径 `/api/...` 最稳。
 * · 桌面端（tauri://localhost）：相对路径会打到 `tauri://localhost/api/...` → 必然 404，
 *   必须用绝对地址让 desktop-runtime 的 `proxy_fetch.js` 走 Rust 代理（已覆盖 chenddcoder.cn）。
 * · web-runtime 的 fetch **返回的不是标准 Response**：`r.headers.get` 会 TypeError，
 *   且异常落在未捕获 Promise 里 → 轮询/请求静默停死。所以读 body 一律 `text()` + JSON.parse，
 *   并且整段 try/catch。
 */
import { computed, reactive, ref } from 'vue'
import type { AppCategory, AppItem } from './appTypes'

/** 与运行时同一个后端（runtime 站点的 /api 已反代到 vue-ai-server:8081） */
const CATALOG_ORIGIN = 'https://www.chenddcoder.cn'

/** 本 launcher 自身 + 必须带参拉起的二级入口 */
const EXCLUDED = new Set(['cn.chenddcoder.tvcast', 'cn.chenddcoder.hongjian'])

interface Meta {
  category: AppCategory
  glyph: string
  c1: string
  c2: string
}

/**
 * 按包名登记的展示元数据。
 * 新增应用时**可以不加**（会落到 DEFAULT_META），只是分类/配色不如手工指定好看。
 */
const APP_META: Record<string, Meta> = {
  'cn.chenddcoder.game': { category: '游戏', glyph: '游', c1: '#1c2a4a', c2: '#0b1220' },
  'cn.chenddcoder.weather': { category: '工具', glyph: '天', c1: '#2e6fb7', c2: '#1b4f86' },
  'es.com.nes.tv': { category: '游戏', glyph: '卡', c1: '#30364f', c2: '#11131c' },
}

const DEFAULT_META: Meta = { category: '工具', glyph: '应', c1: '#2b3245', c2: '#141a26' }

/**
 * 接口不通时的兜底：至少还能进这两款（都能按 es_pkg 解析加载）。
 * 只保留已经在线上登记过的包，不要把未上线的包写进来 —— 点了会报「无法加载应用」。
 */
const FALLBACK_APPS: AppItem[] = [
  {
    name: '游戏中心',
    glyph: '游',
    c1: '#1c2a4a',
    c2: '#0b1220',
    category: '游戏',
    pkg: 'cn.chenddcoder.game',
    icon: `${CATALOG_ORIGIN}/app-icons/cn.chenddcoder.game.svg`,
  },
  {
    name: '天气',
    glyph: '天',
    c1: '#2e6fb7',
    c2: '#1b4f86',
    category: '工具',
    pkg: 'cn.chenddcoder.weather',
    icon: `${CATALOG_ORIGIN}/app-icons/cn.chenddcoder.weather.svg`,
  },
]

/** 拉取状态（页面可据此显示「正在读取应用列表…」/「离线，仅显示已缓存的应用」） */
export const catalogState = reactive({
  phase: 'idle' as 'idle' | 'loading' | 'ready' | 'fallback',
  message: '',
  updatedAt: 0,
})

/** 应用目录（响应式；初值为兜底列表，接口回来后原地替换） */
export const ALL_APPS = ref<AppItem[]>(FALLBACK_APPS)

export const INSTALLED_APPS = computed(() => ALL_APPS.value)

/** 分类出现顺序（只列目录里真实存在的分类） */
export const CATEGORY_ORDER = computed(() =>
  (['游戏', '工具'] as AppCategory[]).filter((c) => ALL_APPS.value.some((x) => x.category === c))
)

/**
 * 搜索框阈值：少于这个数时「全部应用」不摆搜索框 ——
 * 对两三个应用做搜索是无意义交互（元素不过载），且 TV 遥控器输入文字体验很差。
 * ⚠️ 分类 chips 不设阈值，永远显示（陈兄 2026-09-12 要求：tab 留着方便扩展）。
 */
export const SEARCH_MIN_APPS = 6
export const showSearch = computed(() => ALL_APPS.value.length >= SEARCH_MIN_APPS)

/** 分类计数（含「全部」），用于 02 屏 chips */
export const CATEGORY_COUNTS = computed(() => [
  { key: 'all' as const, label: '全部', count: ALL_APPS.value.length },
  ...CATEGORY_ORDER.value.map((c) => ({
    key: c,
    label: c,
    count: ALL_APPS.value.filter((x) => x.category === c).length,
  })),
])

/**
 * catalog 请求地址。
 * 同源（运行时页面）用相对路径；桌面端必须绝对地址，否则代理钩子拦不到。
 */
function catalogUrl(): string {
  const g: any = typeof window !== 'undefined' ? window : {}
  if (g.__TAURI__) return `${CATALOG_ORIGIN}/api/runtime/catalog`
  if (typeof location !== 'undefined' && /chenddcoder\.cn$/.test(location.hostname)) {
    return '/api/runtime/catalog'
  }
  return `${CATALOG_ORIGIN}/api/runtime/catalog`
}

/** 各家 fetch 的响应形态不一：web-runtime 给的不是标准 Response */
async function readJson(res: any): Promise<any> {
  if (!res) return null
  if (typeof res.json === 'function') {
    try {
      return await res.json()
    } catch (_e) {
      /* 落到 text 分支 */
    }
  }
  if (res.data !== undefined && res.code !== undefined) return res
  if (typeof res.text === 'function') {
    const t = await res.text()
    return t ? JSON.parse(t) : null
  }
  if (typeof res === 'string') return JSON.parse(res)
  return res
}

function toAppItem(row: any): AppItem | null {
  const pkg = String(row?.packageName || '')
  if (!pkg || EXCLUDED.has(pkg)) return null
  const meta = APP_META[pkg] || DEFAULT_META
  const name = String(row?.appName || pkg)
  return {
    name,
    // 未登记的应用取名称首字，避免所有新应用都显示默认的「应」
    glyph: APP_META[pkg]?.glyph || name.charAt(0),
    c1: meta.c1,
    c2: meta.c2,
    category: meta.category,
    pkg,
    icon: row?.icon ? String(row.icon) : undefined,
    meta: row?.version ? `v${row.version}` : undefined,
  }
}

/**
 * 拉一次应用目录。**失败不抛**（页面不该因为后端抖动而空白），
 * 保留当前列表并把 phase 标成 fallback。
 */
export async function loadCatalog(): Promise<void> {
  if (catalogState.phase === 'loading') return
  catalogState.phase = 'loading'
  try {
    const res = await fetch(catalogUrl(), { method: 'GET' })
    const body = await readJson(res)
    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []
    const apps = rows.map(toAppItem).filter((x: AppItem | null): x is AppItem => !!x)
    if (!apps.length) throw new Error('catalog 返回空列表')
    ALL_APPS.value = apps
    catalogState.phase = 'ready'
    catalogState.message = ''
    catalogState.updatedAt = Date.now()
  } catch (e: any) {
    catalogState.phase = 'fallback'
    catalogState.message = String((e && e.message) || e || '应用列表获取失败')
    // 保持现有列表（可能是兜底、也可能是上次成功的结果）
  }
}
