/**
 * 游戏中心数据源 + 本地缓存（游戏中心 tab 用）。
 *
 * 契约与 esapp-game/src/api/index.ts 完全一致（同一后端 www.chenddcoder.cn）：
 *   GET /api/game/list → { code: 200, data: GameCategory[] }，无需登录。
 *
 * 缓存策略（陈兄要求）：切到 tab 时读缓存；**未过期直接用缓存不发请求**，
 * 过期或没有缓存才重新拉取；拉取失败时退回旧缓存并如实标注（不放空页面）。
 * 缓存写 localStorage（与游戏中心同 runtime、同 origin，key 独立互不干扰）。
 *
 * 存储读写必须走 tools/storage（web-renderer 下 localStorage 被换成 Promise 版，
 * 同步写法会静默失效——缓存永远读不回，详见该文件注释）。
 */
import { storageGet, storageSet, storageGetJSON } from '../../tools/storage'

const BASE = 'https://www.chenddcoder.cn'

/** 缓存 key（独立于游戏中心的 gc_token / gc_user） */
const CACHE_KEY = 'tvcast_games_cache'

/** 过期时间：30 分钟 */
export const CACHE_TTL_MS = 30 * 60 * 1000

/** 游戏中心登录态 key（与 esapp-game/src/api/token.ts 一致，跨包共享同一 localStorage） */
const GC_TOKEN_KEY = 'gc_token'

export interface GameItem {
  id: number
  category_id: number
  /** 游戏快应用包名：有值才能拉起 */
  pkg: string
  name: string
  /** 彩色方角应用图标 URL */
  icon: string
  description: string
  /** all | 12+ */
  rating: string
}

export interface GameCategory {
  id: number
  name: string
  games: GameItem[]
}

interface CachePayload {
  updatedAt: number
  list: GameCategory[]
}

/** 本次加载结果（含"数据从哪来"的如实标注，供 UI 显示） */
export interface GamesState {
  list: GameCategory[]
  /** 上次成功拉取的时间戳；0 = 从未成功过 */
  updatedAt: number
  /** 本次结果是否直接来自缓存（未发请求） */
  fromCache: boolean
  /** 缓存是否已过期 */
  expired: boolean
  /** 拉取失败提示（有缓存时表示"显示的是缓存"） */
  error: string
}

export const EMPTY_GAMES_STATE: GamesState = {
  list: [],
  updatedAt: 0,
  fromCache: false,
  expired: false,
  error: '',
}

/** 读游戏中心登录 token（没有就空串，游戏按游客跑，结算不上报） */
export async function readGameToken(): Promise<string> {
  return await storageGet(GC_TOKEN_KEY)
}

async function readCache(): Promise<CachePayload | null> {
  const p = await storageGetJSON<CachePayload>(CACHE_KEY)
  if (!p || !Array.isArray(p.list) || !Number.isFinite(p.updatedAt)) return null
  return p
}

async function writeCache(list: GameCategory[]): Promise<void> {
  // 写入失败只影响下次是否命中缓存，不影响本次展示
  await storageSet(CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), list }))
}

/** 缓存是否新鲜（未过期） */
export function isFresh(updatedAt: number): boolean {
  return updatedAt > 0 && Date.now() - updatedAt < CACHE_TTL_MS
}

async function fetchGameList(): Promise<{ ok: boolean; data: GameCategory[]; message: string }> {
  try {
    const res = await fetch(`${BASE}/api/game/list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await res.json().catch(() => null)
    if (json && json.code === 200 && Array.isArray(json.data)) {
      return { ok: true, data: json.data as GameCategory[], message: '' }
    }
    return { ok: false, data: [], message: (json && (json.message || json.error)) || `请求失败(${res.status})` }
  } catch (e) {
    return { ok: false, data: [], message: '网络异常' }
  }
}

async function runLoad(force: boolean): Promise<GamesState> {
  const cache = await readCache()
  if (cache && !force && isFresh(cache.updatedAt)) {
    return { list: cache.list, updatedAt: cache.updatedAt, fromCache: true, expired: false, error: '' }
  }

  const res = await fetchGameList()
  if (res.ok) {
    await writeCache(res.data)
    return { list: res.data, updatedAt: Date.now(), fromCache: false, expired: false, error: '' }
  }

  // 拉取失败：有旧缓存就继续用（如实标注已过期），否则给空态 + 错误
  if (cache) {
    return { list: cache.list, updatedAt: cache.updatedAt, fromCache: true, expired: true, error: '刷新失败，显示本地缓存' }
  }
  return { list: [], updatedAt: 0, fromCache: false, expired: false, error: res.message || '加载失败' }
}

/** 在途请求：短时间内连续切 tab 会重复挂载，共享同一次加载，避免重复打后端 */
let inflight: Promise<GamesState> | null = null

/**
 * 加载游戏列表。
 * @param force 手动刷新（点「刷新」按钮）时传 true，跳过缓存时效判断
 */
export function loadGames(force = false): Promise<GamesState> {
  if (inflight) return inflight
  inflight = runLoad(force)
  const clear = () => {
    inflight = null
  }
  inflight.then(clear, clear)
  return inflight
}

/** 扁平游戏列表（列表页展示用，顺序按接口给的分类顺序） */
export function flattenGames(list: GameCategory[]): GameItem[] {
  const out: GameItem[] = []
  list.forEach((c) => c.games.forEach((g) => out.push(g)))
  return out
}

export function countGames(list: GameCategory[]): number {
  return flattenGames(list).length
}

/** 只保留有游戏的分类（空分类对用户没意义） */
export function categoriesWithGames(list: GameCategory[]): GameCategory[] {
  return list.filter((c) => c.games.length > 0)
}
