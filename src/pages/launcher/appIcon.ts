// launcher 应用图标：默认图标（glyph 字形）兜底 → fetch 拉取真实 SVG 图标 → base64 缓存到 localStorage。
// 天气等有真实应用(pkg)的卡片配 icon URL，首次启动显示默认字形，拉到后替换为真实图标并缓存，
// 之后启动直接读缓存，不依赖网络也不闪烁。
const CACHE_PREFIX = 'tvcast_icon_v1_'

export function getCachedAppIcon(pkg: string): string | null {
  try {
    return localStorage.getItem(CACHE_PREFIX + pkg)
  } catch {
    return null
  }
}

// SVG 可能是 UTF-8（含中文/emoji），逐字节转 base64，避免 btoa 对非 Latin-1 抛错
function toDataUrl(svgText: string): string {
  const bytes = new TextEncoder().encode(svgText)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return 'data:image/svg+xml;base64,' + btoa(bin)
}

/** 拉取图标并缓存；失败返回 null（调用方保持默认图标）。 */
export async function loadAppIcon(pkg: string, url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const text = await resp.text()
    const dataUrl = toDataUrl(text)
    try {
      localStorage.setItem(CACHE_PREFIX + pkg, dataUrl)
    } catch {
      // 缓存失败不阻塞显示
    }
    return dataUrl
  } catch {
    return null
  }
}
