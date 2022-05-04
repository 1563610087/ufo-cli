const log = require('npmlog')

log.level=process.env.LOG_LEVEL?process.env.LOG_LEVEL:'info' //设置默认日志等级
log.heading='uzt' //设置日志头
log.addLevel('success',2000,{fg:'green',bold:true,})//设置日志样式

module.exports =log