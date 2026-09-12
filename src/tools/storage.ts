/**
 * 跨运行时 localStorage 适配层（同步 / 异步双兼容）。
 *
 * 坑（实测踩过）：QuickTVUI web-renderer 启动时会执行
 * `initAsyncLocalStorage()`（web-renderer/src/core/asyncLocalStorage.js），把全局
 * `window.localStorage` 整个换成 `asyncLocalStorage`——getItem/setItem 一律返回 Promise，
 * 并把原生同步句柄挂在 `globalThis.__nativeLocalStorage`。
 *
 * 于是业务侧按常规同步写法会静默出错：
 *   `JSON.parse(localStorage.getItem(k))` 拿到的是 "[object Promise]" → JSON.parse 抛错
 *   → 被 try/catch 吞掉 → 缓存永远读不回来（表象：每次都重新发请求，看不出报错）。
 *   `localStorage.getItem(k) || ''` 拿到的是 Promise 对象（真值）→ 值变成 "[object Promise]"。
 *
 * 设备端（Hippy 原生）的 localStorage 是同步的，所以这里两条路都走通：
 *   1. 有 __nativeLocalStorage（web 端）→ 直接用，等价同步，无 setTimeout 延迟；
 *   2. 没有（设备端 / 其他运行时）→ 用全局 localStorage，并对返回的 thenable 做 await。
 *
 * 业务代码一律用这里的 async API，不要再直接摸 localStorage。
 */

type MaybePromise<T> = T | Promise<T>

/** 取底层存储句柄；都拿不到返回 null（如隐私模式下被禁用） */
function store(): any {
  const g = globalThis as any
  try {
    if (g.__nativeLocalStorage) return g.__nativeLocalStorage
  } catch (e) {
    // 访问受限，走下面的全局兜底
  }
  try {
    return localStorage
  } catch (e) {
    return null
  }
}

/** 同步值或 Promise 都归一成 Promise */
function settle<T>(v: MaybePromise<T>): Promise<T> {
  return v && typeof (v as any).then === 'function' ? (v as Promise<T>) : Promise.resolve(v as T)
}

/** 读字符串；不存在 / 出错一律返回 '' */
export async function storageGet(key: string): Promise<string> {
  const s = store()
  if (!s) return ''
  try {
    const v = await settle<string | null>(s.getItem(key))
    return typeof v === 'string' ? v : ''
  } catch (e) {
    return ''
  }
}

/** 写字符串；返回是否成功 */
export async function storageSet(key: string, value: string): Promise<boolean> {
  const s = store()
  if (!s) return false
  try {
    await settle(s.setItem(key, value))
    return true
  } catch (e) {
    return false
  }
}

/** 删键 */
export async function storageRemove(key: string): Promise<void> {
  const s = store()
  if (!s) return
  try {
    await settle(s.removeItem(key))
  } catch (e) {
    // 删除失败无副作用可处理
  }
}

/** 读 JSON；解析失败返回 null */
export async function storageGetJSON<T>(key: string): Promise<T | null> {
  const raw = await storageGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    return null
  }
}
