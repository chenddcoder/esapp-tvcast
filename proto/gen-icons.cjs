const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'icons')

const P = {
  cast: '<rect x="2.5" y="4" width="19" height="12.5" rx="3"/><path d="M9 20.5h6"/><path d="M7 14.4a4.5 4.5 0 0 1 4.5-4.5"/><path d="M7 17.6a7.8 7.8 0 0 1 7.8-7.8"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="3.5"/><circle cx="8.6" cy="9.6" r="1.9"/><path d="M4 17.4l4.4-4.4 3.2 3.2 3.4-3.4 5 5"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M10.4 9.4l4.8 2.6-4.8 2.6z" fill="#FFFFFF" stroke-width="1.2"/>',
  music: '<circle cx="7" cy="17.6" r="2.6"/><path d="M9.6 17.6V6.4l8.8-2v11.2"/><circle cx="15.8" cy="15.6" r="2.6"/>',
  file: '<path d="M6.5 3.5h6.6l4.9 4.9v11.6a.5.5 0 0 1-.5.5H6.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M13 3.6v5h5"/>',
  browser: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.7 5.4 3.7 8.5s-1.3 6.1-3.7 8.5c-2.4-2.4-3.7-5.4-3.7-8.5S9.6 5.9 12 3.5z"/>',
  game: '<path d="M7.6 8h8.8a5 5 0 0 1 4.9 5.9l-.6 3.3a2.9 2.9 0 0 1-2.9 2.4l-2.5-.7a2 2 0 0 1-1.1-3l.9-1.5H8.9l.9 1.5a2 2 0 0 1-1.1 3l-2.5.7a2.9 2.9 0 0 1-2.9-2.4l-.6-3.3A5 5 0 0 1 7.6 8z"/><path d="M7.2 11.6v3.2"/><path d="M5.6 13.2h3.2"/>',
  weather: '<circle cx="8.4" cy="8" r="3"/><path d="M8.4 3.4v1.1M8.4 11.5v1.1M3.9 8H2.8M14 8h-1.1M5.2 4.8l-.8-.8M11.6 4.8l.8-.8"/><path d="M17.6 19.4a3.5 3.5 0 0 0-.5-7 5 5 0 0 0-9.4 1.3 3.4 3.4 0 0 0 .4 6.7z"/>',
  calc: '<rect x="4.5" y="3" width="15" height="18" rx="3"/><path d="M8 7.6h8"/><path d="M8.4 12h.01M12 12h.01M15.6 12h.01M8.4 16.4h.01M12 16.4h.01M15.6 16.4h.01"/>',
  store: '<path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.4v2.3M12 18.3v2.3M4.9 7.5l2 1.1M17.1 15.4l2 1.1M4.9 16.5l2-1.1M17.1 8.6l2-1.1"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  wifi: '<path d="M2.6 8.6a15 15 0 0 1 18.8 0"/><path d="M6.1 12.3a10 10 0 0 1 11.8 0"/><path d="M9.3 15.9a5 5 0 0 1 5.4 0"/><circle cx="12" cy="19.4" r="1.2" fill="#FFFFFF" stroke="none"/>',
}

fs.mkdirSync(OUT, { recursive: true })

Object.keys(P).forEach((name) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" ` +
    `fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>`
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg, 'utf8')
})

console.log('generated', Object.keys(P).length, 'icons ->', OUT)
