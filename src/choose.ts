import inquirer, { DistinctQuestion } from 'inquirer';
import { Application } from 'express';
import { Connect } from 'vite';

import { initLocalMockData } from './local-mock/local-mock';
import { initMockMiddleware } from "./local-mock/local-mock-index.js";
import { getProxyTable } from './proxy-mock/proxy.config'
import { getNewNeiConfig } from './neiConfig';
import { getTheKey, setProxyMiddleware } from './utils';
import { startWatchMockFolder } from './watcher';
import neiOnlineMockMiddleware from "./nei-online/nei-online";

// 命令行配置
const firstQuestion: DistinctQuestion<{ neiOnline: 'false' | 'true'  }> = {
  type: 'list',
  message: '是否使用nei线上mock数据?',
  name: 'neiOnline',
  choices: ['false', 'true']
}
const secondQuestion: DistinctQuestion<{ useProxy: 'false' | 'true' | 'mixed'  }> = {
  type: 'list',
  message: '是否代理到测试/线上环境?',
  name: 'useProxy',
  choices: ['false', 'true', 'mixed']
}

export async function choose(app: Application | Connect.Server) {
  const neiConfig = getNewNeiConfig();
  const { userConfig } = neiConfig
  const { neiOnline } = await inquirer.prompt(firstQuestion)
  neiConfig.online = neiOnline;
  if (neiOnline === 'true') {
    neiConfig.theKey = typeof userConfig.key === 'string' 
      ? userConfig.key
      : await getTheKey(userConfig);
    app?.use(neiOnlineMockMiddleware)
  } else {
    const { useProxy } = await inquirer.prompt(secondQuestion)
    neiConfig.useProxy = useProxy;
    switch (useProxy) {
      case 'true': await useProxyMock(app, neiConfig); break;
      case 'false': await useLocalMock(app, neiConfig); break;
      case 'mixed': await useMixedMock(app, neiConfig); break;
    } 
  }
}

export async function useMixedMock(
  app: Application | Connect.Server, 
  neiConfig: ReturnType<typeof getNewNeiConfig>, 
) {
  await useLocalMock(app, neiConfig);
  const proxyTable = getProxyTable({ mixed: true });
  setProxyMiddleware(app, proxyTable);
}

async function useProxyMock(
  app: Application | Connect.Server, 
  neiConfig: ReturnType<typeof getNewNeiConfig>, 
) {
  // 代理到测试/线上环境
  const { proxyTarget } = neiConfig.userConfig
  if (typeof proxyTarget !== 'object') {
    console.log('error: proxyTargt is not configured correctly!');
    return;
  }
  const proxyTargetSelectQuestion: DistinctQuestion<{ NEIProxyTarget: string }> = {
    type: 'list',
    message: '代理到哪个环境？',
    name: 'NEIProxyTarget',
    choices: Object.keys(proxyTarget)
  };
  const { NEIProxyTarget } = await inquirer.prompt(proxyTargetSelectQuestion);
  neiConfig.theProxyTarget = proxyTarget[NEIProxyTarget]
  const proxyTable = getProxyTable();
  setProxyMiddleware(app, proxyTable)
}

const thirdQuestion: DistinctQuestion<{ forceCover: 'false' | 'true'  }> = {
  type: 'list',
  message: '是否覆盖本地mock数据?',
  name: 'forceCover',
  choices: ['false', 'true']
}
async function useLocalMock(
  app: Application | Connect.Server, 
  neiConfig: ReturnType<typeof getNewNeiConfig>, 
) {
  const { forceCover } = await inquirer.prompt(thirdQuestion);
  neiConfig.forceCover = forceCover;
  neiConfig.theKey = typeof neiConfig.userConfig.key === 'string' 
    ? neiConfig.userConfig.key
    : await getTheKey(neiConfig.userConfig);
  initLocalMockData();
  if((app as Application)._router) {
    app.use(initMockMiddleware)
  }
  if ((app as Connect.Server).stack) {
    app.stack.length > 0 
      ? app.stack.unshift({ route: '', handle: initMockMiddleware })
      : app.use(initMockMiddleware)
  }
  startWatchMockFolder(neiConfig.userConfig.localMockData);
}