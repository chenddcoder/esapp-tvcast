#!/usr/bin/env node
/**
 * tvcast launcher「游戏中心」tab 验证 —— 列表拉取 + 本地缓存时效 + 游戏拉起。
 *
 * 覆盖陈兄定的逻辑：切 tab 时取游戏库 → 缓存本地 → 未过期不再请求 → 过期重新拉取。
 *
 * 链路：web-runtime staging 加载 tvcast dev bundle（launcher 页）
 *   → 点导航轨 rail-games → GamesView 挂载 → GET www.chenddcoder.cn/api/game/list
 *   → 写 localStorage `tvcast_games_cache` → 渲染游戏磁贴
 *   → 点磁贴 name="tile-<游戏名>" → nativeRouter.push({pkg, args:{params:{token,gameId,source}}})
 *   → 整页 reload ?es_pkg=<游戏包名> → 目标游戏菜单页
 *
 * 断言（用「实际发出的 /api/game/list 请求数」证明缓存生效，不靠日志猜）：
 *   ① 首次进 tab          → 恰好 1 次请求 + 缓存落盘
 *   ② 切走再切回（未过期）→ 仍是 1 次（命中缓存，不发请求）
 *   ③ 把缓存 updatedAt 改老 → 切走再切回 → 变 2 次（过期重拉）
 *   ④ 点游戏磁贴          → ?es_pkg=cn.chenddcoder.hongjian + 游戏菜单页渲染
 *
 * 前置：先 `pnpm dev` 产出 dist/dev/index.bundle。
 * 用法：env -u NODE_OPTIONS node scripts/verify-games-tab.cjs [--port 41007] [--bundle <path>]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')

const pw = require('/Users/chendd/.trae/skills/playwright-skill/node_modules/playwright-core/index.js')
const { chromium } = pw
const CHROME_EXEC =
  '/Users/chendd/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const RUNTIME_DIR = '/Volumes/WD/Users/chendd/Documents/self/扩展屏快应用/quicktvui/packages/web-runtime/dist'
const BUNDLE = arg('bundle', path.join(__dirname, '..', 'dist/dev/index.bundle'))
const PORT = Number(arg('port', '41007'))
const STAGE = '/tmp/tv-games-stage-' + process.pid
const PROFILE = '/tmp/tv-games-profile-' + process.pid

/** 目标游戏（来自 /api/game/list 的第一条；用作拉起断言） */
const GAME = { name: '鸿渐冒险', pkg: 'cn.chenddcoder.hongjian', mark: '开始游戏' }
/** 与 gamesApi.ts 保持一致 */
const CACHE_KEY = 'tvcast_games_cache'
const TTL_MS = 30 * 60 * 1000

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.svg': 'image/svg+xml',
}

