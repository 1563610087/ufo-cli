'use strict';
const semver = require('semver')
const colors = require('colors/safe')
const log = require('../../../utils/log/index')
const LOWEST_NODE_VERSION ='12.0.0';
class Command {
    constructor(args){
        if(!args){
            throw new Error('参数不能为空')
        }
        if(!Array.isArray(args)){
            throw new Error('参数必须是数组')
        }
        if(args.length<1){
            throw new Error('参数列表不能为空')
        }
        this._args = args;
        let runner=new Promise((resolve, reject)=>{
            let chain=Promise.resolve()
            chain=chain.then(()=>this.checkNodeVersion())
            chain = chain.then(() => this.initArgs());
            chain = chain.then(() => this.init());
            chain = chain.then(() => this.exec());
            chain.catch(err=>log.error(err.message))

        })
        
    }

    //初始化参数
    initArgs(){
        this._cmd=this._args[this._args.length-1]
        this._args=this._args.slice(0,this._args.length-1)
    }

    //检查node版本
    checkNodeVersion() {
        let currentVersion = process.version
        let lowerVersion = LOWEST_NODE_VERSION
        if(!semver.gte(currentVersion, lowerVersion)){
          throw new Error(colors.red(`ufo-cli需要安装v${lowerVersion}以上版本的node.js`))
        }
      }

    init(){
        throw new Error('init必须实现')
    }

    exec(){
        throw new Error('exec必须实现')
    }
}
module.exports = Command;