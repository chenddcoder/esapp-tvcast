#!/usr/bin/env zx
const run = require('./process')

async function build() {
  await run(`webpack --config ./scripts/quicktvui-webpack.android.ts`, '')
}

build().catch((e) => {
  console.error(e)
  // 必须非 0 退出：deploy.mjs 靠 execSync 的退出码判断构建是否成功
  process.exit(1)
})
