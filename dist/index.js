"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/nei-online/nei-online.js
var require_nei_online = __commonJS({
  "src/nei-online/nei-online.js"(exports, module2) {
    "use strict";
    var querystring = require("querystring");
    var path = require("path");
    var os2 = require("os");
    var async = require("async");
    var exec2 = require("child_process").exec;
    var globule2 = require("globule");
    var key2 = process.env.NEI_KEY;
    var serverDomainCMD2 = process.env.NEI_DOMAIN ? `-s ${process.env.NEI_DOMAIN}` : "";
    var neiBaseDir2 = path.resolve(os2.homedir(), "localMock", key2);
    var neiServerConfigFolder = path.resolve(neiBaseDir2, "./nei**");
    var lock = false;
    var reloadServerConfig = (cb) => {
      if (lock) {
        cb && cb(null);
        return;
      }
      lock = true;
      console.log("reload server config start");
      let configPathArr = globule2.find(neiServerConfigFolder);
      const neiBuild = `nei build -k ${key2} -o ${neiBaseDir2} ${serverDomainCMD2}`;
      const neiUpdate = `cd ~/localMock/${key2} && nei update ${serverDomainCMD2}`;
      const cmdStr = configPathArr && configPathArr.length ? neiUpdate : neiBuild;
      exec2(cmdStr, (error, stdout, stderr) => {
        if (error) {
          cb && cb(null);
          console.log("cmd exec error:", error);
          console.log("cmd exec stdout:", stdout);
          console.log("cmd exec stderr:", stderr);
          return;
        }
        console.log("reload success");
        lock = false;
        cb && cb(null);
      });
    };
    var initMockRouterReg2 = function(map) {
      var regMap = /* @__PURE__ */ new Map();
      for (var pathReg in map) {
        let url = pathReg.split(" ")[1];
        var content = map[pathReg];
        var pathInfo = {};
        pathInfo.method = pathReg.split(" ")[0].toLowerCase();
        pathInfo.id = content.id;
        regMap.set(url, pathInfo);
      }
      return regMap;
    };
    var existUrlAndGetId = (requestPath, method, isXhr) => {
      let configPathArr = globule2.find(neiServerConfigFolder);
      let neiServerConfig = path.resolve(configPathArr[0], "./server.config.js");
      let { routes } = require(neiServerConfig);
      let pathRegMap2 = initMockRouterReg2(routes);
      let existUrl = false;
      let id = null;
      pathRegMap2.forEach(function(pathInfo, url) {
        let limitMethod = pathInfo.method;
        if (url === requestPath) {
          existUrl = true;
          id = pathInfo.id;
          if (limitMethod && limitMethod !== method && isXhr) {
            existUrl = false;
          }
        }
      });
      return { existUrl, id };
    };
    var getFromNEISite = (requestPath, method, id, callback) => {
      let params = {
        path: requestPath,
        type: 3,
        // api代理：3，页面代理：1
        key: key2,
        id,
        method
      };
      const grabDataFrom = process.env.NEI_DOMAIN || "https://nei.netease.com";
      let url = grabDataFrom + "/api/mockdata?" + querystring.stringify(params);
      const httpProtocal = grabDataFrom.split("://")[0] === "https" ? require("https") : require("http");
      httpProtocal.get(url, function(res) {
        let ret = [];
        res.on("data", function(chunk) {
          ret.push(chunk.toString());
        });
        res.on("end", function() {
          let json = null;
          try {
            json = JSON.parse(ret.join(""));
          } catch (ex) {
          }
          if (json && json.code === 200) {
            if (json.result.error.length) {
              console.log(`\u9519\u8BEF: ${json.result.error.map((err) => err.message).join(", ")}`);
            }
            callback(json.result.json);
          } else {
            callback(ret.join(""));
          }
        });
      }).on("error", function(error) {
        callback(error.message);
      });
    };
    var neiOnlineMockMiddleware2 = (request, response, next) => {
      let requestPath = request.path;
      let method = request.method.toLowerCase();
      async.waterfall(
        [
          reloadServerConfig,
          // 实时获取nei线上接口信息
          (cb) => {
            let { existUrl, id } = existUrlAndGetId(requestPath, method, request.xhr);
            cb && cb(null, existUrl, id);
          },
          (existUrl, id, cb) => {
            if (existUrl) {
              getFromNEISite(requestPath, method, id, (json) => {
                if (json) {
                  response.status(200).json(json);
                } else {
                  var NO_FOUND_CODE = 404;
                  response.json(NO_FOUND_CODE, {
                    code: NO_FOUND_CODE,
                    msg: "\u63A5\u53E3\u6570\u636E\u672A\u5B9A\u4E49"
                  });
                }
              });
            } else {
              next();
            }
            cb && cb();
          }
        ],
        (err, results) => {
          if (err) {
            console.log("async series error:", err);
          }
        }
      );
    };
    module2.exports = neiOnlineMockMiddleware2;
  }
});

