#!/usr/bin/env node
/**
 * tvcast launcher「游戏」卡片对接验证 —— 参考 esapp-hongjian verify-e2e.cjs 的宿主方案。
 *
 * 链路：web-runtime staging 加载 tvcast dev bundle（launcher 页）
 *   → 点击「游戏」卡片（name=allApp，文本「游戏」）
 *   → EsNativeModule.launchEsPage → 整页 reload ?es_pkg=cn.chenddcoder.hongjian
 *   → 自建 resolver（__CROSS_APP_RESOLVER_BASE__=runtime.chenddcoder.cn）解析 + 加密 zip 下载解密
 *   → VirtualFS → 鸿渐冒险菜单页渲染
 *
 * 前置：先 `pnpm dev` 产出 dist/dev/index.bundle（dev 构建含未压缩 bundle）。
 *   本沙箱若无法写 dist/dev/（EXDEV），可先程序化构建到 /tmp 再 --bundle 指入。
 * 用法：env -u NODE_OPTIONS node scripts/verify-game-entry.cjs [--port 41004] [--bundle <path>]
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
const GAME_PKG = 'cn.chenddcoder.hongjian'
const STAGE = '/tmp/tv-game-stage-' + process.pid
const PROFILE = '/tmp/tv-game-profile-' + process.pid

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt
}
const PORT = Number(arg('port', '41004'))

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
  results.push({ name, ok, evidence })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${evidence}`)
}

function serve() {
  return http
    .createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0])
      // web-runtime AutoProxy 把跨域 XHR 改写为 /proxy?url=...：转发到真实服务（否则本地 staging 404）
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
  // staging：web-runtime 宿主 + tvcast dev bundle
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
  // 本地 dist 无 chenddcoder 配置，默认落 https://run.quicktvui.com（huan 公共后台无此包 → 404）。
  // 与 desktop-runtime ui_scale.js 同款：早于主 JS 注入自建 resolver base（跨包 reload 后仍生效）。
  await page.addInitScript(() => {
    window.__CROSS_APP_RESOLVER_BASE__ = 'https://runtime.chenddcoder.cn'
  })
  const logs = []
  page.on('console', (m) => logs.push(m.text()))
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))

  const args = encodeURIComponent(JSON.stringify({ url: 'home' }))
  const pageUrl = `http://127.0.0.1:${PORT}/index.html?bundle=/bundles/index.bundle&args=${args}`
  console.log('page: ' + pageUrl)
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(8000)

  // ① launcher 渲染
  const bodyText = () => page.evaluate(() => document.body.innerText || '')
  const t1 = await bodyText()
  check(
    '① launcher 渲染（投屏显象 + 全部应用 + 游戏卡片）',
    t1.includes('投屏显象') && t1.includes('全部应用') && t1.includes('游戏'),
    `body=${JSON.stringify(t1.slice(0, 120))}`
  )

  // ② 游戏卡片图标（hongjian-icon.svg）加载成功（hippy-web 丢 scoped class，按 name 属性定位）
  const iconOk = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[name="allApp"]'))
    const card = cards.find((c) => c.innerText && c.innerText.includes('游戏'))
    if (!card) return 'CARD_NOT_FOUND'
    const img = card.querySelector('img')
    return !!img && img.complete && img.naturalWidth > 0
  })
  check('② 游戏卡片图标加载（hongjian-icon.svg naturalWidth>0）', iconOk === true, `iconOk=${iconOk}`)

  // ③ 点击游戏卡片 → 跨包拉起（先鼠标点击，3s 内无跳转则聚焦+Enter 重试）
  const gameCard = page.locator('div[name="allApp"]', { hasText: '游戏' }).last()
  await gameCard.click()
  await page.waitForTimeout(3000)
  if (!page.url().includes('es_pkg=') && !(await bodyText()).includes('鸿渐冒险')) {
    console.log('（鼠标点击未触发，改用 聚焦+Enter）')
    await gameCard.focus()
    await page.keyboard.press('Enter')
  }
  // _performCrossAppLaunch 会整页 reload 到 ?es_pkg=...：等服务端解析+下载+解压+入口加载
  let t2 = ''
  let menuLoaded = false
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000)
    t2 = await bodyText()
    menuLoaded = t2.includes('鸿渐冒险') && t2.includes('开始游戏')
    if (menuLoaded) break
  }
  const urlNow = page.url()
  check(
    '③ 点击「游戏」→ es_pkg 链路拉起鸿渐冒险菜单页',
    menuLoaded && urlNow.includes('es_pkg=' + GAME_PKG),
    `url=${urlNow.slice(0, 100)}；body=${JSON.stringify(t2.slice(0, 120))}`
  )

  // 错误日志摘要
  const errLogs = logs.filter((l) => /PAGEERROR|es_pkg.*Failed|Failed to fetch|EsNativeModule|launchEsPage|Cross-app/.test(l))
  if (errLogs.length) {
    console.log('\n--- 相关日志 ---')
    errLogs.slice(0, 12).forEach((l) => console.log('  ' + l))
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
