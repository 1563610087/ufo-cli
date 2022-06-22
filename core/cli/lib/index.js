#! /usr/bin/env/ node

module.exports = core

const pkg = require('../../../package.json')
const log = require('../../../utils/log')
const constants = require('./const')
const semver = require('semver')
const path = require('path')
const colors = require('colors/safe')
const userHome = require('user-home')
const { Command } = require('commander')
const pathExists = require('path-exists').sync
const exec = require('../../exec/lib/index')
const { getNpmServerInfo } = require('../../../utils/get-npm-info/index')

//实例化全局命令对象
const program = new Command()
let args, config
async function core() {
  try {
    await prepare()//项目准备阶段
    registryCommander()//命令注册
  } catch (err) {
    log.error(err.message)
    if (program.debug) {
      console.log(err)
    }
  }

}

async function prepare() {
  checkNodeVersion()
  checkVersion()//检测当前版本
  checkRoot()//检测root启动
  checkUserHome()//检测用户主目录
  checkEnv()//检测环境变量
  // await checkUpdateGlobal()//检查全局更新
}


//检查node版本
function checkNodeVersion() {
  let currentVersion = process.version
  let lowerVersion = constants.LOWEST_NODE_VERSION
  if(!semver.gte(currentVersion, lowerVersion)){
    throw new Error(colors.red(`ufo-cli需要安装v${lowerVersion}以上版本的node.js`))
  }
}

async function checkUpdateGlobal() {
  const currentVersion = pkg.version
  const npmName = pkg.name
  const lastVersion = await getNpmServerInfo(currentVersion, 'semver')
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn('更新提示', colors.yellow(
      `请手动更新${npmName},当前版本：${currentVersion},最新版本${lastVersion}
更新命令：npm install -g ${npmName}`))
  }
}

function checkEnv() {
  const dotenv = require('dotenv')
  const dotPathEnv = path.resolve(userHome, '.env')
  if (pathExists(dotPathEnv)) {
    config = dotenv.config({
      path: dotPath
    })
  }
  //脚手架的目录位置
  process.env.CLI_HOME_PATH = path.join(userHome, constants.DEFAULT_CLI_HOME)
}

function checkVersion() {
  log.notice('cli', pkg.version)
}

async function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red(`当前用户主目录不存在`))
  }
}


function checkRoot() {
  //linux系统可用
  if (process.getuid) {
    const checkRoot = require('check-root')
    checkRoot()
    console.log(`Current uid: ${process.getuid()}`);
  }
}

function registryCommander() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    //下面这行是添加选项的第一种模式，不带参数，值为布尔类型
    .option('-d,--debug', '是否开启调试模式', false)
    //下面这行是添加选项的第二种模式，带参数，值为用户输入的类型
    .option('-tp,--targetPath <targetPath>', '是否开启本地调试模式', '')
  //监听未定义的命令功能未实现

  program
    .command('init <projectName>')
    .option('-f', '--force', '是否强制初始化项目')
    .action(exec)

  program.on('option:targetPath', function (targetPath) {
    process.env.CLI_TARGET_PATH = targetPath
  })

  program.on('option:debug', function (debug) {
    if (program.debug) {
      process.env.LOG_LEVEL = 'verbose'
    }
    log.level = process.env.LOG_LEVEL
  })
  // if(program.args&&program.args.length<1){
  //   program.outputHelp()
  //   console.log()
  // }
  program.parse(process.argv)

}