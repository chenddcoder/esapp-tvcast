#!/usr/bin/env node
/**
 * 发版后端到端验证：本地 web-runtime staging 按线上 resolver 拉 **最新已发布包**，
 * 断言跑起来的版本与 UI 特征。resolve(null) 走 ORDER BY created_at DESC LIMIT 1，
 * 即「线上最新版」——用它能证明发版真的生效了（而不是只看上传接口返回）。
 *
 * 用法：env -u NODE_OPTIONS node scripts/verify-deployed-version.cjs [--pkg cn.chenddcoder.tvcast] [--version 1.0.57] [--mark 全部应用]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')

const pw = require('/Users/chendd/.trae/skills/playwright-skill/node_modules/playwright-core/index.js')
const { chromium } = pw
const CHROME_EXEC =
  '/Users/chendd/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const RUNTIME_DIR = '/Volumes/WD/Users/chendd/Documents/self/扩展屏快应用/quicktvui/packages/web-runtime/dist'
const PKG = arg('pkg', 'cn.chenddcoder.tvcast')
const EXPECT_VERSION = arg('version', '')
const MARK = arg('mark', '全部应用')
const PORT = Number(arg('port', '41011'))
const STAGE = '/tmp/tv-deploy-stage-' + process.pid
const PROFILE = '/tmp/tv-deploy-profile-' + process.pid

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

function serve() {
  return http
    .createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0])
      // web-runtime AutoProxy 把跨域请求改写为 /proxy?url=...：
      // 必须转发 headers + body（跨包解析是 POST application/octet-stream 加密体，漏转发 404）
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
          res.writeHead(404)
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
  fs.mkdirSync(STAGE, { recursive: true })
  for (const f of fs.readdirSync(RUNTIME_DIR)) {
    if (f.endsWith('.gz')) continue
    fs.copyFileSync(path.join(RUNTIME_DIR, f), path.join(STAGE, f))
  }
  const server = serve()
  await new Promise((r) => server.on('listening', r))

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    executablePath: CHROME_EXEC,
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--disable-web-security'],
    viewport: { width: 1920, height: 1080 },
  })
  const page = await ctx.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.addInitScript(() => {
    window.__CROSS_APP_RESOLVER_BASE__ = 'https://runtime.chenddcoder.cn'
  })
  const logs = []
  page.on('console', (m) => logs.push(m.text()))
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))

  await page.goto(`http://127.0.0.1:${PORT}/index.html?es_pkg=${PKG}`, {
    waitUntil: 'load',
    timeout: 60000,
  })

  // 最长等 40s：resolve → 下载加密包 → 解密 → 渲染
  let body = ''
  let ok = false
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000)
    body = await page.evaluate(() => document.body.innerText || '')
    ok = body.includes('运行中: ' + PKG) && body.includes(MARK)
    if (ok) break
  }
  const runningLine = (body.match(/运行中[^\n]*/) || ['（未找到）'])[0]
  const versionOk = EXPECT_VERSION ? runningLine.includes('v' + EXPECT_VERSION) : true
  if (ok) {
    const vMatch = runningLine.match(/v([\d.]+)/)
    const shot = path.join(__dirname, '..', 'docs/pen', `deployed-${PKG}${vMatch ? '-' + vMatch[1] : ''}.png`)
    await page.screenshot({ path: shot }).catch(() => {})
    console.log('      截图=' + shot)
  }
  console.log(`${ok && versionOk ? 'PASS' : 'FAIL'}  线上拉起 ${PKG}${EXPECT_VERSION ? '（期望 v' + EXPECT_VERSION + '）' : ''}`)
  console.log(`      ${runningLine}；UI 特征「${MARK}」=${body.includes(MARK)}`)
  if (!ok) {
    console.log('      url=' + page.url().slice(0, 120))
    console.log('      body=' + JSON.stringify(body.slice(0, 160)))
    const errs = logs.filter((l) => /PAGEERROR|Failed|404|resolve|decrypt/i.test(l))
    errs.slice(0, 8).forEach((l) => console.log('      [log] ' + l.slice(0, 160)))
  }

  await ctx.close()
  server.close()
  try {
    fs.rmSync(STAGE, { recursive: true, force: true })
    fs.rmSync(PROFILE, { recursive: true, force: true })
  } catch (_e) {}
  process.exit(ok && versionOk ? 0 : 1)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
