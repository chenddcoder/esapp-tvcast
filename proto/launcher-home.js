const RECENT = [
  { name: '相册', icon: 'photo', c1: '#8b7bff', c2: '#5f4bff' },
  { name: '视频', icon: 'video', c1: '#ff7a92', c2: '#e8386f' },
  { name: '音乐', icon: 'music', c1: '#3fd8c6', c2: '#0f9b93' },
  { name: '文件', icon: 'file', c1: '#ffb457', c2: '#f2820c' },
  { name: '浏览器', icon: 'browser', c1: '#5cc8a8', c2: '#2f9e7e' },
  { name: '游戏', icon: 'game', c1: '#ff6fa8', c2: '#d61f6a' },
  { name: '天气', icon: 'weather', c1: '#63c9f5', c2: '#2a86c9' },
]

const APPS = [
  { name: '视频', icon: 'video', c1: '#ff7a92', c2: '#e8386f' },
  { name: '音乐', icon: 'music', c1: '#3fd8c6', c2: '#0f9b93' },
  { name: '相册', icon: 'photo', c1: '#8b7bff', c2: '#5f4bff' },
  { name: '文件', icon: 'file', c1: '#ffb457', c2: '#f2820c' },
  { name: '游戏', icon: 'game', c1: '#ff6fa8', c2: '#d61f6a', pkg: 'cn.chenddcoder.game' },
  { name: '浏览器', icon: 'browser', c1: '#5cc8a8', c2: '#2f9e7e' },
  { name: '天气', icon: 'weather', c1: '#63c9f5', c2: '#2a86c9', pkg: 'cn.chenddcoder.weather' },
  { name: '计算器', icon: 'calc', c1: '#9aa8c2', c2: '#5d6b85' },
  { name: '应用商店', icon: 'store', c1: '#4fd1a0', c2: '#159c74' },
  { name: '设置', icon: 'settings', c1: '#8f9bff', c2: '#5b62d6' },
]

const cardHtml = (a, row, col) =>
  `<div class="cell" data-row="${row}" data-col="${col}" data-act="${a.name}" data-pkg="${a.pkg || ''}">
     <div class="card">
       <div class="card-hl"></div>
       <div class="ico" style="background:linear-gradient(145deg,${a.c1},${a.c2})">
         <img class="ico-img" src="./icons/${a.icon}.svg" alt="" />
       </div>
       <span class="app-name">${a.name}</span>
     </div>
   </div>`

document.getElementById('recentRow').innerHTML = RECENT.map((a, i) => cardHtml(a, 0, i)).join('')
document.getElementById('appGrid').innerHTML = APPS.map((a, i) => cardHtml(a, 1, i)).join('')

const items = Array.from(document.querySelectorAll('[data-row]'))
let cur = { row: 0, col: 0 }

const colsIn = (row) => items.filter((el) => +el.dataset.row === row).length

const paint = () => {
  items.forEach((el) => {
    const on = +el.dataset.row === cur.row && +el.dataset.col === cur.col
    if (on) el.classList.add('focus')
    else el.classList.remove('focus')
  })
}

const move = (row, col) => {
  cur.row = Math.min(2, Math.max(0, row))
  cur.col = Math.min(colsIn(cur.row) - 1, Math.max(0, col))
  paint()
}

const PKG_MSG = {
  'cn.chenddcoder.game': '拉起个人快应用 · 游戏',
  'cn.chenddcoder.weather': '拉起个人快应用 · 天气',
}

let toastTimer = -1
const toastEl = document.getElementById('toast')

const showToast = (msg) => {
  document.getElementById('toastText').textContent = msg
  toastEl.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600)
}

const activate = (el) => {
  const pkg = el.dataset.pkg
  showToast(pkg && PKG_MSG[pkg] ? PKG_MSG[pkg] : `打开「${el.dataset.act}」`)
}

document.addEventListener('keydown', (e) => {
  const dirs = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
  if (dirs[e.key]) {
    e.preventDefault()
    const [dr, dc] = dirs[e.key]
    if (dr) move(cur.row + dr, Math.min(cur.col, colsIn(cur.row + dr) - 1))
    else move(cur.row, cur.col + dc)
    return
  }
  if (e.key === 'Enter') {
    const el = items.find((x) => +x.dataset.row === cur.row && +x.dataset.col === cur.col)
    if (el) activate(el)
  }
})

items.forEach((el) => {
  el.addEventListener('mouseenter', () => move(+el.dataset.row, +el.dataset.col))
  el.addEventListener('click', () => activate(el))
})

const states = [
  { text: '可投屏', color: '#3ddc97', hint: '同一 Wi-Fi 下，手机扫码即可投屏' },
  { text: '投屏中 · 腾讯视频', color: '#4fd1c5', hint: '手机正在投屏，按返回键可退出投屏' },
]
let stateIdx = 0

const applyState = () => {
  const s = states[stateIdx]
  document.getElementById('stateText').textContent = s.text
  document.querySelector('#statePill .dot').style.backgroundColor = s.color
  document.getElementById('hint').textContent = s.hint
}

document.getElementById('statePill').addEventListener('click', () => {
  stateIdx = (stateIdx + 1) % states.length
  applyState()
})
document.getElementById('toggleState').addEventListener('click', () => {
  stateIdx = (stateIdx + 1) % states.length
  applyState()
})
applyState()

const tick = () => {
  const d = new Date()
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  document.getElementById('clock').textContent = `${p(d.getHours())}:${p(d.getMinutes())}`
}
tick()
setInterval(tick, 15000)

const fit = () => {
  const scale = Math.min(window.innerWidth / 1920, 1)
  const vp = document.getElementById('viewport')
  vp.style.transform = `scale(${scale})`
  vp.style.height = 1080 * scale + 'px'
}
window.addEventListener('resize', fit)
fit()

paint()
