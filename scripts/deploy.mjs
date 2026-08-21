#!/usr/bin/env node
/**
 * 一键发版：构建 -> 按版本号打包 zip -> 上传到自建 RuntimeController（服务端自动加密）-> 回读校验。
 *
 * 为什么必须走这个脚本 / 上传接口，而不能直接 scp 明文 zip 到服务器：
 *   web-runtime 下载包后会无条件做 decrypt_zip（字节反转）。只有 /api/runtime/packages
 *   上传接口会在落盘时 applyGetFileEncrypt（同样的字节反转）加密，客户端才能正确解开。
 *   直接覆盖服务器 storagePath 的明文 zip -> 客户端反转后 ZIP 头损坏 -> 桌面端崩溃。
 *
 * 用法：
 *   pnpm deploy                       # 默认 patch 升版本并构建+上传
 *   pnpm deploy --type minor          # 升 minor
 *   pnpm deploy --set 1.2.0           # 指定版本
 *   pnpm deploy --no-bump             # 不改版本（仅代码变更重发当前版）
 *   pnpm deploy --no-build            # 跳过 pnpm build（dist/android 已是最新）
 *   pnpm deploy --no-upload           # 只本地构建+打包，不上传（本地预检）
 */
import { createRequire } from 'module'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const compressing = require('compressing')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ---------- 配置（.deploy.env 优先于环境变量；不提交真实值） ----------
function loadEnv() {
  const cfg = { ...process.env }
  const envPath = path.join(ROOT, '.deploy.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && cfg[m[1]] === undefined) cfg[m[1]] = m[2]
    }
  }
  return cfg
}
const cfg = loadEnv()
const SERVER_BASE = cfg.SERVER_BASE || 'https://www.chenddcoder.cn'
const PACKAGE_NAME = cfg.PACKAGE_NAME || 'cn.chenddcoder.tvcast'
const APP_NAME = cfg.APP_NAME || '投屏显象'
const ICON_URL = cfg.ICON_URL || 'https://www.chenddcoder.cn/upload/tvcast-icon.svg'
const CIRCLE_LOGO_URL = cfg.CIRCLE_LOGO_URL || ICON_URL

// ---------- 参数 ----------
const args = new Set(process.argv.slice(2))
const argVal = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}
const NO_BUILD = args.has('--no-build')
const NO_UPLOAD = args.has('--no-upload') || args.has('--dry')
const NO_BUMP = args.has('--no-bump')
const SET_VERSION = argVal('--set')
const BUMP_TYPE = argVal('--type') || 'patch'

