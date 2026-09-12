# esapp-tvcast 按设计稿优化 —— 可实现性评估与落地计划

- 设计源：`docs/pen/tvcast.pen`（3 屏 × 1920×1080，33 个 `tv-*` 设计 token，Dark/Light 双主题）
- 对照实现：`src/pages/launcher/`（单页启动器）、`src/pages/casting/index.vue`（投屏覆盖/路由页）、`src/pages/settings/`、`src/pages/guide/`
- 结论一句话：**骨架 100% 可落地；「数据真实性」和「投屏页右栏语义」两块必须改设计，不能照抄。**

---

## 1. 设计稿解析结果（已核实的客观数据）

| 屏 | 结构要点 | 关键尺寸 |
|---|---|---|
| 01 首页 | 132px 左导航轨（4 项 + HDMI 胶囊）+ header（设备名/状态胶囊/48px 时钟/日期）+ hero 卡（上次投屏 + 开始投屏 CTA）+ aside「可投屏设备」3 条 + 「最近打开」7 磁贴 + 72px 快捷键条 | hero 1033×455，aside 601×455，磁贴 185×272 |
| 02 全部应用 | header（标题 + 共 24 个应用 + 搜索框 480×60）+ 分类 chips（全部24/影音9/音乐4/社交5/游戏3/工具3）+ 24 磁贴 **8 列 × 3 行** + 快捷键条 | 磁贴 185×212，行距 48，列距 26 |
| 03 投屏进行中 | 全屏媒体 + 双层渐变 scrim + 左上返回/正在投屏胶囊/标题/来源 + 右上 3 信息胶囊 + 右侧「画面源」4 项 + 底部 992px 控制条（上一个/播放/下一个/进度/音量60%/全屏/停止投屏） | 右栏宽 420，控制条 992×90 |

设计 token 已完整（`tv-bg #0b101e` / `tv-accent #fb615a` / `tv-live #61cb7c` / 字号 21·22·26·34·48 / radius 16·24·pill）。**注意：设计已在 09-12 走过一轮评审修订**（8 列、字号电视化、scrim 改 to right、磁贴去卡片框、设备在线加绿点、停止投屏改实心 coral），本计划基于**修订后**版本。

---

## 2. 现状 vs 设计：差在哪

| 维度 | 现状 | 设计 | 差距性质 |
|---|---|---|---|
| 导航 | 顶部状态栏 + 底部 dock（应用商店/搜索/设置/开始投屏） | 左侧 132px 导航轨，4 目的地：首页/全部应用/投屏/设置 | **结构性重排**（新增页面壳） |
| 主色 | 紫青渐变 `#7c5cff → #4fd1c5` | 珊瑚红 `#fb615a` + 深海军蓝底 | 换肤，低成本 |
| 信息架构 | 1 页塞「最近打开 + 全部应用」两段 | 拆成 2 页（首页只留 hero + 设备 + 最近打开；全部应用独立页 + 搜索 + 分类） | 结构性 |
| 字号 | 22–30 | 21–48（时钟 48） | 全量重排 |
| 投屏页 | 极简：顶部来源条 + 底部控制条（文本符号 ❚❚ ▶ ⏹ ⌂） | 完整导播台：scrim + 状态胶囊组 + 右栏信息 + 图标化控制条 + 音量/全屏 | 增量重做 |
| 磁贴 | 188×172 带描边卡片，7 列 | 185×212 无框图标 + 名称 + meta，8 列 | 视觉重排 |

---

## 3. 可行性分级（元素级）

### 3.1 ✅ 可直接实现（低风险，几乎无技术障碍）

