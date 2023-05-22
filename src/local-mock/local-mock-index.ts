import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import stripJsonComments from 'strip-json-comments';

import { getFilePath } from "./mockRouterMap.js";
import { Request, Response } from 'express';
import { Connect } from 'vite';
import { ServerResponse } from 'node:http';
import {neiConfig } from '../neiConfig.js';
import chalk from 'chalk';

export function initMockMiddleware(
  request: Request | Connect.IncomingMessage, 
  response: Response | ServerResponse, 
  next: () => void
) {
  const requestPath = getReqPath(request);
  const method = request.method?.toLowerCase() || '';
  const mockDataPath = getFilePath(requestPath, method)
  if (mockDataPath) {
    const newPath = resolveMockDataPath(mockDataPath);
    const content = readFile()(newPath);
    logToTerminal(newPath, requestPath, Boolean(content));
    if (content) {
      response
        .writeHead(200, { 'Content-Type': 'text/plain' })
        .end(stripJsonComments(content))
    } else {
      response
        .writeHead(404, { 'Content-Type': 'text/plain' })
        .end("接口数据未定义")
    }
  } else {
    next()
  }
}

let lastpath = '';
let pathRepeatCount = 0;
function logToTerminal(newPath: string, requestPath: string, contentExist: boolean) {
  const filePathLogger = contentExist ? chalk.green : chalk.red
  if (lastpath !== newPath) {
    console.log(`${chalk.blue(requestPath)} ⏩ ${filePathLogger(newPath + '.json')}`);
    lastpath = newPath;
    pathRepeatCount = 0;
  } else {
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
    console.log(
      chalk.blue(requestPath), 
      '⏩', 
      filePathLogger(newPath + '.json'),
      chalk.yellow('X', ++pathRepeatCount)
    );
  }
}

function getReqPath(req: { url?: string, path?: string}) {
  return req.path ? req.path : req.url ? req.url : '';
}

function readFile(extname?: string) {
  extname = extname || '.json'
  return (filePath: string) => {
    filePath += extname
    const exists = existsSync(filePath)
    if (exists) { 
      return readFileSync(filePath, 'utf-8')
    }
    return exists
  }
}

function resolveMockDataPath(filePath: string) {
  const mockDir = resolve(process.cwd(), neiConfig.userConfig.localMockData)
  if (filePath.indexOf('/') === 0) {
    filePath = filePath.slice(1, filePath.length)
  }
  return resolve(mockDir, filePath)
}
