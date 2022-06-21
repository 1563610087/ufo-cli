'use strict';

const path = require('path');
const { isObject } = require('../../../utils/utils/lib/index')
const pkgDir = require('pkg-dir').sync
const formatePath = require('../../../utils/formate-path/lib/index');
const npminstall = require('npminstall')
const pathExists = require('path-exists').sync
const fsExtra = require('fs-extra')
const { getDefaultRegistry, getNpmLatestVersion } = require('../../../utils/get-npm-info/index')
class Package {
    constructor(options) {
        if (!options) {
            throw new Error('Package类的参数options不能为空')
        }
        if (!isObject(options)) {
            throw new Error('Package类的参数options必须为对象')
        }
        //目标路径，就是项目初始化要放到的位置
        this.targetPath = options.targetPath
        //缓存路径，将项目模板缓存下来的位置
        this.storePath = options.storePath
        this.packageName = options.packageName
        this.packageVersion = options.packageVersion
        //package缓存目录前缀
        this.cacheFilePathPrefix = options.packageName.replace('/', '_')
    }

    get cacheFilePath() {
        return path.resolve(this.storePath, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
    }

    getSpecificCacheFilePath(packageVersion) {
        return path.resolve(this.storePath, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
    }

    async prepare() {
        if (this.storePath && !pathExists(this.storePath)) {
            fsExtra.mkdirpSync(this.storePath)
        }
        if (this.packageVersion === 'latest') {
            this.packageVersion = await getNpmLatestVersion(this.packageName)
        }

    }

    //判断包是否存在
    async exists() {
        if (this.storePath) {
            await this.prepare()
            return pathExists(this.cacheFilePath)
        } else {
            return pathExists(this.targetPath)

        }
    }

    //安装依赖包
    async install() {
        await this.prepare()
        return npminstall({
            root: this.targetPath,
            storePath: this.storePath,
            registry: getDefaultRegistry(),
            pkgs: [
                {
                    name: this.packageName,
                    version: this.packageVersion
                }
            ]
        })
    }

    //更新包
    async update() {
        //1、获取最新版本号
        const latestPackageVersion = await getNpmLatestVersion(this.packageName)
        //2、查询最新版本号对应的路径是否存在
        const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
        //3、如果不存在，则直接安装最新版本
        if (!pathExists(latestFilePath)) {
            await npminstall({
                root: this.targetPath,
                storePath: this.storePath,
                registry: getDefaultRegistry(),
                pkgs: [
                    {
                        name: this.packageName,
                        version: latestPackageVersion
                    }
                ]
            })
            this.packageVersion = latestPackageVersion
        }


    }

    //获取入口文件
    getRootFilePath() {
        function _getRootFile(targetPath){
            //1、获取package.json的所在目录
            const dir = pkgDir(targetPath)
            if (dir) {
                //2、读取package.json文件
                const pkgFile = require(path.resolve(dir, 'package.json'))
                //3、寻找main/lib
                if (pkgFile || pkgFile.main) {
                    //4、兼容windows和ios系统
                    return formatePath(path.resolve(dir, pkgFile.main))
                }
                // console.log(pkgFile)
                return null
            }
        }
        if (!this.storePath) {
            return _getRootFile(this.cacheFilePath)
        } else {
            return _getRootFile(this.targetPath)
        }
    }
}

module.exports = Package;