1. **珊瑚红换肤**：token 值直接替换；抽 `src/styles/tokens.ts` 供 JS 侧用色（seek 进度色、状态点色）。
2. **左侧导航轨**：纯 flex 容器 + 4 个 focusable 项（icon 上 / label 下，`focus-scale` + `focus-background-color`），沿用现有 AppCard 的焦点写法。底部 HDMI 胶囊改「本机状态胶囊」（HDMI 语义不明，评审已标黄）。
3. **快捷键提示条**：静态文本 + kbd 方块，零风险。需先确认键位真实可用再展示文案。
4. **header 重排**：设备名（已有 `ProcessBridgeModule.getDlnaName`）+ 大时钟 48px（现有 setInterval，建议降到 30s/次）+ 日期。「投屏就绪」胶囊接真实状态（`markDlnaReady`）。
5. **分类 chips + 计数**：`appTypes.ts` 加 `category` 字段，计数由数组派生，无需后端。总数 9+4+5+3+3=24 与设计一致。
6. **24 磁贴 8 列 × 3 行**：**建议继续用现有 flex-wrap 方案**（24 条数据无需虚拟化，`qt-grid-view` spanCount 引入额外焦点契约风险）。8×(185+26)=1688，内容区 1660 → 磁贴宽改 181px 或列距改 23px 精确占满。
7. **投屏页 scrim + 标题/来源 + 播放暂停/进度/停止**：现有链路（ESPlayerManager + dlna-bridge + qt-seek-bar）已通，属重排版而非重写。
8. **分辨率胶囊**：`video.videoWidth/videoHeight` 是真实可得数据 → 「1080P」能真做。
9. **音量条 + 全屏**：player `setVolume` / 全屏切换均为既有能力；音量条用 `qt-progress-bar`。
10. **上一集 / 下一集**：现有下键切集（`forceComplete` + DLNA 上报）已有，扩展上键即可。

### 3.2 ⚠️ 需变通 / 降级（能做，但拿不到设计假设的数据）

| 设计元素 | 问题 | 建议方案 |
|---|---|---|
| 首页 hero「上次投屏 · 手机相册」大字报底图 | ①快应用里没有"上次投屏画面缩略图"；②设计稿底图是真实照片（版权/隐私） | 保留卡结构；底图改**抽象渐变 + 装饰纹理**；文案取真实「上次投屏记录」（本地持久化，无记录时降级为「还没有投屏记录 · 手机推送视频/照片到这里」引导态） |
| hero CTA「开始投屏」 | TV 是接收端，"开始投屏"实际含义是"等待手机推送" | 保留按钮，点击进「接收引导」态（含二维码，见下） |
| 「最近打开」的 `分类 · 时间` meta | 需要真实的最近使用时间 | 打开应用时写入本地存储（`@extscreen/es3-core` SharedPreferences / localStorage），格式化为「2 小时前」；**磁贴必须真实可打开**，否则 meta 是假的 |
| header「已连接 · Wi-Fi 6」 | 拿不到 SSID 和频段 | 降级为「已连接」或「Wi-Fi」；频段除非 Rust 侧补能力，否则不做 |
| 「投屏就绪」绿点 | 可做 | 接 `markDlnaReady` 的真实状态机：就绪 / 投屏中 / 未连接 |
| 投屏页「1080P · 60fps」「Wi-Fi 6 · 5GHz」 | fps 和频段都不可得 | 改「1080P · DLNA」「已投屏 mm:ss」（时长真实） |
| 02 搜索框 | web-renderer 的 QtTextInput 可用（设置页已有 `<input>` 先例），但**遥控器输入中文体验差** | v1 先做分类 chips（高价值低风险）；搜索框保留视觉但点击后弹系统输入 + 仅匹配名称/拼音首字母；若体验不达标则改设计去掉搜索框 |
| 24 个应用磁贴的点击行为 | 24 个全是第三方品牌 App，TV 侧既不能安装也不能投屏 | 每项标 `castable` / `nativePkg` / `placeholder`；placeholder 走 toast「即将接入」（沿用现有策略，**禁用触发而非删功能**） |
| 字号放大后的一屏装下 | 01 屏实测内容 1071/1080（**只剩 9px 余量**）；02 屏 1064/1080 | 按设计值落地后**必须实测溢出**；真机字体度量与设计工具不同，正文类留 2–4px 弹性（宁可缩 2px 字，不可裁内容） |
| Light 主题 | 设计给了 Dark/Light 双 token | **只做 Dark**（TV 客厅无浅色场景）；token 文件保留 Light 值备用 |

