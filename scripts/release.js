#!/usr/bin/env node
/**
 * 发布脚本（中文交互）
 * 功能：
 *  - 检查 git 状态是否干净
 *  - 检查当前分支（默认建议发布到 main/master）
 *  - 检查 npm 登录状态
 *  - 支持版本选择：patch/minor/major/custom
 *  - 自动执行 build/test（若在 package.json 中存在对应脚本）
 *  - 使用 `npm version` 提交并创建 tag（自动 commit & tag）
 *  - 推送 commit 与 tag，然后执行 `npm publish --access public`
 *
 * 使用：
 *   node scripts/release.js
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

// npm 官方 registry
const OFFICIAL_NPM_REGISTRY = 'https://registry.npmjs.org'
let originalRegistry = null

function run(cmd, opts = {}) {
  return execSync(cmd, Object.assign({ stdio: 'inherit' }, opts))
}

function runQuiet(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString().trim()
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function bumpVersion(current, type) {
  const parts = current.split('.').map((v) => parseInt(v, 10))
  if (parts.length !== 3 || parts.some(isNaN)) throw new Error('invalid version')
  let [major, minor, patch] = parts
  if (type === 'patch') patch++
  else if (type === 'minor') { minor++; patch = 0 }
  else if (type === 'major') { major++; minor = 0; patch = 0 }
  else throw new Error('unknown bump')
  return [major, minor, patch].join('.')
}

/**
 * 获取当前 npm registry
 */
function getCurrentRegistry() {
  try {
    return runQuiet('npm config get registry')
  } catch (e) {
    return OFFICIAL_NPM_REGISTRY
  }
}

/**
 * 设置 npm registry
 */
function setRegistry(registry) {
  try {
    run(`npm config set registry ${registry}`)
  } catch (e) {
    console.error('设置 npm registry 失败:', e && e.message)
    throw e
  }
}

/**
 * 恢复原始 npm registry
 */
function restoreRegistry() {
  if (originalRegistry && originalRegistry !== OFFICIAL_NPM_REGISTRY) {
    console.log(`恢复 npm registry 到：${originalRegistry}`)
    try {
      setRegistry(originalRegistry)
    } catch (e) {
      console.error('⚠️ 恢复 npm registry 失败，请手动恢复：npm config set registry', originalRegistry)
    }
  }
}

/**
 * 检查并修复 npm registry
 */
async function checkAndFixRegistry() {
  const currentRegistry = getCurrentRegistry()
  originalRegistry = currentRegistry
  console.log(`当前 npm registry：${currentRegistry}`)
  
  if (currentRegistry !== OFFICIAL_NPM_REGISTRY) {
    console.log(`❗ 检测到非官方 npm registry`)
    const fix = (await ask(`是否修改为官方地址 ${OFFICIAL_NPM_REGISTRY}？(y/N)：`)).toLowerCase()
    if (fix === 'y') {
      console.log('修改 npm registry 到官方地址...')
      setRegistry(OFFICIAL_NPM_REGISTRY)
      console.log('✅ 已切换到官方 npm registry')
    } else {
      const cont = (await ask('是否继续使用当前地址发布？(y/N)：')).toLowerCase()
      if (cont !== 'y') {
        console.log('已取消发布')
        restoreRegistry()
        process.exit(1)
      }
    }
  }
}

