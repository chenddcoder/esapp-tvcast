#!/usr/bin/env node
/**
 * tvcast launcher「本机应用」磁贴对接验证 —— 参考 verify-game-entry.cjs 的宿主方案。
 *
 * 链路：web-runtime staging 加载 tvcast dev bundle（launcher 页）
 *   → 点击磁贴 name="tile-游戏中心" / name="tile-天气"
 *   → useESNativeRouter.push({pkg}) → EsNativeModule.launchEsPage
 *   → 整页 reload ?es_pkg=<包名> → 自建 resolver（runtime.chenddcoder.cn）解析 + 加密 zip 下载解密
 *   → VirtualFS → 目标快应用首页渲染
 *
 * 覆盖两个已发布应用：cn.chenddcoder.game（游戏中心）、cn.chenddcoder.weather（天气）。
 *
 * 前置：先 `pnpm dev` 产出 dist/dev/index.bundle（dev 构建含未压缩 bundle）。
 * 用法：env -u NODE_OPTIONS node scripts/verify-apps-entry.cjs [--port 41006] [--bundle <path>]
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
const PORT = Number(arg('port', '41006'))
const STAGE = '/tmp/tv-apps-stage-' + process.pid
const PROFILE = '/tmp/tv-apps-profile-' + process.pid

/** 磁贴名 → 期望的 es_pkg + 目标应用首页特征文案 */
const CASES = [
  { tile: '游戏中心', pkg: 'cn.chenddcoder.game', marks: ['全部游戏', '游戏中心'] },
  { tile: '天气', pkg: 'cn.chenddcoder.weather', marks: ['未来 7 天', '城市'] },
]

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
      // web-runtime AutoProxy 把跨域 XHR 改写为 /proxy?url=...：转发到真实服务
      if (p === '/proxy') {
        const target = new URL(req.url, 'http://127.0.0.1').searchParams.get('url')
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', async () => {
          try {
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
  // 本地 dist 无 chenddcoder 配置，默认会落 https://run.quicktvui.com（无此包 → 404）。
  // 与 desktop-runtime ui_scale.js 同款：早于主 JS 注入自建 resolver base（跨包 reload 后仍生效）。
  await page.addInitScript(() => {
    window.__CROSS_APP_RESOLVER_BASE__ = 'https://runtime.chenddcoder.cn'
  })
  const logs = []
  page.on('console', (m) => logs.push(m.text()))
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))

  const args = encodeURIComponent(JSON.stringify({ url: 'home' }))
  const pageUrl = `http://127.0.0.1:${PORT}/index.html?bundle=/bundles/index.bundle&args=${args}`
  const bodyText = () => page.evaluate(() => document.body.innerText || '')

  // ① launcher 渲染：两个真实应用磁贴 + 图标加载
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(8000)
  const t1 = await bodyText()
  check(
    '① launcher 渲染（我的应用 + 游戏中心 + 天气）',
    t1.includes('我的应用') && t1.includes('游戏中心') && t1.includes('天气'),
    `body=${JSON.stringify(t1.slice(0, 120))}`
  )
  // ②③ 全部应用：分类 chips **常显**（陈兄 2026-09-12：分类 tab 保留着，方便后面扩展）
  //      + 点分类能真的筛出子集（不只是画了个壳）
  await page.locator('div[name="rail-apps"]').first().click()
  await page.waitForTimeout(2500)
  const tileNames = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('div[name^="tile-"]')).map((e) => e.getAttribute('name'))
    )
  const chipStates = await page.evaluate(() =>
    ['all', '游戏', '工具'].map((k) => {
      const el = document.querySelector(`div[name="chip-${k}"]`)
      return { k, has: !!el, text: el ? el.innerText : '' }
    })
  )
  await page
    .screenshot({ path: path.join(__dirname, '..', 'docs/pen/p1-real-apps.png') })
    .catch(() => {})
  check(
    '② 全部应用：分类 chips 常显（全部 / 游戏 / 工具）',
    chipStates.every((c) => c.has),
    JSON.stringify(chipStates)
  )

  const pickChip = async (key) => {
    await page.locator(`div[name="chip-${key}"]`).first().click()
    await page.waitForTimeout(1200)
  }
  await pickChip('游戏')
  const onlyGame = await tileNames()
  await pickChip('工具')
  const onlyTool = await tileNames()
  await pickChip('all')
  const allTiles = await tileNames()
  check(
    '③ 分类筛选生效：游戏→1 个 / 工具→1 个 / 全部→2 个',
    onlyGame.length === 1 &&
      onlyGame[0] === 'tile-游戏中心' &&
      onlyTool.length === 1 &&
      onlyTool[0] === 'tile-天气' &&
      allTiles.length === 2,
    `游戏=${JSON.stringify(onlyGame)}；工具=${JSON.stringify(onlyTool)}；全部=${JSON.stringify(allTiles)}`
  )

  const icons = await page.evaluate(() =>
    ['tile-游戏中心', 'tile-天气'].map((n) => {
      const el = document.querySelector(`div[name="${n}"]`)
      const img = el && el.querySelector('img')
      return { n, ok: !!img && img.complete && img.naturalWidth > 0, src: img ? img.getAttribute('src').split('/').pop() : null }
    })
  )
  check(
    '④ 两个磁贴图标加载（cn.chenddcoder.game.svg / weather-app.svg 彩色应用图标）',
    icons.every((i) => i.ok),
    JSON.stringify(icons)
  )

  // ⑤⑥ 逐个点击磁贴 → 跨包拉起
  for (const c of CASES) {
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(6000)

    const tile = page.locator(`div[name="tile-${c.tile}"]`).first()
    await tile.click()
    await page.waitForTimeout(2500)
    if (!page.url().includes('es_pkg=')) {
      console.log(`（鼠标点击未触发，改用 聚焦+Enter：${c.tile}）`)
      await tile.focus()
      await page.keyboard.press('Enter')
    }

    let body = ''
    let hit = false
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000)
      body = await bodyText()
      hit = c.marks.some((m) => body.includes(m))
      if (hit) break
    }
    const urlNow = page.url()
    check(
      `点击「${c.tile}」→ es_pkg 拉起 ${c.pkg}`,
      hit && urlNow.includes('es_pkg=' + c.pkg),
      `url=${urlNow.slice(0, 110)}；body=${JSON.stringify(body.slice(0, 110))}`
    )
  }

  const errLogs = logs.filter((l) => /PAGEERROR|es_pkg.*Failed|Failed to fetch|launchEsPage|Cross-app|Not found|404/i.test(l))
  if (errLogs.length) {
    console.log('\n--- 相关日志 ---')
    errLogs.slice(0, 12).forEach((l) => console.log('  ' + l.slice(0, 180)))
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