### 3.3 ❌ 数据/语义不可得，**必须改设计**（照抄会做假功能）

| 设计元素 | 为什么不行 | 建议改法 |
|---|---|---|
| **首页 aside「可投屏设备」3 条（iPhone/MacBook Pro/iPad Air + 在线/空闲）** | DLNA **DMR 接收端无法枚举 source**。手机是否在线、有几台设备，接收端没有这个信息。现状只能从 Rust 侧拿到本机广播名。 | 三选一：<br>**A（推荐，可做真功能）**：改成「手机投屏到这里」引导卡 —— 用 `qt-qr-code` 生成真实二维码（指向 `runtime.chenddcoder.cn` 投屏指引），下方列**本机信息**（设备名 / IP / 状态）。这是真数据、真有用。<br>**B（要改 Rust）**：desktop-runtime 的 Rust 侧记录「最近投屏来源」（会话建立时的 IP + UA）→ 给出 1 条真实「上次投屏：iPhone 15 Pro」+ 空态。<br>**C（不建议）**：保留 3 条假数据 —— 电视上展示不存在的设备，产品上站不住。 |
| **投屏页右栏「画面源」4 项（相册/视频应用/手机镜像/电脑投屏）** | 接收端**不能选源**，源由手机端决定。这 4 项在 TV 上点了没有任何作用。 | 改成**只读「投屏信息」卡**：来源设备 / 投屏类型（相册·视频·镜像）/ 分辨率 / 已投屏时长 / 连接方式。信息全部可从 `payload` + video 元数据派生，是真数据。 |
| **02 磁贴 meta「影音 · 2 小时前」** | 与上方分类 chips 同维度重复（评审已标黄）。 | 只留时间，或只留分类。 |
| **rail「HDMI 1」胶囊** | 语义不明（评审已标黄），且快应用无法切换 HDMI 源。 | 改「本机状态」胶囊（DLNA 就绪 / 投屏中 / IP 尾号）。 |

---

## 4. 资源清单（图标 / 图片）

现有可用 13 个远端 SVG（`https://www.chenddcoder.cn/upload/<key>-icon.svg`，`proto/icons-dist/` 有源文件）。

**净新增约 13 个 SVG**：
- 导航 2：`house`、`grid`（`cast`/`settings` 已有）
- 设备 3：`phone`、`laptop`、`tablet`（→ 仅当决策选 B 时才需要）
- 控制 8：`prev`、`play`、`pause`、`next`、`volume-low`、`volume-high`、`fullscreen`、`stop`

**24 个应用图标**（bilibili / 爱奇艺 / 腾讯视频 / 优酷 / 芒果TV / YouTube / Netflix / Disney+ / Prime Video / Spotify / Apple Music / QQ音乐 / 网易云 / 抖音 / 快手 / 小红书 / 微博 / 微信 / 王者荣耀 / 原神 / 和平精英 / 钉钉 / 腾讯会议 / 高德地图）：

- **方案 A**：直接用设计稿的 24 张 512×512 品牌 PNG（`docs/pen/images/`）→ 上传到 `/upload/`，URL 引用。**视觉与设计稿 1:1**，但有品牌 IP 问题（个人站分发，风险可控）。
- **方案 B**：自绘中性 SVG（品牌色圆角块 + 首字母/几何符号）→ 版权干净，但**明显不如设计稿**。
- **不要本地打包**：24 张 PNG 约 3.4MB，会撑爆快应用包；必须走远端 URL（沿用现有"远端 SVG + 本地 glyph 兜底"策略）。

