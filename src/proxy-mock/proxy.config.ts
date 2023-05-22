import { createProxyMiddleware } from 'http-proxy-middleware';
import { neiConfig } from '../neiConfig';

const defaultProxyTarget = 'http://content.kaola.com';

export function getProxyTable(options?: { mixed?: boolean }) {
  if (options?.mixed) {
    return getMixedProxyTable()
  }
  const proxyTarget = neiConfig.theProxyTarget || defaultProxyTarget;
  const { proxyURL } = neiConfig.userConfig;
  if (!proxyURL || proxyURL.length <= 0) {
    throw new Error('please configure proxyURL correctly');
  }
  return proxyURL.map((item) => ({
    route: item,
    handle: createProxyMiddleware({
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
    })
  }));
}

export function getMixedProxyTable() {
  const { mixedProxy } = neiConfig.userConfig;
  if (!mixedProxy || Object.keys(mixedProxy).length === 0) {
    console.warn('🤖, detected 0 mixedProxy, you can set it up anytime you want');
    return [];
  } else {
    return Object.entries(mixedProxy).map(([route, target]) => ({
      route,
      handle: createProxyMiddleware({
        target,
        changeOrigin: true,
        secure: false,
      })
    }));;
  }
}