// src/index.ts
var src_exports = {};
__export(src_exports, {
  createNeiMockConfig: () => createNeiMockConfig,
  neiMock: () => neiMock,
  vitePluginNeiMock: () => vitePluginNeiMock
});
module.exports = __toCommonJS(src_exports);

// src/choose.ts
var import_inquirer3 = __toESM(require("inquirer"));

// src/local-mock/local-mock.ts
var import_fs2 = require("fs");
var import_path3 = require("path");
var import_os = __toESM(require("os"));
var import_globule = __toESM(require("globule"));
var import_rimraf = require("rimraf");
var import_child_process = require("child_process");
var import_async = require("async");

// src/neiConfig.ts
var import_path = require("path");
var neiConfig = {
  userConfig: {
    domain: "",
    key: "",
    localMockData: "",
    proxyTarget: {},
    proxyURL: [""],
    forceUpdate: false
  },
  theProxyTarget: "",
  theKey: "",
  online: "false",
  useProxy: "false",
  forceCover: "false",
  firstGet: true
};
var getCurrentConfig = () => neiConfig;
function getNewNeiConfig(option) {
  if (neiConfig.firstGet || option?.changeHappend) {
    if (!neiConfig.firstGet) {
      delete require.cache[(0, import_path.resolve)(process.cwd(), `neiMockConfig.js`)];
    }
    neiConfig.userConfig = require((0, import_path.resolve)(process.cwd(), `neiMockConfig.js`));
    delete neiConfig.firstGet;
  }
  return neiConfig;
}

// src/local-mock/mockRouterMap.ts
var import_path_to_regexp = require("path-to-regexp");
var import_fs = require("fs");
var import_path2 = require("path");
var MOCK_DATA_DIR = "./data";
var ROUTE_MAP = "./routeMap.json";
var pathRegMap = /* @__PURE__ */ new Map();
function getFilePath(requestPath, method, isXhr) {
  let filePath = false;
  pathRegMap.forEach((pathInfo, urlReg) => {
    const limitMethod = pathInfo.method;
    if (urlReg.test(requestPath)) {
      filePath = pathInfo.mockFile;
      if (limitMethod && limitMethod !== method && isXhr) {
        filePath = false;
      }
    }
  });
  return filePath;
}
function initMockRouterReg(localMockData) {
  const routeMapPath2 = (0, import_path2.resolve)(process.cwd(), localMockData, ROUTE_MAP);
  if (!fsExistsSync(routeMapPath2)) {
    (0, import_fs.writeFileSync)(routeMapPath2, "{}");
  }
  const routeMap2 = JSON.parse((0, import_fs.readFileSync)(routeMapPath2, "utf-8"));
  Object.entries(routeMap2).forEach(([reqPathReg, filePath]) => {
    const [key0, key1] = reqPathReg.split(/\s/);
    const pathInfo = {
      method: key1 ? key0 : "",
      mockFile: MOCK_DATA_DIR + filePath
    };
    const urlReg = key1 ? key1 : key0;
    pathRegMap.set((0, import_path_to_regexp.pathToRegexp)(urlReg), pathInfo);
  });
}

