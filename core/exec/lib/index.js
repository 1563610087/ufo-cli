'use strict';

//执行初始化命令逻辑
const Package = require('../../../models/package/lib/index');
const log = require('../../../utils/log/index');
const path = require('path');
const { exec: spawn } = require('../../../utils/utils/lib/index');

const SETTINGS={
    // 'init':"@ufo-zhu/init"
    'init':"uglify-js"
}

const CACHE_DIR='dependencies'

async function exec() {
    let targetPath=process.env.CLI_TARGET_PATH
    let pkg=''
    const homePath = process.env.CLI_HOME_PATH
    const cmdObj=arguments[arguments.length-1]
    const cmdName=cmdObj._name
    const packageName=SETTINGS[cmdName]
    const packageVersion='latest'
    let storePath=''
    if(!targetPath){
        targetPath=path.resolve(homePath,CACHE_DIR)
        storePath=path.resolve(targetPath,'node_modules')
        log.verbose('targetPath',targetPath)
        log.verbose('homePath',homePath)
        pkg=new Package({
            targetPath,
            storePath,
            packageName,
            packageVersion
        })
        if(await pkg.exists()) {
            //更新package
            await pkg.update()
        }else{
            //安装package
            await pkg.install()
        }
    }else{
        pkg=new Package({
            targetPath,
            packageName,
            packageVersion
        })
    }
    // const rootFilePath=pkg.getRootFilePath()
    const rootFilePath='../../../commands/init/lib/index.js'
    if(rootFilePath){
        try {
            // 在当前进程中调用
            require(rootFilePath).call(null, Array.from(arguments));
            // 在node子进程中调用
            // const args = Array.from(arguments);
            // const cmd = args[args.length - 1];
            // const o = Object.create(null);
            // Object.keys(cmd).forEach(key => {
            //   if (cmd.hasOwnProperty(key) &&
            //     !key.startsWith('_') &&
            //     key !== 'parent') {
            //     o[key] = cmd[key];
            //   }
            // });
            
            // args[args.length - 1] = o;
            // const code = `require('${rootFilePath}').call(null, ${JSON.stringify(args)})`;
            // console.log(code)
            // const child = spawn('node', ['-e', code], {
            //   cwd: process.cwd(),
            //   stdio: 'inherit',
            // });
            // child.on('error', e => {
            //   log.error(e.message);
            //   process.exit(1);
            // });
            // child.on('exit', e => {
            //   log.verbose('命令执行成功:' + e);
            //   process.exit(e);
            // });
          } catch (e) {
            log.error(e.message);
          }
    }
    
}

module.exports = exec;
