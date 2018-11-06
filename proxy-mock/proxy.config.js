const proxy = require('http-proxy-middleware')

const NO_NEED_PROXY = process.env.NO_NEED_PROXY

const defaultProxyTarget = 'http://content.kaola.com'
let proxyTarget = process.env.NEI_PROXYTARGET || defaultProxyTarget

const path = require('path')
const { proxyURL } = require(path.resolve(process.cwd(), 'neiMockConfig'))

let getProxy = () => {
  if (!proxyURL || proxyURL.length <= 0) {
    return new Error('please configure proxyURL correctly')
  }
  let result = []
  proxyURL.forEach(item => {
    result.push(proxy(item, {
      target: proxyTarget,
      changeOrigin: true
    }))
  })
  return result
}

const proxyTable = (process.env.NEI_USEPROXY === 'false' || NO_NEED_PROXY) ? [] : getProxy()

module.exports = {
  // 代理环境配置
  proxyTable
}