// src/local-mock/local-mock.ts
var serverDomainCMD = "";
var key = "";
var keyNameArr = [];
var neiBaseDir = "";
var routeMapPath = "";
var copyTarget = "";
function initLocalMockData() {
  const neiConfig2 = getNewNeiConfig();
  const { userConfig } = neiConfig2;
  serverDomainCMD = userConfig.domain ? `-s ${userConfig.domain}` : "";
  if (typeof userConfig.key === "string") {
    key = userConfig.key;
  } else {
    keyNameArr = Object.keys(userConfig.key);
    key = neiConfig2.theKey || userConfig.key[keyNameArr[0]];
  }
  neiBaseDir = (0, import_path3.resolve)(import_os.default.homedir(), "localMock", key);
  makeMockFolder(userConfig.localMockData);
  if (neiConfig2.forceCover === "true") {
    hardUpdate();
  } else {
    softUpdate();
  }
}
function hardUpdate() {
  (0, import_async.series)(
    [
      removeLocalMock,
      // 删除 ~/localMock/${key}文件
      removeProjectMockData,
      // 删除本工程mock/data下的文件
      removeMockMap,
      // 删除工程routeMap.json文件
      softUpdate
      // 重新拉取
    ],
    (err, _results) => {
      if (err) {
        console.log("async series error:", err);
      }
    }
  );
}
function softUpdate(cb) {
  const neiServerConfig = (0, import_path3.resolve)(neiBaseDir, "./nei**");
  let configPathArr = import_globule.default.find(neiServerConfig);
  const neiBuild = `nei build -k ${key} -o ${neiBaseDir} ${serverDomainCMD}`;
  const neiUpdate = `cd ~/localMock/${key} && nei update ${serverDomainCMD}`;
  const cmdStr = configPathArr.length ? neiUpdate : neiBuild;
  console.log("nei exec start:", cmdStr);
  (0, import_child_process.exec)(cmdStr, (error, stdout, stderr) => {
    console.log("nei exec end");
    if (error) {
      cb && cb("cmd exec error");
      console.log("cmd exec error:", error);
      console.log("cmd exec stdout:", stdout);
      console.log("cmd exec stderr:", stderr);
      return;
    }
    !configPathArr[0] && (configPathArr = import_globule.default.find(neiServerConfig));
    routeMap(configPathArr[0]);
    createMockData(neiBaseDir);
    cb && cb();
  });
}
function routeMap(folderPath) {
  const sourcePath = (0, import_path3.resolve)(folderPath, "./server.config.js");
  const { routes } = require(sourcePath);
  const pureRoutes = formatRoutes(routes);
  let tarPathContent = {};
  try {
    tarPathContent = JSON.parse((0, import_fs2.readFileSync)(routeMapPath, "utf-8"));
    console.log("update routeMap.js");
  } catch (e) {
    console.log("create routeMap.js");
  }
  tarPathContent = { ...tarPathContent, ...pureRoutes };
  (0, import_fs2.writeFileSync)(
    routeMapPath,
    JSON.stringify(tarPathContent, null, 2)
  );
  console.log("update route map: success");
  const { localMockData } = getCurrentConfig().userConfig;
  initMockRouterReg(localMockData);
}
function createMockData(neiBaseDir2) {
  const copySrcGET = (0, import_path3.join)(neiBaseDir2, "./mock/get");
  const copySrcPOST = (0, import_path3.join)(neiBaseDir2, "./mock/post");
  copyFolder(copySrcGET, copyTarget, (error) => {
    if (error) {
      console.log("copy get error:", error);
      return;
    }
  });
  copyFolder(copySrcPOST, copyTarget, (error) => {
    if (error) {
      console.log("copy post error:", error);
      return;
    }
  });
}
function removeLocalMock(cb) {
  console.log("remove localMock start:", neiBaseDir);
  (0, import_rimraf.rimraf)(neiBaseDir).catch((error) => {
    if (error) {
      cb && cb("remove localMock error");
      console.log("remove localMock error:", error);
      return;
    }
  });
  console.log("remove localMock end");
  cb && cb();
}
function removeProjectMockData(cb) {
  console.log("remove project mock data start");
  (0, import_fs2.readdir)(copyTarget, (error, files) => {
    if (error) {
      cb && cb("remove project mock data readdir error");
      console.log("readdir error:", error);
      return;
    }
    if (files.length === 0) {
      console.log("project mock data is empty");
      return;
    }
    files.forEach((file) => {
      const theFolder = (0, import_path3.join)(copyTarget, file);
      (0, import_rimraf.rimraf)(theFolder).catch((error2) => {
        if (error2) {
          cb && cb("remove project mock data error");
          console.log("remove project mock data error:", error2);
          return;
        }
      });
    });
    console.log("remove project mock data end");
    cb && cb();
  });
}
function removeMockMap(cb) {
  console.log("remove project mockMap start");
  (0, import_rimraf.rimraf)(routeMapPath).catch((error) => {
    if (error) {
      cb && cb("remove mockMap error");
      console.log("remove mockMap error:", error);
      return;
    }
    console.log("remove mockMap end");
    cb && cb();
  });
}
function copyFolder(sourceDir, targetDir, cb) {
  (0, import_fs2.readdir)(sourceDir, (error, files) => {
    if (error) {
      console.log("readdir error:", error);
      cb && cb(error);
      return;
    }
    if (files.length === 0) {
      cb && cb(new Error("files is empty"));
    }
    let hasPeerFolder = false;
    files.forEach((file) => {
      const sourcePath = (0, import_path3.join)(sourceDir, file);
      (0, import_fs2.stat)(sourcePath, (error2, sourceStat) => {
        if (error2) {
          console.log("stat error:", error2);
          return;
        }
        if (sourceStat.isDirectory()) {
          const targetPath = (0, import_path3.join)(targetDir, file);
          hasPeerFolder = true;
          console.log("mkdir:", targetPath);
          (0, import_fs2.mkdir)(targetPath, (error3) => {
            if (error3 && error3.code !== "EEXIST") {
              console.log("mrdir error:", error3);
              return;
            }
            copyFolder(sourcePath, targetPath, cb);
          });
        } else if (file === "data.json") {
          const newTarget = targetDir + ".json";
          if (!fsExistsSync(newTarget)) {
            copyFile(sourcePath, newTarget, cb);
          } else {
            console.log("file exist:", newTarget);
          }
          if (hasPeerFolder) {
            return;
          }
          (0, import_rimraf.rimraf)(targetDir).catch((e) => console.log("rmdir error:", e));
        }
      });
    });
  });
}
function fsExistsSync(path) {
  try {
    (0, import_fs2.accessSync)(path, import_fs2.constants.F_OK);
  } catch (e) {
    return false;
  }
  return true;
}
function copyFile(src, target, cb) {
  console.log("file update:", target);
  let rs = (0, import_fs2.createReadStream)(src);
  rs.on("error", (error) => {
    if (error) {
      console.log("file read error:", src);
    }
    cb && cb(error);
  });
  let ws = (0, import_fs2.createWriteStream)(target);
  ws.on("error", (error) => {
    if (error) {
      console.log("file write error:", target);
    }
    cb && cb(error);
  });
  ws.on("close", () => {
    cb && cb();
  });
  rs.pipe(ws);
}
function formatRoutes(routes) {
  return Object.keys(routes).reduce((acc, curr) => ({
    ...acc,
    [curr]: curr.split(" ")[1]
  }), {});
}
function makeMockFolder(foldername) {
  (0, import_fs2.mkdir)((0, import_path3.resolve)(process.cwd(), foldername), (e) => {
    if (e && e.code !== "EEXIST") {
      throw e;
    }
  });
  routeMapPath = (0, import_path3.resolve)(process.cwd(), foldername, "./routeMap.json");
  if (!fsExistsSync(routeMapPath)) {
    (0, import_fs2.writeFileSync)(routeMapPath, "{}");
  }
  copyTarget = (0, import_path3.resolve)(process.cwd(), foldername + "/data");
  (0, import_fs2.mkdir)(copyTarget, (e) => {
    if (e && e.code !== "EEXIST") {
      throw e;
    }
  });
}