**2 张照片素材**（hero 底图 204KB / 投屏页底图 357KB）：均建议替换为渐变/抽象底，不随包分发。

---

## 5. 落地计划

### 阶段 P0 —— 地基与视觉骨架
- 新增 `src/styles/tokens.ts`（Dark 一套色值 + 尺寸常量，供 JS/CSS 双用）
- 新增 `src/pages/launcher/NavRail.vue`（132px 导航轨，4 项，emit `nav`）
- 新增 `src/pages/launcher/HintBar.vue`（72px 快捷键条）
- 全仓 accent 换肤：`#7c5cff/#4fd1c5` → `#fb615a`（含 seek 进度色）
- **页面壳改造**：`launcher/index.vue` 改为「共享 header + NavRail + HintBar + 内容区 v-if 切换（home / apps / settings）」
- 产出：可跑通的 3 目的地骨架 + 换肤

### 阶段 P1 —— 首页（01）
- header：设备名 + 连接胶囊 + 投屏状态胶囊 + 48px 时钟 + 日期
- hero 卡：渐变底 + 上次投屏文案 + 开始投屏 CTA（真实记录，空态降级）
- aside：按决策结果做**二维码引导卡**或**最近投屏来源卡**
- 最近打开：本地持久化最近使用记录 + 时间格式化
- 高度预算复核（设计值只剩 9px 余量）

### 阶段 P2 —— 全部应用（02）
- 分类 chips（含计数、焦点态、选中态）
- 24 磁贴 8 列 × 3 行（flex-wrap，宽度按 1660 内宽反算）
- meta 去重（只留时间）
- 搜索：按决策（先 chips / 或补 input）

### 阶段 P3 —— 投屏页（03）
- 双层 scrim + 返回圆钮 + 正在投屏胶囊 + 标题/来源
- 右上信息胶囊（分辨率真实值 + 时长）
- 右栏改**只读投屏信息卡**（替换「画面源」）
- 控制条图标化（8 个 SVG）+ 音量条 + 全屏 + 实心 coral 停止
- 回归：多播放器实例、切集防抖、返回键链路（这几处有历史 bug，改动前先跑通现状）

### 阶段 P4 —— 资源
- 按决策生成 13 个 SVG（沿用 `proto/gen-icons.cjs`）+ 24 应用图标
- 上传 `root@www.chenddcoder.cn:/opt/upFiles/`，覆盖前先 `cp -n` 备份，逐个 `curl -sI` 验 200

### 阶段 P5 —— 验证
- 构建：`PATH="$PWD/node_modules/.bin:$PATH" tsx scripts/build.ts`（沙箱下先 `mv dist/android dist/android_bak`，不可跨设备 mv）
- 焦点链路实测：导航轨 ↔ 内容区、8 列网格末列、返回键
- 投屏全链路回归（手机推流 → 播放 → seek → 切集 → 停止）
- 真机 + web-cli 双端

---

## 6. 风险清单

**🔴 红（会做假功能，必须先决策）**
1. 投屏页右栏「画面源」4 项：接收端不能选源，照抄= 无功能按钮。
2. 首页「可投屏设备」列表：DMR 无设备发现能力，照抄= 展示不存在的设备。
3. 24 个第三方 App 的行为定义缺失：不确定就全是 toast，页面变"假货架"。

**🟠 橙（能解但需实测/改造成本）**
4. 首页一屏高度只余 9px：真机字体度量差异极易溢出。
5. 搜索框遥控器输入体验未知（`QtTextInput` 在 web-renderer 真机链路有历史坑）。
6. 「上次投屏」「最近打开时间」需要新增本地持久化，链路要新写。
7. 投屏页历史 bug 密集（多播放器实例 / 切集防抖 / 返回链路），重排 UI 时容易回归。

**🟡 黄（可选/低优先）**
8. Light 主题不做（建议）。
9. 24 品牌图标的 IP 归属。
10. rail「HDMI 1」胶囊语义。