const results = []
function check(name, ok, evidence) {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${evidence}`)
}

function serve() {
  return http
    .createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0])
      if (p === '/proxy') {
        const target = new URL(req.url, 'http://127.0.0.1').searchParams.get('url')
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', async () => {
          try {
            // 必须转发 headers + body：跨包解析 POST /api/app/resolve 是
            // application/octet-stream 的加密体，漏转发会被服务端拒（表现为 404/解析失败）。
            const r = await fetch(target, {
              method: req.method,
              headers: { 'Content-Type': req.headers['content-type'] || 'application/octet-stream' },
              body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
              redirect: 'follow',
            })
            const buf = Buffer.from(await r.arrayBuffer())
            const headers = {}
            r.headers.forEach((v, k) => {
              if (!/content-length|access-control|transfer-encoding/i.test(k)) headers[k] = v
            })
            res.writeHead(r.status, headers)
            res.end(buf)
          } catch (e) {
            res.writeHead(502, { 'Content-Type': 'text/plain' })
            res.end('proxy error: ' + e.message)
          }
        })
        return
      }
      if (p === '/') p = '/index.html'
      const file = path.join(STAGE, path.normalize(p).replace(/^(\.\.[/\\])+/, ''))
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('404 ' + p)
          return
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        })
        res.end(buf)
      })
    })
    .listen(PORT, '127.0.0.1')
}

;(async () => {
  if (!fs.existsSync(BUNDLE)) {
    console.error('bundle 不存在：' + BUNDLE + '（先跑 pnpm dev）')
    process.exit(1)
  }
  fs.mkdirSync(path.join(STAGE, 'bundles'), { recursive: true })
  for (const f of fs.readdirSync(RUNTIME_DIR)) {
    if (f.endsWith('.gz')) continue
    fs.copyFileSync(path.join(RUNTIME_DIR, f), path.join(STAGE, f))
  }
  fs.copyFileSync(BUNDLE, path.join(STAGE, 'bundles/index.bundle'))

  const server = serve()
  await new Promise((r) => server.on('listening', r))

  const browser = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    executablePath: CHROME_EXEC,
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--disable-web-security'],
    viewport: { width: 1920, height: 1080 },
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.addInitScript(() => {
    window.__CROSS_APP_RESOLVER_BASE__ = 'https://runtime.chenddcoder.cn'
  })

  let listRequests = 0
  const logs = []
  page.on('request', (r) => {
    if (decodeURIComponent(r.url()).includes('/api/game/list')) listRequests++
  })
  page.on('console', (m) => logs.push(m.text()))
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))

  const bodyText = () => page.evaluate(() => document.body.innerText || '')
  const cacheRaw = () =>
    page.evaluate((k) => {
      try {
        return localStorage.getItem(k)
      } catch (e) {
        return null
      }
    }, CACHE_KEY)
  const clickRail = async (key) => {
    const el = page.locator(`div[name="rail-${key}"]`).first()
    await el.click()
    await page.waitForTimeout(2500)
  }

  const args = encodeURIComponent(JSON.stringify({ url: 'home' }))
  const pageUrl = `http://127.0.0.1:${PORT}/index.html?bundle=/bundles/index.bundle&args=${args}`
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(7000)

  // ① 切到游戏中心 tab：拉一次列表 + 落缓存
  await clickRail('games')
  let body = await bodyText()
  let cache = await cacheRaw()
  let cached = null
  try {
    cached = cache ? JSON.parse(cache) : null
  } catch (e) {}
  check(
    '① 切到「游戏中心」tab → 拉取游戏库并渲染磁贴',
    listRequests === 1 && body.includes(GAME.name) && body.includes('游戏中心'),
    `请求数=${listRequests}；body=${JSON.stringify(body.slice(0, 100))}`
  )
  check(
    '① 缓存写入 localStorage（' + CACHE_KEY + '）',
    !!cached && Array.isArray(cached.list) && Number.isFinite(cached.updatedAt),
    `updatedAt=${cached && cached.updatedAt}；分类数=${cached && cached.list && cached.list.length}`
  )

  // ② 切走再切回（缓存未过期）→ 不应再发请求
  await clickRail('home')
  await clickRail('games')
  body = await bodyText()
  const shot = path.join(__dirname, '..', 'docs/pen/p1-real-games.png')
  await page.screenshot({ path: shot }).catch(() => {})
  check(
    '② 缓存未过期 → 切回不发请求（命中缓存）',
    listRequests === 1 && body.includes(GAME.name),
    `请求数=${listRequests}；状态条=${JSON.stringify((body.match(/缓存[^\n]*/) || [''])[0].slice(0, 40))}；截图=${shot}`
  )

  // ③ 手动把缓存改过期 → 切回应重新拉取
  // 注意：web-renderer 下 localStorage 被换成 Promise 版（asyncLocalStorage），
  // 这里必须 await getItem/setItem，否则 JSON.parse 拿到 "[object Promise]"（踩过一次）。
  await page.evaluate(
    async (a) => {
      const raw = await localStorage.getItem(a.k)
      const o = JSON.parse(raw)
      o.updatedAt = Date.now() - a.ttl - 60000
      const r = localStorage.setItem(a.k, JSON.stringify(o))
      if (r && typeof r.then === 'function') await r
    },
    { k: CACHE_KEY, ttl: TTL_MS }
  )
  await clickRail('home')
  await clickRail('games')
  body = await bodyText()
  check(
    '③ 缓存过期 → 切回重新拉取',
    listRequests === 2 && body.includes(GAME.name),
    `请求数=${listRequests}`
  )

  // ④ 点游戏磁贴 → 跨包拉起游戏（带 token/gameId/source 参数）
  const tile = page.locator(`div[name="tile-${GAME.name}"]`).first()
  await tile.click()
  await page.waitForTimeout(2500)
  if (!page.url().includes('es_pkg=')) {
    console.log('（鼠标点击未触发，改用 聚焦+Enter）')
    await tile.focus()
    await page.keyboard.press('Enter')
  }
  let hit = false
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000)
    body = await bodyText()
    hit = body.includes(GAME.mark)
    if (hit) break
  }
  check(
    `④ 点游戏磁贴 → es_pkg 拉起 ${GAME.pkg}（且 token 未被 Promise 污染）`,
    hit &&
      page.url().includes('es_pkg=' + GAME.pkg) &&
      !decodeURIComponent(page.url()).includes('[object Promise]'),
    `url=${decodeURIComponent(page.url()).slice(0, 170)}；body=${JSON.stringify(body.slice(0, 100))}`
  )

  const errLogs = logs.filter((l) => /PAGEERROR|Uncaught|Failed to fetch|game\/list/i.test(l))
  if (errLogs.length) {
    console.log('\n--- 相关日志 ---')
    errLogs.slice(0, 10).forEach((l) => console.log('  ' + l.slice(0, 180)))
  }

  await browser.close()
  server.close()
  try {
    fs.rmSync(STAGE, { recursive: true, force: true })
    fs.rmSync(PROFILE, { recursive: true, force: true })
  } catch (_e) {}

  const failed = results.filter((r) => !r.ok)
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' 通过 ====')
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