// src/local-mock/local-mock-index.ts
var import_fs3 = require("fs");
var import_path4 = require("path");
var import_strip_json_comments = __toESM(require("strip-json-comments"));
var import_chalk = __toESM(require("chalk"));
function initMockMiddleware(request, response, next) {
  const requestPath = getReqPath(request);
  const method = request.method?.toLowerCase() || "";
  const mockDataPath = getFilePath(requestPath, method);
  if (mockDataPath) {
    const newPath = resolveMockDataPath(mockDataPath);
    const content = readFile()(newPath);
    logToTerminal(newPath, requestPath, Boolean(content));
    if (content) {
      response.writeHead(200, { "Content-Type": "text/plain" }).end((0, import_strip_json_comments.default)(content));
    } else {
      response.writeHead(404, { "Content-Type": "text/plain" }).end("\u63A5\u53E3\u6570\u636E\u672A\u5B9A\u4E49");
    }
  } else {
    next();
  }
}
var lastpath = "";
var pathRepeatCount = 0;
function logToTerminal(newPath, requestPath, contentExist) {
  const filePathLogger = contentExist ? import_chalk.default.green : import_chalk.default.red;
  if (lastpath !== newPath) {
    console.log(`${import_chalk.default.blue(requestPath)} \u23E9 ${filePathLogger(newPath + ".json")}`);
    lastpath = newPath;
    pathRepeatCount = 0;
  } else {
    process.stdout.moveCursor(0, -1);
    process.stdout.clearLine(1);
    console.log(
      import_chalk.default.blue(requestPath),
      "\u23E9",
      filePathLogger(newPath + ".json"),
      import_chalk.default.yellow("X", ++pathRepeatCount)
    );
  }
}
function getReqPath(req) {
  return req.path ? req.path : req.url ? req.url : "";
}
function readFile(extname) {
  extname = extname || ".json";
  return (filePath) => {
    filePath += extname;
    const exists = (0, import_fs3.existsSync)(filePath);
    if (exists) {
      return (0, import_fs3.readFileSync)(filePath, "utf-8");
    }
    return exists;
  };
}
function resolveMockDataPath(filePath) {
  const mockDir = (0, import_path4.resolve)(process.cwd(), neiConfig.userConfig.localMockData);
  if (filePath.indexOf("/") === 0) {
    filePath = filePath.slice(1, filePath.length);
  }
  return (0, import_path4.resolve)(mockDir, filePath);
}

