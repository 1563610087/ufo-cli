'use strict';

const path = require('path')

function formatePath(p) {
    if (p&&typeof p === 'string'){
        //window目前没有sep方法
        const sep=path.sep
        if (sep==='/'){
            return p
        }else{
            return p.replace('/\\/g','/')
        }
    }
    return p
}

module.exports = formatePath