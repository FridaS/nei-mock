import { pathToRegexp } from 'path-to-regexp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { fsExistsSync } from './local-mock'

const MOCK_DATA_DIR = './data'
const ROUTE_MAP = './routeMap.json'
const pathRegMap: Map<RegExp, {
  method: string;
  mockFile: string;
}> = new Map();

export function getFilePath(requestPath: string, method: string, isXhr?: boolean): string | false {
  let filePath: false | string = false
  pathRegMap.forEach((pathInfo, urlReg)  => {
    const limitMethod = pathInfo.method
    if (urlReg.test(requestPath)) {
      filePath = pathInfo.mockFile
      if (limitMethod && limitMethod !== method && isXhr) {
        filePath = false
      }
    }
  })
  return filePath
}

export function initMockRouterReg(localMockData: string) {
  const routeMapPath = resolve(process.cwd(), localMockData, ROUTE_MAP)
  
  if (!fsExistsSync(routeMapPath)) {
    writeFileSync(routeMapPath, '{}');
  }
  const routeMap: Record<string, string> = JSON.parse(readFileSync(routeMapPath, 'utf-8'))
  
  Object.entries(routeMap).forEach(([ reqPathReg, filePath ] ) => {
    const [key0, key1] = reqPathReg.split(/\s/)
    const pathInfo = { 
      method:  key1 ? key0 : '', 
      mockFile: MOCK_DATA_DIR + filePath
    };
    const urlReg = key1 ? key1: key0;
    pathRegMap.set(pathToRegexp(urlReg), pathInfo)
  })
}