// src/proxy-mock/proxy.config.ts
var import_http_proxy_middleware = require("http-proxy-middleware");
var defaultProxyTarget = "http://content.kaola.com";
function getProxyTable(options) {
  if (options?.mixed) {
    return getMixedProxyTable();
  }
  const proxyTarget = neiConfig.theProxyTarget || defaultProxyTarget;
  const { proxyURL } = neiConfig.userConfig;
  if (!proxyURL || proxyURL.length <= 0) {
    throw new Error("please configure proxyURL correctly");
  }
  return proxyURL.map((item) => ({
    route: item,
    handle: (0, import_http_proxy_middleware.createProxyMiddleware)({
      target: proxyTarget,
      changeOrigin: true,
      secure: false
    })
  }));
}
function getMixedProxyTable() {
  const { mixedProxy } = neiConfig.userConfig;
  if (!mixedProxy || Object.keys(mixedProxy).length === 0) {
    console.warn("\u{1F916}, detected 0 mixedProxy, you can set it up anytime you want");
    return [];
  } else {
    return Object.entries(mixedProxy).map(([route, target]) => ({
      route,
      handle: (0, import_http_proxy_middleware.createProxyMiddleware)({
        target,
        changeOrigin: true,
        secure: false
      })
    }));
    ;
  }
}

