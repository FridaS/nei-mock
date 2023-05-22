import { resolve } from 'path';
import { NeiMockConfig } from './types';

export const neiConfig: { 
  userConfig: NeiMockConfig,
  theProxyTarget: string,
  theKey: string,
  online: 'true' | 'false';
  forceCover: 'true' | 'false',
  useProxy: 'true' | 'false' | 'mixed',
  firstGet?: true
} = {
  userConfig: {
    domain: '',
    key: '',
    localMockData: '',
    proxyTarget: {},
    proxyURL: [''],
    forceUpdate: false
  },
  theProxyTarget: '',
  theKey: '',
  online: 'false',
  useProxy: 'false',
  forceCover: 'false',
  firstGet: true,
};

export const getCurrentConfig = () => neiConfig;

export function getNewNeiConfig(option?: { changeHappend: boolean}) {
  if (neiConfig.firstGet || option?.changeHappend) {
    if (!neiConfig.firstGet) {
      delete require.cache[resolve(process.cwd(), `neiMockConfig.js`)]
    }
    neiConfig.userConfig = require(resolve(process.cwd(), `neiMockConfig.js`)) as NeiMockConfig;
    delete neiConfig.firstGet;
  }
  return neiConfig;
}