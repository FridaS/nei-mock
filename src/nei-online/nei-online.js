const querystring = require('querystring')
const path = require('path')
const os = require('os')
const async = require('async')
const exec = require('child_process').exec
const globule = require('globule')
import { getCurrentConfig } from '../neiConfig';
const neiConfig = getCurrentConfig()
const key = neiConfig.theKey
const serverDomainCMD = neiConfig.userConfig.domain ? `-s ${neiConfig.userConfig.domain}` : '';

const neiBaseDir = path.resolve(os.homedir(), 'localMock', key)
const neiServerConfigFolder = path.resolve(neiBaseDir, './nei**')
// let configPathArr = globule.find(neiServerConfigFolder)
// let neiServerConfig = path.resolve(configPathArr[0], './server.config.js')

let lock = false

let reloadServerConfig = (cb) => {
  if (lock) {
    cb && cb(null)
    return
  }
  lock = true
  // 只需要更新server.config.js文件（nei线上发生改变[添加、删除接口]，
  // nei update或nei update -w都会获得最新server.config.js文件）
  console.log('reload server config start')

  let configPathArr = globule.find(neiServerConfigFolder)

  const neiBuild = `nei build -k ${key} -o ${neiBaseDir} ${serverDomainCMD}`
  const neiUpdate = `cd ~/localMock/${key} && nei update ${serverDomainCMD}`
  const cmdStr = (configPathArr && configPathArr.length) ? neiUpdate : neiBuild

  exec(cmdStr, (error, stdout, stderr) => {
    if (error) {
      cb && cb(null)
      console.log('cmd exec error:', error)
      console.log('cmd exec stdout:', stdout)
      console.log('cmd exec stderr:', stderr)
      return
    }
    console.log('reload success')
    lock = false

    cb && cb(null)
  })
}

const initMockRouterReg = function (map) {
  var regMap = new Map()
  for (var pathReg in map) {
    let url = pathReg.split(' ')[1]
    var content = map[pathReg]
    var pathInfo = {}
    pathInfo.method = pathReg.split(' ')[0].toLowerCase()
    pathInfo.id = content.id

    regMap.set(url, pathInfo)
  }
  return regMap
}

let existUrlAndGetId = (requestPath, method, isXhr) => {
  let configPathArr = globule.find(neiServerConfigFolder)
  let neiServerConfig = path.resolve(configPathArr[0], './server.config.js')

  let { routes } = require(neiServerConfig)
  let pathRegMap = initMockRouterReg(routes)
  let existUrl = false
  let id = null
  pathRegMap.forEach(function (pathInfo, url) {
    let limitMethod = pathInfo.method
    if (url === requestPath) {
      existUrl = true
      id = pathInfo.id
      if (limitMethod && limitMethod !== method && isXhr) {
        existUrl = false
      }
    }
  })
  return { existUrl, id }
}

var getFromNEISite = (requestPath, method, id, callback) => {
  let params = {
    path: requestPath,
    type: 3, // api代理：3，页面代理：1
    key: key,
    id,
    method: method
  }

  const grabDataFrom = neiConfig.userConfig.domain || 'https://nei.netease.com';
  let url = grabDataFrom + '/api/mockdata?' + querystring.stringify(params)

  const httpProtocal = grabDataFrom.split('://')[0] === 'https' ? require('https') : require('http');

  httpProtocal.get(url, function (res) {
    let ret = []
    res.on('data', function (chunk) {
      ret.push(chunk.toString())
    })
    res.on('end', function () {
      let json = null
      try {
        json = JSON.parse(ret.join(''))
      } catch (ex) {
        // ignore
      }
      if (json && json.code === 200) {
        // 成功
        if (json.result.error.length) {
          console.log(`错误: ${json.result.error.map(err => err.message).join(', ')}`)
        }
        // 真正的 mock 数据
        callback(json.result.json)
      } else {
        callback(ret.join(''))
      }
    })
  }).on('error', function (error) {
    callback(error.message)
  })
}

var neiOnlineMockMiddleware = (request, response, next) => {
  let requestPath = request.path
  let method = request.method.toLowerCase()

  async.waterfall([
    reloadServerConfig, // 实时获取nei线上接口信息
    (cb) => {
      let { existUrl, id } = existUrlAndGetId(requestPath, method, request.xhr)
      cb && cb(null, existUrl, id)
    },
    (existUrl, id, cb) => {
      if (existUrl) {
        getFromNEISite(requestPath, method, id, (json) => {
          if (json) {
            response.status(200).json(json)
          } else {
            var NO_FOUND_CODE = 404
            response.json(NO_FOUND_CODE, {
              code: NO_FOUND_CODE,
              msg: '接口数据未定义'
            })
          }
        })
      } else {
        next()
      }
      cb && cb()
    }
  ],
  (err, results) => {
    if (err) {
      console.log('async series error:', err)
    }
  })
}

module.exports = neiOnlineMockMiddleware