// src/utils.ts
var import_inquirer = __toESM(require("inquirer"));
function setProxyMiddleware(app, proxyTable) {
  if (app._router) {
    proxyTable.forEach(({ route, handle }) => app.use(route, handle));
  }
  if (app.stack) {
    app.stack.length > 0 ? proxyTable.forEach(
      ({ route, handle }) => app.stack.unshift({ route, handle })
    ) : proxyTable.forEach(
      ({ route, handle }) => app.use(route, handle)
    );
  }
}
function removeOldMock(app, oldUserConfig2) {
  removeProxyMock(app, oldUserConfig2);
  removeLocalMock2(app);
  removeMixMock(app, oldUserConfig2);
}
function removeProxyMock(app, oldUserConfig2) {
  for (const url of oldUserConfig2.proxyURL) {
    if (app.stack) {
      const middlewareIndex = app.stack.findIndex(({ route }) => route === url);
      app.stack.splice(middlewareIndex, 1);
    } else {
      const stack = app._router.stack;
      const middlewareIndex = stack.findIndex(({ path }) => path === url);
      app._router.stack.splice(middlewareIndex, 1);
    }
  }
}
function removeLocalMock2(app) {
  if (app.stack) {
    const middlewareIndex = app.stack.findIndex(({ route }) => route === "");
    app.stack.splice(middlewareIndex, 1);
  } else {
    const stack = app._router.stack;
    const middlewareIndex = stack.findIndex(({ name }) => name === "initMockMiddleware");
    app._router.stack.splice(middlewareIndex, 1);
  }
}
function removeMixMock(app, oldUserConfig2) {
  if (!oldUserConfig2.mixedProxy) {
    return;
  }
  for (const url of Object.keys(oldUserConfig2.mixedProxy)) {
    if (app.stack) {
      const middlewareIndex = app.stack.findIndex(({ route }) => route === url);
      app.stack.splice(middlewareIndex, 1);
    } else {
      const stack = app._router.stack;
      const middlewareIndex = stack.findIndex(({ path }) => path === url);
      app._router.stack.splice(middlewareIndex, 1);
    }
  }
}
async function getTheKey(userConfig) {
  const projectSelectQuestion = {
    type: "list",
    message: "\u9009\u62E9\u54EA\u4E2Anei\u9879\u76EE\uFF1F",
    name: "NEIProjectKey",
    choices: Object.keys(userConfig.key)
  };
  const { NEIProjectKey } = await import_inquirer.default.prompt(projectSelectQuestion);
  return userConfig.key[NEIProjectKey];
}

