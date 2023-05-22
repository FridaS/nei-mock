import { Application } from 'express';
import { choose } from './choose.js';
import type { Plugin } from 'vite';
import { startWatchConfig } from './watcher.js';
import { NeiMockConfig } from './types/index.js';

export const neiMock = async (app: Application) => {
  startWatchConfig(app);
  console.log('choose');
  await choose(app);
};

export function vitePluginNeiMock(): Plugin {
  return {
    name: 'configure-server',
    async configureServer(server) {
      startWatchConfig(server.middlewares);
      await choose(server.middlewares);
    },
  }
}

export const createNeiMockConfig = (config: NeiMockConfig) => config;

