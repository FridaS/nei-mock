# neiMock
NEI based data mock scheme
基于nei的数据mock方案
1. 需要在package.json同级创建一个配置文件neimockConfig.js文件
```javascript
// neimockConfig.js
module.exports = {
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
  // 代理到proxyTarget的接口
  proxyURL: ['/api'],
  proxyTarget: {
    'default': 'http://content.kaola.com',
    'user_test6': 'http://10.206.58.10:5052',
    'stable_master': 'http://10.165.125.185:5052',
    'pre5': 'http://10.201.171.244:5052'
  },
  // 本地mock数据存放目录
  localMockData: 'mock'
}
```

2. 使用
- 
    ```javascript
    const mockMiddleware = require('nei-mock')

    devServer: {
        before: function(app) {
            console.log('before start')
            mockMiddleware(app)
        }
    }
    ```
- 
    ```javascript
    var express = require('express')
    var app = express()

    var neiMock = require('nei-mock')
    neiMock(app)
    ```

3. 以上两种用法都是在启动服务的同时使用nei-mock，但是我们有这样的需求：不重启服务、更新本地mock数据。这时候可以直接执行local-mock.js：
    ```json
    // package.json
    "scripts": {
        "mock": "node node_modules/nei-mock/local-mock/local-mock.js",
    }
    ```