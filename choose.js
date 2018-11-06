const inquirer = require('inquirer')
const path = require('path')
const { key, proxyTarget } = require(path.resolve(process.cwd(), 'neiMockConfig'))
const { proxyTable } = require('./proxy-mock/proxy.config.js')

// 命令行配置
const firstQuestion = {
  type: 'list',
  message: '是否使用nei线上mock数据？',
  name: 'neiOnline',
  choices: ['false', 'true']
}
const secondQuestion = {
  type: 'list',
  message: '是否代理到测试/线上环境？',
  name: 'useProxy',
  choices: ['false', 'true']
}
const thirdQuestion = {
  type: 'list',
  message: '是否覆盖本地mock数据？',
  name: 'forceCover',
  choices: ['false', 'true']
}
process.env.NEI_NEIONLINE = false
process.env.NEI_USEPROXY = false
process.env.NEI_FORCECOVER = false

process.env.NEI_KEY = key
let projectSelectQuestion = null
if (typeof key === 'object') {
  let neiProjectChoices = []
  for (let i in key) {
    neiProjectChoices.push(i)
  }
  projectSelectQuestion = {
    type: 'list',
    message: '选择哪个nei项目？',
    name: 'NEIProjectKey',
    choices: neiProjectChoices
  }
}

let choose = (app) => {
  inquirer.prompt(firstQuestion).then(answers => {
    process.env.NEI_NEIONLINE = answers.neiOnline
    if (process.env.NEI_NEIONLINE === 'false') {
      inquirer.prompt(secondQuestion).then(answers => {
        process.env.NEI_USEPROXY = answers.useProxy
        if (process.env.NEI_USEPROXY === 'false') {
          inquirer.prompt(thirdQuestion).then(answers => {
            process.env.NEI_FORCECOVER = answers.forceCover
            if (projectSelectQuestion) {
              // 更新所选择的nei工程的本地mock数据
              inquirer.prompt(projectSelectQuestion).then(answers => {
                process.env.NEI_KEY = key[answers.NEIProjectKey]
                require('./local-mock/local-mock')
                app.use(require('./local-mock/local-mock-index'))
              })
            } else {
              // 更新唯一的nei工程的本地mock数据
              require('./local-mock/local-mock')
              app.use(require('./local-mock/local-mock-index'))
            }
          })
        } else {
          // 代理到测试/线上环境
          if (typeof proxyTarget !== 'object') {
            console.log('error: proxyTargt is not configured correctly!')
            return
          }
          let proxyTargetChoices = []
          for (let i in proxyTarget) {
            proxyTargetChoices.push(i)
          }
          let proxyTargetSelectQuestion = {
            type: 'list',
            message: '代理到哪个环境？',
            name: 'NEIProxyTarget',
            choices: proxyTargetChoices
          }
          // 选取代理到的目标环境
          inquirer.prompt(proxyTargetSelectQuestion).then(answers => {
            process.env.NEI_PROXYTARGET = proxyTarget[answers.NEIProxyTarget]
            app.use(proxyTable)
          })
        }
      })
    } else if (projectSelectQuestion) {
      // 使用所选择的nei工程的线上mock数据
      inquirer.prompt(projectSelectQuestion).then(answers => {
        process.env.NEI_KEY = key[answers.NEIProjectKey]
        app.use(require('./nei-online/nei-online.js'))
      })
    } else {
      // 使用唯一的nei工程的线上mock数据
      app.use(require('./nei-online/nei-online.js'))
    }
  })
}

module.exports = choose