// src/watcher.ts
var import_chokidar = require("chokidar");
var import_path5 = require("path");
var import_chalk2 = __toESM(require("chalk"));
var import_inquirer2 = require("inquirer");
var oldUserConfig;
var oldTheProxyTarget;
var oldKey;
var oldUseProxy;
function startWatchConfig(app) {
  (0, import_chokidar.watch)((0, import_path5.resolve)(process.cwd(), "neiMockConfig.js")).on("change", () => {
    console.log("\u2728,", import_chalk2.default.blue("detected neiMockConfig.js change"));
    const oldConfig = getCurrentConfig();
    oldKey = oldConfig.theKey;
    oldTheProxyTarget = oldConfig.theProxyTarget;
    oldUserConfig = oldConfig.userConfig;
    oldUseProxy = oldConfig.useProxy;
    const newConfig = getNewNeiConfig({ changeHappend: true });
    if (newConfig.userConfig.forceUpdate === "re-select") {
      return reStartNeiMock(app);
    }
    switch (oldUseProxy) {
      case "true":
        proxyChange(newConfig, app);
        break;
      case "false":
        localChange(newConfig, app);
        break;
      case "mixed":
        mixChange(newConfig, app);
        break;
    }
  });
}
var mockDirWatcher;
function startWatchMockFolder(mockDir) {
  if (mockDirWatcher) {
    return;
  }
  mockDirWatcher = (0, import_chokidar.watch)((0, import_path5.resolve)(process.cwd(), mockDir));
  mockDirWatcher.on("change", (path) => {
    if (path === (0, import_path5.resolve)(process.cwd(), mockDir, "routeMap.json")) {
      initMockRouterReg(mockDir);
    }
    console.log("\u2728,", import_chalk2.default.blue("detected localMockFile change, change applied!"));
  });
}
function reStartNeiMock(app) {
  removeOldMock(app, oldUserConfig);
  choose(app);
}
async function mixChange(newConfig, app) {
  localChange(newConfig, app);
  removeMixMock(app, oldUserConfig);
  const { forceUpdate } = newConfig.userConfig;
  const [mixedProxyChanged] = compareConfig(oldUserConfig, newConfig.userConfig, "mix");
  if (mixedProxyChanged || forceUpdate) {
    const proxyTable = getProxyTable();
    setProxyMiddleware(app, proxyTable);
  }
}
async function localChange(newConfig, app) {
  const { key: key2, forceUpdate } = newConfig.userConfig;
  const [domainChanged, localMockChanged, keyChanged] = compareConfig(oldUserConfig, newConfig.userConfig, false);
  if (keyChanged === "reselect" || typeof key2 === "object" && forceUpdate) {
    newConfig.theKey = await getTheKey(newConfig.userConfig);
  } else if (keyChanged === true && typeof key2 === "string") {
    newConfig.theKey = key2;
  }
  if (domainChanged || localMockChanged || oldKey !== newConfig.theKey || forceUpdate) {
    initLocalMockData();
  }
}
async function proxyChange(newConfig, app) {
  const { forceUpdate, proxyTarget } = newConfig.userConfig;
  const [proxyURLChanged, proxyTargetChanged] = compareConfig(oldUserConfig, newConfig.userConfig, true);
  if (proxyTargetChanged || forceUpdate) {
    const proxyTargetSelectQuestion = {
      type: "list",
      message: "\u4EE3\u7406\u5230\u54EA\u4E2A\u73AF\u5883\uFF1F",
      name: "NEIProxyTarget",
      choices: Object.keys(proxyTarget)
    };
    const { NEIProxyTarget } = await (0, import_inquirer2.prompt)(proxyTargetSelectQuestion);
    newConfig.theProxyTarget = proxyTarget[NEIProxyTarget];
  }
  if (newConfig.theProxyTarget !== oldTheProxyTarget || proxyURLChanged || forceUpdate) {
    removeProxyMock(app, oldUserConfig);
    const proxyTable = getProxyTable();
    setProxyMiddleware(app, proxyTable);
  }
}
function compareConfig(oldUserConfig2, newUserConfig, useProxy) {
  if (useProxy === true) {
    const proxyURLChanged = isArrayChanged(oldUserConfig2.proxyURL, newUserConfig.proxyURL);
    const proxyTargetChanged = isObjectChanged(oldUserConfig2.proxyTarget, newUserConfig.proxyTarget);
    return [proxyURLChanged, proxyTargetChanged];
  }
  if (useProxy === "mix") {
    const oldMix = oldUserConfig2.mixedProxy;
    const newMix = oldUserConfig2.mixedProxy;
    const mixedProxyChanged = !oldMix && !newMix ? false : !oldMix || !newMix ? true : isObjectChanged(oldMix, newMix);
    return [mixedProxyChanged];
  }
  const keyChanged = isKeyChanged(oldUserConfig2.key, newUserConfig.key);
  const domainChanged = newUserConfig.domain !== oldUserConfig2.domain;
  const localMockChanged = newUserConfig.localMockData !== oldUserConfig2.localMockData;
  return [domainChanged, localMockChanged, keyChanged];
}
function isKeyChanged(k1, k2) {
  const k1type = typeof k1, k2type = typeof k2;
  if (k1type !== k2type) {
    return k2type === "string" ? k2 === oldKey ? false : true : "reselect";
  } else {
    if (k1type === "string" && k2type === "string") {
      return k1 === k2 ? false : true;
    } else {
      return isObjectChanged(k1, k2) ? "reselect" : false;
    }
  }
}
function isArrayChanged(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) {
    return true;
  }
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  return !(arr1.every((item) => set2.has(item)) && arr2.every((item) => set1.has(item)));
}
function isObjectChanged(o1, o2) {
  if (isArrayChanged(Object.keys(o1), Object.keys(o2))) {
    return true;
  }
  for (const [k, v] of Object.entries(o1)) {
    if (o2[k] !== v) {
      return true;
    }
  }
  return false;
}

