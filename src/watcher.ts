import { watch } from "chokidar";
import { resolve } from 'path';
import { getCurrentConfig, getNewNeiConfig } from './neiConfig';
import { NeiMockConfig } from './types';
import { initLocalMockData } from './local-mock/local-mock';
import { choose } from './choose';
import chalk from 'chalk';
import { type DistinctQuestion, prompt } from 'inquirer';
import { getProxyTable } from './proxy-mock/proxy.config';
import { Application } from 'express';
import { Connect, FSWatcher } from 'vite';
import { getTheKey, removeMixMock, removeOldMock, removeProxyMock, setProxyMiddleware } from './utils';
import { initMockRouterReg } from './local-mock/mockRouterMap';

let oldUserConfig: ReturnType<typeof getCurrentConfig>['userConfig'];
let oldTheProxyTarget: string;
let oldKey: string;
let oldUseProxy: ReturnType<typeof getCurrentConfig>['useProxy']

export function startWatchConfig(app: Application | Connect.Server) {
  watch(resolve(process.cwd(), 'neiMockConfig.js')).on('change', () => {
    console.log('✨,', chalk.blue('detected neiMockConfig.js change'));
    const oldConfig = getCurrentConfig();
    oldKey = oldConfig.theKey;
    oldTheProxyTarget = oldConfig.theProxyTarget;
    oldUserConfig = oldConfig.userConfig;
    oldUseProxy = oldConfig.useProxy;
    const newConfig = getNewNeiConfig({ changeHappend: true });
    if (newConfig.userConfig.forceUpdate === 're-select') {
      return reStartNeiMock(app);
    }
    switch (oldUseProxy) {
      case 'true': proxyChange(newConfig, app); break;
      case 'false': localChange(newConfig, app); break;
      case 'mixed': mixChange(newConfig, app); break;
    }
  });
}

let mockDirWatcher: FSWatcher;
export function startWatchMockFolder(mockDir: string) {
  if (mockDirWatcher) {
    return ;
  }
  mockDirWatcher = watch(resolve(process.cwd(), mockDir))
  mockDirWatcher.on('change', (path) => {
    if (path === resolve(process.cwd(), mockDir, 'routeMap.json')) {
      initMockRouterReg(mockDir)
    }
    console.log('✨,', chalk.blue('detected localMockFile change, change applied!'));
  })
}

function reStartNeiMock(app: Application | Connect.Server) {
  removeOldMock(app, oldUserConfig)
  choose(app)
}

async function mixChange(newConfig: ReturnType<typeof getCurrentConfig>, app: Application | Connect.Server) {
  localChange(newConfig, app);
  removeMixMock(app, oldUserConfig)
  const { forceUpdate } = newConfig.userConfig
  const [ mixedProxyChanged ] = compareConfig(oldUserConfig, newConfig.userConfig, 'mix');
  if (mixedProxyChanged || forceUpdate) {
    const proxyTable = getProxyTable(); 
    setProxyMiddleware(app, proxyTable)
  }
}

async function localChange(newConfig: ReturnType<typeof getCurrentConfig>, app: Application | Connect.Server) {
  const { key, forceUpdate } = newConfig.userConfig
  const [ domainChanged, localMockChanged, keyChanged ] = compareConfig(oldUserConfig, newConfig.userConfig, false);
  if (keyChanged === 'reselect' || (typeof key === 'object' && forceUpdate)) {
    newConfig.theKey = await getTheKey(newConfig.userConfig);
  } else if (keyChanged === true && typeof key === 'string') {
    newConfig.theKey = key;
  }
  if (domainChanged || localMockChanged || oldKey !== newConfig.theKey || forceUpdate) {
    initLocalMockData();
  }
}

async function proxyChange(newConfig: ReturnType<typeof getCurrentConfig>, app: Application | Connect.Server) {
  const { forceUpdate, proxyTarget } = newConfig.userConfig
  const [ proxyURLChanged, proxyTargetChanged ] = compareConfig(oldUserConfig, newConfig.userConfig, true);
  if (proxyTargetChanged || forceUpdate) {
    const proxyTargetSelectQuestion: DistinctQuestion<{ NEIProxyTarget: string }> = {
      type: 'list',
      message: '代理到哪个环境？',
      name: 'NEIProxyTarget',
      choices: Object.keys(proxyTarget)
    };
    const { NEIProxyTarget } = await prompt(proxyTargetSelectQuestion);
    newConfig.theProxyTarget = proxyTarget[NEIProxyTarget]
  }
  if (newConfig.theProxyTarget !== oldTheProxyTarget || proxyURLChanged || forceUpdate) {
    removeProxyMock(app, oldUserConfig);
    const proxyTable = getProxyTable(); 
    setProxyMiddleware(app, proxyTable)
  }
}

function compareConfig(
  oldUserConfig: NeiMockConfig, 
  newUserConfig: NeiMockConfig, 
  useProxy: boolean | 'mix'
): [boolean, boolean?, ('reselect' | boolean)?] {
  if (useProxy === true) {
    const proxyURLChanged = isArrayChanged(oldUserConfig.proxyURL, newUserConfig.proxyURL);
    const proxyTargetChanged = isObjectChanged(oldUserConfig.proxyTarget, newUserConfig.proxyTarget);
    return [proxyURLChanged, proxyTargetChanged]
  }
  if (useProxy === 'mix') {
    const oldMix = oldUserConfig.mixedProxy;
    const newMix = oldUserConfig.mixedProxy;
    const mixedProxyChanged = !oldMix && !newMix
      ? false
      : !oldMix || !newMix
       ? true
       : isObjectChanged(oldMix, newMix)
    return [ mixedProxyChanged ]
  }
  const keyChanged = isKeyChanged(oldUserConfig.key, newUserConfig.key);
  const domainChanged = newUserConfig.domain !== oldUserConfig.domain;
  const localMockChanged = newUserConfig.localMockData !== oldUserConfig.localMockData;
  return [domainChanged, localMockChanged, keyChanged]
}

function isKeyChanged(k1: string | Record<string, string>, k2: string | Record<string, string>): boolean | 'reselect' {
  const k1type = typeof k1, k2type = typeof k2;
  if (k1type !== k2type) {
    return k2type === 'string' 
      ? k2 === oldKey 
        ? false
        : true
      : 'reselect';
  } else {
    if (k1type === 'string' && k2type === 'string') {
      return k1 === k2 ? false : true;
    } else {
      return isObjectChanged(k1 as Record<string, string>, k2 as Record<string, string>) 
        ? 'reselect': false;
    } 
  }
}

function isArrayChanged(arr1: string[], arr2: string[]) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) {
    return true;
  }

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  return !(arr1.every(item => set2.has(item)) && arr2.every(item => set1.has(item)))
}

function isObjectChanged(o1: Record<string, string>, o2: Record<string, string>) {
  if (isArrayChanged(Object.keys(o1), Object.keys(o2))) {
    return true;
  }
  for(const [k, v] of Object.entries(o1)) {
    if (o2[k] !== v) {
      return true;
    }
  }
  return false;
}