async function main() {
  try {
    console.log('📦 开始发布流程')

    // Node / npm 环境
    console.log('🔎 检查 Node / npm 版本...')
    try { console.log('Node:', runQuiet('node -v')) } catch (e) { /* ignore */ }
    try { console.log('npm:', runQuiet('npm -v')) } catch (e) { /* ignore */ }

    // check and fix npm registry (先于 git 检查)
    await checkAndFixRegistry()

    // check git clean
    const status = runQuiet('git status --porcelain')
    if (status) {
      console.log('❗ 当前 git 存在未提交或未跟踪的更改：')
      console.log(status)
      const cont = (await ask('是否继续发布？输入 y 确认，其他取消(y/N)：')).toLowerCase()
      if (cont !== 'y') {
        console.log('已取消发布')
        restoreRegistry()
        process.exit(1)
      }
    }

    // check branch
    const branch = runQuiet('git rev-parse --abbrev-ref HEAD')
    console.log('当前分支：', branch)
    if (!['main', 'master'].includes(branch)) {
      const ok = (await ask('当前不是 main/master 分支，是否继续？输入 y 确认，其他取消：')).toLowerCase()
      if (ok !== 'y') { 
        console.log('已取消发布')
        restoreRegistry()
        process.exit(1) 
      }
    }

    // check npm login
    let npmUser = null
    try {
      npmUser = runQuiet('npm whoami')
      console.log(`已登录 npm：${npmUser}`)
    } catch (e) {
      console.log('❗ 未检测到 npm 登录（npm whoami 失败）')
      const ok = (await ask('是否继续发布（需要本地已登录或在后续手动登录）？输入 y 确认，其他取消：')).toLowerCase()
      if (ok !== 'y') { 
        console.log('已取消发布')
        restoreRegistry()
        process.exit(1) 
      }
    }

    // read package.json
    const pkgPath = path.resolve(process.cwd(), 'package.json')
    if (!fs.existsSync(pkgPath)) {
      console.error('找不到 package.json，退出')
      restoreRegistry()
      process.exit(1)
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const currentVersion = pkg.version
    console.log(`当前版本：${currentVersion}`)

    // choose version
    console.log('\n请选择版本类型：')
    console.log('  1) patch')
    console.log('  2) minor')
    console.log('  3) major')
    console.log('  4) custom')
    const choice = (await ask('输入选项编号（默认 1）：')) || '1'
    let newVersion = currentVersion
    if (choice === '1') newVersion = bumpVersion(currentVersion, 'patch')
    else if (choice === '2') newVersion = bumpVersion(currentVersion, 'minor')
    else if (choice === '3') newVersion = bumpVersion(currentVersion, 'major')
    else if (choice === '4') {
      const custom = await ask('请输入自定义版本（例如 1.2.3）：')
      if (!/^\d+\.\d+\.\d+$/.test(custom)) { 
        console.error('版本格式无效，退出')
        restoreRegistry()
        process.exit(1) 
      }
      newVersion = custom
    } else { 
      console.log('无效选项，退出')
      restoreRegistry()
      process.exit(1) 
    }

    console.log(`将要发布版本： ${newVersion}`)
    const confirm = (await ask('确认发布并自动创建 tag？输入 y 确认，其他取消：')).toLowerCase()
    if (confirm !== 'y') { 
      console.log('已取消发布')
      restoreRegistry()
      process.exit(1) 
    }

    // run tests if exist
    if (pkg.scripts && pkg.scripts.test) {
      console.log('🧪 运行测试：npm run test')
      try {
        run('npm run test')
      } catch (e) {
        console.error('测试失败：', e && e.message)
        restoreRegistry()
        process.exit(1)
      }
    }

    // run build if exist
    if (pkg.scripts && pkg.scripts.build) {
      console.log('🔧 运行打包：npm run build')
      try {
        run('npm run build')
      } catch (e) {
        console.error('打包失败：', e && e.message)
        restoreRegistry()
        process.exit(1)
      }
    }

    // use npm version to bump, commit and tag (this will create a git commit + tag)
    console.log('🔖 使用 npm version 更新 package.json、创建 commit 与 tag')
    try {
      run(`npm version ${newVersion} -m "chore(release): v%s"`)
    } catch (e) {
      console.error('npm version 失败：', e && e.message)
      restoreRegistry()
      process.exit(1)
    }

    // push commit and tags
    console.log('⬆️ 推送 commit 与 tags 到远程')
    try {
      run('git push')
      run('git push --tags')
    } catch (e) {
      console.error('git push 失败：', e && e.message)
      console.log('你可能需要手动回滚版本：例如 git tag -d v' + newVersion + ' 然后 git reset --hard HEAD~1')
      restoreRegistry()
      process.exit(1)
    }

    // publish to npm
    console.log('🚀 发布到 npm')
    const publishCmd = pkg.name && pkg.name.startsWith('@') ? 'npm publish --access public' : 'npm publish'
    try {
      run(publishCmd)
    } catch (e) {
      console.error('npm publish 失败：', e && e.message)
      console.log('你可能需要手动回滚版本：例如 git tag -d v' + newVersion + ' 然后 git reset --hard HEAD~1')
      restoreRegistry()
      process.exit(1)
    }

    console.log('✅ 发布完成：', `${pkg.name}@${newVersion}`)
    console.log('发布流程结束')
    restoreRegistry()
  } catch (err) {
    console.error('发布失败：', err && err.message)
    restoreRegistry()
    process.exit(1)
  }
}

main()