---

## 7. 需拍板的决策点

1. **页面组织**：A 单页壳 + v-if 视图切换（推荐，规避 web-renderer 路由坑、TV 零切换成本）／ B 新增 `/apps` 真路由（真机优雅、web 需兜底双实现）。
2. **投屏页右栏**：A 改只读「投屏信息」卡（推荐）／ B 保留「画面源」但置灰说明"由手机端选择"／ C 删掉右栏。
3. **首页设备区**：A 二维码投屏引导卡（推荐，真功能）／ B 改 Rust 补「最近投屏来源」记录（能出 1 条真数据，需重编译 desktop-runtime）／ C 保留 3 条假数据。
4. **应用图标素材**：A 复用设计稿 24 张品牌 PNG（视觉 1:1，有 IP 风险）／ B 自绘中性 SVG（干净，视觉打折）。

---

## 8. 落地记录

### 8.1 应用目录按实际情况收口（2026-09-12）
决策点 4（图标素材）与风险 3（24 个 App 的行为定义）随之作废：**设计稿的 24 个手机侧应用整体移除**，目录改为本机真实可拉起的个人快应用。

依据是各工程 `.deploy.env`（发版时的权威值，也是线上 RuntimeController 的登记值）：

| 展示名 | 包名 | 线上版本 | 图标 | 分类 |
|---|---|---|---|---|
| 游戏中心 | `cn.chenddcoder.game` | 1.0.3 | game-icon.svg | 游戏 |
| 天气 | `cn.chenddcoder.weather` | 1.1.2 | weather-icon.svg | 工具 |

- 鸿渐冒险 `cn.chenddcoder.hongjian` **不列入**：它是游戏中心内部带 token/gameId 拉起的游戏（`esapp-game/src/pages/detail/index.vue` 的 `nativeRouter.push`），作为一级入口会缺参数报错。
- 磁贴点击 = `nativeRouter.push({ pkg })` → `EsNativeModule.launchEsPage` → 整页 reload `?es_pkg=<包名>`（沿用旧启动器已在 hongjian 上验证过的链路）。
- **分类 chips 无条件常显**（2026-09-12 陈兄修正：分类 tab 保留着，方便后面扩展）—— 即便当前只有「游戏 / 工具」各 1 个应用也照常展示「全部2 / 游戏1 / 工具1」，且点分类能真的筛出子集。chips 行高度固定 60，显示与否都不动网格原点（**仍锁设计稿的 232px**）。只有**搜索框**保留数量阈值（< 6 个应用不摆：对两三个应用做搜索是无意义交互，TV 遥控器输入也差），目录长大后自动出现。
- 首页那一行由「最近打开」改为「我的应用」：当前没有任何使用记录，写「最近打开」是假信息；P1 接入真实最近使用后再恢复该语义。

### 8.2 端到端验证
`scripts/verify-apps-entry.cjs`（web-runtime staging 宿主 + tvcast dev bundle + 自建 resolver）：

```
PASS  ① launcher 渲染（我的应用 + 游戏中心 + 天气）
PASS  ② 全部应用：分类 chips 常显（全部 / 游戏 / 工具）
      [{"k":"all","has":true,"text":"全部2"},{"k":"游戏","has":true,"text":"游戏1"},{"k":"工具","has":true,"text":"工具1"}]
PASS  ③ 分类筛选生效：游戏→1 个 / 工具→1 个 / 全部→2 个
      游戏=["tile-游戏中心"]；工具=["tile-天气"]；全部=["tile-游戏中心","tile-天气"]
PASS  ④ 两个磁贴图标加载（cn.chenddcoder.game.svg / weather-app.svg）
PASS  点击「游戏中心」→ es_pkg 拉起 cn.chenddcoder.game
      url=...?es_pkg=cn.chenddcoder.game；body="...运行中: cn.chenddcoder.game v1.0.3...游戏中心 登录 加载中..."
PASS  点击「天气」→ es_pkg 拉起 cn.chenddcoder.weather
      url=...?es_pkg=cn.chenddcoder.weather；body="...运行中: cn.chenddcoder.weather v1.1.2...天气 北京 体感..."
==== 6/6 通过 ====
```