// ---------- 版本 ----------
function bumpVersion(v, type) {
  const parts = v.split('.').map(Number)
  while (parts.length < 3) parts.push(0)
  if (type === 'major') parts[0]++
  else if (type === 'minor') parts[1]++
  else parts[2]++
  for (let i = type === 'major' ? 1 : type === 'minor' ? 2 : 3; i < 3; i++) parts[i] = 0
  return parts.join('.')
}
const pkgPath = path.join(ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const oldVersion = pkg.version
const newVersion = SET_VERSION || (NO_BUMP ? oldVersion : bumpVersion(oldVersion, BUMP_TYPE))
console.log(`版本: ${oldVersion} -> ${newVersion}` + (newVersion === oldVersion ? ' (不变)' : ''))

// ---------- 构建 ----------
if (!NO_BUILD) {
  console.log('构建中 (pnpm build)...')
  execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' })
} else {
  console.log('跳过构建 (--no-build)')
}

// ---------- 打包 zip（压缩 dist/android 内容本身，不带顶层文件夹） ----------
const androidDir = path.join(ROOT, 'dist', 'android')
if (!fs.existsSync(androidDir)) {
  console.error('dist/android 不存在，请先构建'); process.exit(1)
}
const zipName = `${PACKAGE_NAME}-${newVersion}.zip`
const zipPath = path.join(ROOT, 'dist', zipName)
console.log(`打包 zip: ${zipName}`)
await compressing.zip.compressDir(androidDir, zipPath)
const zipBytes = fs.readFileSync(zipPath)
console.log(`zip 大小: ${(zipBytes.length / 1024).toFixed(1)} KB`)

// ---------- 本地预检（不上传） ----------
if (NO_UPLOAD) {
  console.log('跳过上传 (--no-upload)。本地产物已就绪，package.json 版本未改动。')
  process.exit(0)
}

// ---------- 鉴权：优先 DEPLOY_TOKEN，否则用账号密码自动登录拿新 token ----------
async function getToken() {
  if (cfg.DEPLOY_TOKEN) return cfg.DEPLOY_TOKEN
  if (cfg.DEPLOY_USER && cfg.DEPLOY_PASS) {
    const r = await fetch(`${SERVER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cfg.DEPLOY_USER, password: cfg.DEPLOY_PASS }),
    })
    const j = await r.json().catch(() => ({}))
    if (j && j.token) return j.token
    throw new Error('登录失败: ' + JSON.stringify(j))
  }
  throw new Error('未配置鉴权：在 .deploy.env 设置 DEPLOY_TOKEN 或 DEPLOY_USER/DEPLOY_PASS')
}

// ---------- 字节反转：与服务器 applyGetFileEncrypt / 客户端 decrypt_zip 完全一致 ----------
function reverseBytes(buf) {
  const l = buf.length
  if (l <= 20) return buf
  let n = l > 200 ? 100 : 10
  if (n > Math.floor(l / 2)) n = Math.floor(l / 2)
  const a = Buffer.from(buf)
  for (let i = 0; i < n; i++) {
    const t = a[i]
    a[i] = a[l - 1 - i]
    a[l - 1 - i] = t
  }
  return a
}

// ---------- 上传 ----------
const token = await getToken()
console.log('上传到服务器（服务端自动加密落盘）...')
const form = new FormData()
form.append('file', new Blob([zipBytes], { type: 'application/zip' }), zipName)
form.append('packageName', PACKAGE_NAME)
form.append('version', newVersion)
form.append('appName', APP_NAME)
form.append('icon', ICON_URL)
form.append('circleLogo', CIRCLE_LOGO_URL)
const res = await fetch(`${SERVER_BASE}/api/runtime/packages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
})
const j = await res.json().catch(() => ({}))
if (!j || j.code !== 200) {
  console.error('上传失败:', JSON.stringify(j))
  process.exit(1)
}
const data = j.data
console.log(`已登记: ${data.packageName}@${data.version}`)
console.log(`packageUrl: ${data.packageUrl}`)
console.log(`服务端明文 md5: ${data.packageMd5}`)

// ---------- 端到端校验：下载加密 zip -> 客户端解密 -> 校验 PK 头 + md5 ----------
console.log('端到端校验（下载加密包 -> 客户端解密 -> 校验 ZIP 头 + md5）...')
const dl = await fetch(data.packageUrl, { redirect: 'follow' })
const enc = Buffer.from(await dl.arrayBuffer())
const plain = reverseBytes(enc)
const isZip = plain[0] === 0x50 && plain[1] === 0x4b && plain[2] === 0x03 && plain[3] === 0x04
const md5 = crypto.createHash('md5').update(plain).digest('hex')
if (!isZip) {
  console.error('校验失败: 解密后不是有效 ZIP（加密态异常）')
  process.exit(1)
}
if (md5 !== data.packageMd5) {
  console.error(`校验失败: md5 不符（本地 ${md5} vs 服务端 ${data.packageMd5}）`)
  process.exit(1)
}
console.log('校验通过: 解密后 PK 头正常, md5 一致。')

// ---------- 发布成功：把新版本写回 package.json，保持源码与线上一致 ----------
pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`发版完成: ${PACKAGE_NAME}@${newVersion}（package.json 已同步）`)