// src/choose.ts
var import_nei_online = __toESM(require_nei_online());
var firstQuestion = {
  type: "list",
  message: "\u662F\u5426\u4F7F\u7528nei\u7EBF\u4E0Amock\u6570\u636E?",
  name: "neiOnline",
  choices: ["false", "true"]
};
var secondQuestion = {
  type: "list",
  message: "\u662F\u5426\u4EE3\u7406\u5230\u6D4B\u8BD5/\u7EBF\u4E0A\u73AF\u5883?",
  name: "useProxy",
  choices: ["false", "true", "mixed"]
};
async function choose(app) {
  const neiConfig2 = getNewNeiConfig();
  const { userConfig } = neiConfig2;
  const { neiOnline } = await import_inquirer3.default.prompt(firstQuestion);
  neiConfig2.online = neiOnline;
  if (neiOnline === "true") {
    neiConfig2.theKey = typeof userConfig.key === "string" ? userConfig.key : await getTheKey(userConfig);
    app?.use(import_nei_online.default);
  } else {
    const { useProxy } = await import_inquirer3.default.prompt(secondQuestion);
    neiConfig2.useProxy = useProxy;
    switch (useProxy) {
      case "true":
        await useProxyMock(app, neiConfig2);
        break;
      case "false":
        await useLocalMock(app, neiConfig2);
        break;
      case "mixed":
        await useMixedMock(app, neiConfig2);
        break;
    }
  }
}
async function useMixedMock(app, neiConfig2) {
  await useLocalMock(app, neiConfig2);
  const proxyTable = getProxyTable({ mixed: true });
  setProxyMiddleware(app, proxyTable);
}
async function useProxyMock(app, neiConfig2) {
  const { proxyTarget } = neiConfig2.userConfig;
  if (typeof proxyTarget !== "object") {
    console.log("error: proxyTargt is not configured correctly!");
    return;
  }
  const proxyTargetSelectQuestion = {
    type: "list",
    message: "\u4EE3\u7406\u5230\u54EA\u4E2A\u73AF\u5883\uFF1F",
    name: "NEIProxyTarget",
    choices: Object.keys(proxyTarget)
  };
  const { NEIProxyTarget } = await import_inquirer3.default.prompt(proxyTargetSelectQuestion);
  neiConfig2.theProxyTarget = proxyTarget[NEIProxyTarget];
  const proxyTable = getProxyTable();
  setProxyMiddleware(app, proxyTable);
}
var thirdQuestion = {
  type: "list",
  message: "\u662F\u5426\u8986\u76D6\u672C\u5730mock\u6570\u636E?",
  name: "forceCover",
  choices: ["false", "true"]
};
async function useLocalMock(app, neiConfig2) {
  const { forceCover } = await import_inquirer3.default.prompt(thirdQuestion);
  neiConfig2.forceCover = forceCover;
  neiConfig2.theKey = typeof neiConfig2.userConfig.key === "string" ? neiConfig2.userConfig.key : await getTheKey(neiConfig2.userConfig);
  initLocalMockData();
  if (app._router) {
    app.use(initMockMiddleware);
  }
  if (app.stack) {
    app.stack.length > 0 ? app.stack.unshift({ route: "", handle: initMockMiddleware }) : app.use(initMockMiddleware);
  }
  startWatchMockFolder(neiConfig2.userConfig.localMockData);
}

// src/index.ts
var neiMock = async (app) => {
  startWatchConfig(app);
  console.log("choose");
  await choose(app);
};
function vitePluginNeiMock() {
  return {
    name: "configure-server",
    async configureServer(server) {
      startWatchConfig(server.middlewares);
      await choose(server.middlewares);
    }
  };
}
var createNeiMockConfig = (config) => config;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createNeiMockConfig,
  neiMock,
  vitePluginNeiMock
});
