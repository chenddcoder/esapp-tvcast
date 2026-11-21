const { spawn } = require('child_process')
const path = require('path')

// 必须返回 Promise 并在非 0 退出时 reject：
// 旧实现 spawn 完就返回，await run() 立即通过、退出码被丢弃，
// 于是 webpack 构建失败也会被当成成功，deploy 拿旧 dist 打出「新版本」脏包。
// cwd 传空串（build.ts 就是这么调的）时 spawn 会拿空路径 -> webpack ENOENT，
// 所以兜底成 process.cwd()，并把 node_modules/.bin 前置到 PATH，
// 不依赖 pnpm/npm 注入的 PATH（deploy.mjs 直接调 tsx，没有 pnpm 那层）。
const run = async (command, cwd) => {
  const [cmd, ...args] = command.split(' ')
  const workdir = cwd || process.cwd()
  const env = {
    ...process.env,
    PATH: [path.join(workdir, 'node_modules', '.bin'), process.env.PATH].join(path.delimiter),
  }
  return new Promise((resolve, reject) => {
    const app = spawn(cmd, args, {
      cwd: workdir,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })

    const onProcessExit = () => app.kill('SIGHUP')

    app.on('error', (err) => {
      process.removeListener('exit', onProcessExit)
      reject(err)
    })
    app.on('close', (code) => {
      process.removeListener('exit', onProcessExit)
      if (code === 0) {
        console.error(`Command succeeded. \n Command: ${command} \n Code: ${code}`)
        resolve(code)
      } else {
        console.error(`Command failed. \n Command: ${command} \n Code: ${code}`)
        reject(new Error(`Command failed (code ${code}): ${command}`))
      }
    })
    process.on('exit', onProcessExit)
  })
}

module.exports = run
