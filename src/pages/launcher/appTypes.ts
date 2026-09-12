/**
 * 启动器数据模型。
 *
 * 分类按**本机真实应用**划分 —— 设计稿的 影音/音乐/社交 是手机侧的第三方 App，
 * tvcast 作为 DLNA 接收端既装不了也投不了它们（见 docs/design-optimization-plan.md），
 * 所以启动器只列本机真正能拉起的个人快应用。
 */

/**
 * 磁贴（AppTile）需要的最小结构 —— 应用目录与游戏列表都映射成它，
 * 这样游戏中心 tab 能直接复用同一个磁贴组件，不用再做一套视觉。
 */
export interface TileItem {
  /** 展示名 */
  name: string
  /** 图标加载失败时的兜底字形 */
  glyph: string
  /** 图标底渐变起始色（图标加载失败/未接入时兜底） */
  c1: string
  /** 图标底渐变结束色 */
  c2: string
  /** 磁贴副标题；缺省时不显示（当前只有 recent 变体显示副标题） */
  meta?: string
  /** 个人快应用包名：有值则点击时通过 nativeRouter（EsNativeModule.launchEsPage）拉起 */
  pkg?: string
  /** 应用图标（远端 SVG，加载失败退 glyph） */
  icon?: string
}

export type AppCategory = '游戏' | '工具'

export interface AppItem extends TileItem {
  /** 应用分类（决定 02 屏分类 chips） */
  category: AppCategory
}