即分类筛选真的筛出子集、两个磁贴都能真实解析、下载、解密并渲染目标快应用首页。

### 8.3 「游戏中心」独立 tab（2026-09-12）

陈兄定的逻辑：**切 tab 时拉取游戏库 → 缓存本地 → 未过期不再请求 → 过期重新拉取**。

- 导航轨由 4 项扩到 5 项（首页 / 全部应用 / **游戏中心** / 投屏 / 设置），新增 `nav-game.svg` + `nav-game-on.svg`（`proto/gen-nav-icons.cjs` 生成后上传 CDN）。
- 数据层 `src/pages/launcher/gamesApi.ts`：`GET /api/game/list`（与 esapp-game 同一后端同一契约，免登录）；缓存 key `tvcast_games_cache`，TTL 30 分钟；拉取失败退回旧缓存并如实标注「刷新失败，显示本地缓存」，不放空页面。
- `GamesView.vue` 挂载即加载（= 切 tab 拉取）；顶部状态条如实显示「缓存 · 更新于 HH:MM / 缓存已过期 / 失败原因」，另有手动「刷新」强制跳过时效。分类 chips 仅在「有游戏的分类 ≥ 2」时出现，只有一个分类时该 60px 格位改显示说明 —— 网格原点始终锁在设计稿的 232px。
- 拉起游戏带参数：`nativeRouter.push({ pkg, args:{ params:{ token, gameId, source:'launcher' } } })`；token 读游戏中心同源的 `gc_token`（未登录为空串，游戏按游客跑）。

**过程中挖出一个真 Bug（影响面超出本 tab）**：web-renderer 启动时 `initAsyncLocalStorage()` 会把全局 `localStorage` 换成方法返回 Promise 的版本，于是 `JSON.parse(localStorage.getItem(k))` 拿到 `"[object Promise]"` → 抛错被 catch 吞掉 → **缓存永远读不回，每次切 tab 都重新请求，且全链路无任何报错**。已新增 `src/tools/storage.ts` 跨运行时适配层（优先用 `globalThis.__nativeLocalStorage` 同步句柄，否则 await thenable），业务侧不再直接摸 localStorage。同源写法在 `个人快应用/esapp-game/src/api/token.ts` 也存在（`getToken` / `getSavedUser`），**待确认后一并修**。

### 8.4 端到端验证
`scripts/verify-games-tab.cjs`（用「实际发出的 /api/game/list 请求数」证明缓存生效，不靠日志猜）：

```
PASS  ① 切到「游戏中心」tab → 拉取游戏库并渲染磁贴      请求数=1
PASS  ① 缓存写入 localStorage（tvcast_games_cache）     updatedAt=…；分类数=2
PASS  ② 缓存未过期 → 切回不发请求（命中缓存）           请求数=1；状态条="缓存 · 更新于 16:23"
PASS  ③ 缓存过期 → 切回重新拉取                        请求数=2
PASS  ④ 点游戏磁贴 → es_pkg 拉起 cn.chenddcoder.hongjian（且 token 未被 Promise 污染）
      url=...?args={"params":{"token":"","gameId":1,"source":"launcher"}}&es_pkg=cn.chenddcoder.hongjian
      body="...运行中: cn.chenddcoder.hongjian v1.0.2...鸿渐冒险 鸿渐于陆..."
==== 5/5 通过 ====
```

注：该脚本的 staging 代理必须转发 `headers` + `body` —— 跨包解析要 POST `application/octet-stream` 的加密体到 `/api/app/resolve`，漏转发会以 404 失败（踩过一次，已对齐 `verify-apps-entry.cjs`）。
