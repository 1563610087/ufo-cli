'use strict';

const Command = require('../../models/command/lib/index')
const fs = require('fs')
const fse = require('fs-extra');
const path = require('path')
const fsExtra = require('fs-extra')
const inquirer = require('inquirer')
const log = require('../../utils/log/index')
const userHome = require('user-home')
const glob = require('glob')
const semver = require('semver')
const ejs = require('ejs')
const Package = require('../../models/package/lib/index')
const { spinnerStart, sleep, execAsync } = require('../../utils/utils/lib/index')

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';
const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMAND = ['npm', 'cnpm'];
class InitCommand extends Command {
    init() {
        this.projectName = this._args[0] || ''
        this.force = !!this._cmd.force
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force)
    }

    async exec() {
        try {
            // 1. 准备阶段
            const projectInfo = await this.prepare();
            if (projectInfo) {
                // 2. 下载模板
                log.verbose('projectInfo', projectInfo);
                this.projectInfo = projectInfo;
                await this.downloadTemplate();
                // 3. 安装模板
                await this.installTemplate();
            }
        } catch (e) {
            log.error(e.message);
            if (process.env.LOG_LEVEL === 'verbose') {
                console.log(e);
            }
        }
    }

    async prepare() {
        // 0. 判断项目模板是否存在,这个是去调用后端的接口查询模板的数据
        // const template = await getProjectTemplate();
        // if (!template || template.length === 0) {
        //     throw new Error('项目模板不存在');
        // }
        // this.template = template;
        this.template = [{
            name: '标准模板',
            npmName: 'jian-test',
            version: '1.0.0',
            tag: 'project'
        }]
        //1、判断当前目录是否为空
        const localPath = process.cwd()
        if (!this.isDirEmpty(localPath)) {
            const { ifContinue } = await inquirer.prompt({
                type: 'confirm',
                name: 'ifContinue',
                default: false,
                message: '当前文件夹不为空，是否继续创建项目'
            })

            if (ifContinue) {
                //给用户做二次确认
                const { confirmDelete } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmDelete',
                    default: false,
                    message: '是否确认清空当前目录下的文件？'
                })
                if (confirmDelete) {
                    //清空当前目录
                    fsExtra.emptyDirSync(localPath)
                }
            } else {
                return
            }
        }
        return this.getProjectInfo()

    }

    async getProjectInfo() {
        function isValidName(v) {
            return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v);
        }
        let projectInfo = {};
        let isProjectNameValid = false;
        if (isValidName(this.projectName)) {
            isProjectNameValid = true;
            projectInfo.projectName = this.projectName;
        }
        // 1. 选择创建项目或组件
        const { type } = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: '请选择初始化类型',
            default: TYPE_PROJECT,
            choices: [{
                name: '项目',
                value: TYPE_PROJECT,
            }, {
                name: '组件',
                value: TYPE_COMPONENT,
            }],
        });
        log.verbose('type', type);
        this.template = this.template.filter(template =>
            template.tag.includes(type));
        const projectPrompt = [];
        projectPrompt.push(
            {
                type: 'list',
                name: 'projectTemplate',
                message: `请选择模板`,
                choices: this.createTemplateChoice(),
            });
        if (type === TYPE_PROJECT) {
            // 2. 获取项目的基本信息
            const project = await inquirer.prompt(projectPrompt);
            projectInfo = {
                ...projectInfo,
                type,
                ...project,
            };
        } else if (type === TYPE_COMPONENT) {
            const descriptionPrompt = {
                type: 'input',
                name: 'componentDescription',
                message: '请输入组件描述信息',
                default: '',
                validate: function (v) {
                    const done = this.async();
                    setTimeout(function () {
                        if (!v) {
                            done('请输入组件描述信息');
                            return;
                        }
                        done(null, true);
                    }, 0);
                },
            };
            projectPrompt.push(descriptionPrompt);
            // 2. 获取组件的基本信息
            const component = await inquirer.prompt(projectPrompt);
            projectInfo = {
                ...projectInfo,
                type,
                ...component,
            };
        }
        // 生成classname
        if (projectInfo.projectName) {
            projectInfo.name = projectInfo.projectName;
            projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '');
        }
        if (projectInfo.projectVersion) {
            projectInfo.version = projectInfo.projectVersion;
        }
        if (projectInfo.componentDescription) {
            projectInfo.description = projectInfo.componentDescription;
        }
        return projectInfo;
    }

    async downloadTemplate() {
        const { projectTemplate } = this.projectInfo;
        const templateInfo = this.template.find(item => item.npmName === projectTemplate);
        const targetPath = path.resolve(userHome, '.ufo-cli', 'template');
        const storeDir = path.resolve(userHome, '.ufo-cli', 'template', 'node_modules');
        const { npmName, version } = templateInfo;
        this.templateInfo = templateInfo;
        const templateNpm = new Package({
            targetPath,
            storePath: storeDir,
            packageName: npmName,
            packageVersion: version,
        });
        if (!await templateNpm.exists()) {
            const spinner = spinnerStart('正在下载模板...');
            await sleep();
            try {
                await templateNpm.install();
            } catch (e) {
                throw e;
            } finally {
                spinner.stop(true);
                if (await templateNpm.exists()) {
                    log.success('下载模板成功');
                    this.templateNpm = templateNpm;
                }
            }
        } else {
            const spinner = spinnerStart('正在更新模板...');
            await sleep();
            try {
                await templateNpm.update();
            } catch (e) {
                throw e;
            } finally {
                spinner.stop(true);
                if (await templateNpm.exists()) {
                    log.success('更新模板成功');
                    this.templateNpm = templateNpm;
                }
            }
        }
    }

    async installTemplate() {
        log.verbose('templateInfo', this.templateInfo);
        if (this.templateInfo) {
            if (!this.templateInfo.type) {
                this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
            }
            if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
                // 标准安装
                await this.installNormalTemplate();
            } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
                // 自定义安装
                await this.installCustomTemplate();
            } else {
                throw new Error('无法识别项目模板类型！');
            }
        } else {
            throw new Error('项目模板信息不存在！');
        }
    }

    createTemplateChoice() {
        return this.template.map(item => ({
            value: item.npmName,
            name: item.name,
        }));
    }

    async installNormalTemplate() {
        log.verbose('templateNpm', this.templateNpm);
        // 拷贝模板代码至当前目录
        //根据输入的项目名称创建文件夹，然后将模板拷贝至当前文件夹下。
        let spinner = spinnerStart('正在安装模板...');
        await sleep();
        try {
            const templatePath = this.templateNpm.cacheFilePath;
            const targetPath = process.cwd();
            console.log(templatePath,targetPath)
            fse.ensureDirSync(templatePath);
            fse.ensureDirSync(targetPath);
            fse.copySync(templatePath, targetPath);
        } catch (e) {
            throw e;
        } finally {
            spinner.stop(true);
            log.success('模板安装成功');
        }
        // const templateIgnore = this.templateInfo.ignore || [];
        // const ignore = ['**/node_modules/**', ...templateIgnore];
        // await this.ejsRender({ ignore });
        // const { installCommand, startCommand } = this.templateInfo;
        // // 依赖安装
        // await this.execCommand(installCommand, '依赖安装失败！');
        // // 启动命令执行
        // await this.execCommand(startCommand, '启动执行命令失败！');
    }

    async installCustomTemplate() {
        // 查询自定义模板的入口文件
        if (await this.templateNpm.exists()) {
            const rootFile = this.templateNpm.getRootFilePath();
            if (fs.existsSync(rootFile)) {
                log.notice('开始执行自定义模板');
                const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
                const options = {
                    templateInfo: this.templateInfo,
                    projectInfo: this.projectInfo,
                    sourcePath: templatePath,
                    targetPath: process.cwd(),
                };
                const code = `require('${rootFile}')(${JSON.stringify(options)})`;
                log.verbose('code', code);
                await execAsync('node', ['-e', code], { stdio: 'inherit', cwd: process.cwd() });
                log.success('自定义模板安装成功');
            } else {
                throw new Error('自定义模板入口文件不存在！');
            }
        }
    }

    isValidName(v) {
        return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v);
    }

    async ejsRender(options) {
        const dir = process.cwd();
        const projectInfo = this.projectInfo;
        return new Promise((resolve, reject) => {
            glob('**', {
                cwd: dir,
                ignore: options.ignore || '',
                nodir: true,
            }, function (err, files) {
                if (err) {
                    reject(err);
                }
                Promise.all(files.map(file => {
                    const filePath = path.join(dir, file);
                    return new Promise((resolve1, reject1) => {
                        ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
                            if (err) {
                                reject1(err);
                            } else {
                                fse.writeFileSync(filePath, result);
                                resolve1(result);
                            }
                        });
                    });
                })).then(() => {
                    resolve();
                }).catch(err => {
                    reject(err);
                });
            });
        });
    }

    isDirEmpty(localPath) {
        let fileList = fs.readdirSync(localPath);
        // 文件过滤的逻辑
        fileList = fileList.filter(file => (
            !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
        ));
        return !fileList || fileList.length <= 0;
    }
}

function init(args) {
    return new InitCommand(args)
}


module.exports = init;