import { accessSync, constants, createReadStream, createWriteStream, readdir, stat, mkdir, writeFile, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import os from 'os';
import globule from 'globule';
import { rimraf } from 'rimraf';
import { exec } from 'child_process';
import { series } from 'async';
import { getCurrentConfig, getNewNeiConfig } from '../neiConfig';
import { initMockRouterReg } from './mockRouterMap';

let serverDomainCMD: string = ''
let key: string = '';
let keyNameArr: string[] = []

let neiBaseDir = '';
let routeMapPath = '';
let copyTarget = '';

export function initLocalMockData() {
  const neiConfig = getNewNeiConfig();
  const { userConfig } = neiConfig;
  serverDomainCMD = userConfig.domain ? `-s ${userConfig.domain}` : '';
  if (typeof userConfig.key === 'string') {
    key = userConfig.key
  } else {
    keyNameArr = Object.keys(userConfig.key);
    key = neiConfig.theKey || userConfig.key[keyNameArr[0]]
  }
  neiBaseDir = resolve(os.homedir(), 'localMock', key);
  makeMockFolder(userConfig.localMockData);

  if (neiConfig.forceCover === 'true') {
    // 强制从nei拉取数据、覆盖本地mock数据
    hardUpdate()
  } else {
    // 更新nei新增接口、保留本地mock数据
    softUpdate()
  }
}

function hardUpdate() {
  series(
    [
      removeLocalMock, // 删除 ~/localMock/${key}文件
      removeProjectMockData, // 删除本工程mock/data下的文件
      removeMockMap, // 删除工程routeMap.json文件
      softUpdate // 重新拉取
    ],
    (err, _results) => {
      if (err) {
        console.log('async series error:', err)
      }
    }
  )
}

function softUpdate(cb?: (s?: string) => void) {
  const neiServerConfig = resolve(neiBaseDir, './nei**');
  let configPathArr = globule.find(neiServerConfig);
  
  // 从nei拉取mock数据
  const neiBuild = `nei build -k ${key} -o ${neiBaseDir} ${serverDomainCMD}`;
  // nei update: 更新接口文件，但本地已存在的不覆盖；
  // nei update -w: 覆盖已存在的文件，但本地已存在、nei已删除的文件不处理（需要用户手动删除）。
  const neiUpdate = `cd ~/localMock/${key} && nei update ${serverDomainCMD}`
  const cmdStr = configPathArr.length ? neiUpdate : neiBuild
  console.log('nei exec start:', cmdStr)

  // 每次执行命令，总是先 nei build 或 nei update，然后更新本地的数据
  exec(cmdStr, (error, stdout, stderr) => {
    console.log('nei exec end')
    if (error) {
      cb && cb('cmd exec error')
      console.log('cmd exec error:', error)
      console.log('cmd exec stdout:', stdout)
      console.log('cmd exec stderr:', stderr)
      return
    }

    !configPathArr[0] && (configPathArr = globule.find(neiServerConfig))
    routeMap(configPathArr[0])
    createMockData(neiBaseDir)

    cb && cb()
  })
}

// 从nei的server.config.js提取route map
function routeMap(folderPath: string) {
  const sourcePath = resolve(folderPath, './server.config.js')
  const { routes } = require(sourcePath) as { routes: Record<string, string>}
  const pureRoutes = formatRoutes(routes)
  
  // routeMap所在文件存在、则读取其内容
  let tarPathContent: Record<string, string> = {}
  try {
    tarPathContent = JSON.parse(readFileSync(routeMapPath, 'utf-8'))
    console.log('update routeMap.js')
  } catch (e) {
    console.log('create routeMap.js')
  }
  // 合并(merge)server.config.js的routes对象和routeMap.json的对象
  tarPathContent = { ...tarPathContent, ...pureRoutes }

  // 将格式化后的数据写入routeMapPath所在文件
  writeFileSync(
    routeMapPath, 
    JSON.stringify(tarPathContent, null, 2)
  )
  console.log('update route map: success');
  const { localMockData } = getCurrentConfig().userConfig;
  initMockRouterReg(localMockData);
}

function createMockData(neiBaseDir: string) {
  const copySrcGET = join(neiBaseDir, './mock/get');
  const copySrcPOST = join(neiBaseDir, './mock/post');
  copyFolder(copySrcGET, copyTarget, (error) => {
    if (error) {
      console.log('copy get error:', error)
      return
    }
  })
  copyFolder(copySrcPOST, copyTarget, (error) => {
    if (error) {
      console.log('copy post error:', error)
      return
    }
  })
}

// 删除 ~/localMock/${key}文件
function removeLocalMock(cb: (s?: string) => void) {
  console.log('remove localMock start:', neiBaseDir)
  rimraf(neiBaseDir).catch(error => {
    if (error) {
      cb && cb('remove localMock error')
      console.log('remove localMock error:', error)
      return
    }
  })
  console.log('remove localMock end')
  cb && cb()
}

// 删除本工程mock/data下的文件
function removeProjectMockData(cb: (s?: string) => void) {
  console.log('remove project mock data start')
  readdir(copyTarget, (error, files) => {
    if (error) {
      cb && cb('remove project mock data readdir error')
      console.log('readdir error:', error)
      return
    }
    // 为空时直接回调
    if (files.length === 0) {
      console.log('project mock data is empty')
      return ;
    }

    files.forEach(file => {
      const theFolder = join(copyTarget, file)
      rimraf(theFolder).catch(error => {
        if (error) {
          cb && cb('remove project mock data error')
          console.log('remove project mock data error:', error)
          return
        }
      })
    })
    console.log('remove project mock data end')
    cb && cb()
  })
}

function removeMockMap(cb: (s?: string) => void) {
  console.log('remove project mockMap start')
  rimraf(routeMapPath).catch(error => {
    if (error) {
      cb && cb('remove mockMap error')
      console.log('remove mockMap error:', error)
      return
    }
    console.log('remove mockMap end')
    cb && cb()
  })
}

// 复制文件夹
function copyFolder(sourceDir: string, targetDir: string, cb: (e?: Error) => void) {
  readdir(sourceDir, (error, files) => {
    if (error) {
      console.log('readdir error:', error)
      cb && cb(error)
      return
    }
    // 为空时直接回调
    if (files.length === 0) {
      cb && cb(new Error('files is empty'))
    }

    let hasPeerFolder = false // 该目录下是否存在文件夹
    files.forEach((file) => {
      const sourcePath = join(sourceDir, file)
      
      stat(sourcePath, (error, sourceStat) => {
        if (error) {
          console.log('stat error:', error)
          return
        }
        if (sourceStat.isDirectory()) {
          const targetPath = join(targetDir, file)
          hasPeerFolder = true
          console.log('mkdir:', targetPath)
          mkdir(targetPath, (error) => {
            if (error && error.code !== 'EEXIST') {
              console.log('mrdir error:', error)
              return
            }
            // 无异常 或 已经存在的文件夹(error.code === 'EEXIST')，复制文件夹内容
            copyFolder(sourcePath, targetPath, cb)
          })
        } else if (file === 'data.json') {
          // 是文件，且文件名是 data.json
          const newTarget = targetDir + '.json'

          if (!fsExistsSync(newTarget)) {
            copyFile(sourcePath, newTarget, cb)
          } else {
            console.log('file exist:', newTarget)
          }

          // 该data.json同级还有文件夹，则不删除其上一级目录
          if (hasPeerFolder) {
            return
          }

          // 删除data.json的上一级目录
          rimraf(targetDir).catch(e => console.log('rmdir error:', e))
          
        }
      })
    })
  })
}

// 判断文件/文件夹是否已存在
export function fsExistsSync (path: string) {
  try {
    accessSync(path, constants.F_OK)
  } catch (e) {
    return false
  }
  return true
}

// 复制文件
function copyFile(src: string, target: string, cb?: (e?: Error) => void) {
  console.log('file update:', target)
  let rs = createReadStream(src)
  rs.on('error', (error) => {
    if (error) {
      console.log('file read error:', src)
    }
    cb && cb(error)
  })

  let ws = createWriteStream(target)
  ws.on('error', (error) => {
    if (error) {
      console.log('file write error:', target)
    }
    cb && cb(error)
  })
  ws.on('close', () => {
    cb && cb()
  })

  rs.pipe(ws)
}

// format server.config.js 的 routes，返回格式化后的对象
function formatRoutes(routes: Record<string, unknown>) {
  return Object.keys(routes).reduce((acc, curr) => ({
    ...acc,
    [curr]: curr.split(' ')[1]
  }), {} as Record<string, string>)
}

function makeMockFolder(foldername: string) {
  mkdir(resolve(process.cwd(), foldername), (e) => {
    if (e && e.code !== 'EEXIST') {
      throw e;
    }
  })
  routeMapPath = resolve(process.cwd(), foldername, './routeMap.json');
  if (!fsExistsSync(routeMapPath)) {
    writeFileSync(routeMapPath, '{}');
  }
  copyTarget = resolve(process.cwd(), foldername + '/data');
  mkdir(copyTarget, (e) => {
    if (e && e.code !== 'EEXIST') {
      throw e;
    }
  })
}