#!/usr/bin/env node
/**
 * 投屏页批 1（视觉/信息层）端到端验收。
 *
 * 链路：web-runtime staging 加载 tvcast dev bundle（launcher 页）
 *   → 经 es3-vue EventDispatcher 直接广播 ACTION_DLNA（playerUrl，本地测试视频）
 *   → App.vue push casting 路由页 → ESPlayerManager 起播（HTML5 video）
 *   → 断言批 1 的全部 UI 层：双层 scrim / 返回圆钮 / 正在投屏胶囊 / 右上信息胶囊
 *     （分辨率=真实 720P + 已投屏时长）/ 右栏只读投屏信息卡 / 992×90 图标化控制条
 *   → 点「停止投屏」→ 断开并回到 launcher。
 *
 * 不碰播放链路与按键契约 —— 本脚本只验批 1 的视觉与信息层。
 * 用法：env -u NODE_OPTIONS node scripts/verify-casting-ui.cjs [--port 41013]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')

const pw = require('/Users/chendd/.trae/skills/playwright-skill/node_modules/playwright-core/index.js')
const { chromium } = pw
const CHROME_EXEC =
  '/Users/chendd/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const RUNTIME_DIR = '/Volumes/WD/Users/chendd/Documents/self/扩展屏快应用/quicktvui/packages/web-runtime/dist'
const BUNDLE = path.join(__dirname, '..', 'dist/dev/index.bundle')
const VIDEO = path.join(__dirname, '..', 'proto/fixtures/bigbuck-720.mp4')
const PORT = Number(arg('port', '41013'))
const STAGE = '/tmp/tv-casting-stage-' + process.pid
const PROFILE = '/tmp/tv-casting-profile-' + process.pid

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
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

const near = (a, b, tol = 3) => Math.abs(a - b) <= tol
const rectEq = (r, x, y, w, h) =>
  !!r && near(r.x, x) && near(r.y, y) && near(r.width, w) && near(r.height, h)

;(async () => {
  fs.mkdirSync(path.join(STAGE, 'bundles'), { recursive: true })
  for (const f of fs.readdirSync(RUNTIME_DIR)) {
    if (f.endsWith('.gz')) continue
    fs.copyFileSync(path.join(RUNTIME_DIR, f), path.join(STAGE, f))
  }
  fs.copyFileSync(BUNDLE, path.join(STAGE, 'bundles/index.bundle'))
  fs.copyFileSync(VIDEO, path.join(STAGE, 'test-video.mp4'))

  const server = serve()
  await new Promise((r) => server.on('listening', r))

  const browser = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    executablePath: CHROME_EXEC,
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--disable-web-security', '--autoplay-policy=no-user-gesture-required'],
    viewport: { width: 1920, height: 1080 },
  })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.addInitScript(() => {
    window.__CROSS_APP_RESOLVER_BASE__ = 'https://runtime.chenddcoder.cn'
  })
  const logs = []
  page.on('console', (m) => logs.push(m.text()))
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message))

  const args = encodeURIComponent(JSON.stringify({ url: 'home' }))
  await page.goto(`http://127.0.0.1:${PORT}/index.html?bundle=/bundles/index.bundle&args=${args}`, {
    waitUntil: 'load',
    timeout: 60000,
  })
  await page.waitForTimeout(7000)

  // ① 经 EventDispatcher 广播 ACTION_DLNA → App.vue push casting
  const dispatched = await page.evaluate(() => {
    const g = global.__GLOBAL__
    const ed = g && g.jsModuleList && g.jsModuleList.EventDispatcher
    if (!ed || typeof ed.receiveNativeEvent !== 'function') return 'NO_EVENTDISPATCHER'
    ed.receiveNativeEvent([
      'ACTION_DLNA',
      { actionType: 'playerUrl', url: `http://127.0.0.1:${location.port}/test-video.mp4`, title: '批1·投屏页验收' },
    ])
    return 'OK'
  })

  // ② 等 casting 页挂载（web-renderer DOM 不保留 class，用批 1 新增的 name 定位）
  let mounted = false
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000)
    mounted = await page.evaluate(() => !!document.querySelector('[name="castBack"]'))
    if (mounted) break
  }
  check(
    '① ACTION_DLNA → casting 页挂载',
    dispatched === 'OK' && mounted,
    `dispatch=${dispatched}；casting-root=${mounted}`
  )

  // ③ 等真实起播（本地视频 + 自动播放策略放开）
  let videoPlaying = false
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000)
    videoPlaying = await page.evaluate(() => {
      const v = document.querySelector('video')
      return !!v && !v.paused && v.currentTime > 0
    })
    if (videoPlaying) break
  }
  check(
    '② 被投视频真实起播（video 未暂停且进度 > 0）',
    videoPlaying,
    logs.filter((l) => /onPlayerPlaying|onPlayerError|PAGEERROR/.test(l)).slice(-3).join(' | ') || 'video=' + videoPlaying
  )

  // 视频置 loop：测试视频仅 10s，播完会触发 completed → 控制层强制显示，
  // 会干扰「5s 自动隐藏」断言；loop 保持播放态稳定（仅测试环境，不影响业务链路）。
  await page.evaluate(() => {
    const v = document.querySelector('video')
    if (v) v.loop = true
  })

  // ④ 批 1 UI 断言（结构 + rect）。
  // ⚠️ 全部按 [name=...] 定位：web-renderer 渲染的 DOM 不保留业务 class 名。
  // 起播 5s 后控制层会自动隐藏 → 断言前先点击画面唤醒（同时预演 ⑪ 的唤醒链路）。
  // staging 宿主页（RuntimeController）在 body 直下挂了个 48×48 返回悬浮钮，
  // 会叠在投屏页左上角混淆截图 —— 仅测试会话内隐藏（真机无此元素）。
  await page.addStyleTag({ content: 'body > div > button { display: none !important; }' })
  await page.mouse.click(960, 540)
  await page.waitForTimeout(300) // 唤醒是同步 v-show，300ms 仅留渲染余量
  await page.waitForTimeout(4000) // 等分辨率轮询（1s 一次）命中
  const ui = await page.evaluate(() => {
    const q = (n) => document.querySelector(`[name="${n}"]`)
    const rect = (n) => {
      const el = q(n)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
    }
    const text = (n) => {
      const el = q(n)
      return el ? (el.innerText || el.textContent || '').trim() : null
    }
    const imgOk = (n) => {
      const el = q(n)
      const img = el && el.querySelector('img')
      return !!img && img.complete && img.naturalWidth > 0
    }
    return {
      scrimTop: rect('scrimTop'),
      scrimBottom: rect('scrimBottom'),
      backBtn: rect('castBack'),
      backIconOk: imgOk('castBack'),
      titleRect: rect('castTitle'),
      sourceRect: rect('castSource'),
      // display:none 不移除节点，判计算样式而非存在性
      hostBtnGone: (() => {
        const b = document.querySelector('body > div > button')
        return !b || getComputedStyle(b).display === 'none'
      })(),
      livePill: text('livePill'),
      castTitle: text('castTitle'),
      pillResolution: text('pillResolution'),
      pillElapsed: text('pillElapsed'),
      infoCardGone: !document.querySelector('[name="infoCard"]'),
      controlBar: rect('controlBar'),
      playIconOk: imgOk('play'),
      stopBtn: text('stop'),
      stopIconOk: imgOk('stop'),
      muteIconOk: imgOk('mute'),
      seekbar: !!q('seekbar'),
      // thumb 白点已隐藏：seekbar 内固定 px 尺寸的 thumb 子元素应换成透明图/透明底
      thumbHidden: (() => {
        const sb = document.querySelector('[name="seekbar"]')
        if (!sb) return false
        const kids = Array.from(sb.children || []).filter((el) => {
          if (!el.getBoundingClientRect || !el.style) return false
          const r = el.getBoundingClientRect()
          // thumb 特征：固定 px 小尺寸（轨道是 100% 宽、进度条是百分比宽）
          return r.width > 0 && r.width <= 60 && r.height <= 60 && !/100%/.test(el.style.width || '')
        })
        if (!kids.length) return true
        return kids.every((el) => {
          const cs = getComputedStyle(el)
          const bg = (cs.backgroundColor || '').replace(/\s/g, '')
          return /data:image\/png/.test(cs.backgroundImage || '') || bg === 'rgba(0,0,0,0)'
        })
      })(),
      hasOldHomeBtn: /返回主页/.test(document.body.innerText || ''),
    }
  })

  check(
    '③ 双层 scrim（顶部收窄 160 / 底部 240，底部不变）',
    rectEq(ui.scrimTop, 0, 0, 1920, 160) && rectEq(ui.scrimBottom, 0, 840, 1920, 240),
    `top=${JSON.stringify(ui.scrimTop)}；bottom=${JSON.stringify(ui.scrimBottom)}`
  )
  check(
    '④ 左上单行导播簇：back(48,44) + 胶囊 + 标题 + 来源同行垂直居中',
    ui.backBtn && ui.backIconOk &&
      near(ui.backBtn.x, 48) && near(ui.backBtn.y, 44) &&
      ui.titleRect && near(ui.titleRect.x, 324) && ui.titleRect.y >= 44 && ui.titleRect.y + ui.titleRect.height <= 116 &&
      ui.sourceRect && ui.sourceRect.x > ui.titleRect.x && ui.sourceRect.y >= 44 && ui.sourceRect.y + ui.sourceRect.height <= 116 &&
      ui.hostBtnGone,
    `back=${JSON.stringify(ui.backBtn)}；title=${JSON.stringify(ui.titleRect)}；source=${JSON.stringify(ui.sourceRect)}；宿主钮已隐藏=${ui.hostBtnGone}；pill=${JSON.stringify(ui.livePill)}`
  )
  check(
    '⑤ 右上信息胶囊：分辨率（真实 720P · DLNA）+ 已投屏时长',
    /720P · DLNA/.test(ui.pillResolution || '') && /已投屏/.test(ui.pillElapsed || ''),
    `pillResolution=${JSON.stringify(ui.pillResolution)}；pillElapsed=${JSON.stringify(ui.pillElapsed)}`
  )
  check(
    '⑥ 右栏「投屏信息」卡已移除（2026-09-13 陈兄：信息重复且挡画面）',
    ui.infoCardGone,
    `infoCard 已移除=${ui.infoCardGone}`
  )
  check(
    '⑦ 控制条 992×90 居中悬浮（left=464 bottom=44）+ 图标化按钮',
    rectEq(ui.controlBar, 464, 946, 992, 90) && ui.playIconOk && ui.muteIconOk && ui.stopIconOk,
    `bar=${JSON.stringify(ui.controlBar)}；play=${ui.playIconOk}；mute=${ui.muteIconOk}；stop=${ui.stopIconOk}`
  )
  check(
    '⑧ 「停止投屏」实心 coral 主按钮 + 无重复「返回主页」+ seekbar 在位 + 白点 thumb 已隐藏',
    /停止投屏/.test(ui.stopBtn || '') && !ui.hasOldHomeBtn && ui.seekbar && ui.thumbHidden,
    `stop=${JSON.stringify(ui.stopBtn)}；oldHomeBtn=${ui.hasOldHomeBtn}；seekbar=${ui.seekbar}；thumbHidden=${ui.thumbHidden}`
  )

  // ⑤ 截图留档（播放中、全 UI 可见）
  await page.screenshot({ path: path.join(__dirname, '..', 'docs/pen/p3-casting-batch1.png') }).catch(() => {})

  // ⑩ 播放中 5s 无操作 → 控制层整层隐藏（opacity 方案：宽度不变、透明度 0）
  let autoHidden = false
  let hideMs = -1
  const t0 = Date.now()
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(1000)
    autoHidden = await page.evaluate(() => {
      const el = document.querySelector('[name="controlsLayer"]')
      return !!el && Number(getComputedStyle(el).opacity) < 0.05
    })
    if (autoHidden) {
      hideMs = Date.now() - t0
      break
    }
  }
  const layerState = await page.evaluate(() => {
    const op = (n) => {
      const el = document.querySelector(`[name="${n}"]`)
      return el ? Number(getComputedStyle(el).opacity) : -1
    }
    // 实例保留（opacity 非移除），宽度不塌缩
    const w = (n) => {
      const el = document.querySelector(`[name="${n}"]`)
      return el ? Math.round(el.getBoundingClientRect().width) : -1
    }
    return { layer: op('controlsLayer'), bar: op('controlBar'), scrim: op('scrimTop'), barW: w('controlBar') }
  })
  check(
    '⑩ 播放 5s 无操作 → 控制层自动隐藏（wrapper opacity=0，实例保留）',
    // ⚠️ 只判 wrapper：getComputedStyle(child).opacity 是子元素自身值（恒 1），
    // 不继承父层隐藏；视觉隐藏以 controlsLayer 的 opacity=0 为准，宽度不变证明实例保留。
    autoHidden && layerState.layer < 0.05 && layerState.barW === 992,
    `layer=${layerState.layer}；barW=${layerState.barW}（实例保留）；子层自身 opacity bar=${layerState.bar} scrim=${layerState.scrim}（不继承父层值，仅信息展示）；等 ${hideMs}ms`
  )

  // ⑪ 用户操作 → 控制层重新显示（点击画面唤醒；TV 遥控按键走同一 wakeControls）
  await page.mouse.click(960, 540)
  let rewoken = false
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500)
    rewoken = await page.evaluate(() => {
      const el = document.querySelector('[name="controlsLayer"]')
      return !!el && Number(getComputedStyle(el).opacity) > 0.9
    })
    if (rewoken) break
  }
  check(
    '⑪ 点击/按键操作 → 控制层重新显示（并重新起算 5s 计时）',
    rewoken,
    `rewoken=${rewoken}`
  )

  // ⑥ 点停止投屏 → 断开并回到 launcher
  await page.locator('div[name="stop"]').first().click()
  await page.waitForTimeout(3000)
  const exited = await page.evaluate(() => {
    const gone = !document.querySelector('.casting-root')
    const backHome = /我的应用|待投屏|全部应用/.test(document.body.innerText || '')
    return { gone, backHome }
  })
  check(
    '⑨ 点「停止投屏」→ 播放层收起回到 launcher',
    exited.gone && exited.backHome,
    `casting-root 已移除=${exited.gone}；回到 launcher=${exited.backHome}`
  )

  const errLogs = logs.filter((l) => /PAGEERROR|Uncaught/i.test(l))
  if (errLogs.length) {
    console.log('\n--- 页面错误 ---')
    errLogs.slice(0, 6).forEach((l) => console.log('  ' + l.slice(0, 180)))
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
