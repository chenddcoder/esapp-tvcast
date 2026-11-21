#!/usr/bin/env node
/**
 * 投屏「图片」链路端到端验收（2026-09-13 华为图库投屏失败修复的回归门禁）。
 *
 * 背景：华为手机图库「投屏播放」推送的是 **JPEG**
 *   http://192.168.1.30:49152/upnp/service/local/<id>/0/0.jpg
 * （DIDL class=object.item.imageItem.photo，protocolInfo=image/jpeg）。
 * 旧实现把一切投屏内容都交给 ESVideoPlayer（HTML5 video）→ 加载 jpg 必然
 * error → onPlayerError 兜底上报 stop → 手机端显示「投屏失败」。
 * 真机实测 4 连败（索引 0/1/2 递增，逐张选图语义）全死在同一步。
 *
 * 链路：web-runtime staging 加载 tvcast dev bundle（launcher）
 *   → EventDispatcher 广播 ACTION_DLNA(playerUrl, mediaType=image)
 *   → App.vue push casting 路由页 → initPlay 判定为图片 → cast-image-layer 渲染
 *
 * 验点：
 *  ① 图片投屏 → casting 页挂载，且**没有** <video>（播放器全程未参与 = 根因已除）
 *  ② <img name=castImage> 加载成功（naturalWidth/Height = 素材真实尺寸）
 *  ③ resizeMode=contain 真的生效（computed object-fit=contain）
 *  ④ 像素级：左右留黑边 + 图心白色块在预期位置（证明 contain 而非 fill/cover）
 *  ⑤ 控制条收成单颗「停止投屏」：play/seekbar/mute 均不在位、条宽 260 居中
 *  ⑥ **未**上报 stop（只上报 play）——旧 Bug 的直接表现就是多余的 stop
 *  ⑦ mediaType 缺失时按 URL 扩展名兜底（老版本 Rust 也能走对分支）
 *  ⑧ 图 → 视频切回：图片层卸载、video 回来、seekbar 复位
 *  ⑨ 点「停止投屏」→ 播放层收起回 launcher
 *
 * 用法：env -u NODE_OPTIONS node scripts/verify-casting-image.cjs [--port 41014]
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
const PHOTO = path.join(__dirname, '..', 'proto/fixtures/photo-1600x1000.jpg')
const VIDEO = path.join(__dirname, '..', 'proto/fixtures/bigbuck-720.mp4')
const PORT = Number(arg('port', '41014'))
const STAGE = '/tmp/tv-casting-image-stage-' + process.pid
const PROFILE = '/tmp/tv-casting-image-profile-' + process.pid

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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

const results = []
function check(name, ok, evidence) {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${evidence}`)
}
function info(name, evidence) {
  console.log(`INFO  ${name}\n      ${evidence}`)
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

/** 广播一个 ACTION_DLNA playerUrl（mediaType 可为空 → 走扩展名兜底） */
async function cast(page, { url, title, mediaType }) {
  return page.evaluate(
    (p) => {
      const g = global.__GLOBAL__
      const ed = g && g.jsModuleList && g.jsModuleList.EventDispatcher
      if (!ed || typeof ed.receiveNativeEvent !== 'function') return 'NO_EVENTDISPATCHER'
      const payload = { actionType: 'playerUrl', url: p.url, title: p.title || '' }
      if (p.mediaType) payload.mediaType = p.mediaType
      ed.receiveNativeEvent(['ACTION_DLNA', payload])
      return 'OK'
    },
    { url, title, mediaType }
  )
}

/** 用浏览器自身的 PNG 解码能力采样截图像素（不引第三方图像库） */
async function samplePixels(page, points) {
  const shot = await page.screenshot()
  return page.evaluate(
    async ({ b64, pts }) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const out = {}
      for (const p of pts) {
        const d = ctx.getImageData(p[0], p[1], 1, 1).data
        out[p[0] + ',' + p[1]] = [d[0], d[1], d[2]]
      }
      out.__size = [img.naturalWidth, img.naturalHeight]
      return out
    },
    { b64: shot.toString('base64'), pts: points }
  )
}

