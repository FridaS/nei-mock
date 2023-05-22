# neiMock
NEI based data mock scheme
基于nei的数据mock方案

##### 1. 需要在package.json同级创建一个配置文件neimockConfig.js文件

```javascript
// neimockConfig.js
const { createNeiMockConfig } = require('./nei-mock');

module.exports = createNeiMockConfig({
    /**
     * nei项目的唯一标识
     * 写法1，唯一的nei项目
     *  key: {String}
     * 写法2，多个nei项目，后续可选择使用哪个项目
     *  key: {
     *      'projet1': {String},
     *      'project2': {String}
     *  }
     */
    key: '07841b89b63b942b1bb0abcfd090685d',
    domain: 'http://localhost:8082', // 数据源服务器，默认https://nei.netease.com
    // 代理到proxyTarget的接口
    proxyURL: ['/api', '/community'],
    proxyTarget: {
        'default': 'http://content.kaola.com',
        'user_test6': 'http://10.206.58.10:5052',
        'stable_master': 'http://10.165.125.185:5052',
        'pre5': 'http://10.201.171.244:5052'
    },
    // 本地mock数据存放目录
    localMockData: 'mock',
    forceUpdate: 're-select' | 'use-current-selection' | false,
    mixedProxy: {
        '/api1': '/api2'
    }
})
```

##### 2. 使用

###### 用法1：
```javascript
// webpack
const { neiMock } = require('nei-mock')

devServer: {
    before: function(app) {
        console.log('before start')
        neiMock(app)
    }
}

// vite
import { vitePluginNeiMock } from './nei-mock-vite';

plugins: [
    ...,
    vitePluginNeiMock(),
    ...
]
```

###### 用法2：
```javascript
var express = require('express')
var app = express()

var neiMock = require('nei-mock')
neiMock(app)
```

##### 3. 以上两种用法都是在启动服务的同时使用nei-mock，但是我们有这样的需求：不重启服务、更新本地mock数据。这时候可以直接执行local-mock.js：
```json
// package.json
"scripts": {
    "mock": "node node_modules/nei-mock/local-mock/local-mock.js",
}
```