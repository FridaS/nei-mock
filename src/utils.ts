import { Application } from 'express';
import { Connect } from 'vite';
import { getProxyTable } from './proxy-mock/proxy.config';
import { NeiMockConfig } from './types';
import inquirer, { DistinctQuestion } from 'inquirer';

export function setProxyMiddleware(
  app: Application | Connect.Server, 
  proxyTable: ReturnType<typeof getProxyTable>
) {
  if((app as Application)._router) {
    proxyTable.forEach(({ route, handle }) => (app as Application).use(route, handle));
  }
  if ((app as Connect.Server).stack) {
    app.stack.length > 0 
      ? proxyTable.forEach(({ route, handle }) => 
        (app as Connect.Server).stack.unshift({ route, handle: handle as Connect.NextHandleFunction })
      )
      : proxyTable.forEach(({ route, handle }) => 
        (app as Connect.Server).use(route, handle as Connect.NextHandleFunction)
      );
  }
}

export function removeOldMock(app: Application | Connect.Server, oldUserConfig: NeiMockConfig) {
  removeProxyMock(app, oldUserConfig);
  removeLocalMock(app);
  removeMixMock(app, oldUserConfig);
}

export function removeProxyMock(app: Application | Connect.Server, oldUserConfig: NeiMockConfig) {
  for (const url of oldUserConfig.proxyURL) {
    if (app.stack) {
      const middlewareIndex = app.stack.findIndex(({ route }) => route === url);
      app.stack.splice(middlewareIndex, 1);
    } else {
      const stack = (app as Application)._router.stack as { path: string }[];
      const middlewareIndex = stack.findIndex(({ path }) => path === url);
      (app as Application)._router.stack.splice(middlewareIndex, 1);
    }
  }
}

function removeLocalMock(app: Application | Connect.Server) {
  if (app.stack) {
    const middlewareIndex = (app as Connect.Server).stack.findIndex(({ route }) => route === '');
    app.stack.splice(middlewareIndex, 1);
  } else {
    const stack = (app as Application)._router.stack as {name: string}[];
    const middlewareIndex = stack.findIndex(({ name }) => name === 'initMockMiddleware');
    (app as Application)._router.stack.splice(middlewareIndex, 1);
  }
}

export function removeMixMock(app: Application | Connect.Server, oldUserConfig: NeiMockConfig) {
  if (!oldUserConfig.mixedProxy) {
    return ;
  }
  for (const url of Object.keys(oldUserConfig.mixedProxy)) {
    if (app.stack) {
      const middlewareIndex = app.stack.findIndex(({ route }) => route === url);
      app.stack.splice(middlewareIndex, 1);
    } else {
      const stack = (app as Application)._router.stack as { path: string }[];
      const middlewareIndex = stack.findIndex(({ path }) => path === url);
      (app as Application)._router.stack.splice(middlewareIndex, 1);
    }
  }
}

export async function getTheKey(userConfig: NeiMockConfig) {
  const projectSelectQuestion = {
    type: 'list',
    message: '选择哪个nei项目？',
    name: 'NEIProjectKey',
    choices: Object.keys(userConfig.key as Record<string, string>)
  } as DistinctQuestion<{ NEIProjectKey: string }>
  const { NEIProjectKey } = await inquirer.prompt(projectSelectQuestion);
  return (userConfig.key as Record<string, string>)[NEIProjectKey];
}