/** 等某个条件在 ms 内成立 */
async function waitFor(page, fn, ms, step = 500) {
  const n = Math.max(1, Math.ceil(ms / step))
  for (let i = 0; i < n; i++) {
    if (await page.evaluate(fn)) return true
    await page.waitForTimeout(step)
  }
  return false
}

;(async () => {
  fs.mkdirSync(path.join(STAGE, 'bundles'), { recursive: true })
  for (const f of fs.readdirSync(RUNTIME_DIR)) {
    if (f.endsWith('.gz')) continue
    fs.copyFileSync(path.join(RUNTIME_DIR, f), path.join(STAGE, f))
  }
  fs.copyFileSync(BUNDLE, path.join(STAGE, 'bundles/index.bundle'))
  fs.copyFileSync(PHOTO, path.join(STAGE, 'test-photo.jpg'))
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

  const base = `http://127.0.0.1:${PORT}`
  const args = encodeURIComponent(JSON.stringify({ url: 'home' }))
  await page.goto(`${base}/index.html?bundle=/bundles/index.bundle&args=${args}`, {
    waitUntil: 'load',
    timeout: 60000,
  })
  await page.waitForTimeout(7000)
  // staging 宿主页 body 直下的 48×48 返回悬浮钮（真机无此元素）
  await page.addStyleTag({ content: 'body > div > button { display: none !important; }' })

  // 上行事件探针。web-cli 运行时**不注册 EsNativeModule**（实测 jsModuleList 只有
  // Dimensions / EventDispatcher）——上行链路只在 Tauri 桌面运行时经 tauriEnv 接通，
  // 所以浏览器 harness 里 Native.callNative('EsNativeModule', ...) 是空操作，
  // 既抓不到事件也看不到日志。这里按同一契约补一个记录用的桩模块：
  // Hippy 的 callNative 在调用时按名字查 jsModuleList，故先装桩即可拦到
  // 快应用真正回报给 DLNA DMR 的事件序列（play/stop/pause/...）。
  const probe = await page.evaluate(() => {
    try {
      const g = global.__GLOBAL__
      const list = (g && g.jsModuleList) || {}
      const names = Object.keys(list)
      return { total: names.length, names: names.slice(0, 40), hasNative: !!list.EsNativeModule }
    } catch (e) {
      return { error: String(e && e.message) }
    }
  })
  info('jsModuleList 模块清单', `总数=${probe.total}；EsNativeModule 是否已在=${probe.hasNative}；名称=${JSON.stringify(probe.names)}`)

  const spyInstalled = await page.evaluate(() => {
    try {
      const g = global.__GLOBAL__
      const list = g && g.jsModuleList
      if (!list) return 'NO_JSMODULELIST'
      window.__REMOTE_EVENTS__ = []
      const existing = list.EsNativeModule
      if (existing && typeof existing.sendRemoteEvent === 'function' && !existing.__spyInstalled) {
        const orig = existing.sendRemoteEvent.bind(existing)
        existing.sendRemoteEvent = function (name, data) {
          try {
            window.__REMOTE_EVENTS__.push(String(name))
          } catch (_e) {}
          try {
            return orig(name, data)
          } catch (_e) {}
          return undefined
        }
        existing.__spyInstalled = true
        return 'WRAPPED_EXISTING'
      }
      // 桩模块：只记录，不做副作用（浏览器 harness 无原生 DLNA 端）
      list.EsNativeModule = {
        __stub: true,
        sendRemoteEvent(name) {
          try {
            window.__REMOTE_EVENTS__.push(String(name))
          } catch (_e) {}
        },
      }
      return 'STUB_INSTALLED'
    } catch (e) {
      return 'THROW:' + (e && e.message)
    }
  })
  info('上行事件探针', `EsNativeModule.sendRemoteEvent 观测方式=${spyInstalled}`)

  const remoteEvents = () => page.evaluate(() => (window.__REMOTE_EVENTS__ || []).slice())

  // ============ ① mediaType=image 的图片投屏 ============
  const marks = logs.length
  const d1 = await cast(page, { url: `${base}/test-photo.jpg`, title: '图片投屏验收', mediaType: 'image' })
  const mounted = await waitFor(page, () => !!document.querySelector('[name="castBack"]'), 15000, 1000)
  check('① ACTION_DLNA(mediaType=image) → casting 页挂载', d1 === 'OK' && mounted, `dispatch=${d1}；mounted=${mounted}`)

  const imgOk = await waitFor(
    page,
    () => {
      const el = document.querySelector('[name="castImage"]')
      return !!el && el.complete && el.naturalWidth > 0
    },
    12000,
    1000
  )
  const imgInfo = await page.evaluate(() => {
    const el = document.querySelector('[name="castImage"]')
    if (!el) return null
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const v = document.querySelector('video')
    return {
      tag: el.tagName,
      nw: el.naturalWidth,
      nh: el.naturalHeight,
      objectFit: cs.objectFit,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      // 播放器实例常驻（不随图片态卸载），但**绝不能**被指向图片：
      // 旧 Bug 就是 video.src = ...jpg → error → onPlayerError → 上报 stop。
      playerSrc: v ? String(v.currentSrc || v.src || '') : null,
      playerErr: v ? (v.error ? String(v.error.code) : null) : null,
      imageLayer: !!document.querySelector('[name="castImageLayer"]'),
    }
  })
  check(
    '② 图片层渲染 + <img> 加载成功（naturalSize = 1600×1000 素材真实尺寸）',
    !!imgInfo && imgInfo.imageLayer && imgInfo.nw === 1600 && imgInfo.nh === 1000,
    `img=${JSON.stringify(imgInfo)}；imgOk=${imgOk}`
  )
  check(
    '③ 播放器未被指向图片（旧 Bug = video 加载 jpg 报错 → 兜底 stop）',
    !!imgInfo && !/test-photo|\.jpg/i.test(imgInfo.playerSrc || '') && imgInfo.playerErr === null,
    `playerSrc=${JSON.stringify(imgInfo && imgInfo.playerSrc)}；playerError=${imgInfo && imgInfo.playerErr}`
  )
  check(
    '④ resizeMode=contain 生效（computed object-fit=contain，不拉伸不裁剪）',
    !!imgInfo && imgInfo.objectFit === 'contain',
    `object-fit=${imgInfo && imgInfo.objectFit}`
  )

  // ============ 像素级验证 contain 的真实排版 ============
  // 素材 1600×1000(1.6) 在 1920×1080 画布按高适配 → 渲染宽 1080×1.6=1728，
  // 左右各留 (1920-1728)/2 = 96px 黑边；素材中央白块(600..1000 × 350..650)
  // 映射到画布 x≈744..1176 y≈378..702。
  const px = await samplePixels(page, [
    [40, 540], // 左侧黑边（fill 模式此处会是图片色）
    [1880, 540], // 右侧黑边
    [200, 200], // 图片本体（蓝）
    [960, 540], // 素材白色块中心
  ])
  const isBlack = (c) => Math.max(c[0], c[1], c[2]) < 40
  const isBlue = (c) => c[2] > 140 && c[2] > c[0] + 60
  const isWhite = (c) => c[0] > 200 && c[1] > 200 && c[2] > 200
  const barL = px['40,540']
  const barR = px['1880,540']
  const body = px['200,200']
  const mid = px['960,540']
  check(
    '⑤ 像素级：按 contain 排版（左右黑边 96px + 图体蓝 + 素材白块居中）',
    isBlack(barL) && isBlack(barR) && isBlue(body) && isWhite(mid),
    `左黑边(40,540)=${barL} 右黑边(1880,540)=${barR} 图体(200,200)=${body} 白块(960,540)=${mid}；截图=${px.__size}`
  )

  // ============ 控制条：图片态只剩「停止投屏」 ============
  await page.mouse.click(960, 300) // 唤醒控制层（点击画面，避开 seekbar 区域）
  await page.waitForTimeout(400)
  const bar = await page.evaluate(() => {
    const q = (n) => document.querySelector(`[name="${n}"]`)
    const r = q('controlBar')
    const rect = r ? r.getBoundingClientRect() : null
    return {
      hasPlay: !!q('play'),
      hasSeekbar: !!q('seekbar'),
      hasMute: !!q('mute'),
      hasStop: !!q('stop'),
      stopText: q('stop') ? (q('stop').innerText || '').trim() : '',
      rect: rect ? { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
    }
  })
  check(
    '⑥ 控制条收成单颗「停止投屏」（无播放/进度/音量，260 宽居中）',
    !bar.hasPlay && !bar.hasSeekbar && !bar.hasMute && bar.hasStop && /停止投屏/.test(bar.stopText) &&
      !!bar.rect && Math.abs(bar.rect.w - 260) <= 3 && Math.abs(bar.rect.x - 830) <= 3,
    `play=${bar.hasPlay} seekbar=${bar.hasSeekbar} mute=${bar.hasMute} stop=${bar.hasStop}("${bar.stopText}") rect=${JSON.stringify(bar.rect)}`
  )

  // ============ 上行事件：只 play，不 stop ============
  // ⚠️ 观测限制：快应用的 sendRemoteEvent 走 Native.callNative，而 es3-vue 是在
  // **模块初始化时**就 `const {callNative} = global.Hippy` 捕获了引用，运行时再往
  // jsModuleList 补桩也拦不到；web-cli 运行时又没注册 EsNativeModule
  // （实测 jsModuleList 只有 Dimensions/EventDispatcher，上行链路只在 Tauri 经
  // tauriEnv 接通）。所以本 harness 里上行事件序列通常抓不到 →
  // 抓到就严格断言（play>0 且 stop==0），抓不到则退化为可观测的等价行为断言：
  // 「图片持续显示 + 无 onPlayerError + 无播放失败」——onPlayerError 正是旧实现
  // 唯一会为该场景上报 stop 的地方，无它即等于没有多余的 stop 断链。
  const sent = await remoteEvents()
  const sentStop = sent.filter((e) => e === 'stop')
  const sentPlay = sent.filter((e) => e === 'play')
  const seg = logs.slice(marks)
  const errLogs = seg.filter((l) => /onPlayerError|播放失败/.test(l))
  const stillOn = await page.evaluate(() => {
    const el = document.querySelector('[name="castImage"]')
    const v = document.querySelector('video')
    return {
      imgAlive: !!el && el.complete && el.naturalWidth > 0,
      noFailText: !/播放失败/.test(document.body.innerText || ''),
      playerPointedAtImage: !!v && /test-photo|\.jpg/i.test(String(v.currentSrc || v.src || '')),
    }
  })
  if (sent.length > 0) {
    check(
      '⑦ 上行只报 play、未报 stop（旧 Bug 的直接表现 = 多余的 stop 断链）',
      sentPlay.length > 0 && sentStop.length === 0,
      `上报序列=[${sent.join(', ')}]；play=${sentPlay.length} stop=${sentStop.length}`
    )
  } else {
    check(
      '⑦ 图片态无任何断链信号（无 onPlayerError / 无「播放失败」/ 图片持续显示）',
      errLogs.length === 0 && stillOn.imgAlive && stillOn.noFailText && !stillOn.playerPointedAtImage,
      `onPlayerError|播放失败 命中=${errLogs.length}；图片仍在显示=${stillOn.imgAlive}；无失败文案=${stillOn.noFailText}；播放器未被指向图片=${!stillOn.playerPointedAtImage}；` +
        `【上行序列未观测到：见脚本内注释的 harness 限制】`
    )
  }
  check(
    '⑧ 无 onPlayerError / 播放失败（图片不再走播放器错误兜底）',
    errLogs.length === 0,
    errLogs.length ? errLogs.slice(0, 2).join(' | ').slice(0, 200) : '无错误日志'
  )

  await page.screenshot({ path: path.join(__dirname, '..', 'docs/pen/p3-casting-image.png') }).catch(() => {})

  // ============ ⑨ mediaType 缺失 → 扩展名兜底 ============
  const markFb = (await remoteEvents()).length
  const d2 = await cast(page, { url: `${base}/test-photo.jpg?v=fallback`, title: '扩展名兜底' })
  const fallbackOk = await waitFor(
    page,
    () => {
      const el = document.querySelector('[name="castImage"]')
      const v = document.querySelector('video')
      return (
        !!el &&
        el.complete &&
        el.naturalWidth > 0 &&
        !/test-photo|\.jpg/i.test(String((v && (v.currentSrc || v.src)) || ''))
      )
    },
    10000,
    1000
  )
  check(
    '⑨ mediaType 缺失时按 URL 扩展名兜底（.jpg → 图片层，播放器仍未被指向图片）',
    d2 === 'OK' && fallbackOk,
    `dispatch=${d2}；兜底进图片层=${fallbackOk}`
  )

  // ============ ⑩ 图 → 视频切回 ============
  const markVid = (await remoteEvents()).length
  const d3 = await cast(page, { url: `${base}/test-video.mp4`, title: '切回视频', mediaType: 'video' })
  const videoOk = await waitFor(
    page,
    () => {
      const v = document.querySelector('video')
      return !!v && v.currentTime > 0 && !v.paused
    },
    15000,
    1000
  )
  const back = await page.evaluate(() => ({
    imageLayer: !!document.querySelector('[name="castImageLayer"]'),
    seekbar: !!document.querySelector('[name="seekbar"]'),
    video: document.querySelectorAll('video').length,
    barW: (() => {
      const el = document.querySelector('[name="controlBar"]')
      return el ? Math.round(el.getBoundingClientRect().width) : -1
    })(),
  }))
  check(
    '⑩ 图 → 视频切回：图片层卸载、video 起播、控制条恢复 992 长条（含 seekbar）',
    d3 === 'OK' && videoOk && !back.imageLayer && back.seekbar && back.video === 1 && Math.abs(back.barW - 992) <= 3,
    `dispatch=${d3}；起播=${videoOk}；${JSON.stringify(back)}`
  )
  const vidEvents = (await remoteEvents()).slice(markVid)
  info('视频段上行事件', `[${vidEvents.join(', ')}]（图片段=[${sent.slice(markFb).join(', ')}]，兜底段起始=${markFb}）`)

  // ============ ⑪ 点「停止投屏」→ 回 launcher ============
  await page.locator('div[name="stop"]').first().click()
  await page.waitForTimeout(3000)
  const exited = await page.evaluate(() => ({
    gone: !document.querySelector('.casting-root'),
    backHome: /我的应用|待投屏|全部应用/.test(document.body.innerText || ''),
  }))
  check(
    '⑪ 点「停止投屏」→ 播放层收起回到 launcher',
    exited.gone && exited.backHome,
    `casting-root 已移除=${exited.gone}；回到 launcher=${exited.backHome}`
  )

  const pageErrs = logs.filter((l) => /PAGEERROR|Uncaught/i.test(l))
  if (pageErrs.length) {
    console.log('\n--- 页面错误 ---')
    pageErrs.slice(0, 6).forEach((l) => console.log('  ' + l.slice(0, 200)))
  }
  info('上行事件全量', `[${(await remoteEvents()).join(', ')}]`)

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
