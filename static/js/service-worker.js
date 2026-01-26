/**
 * QBin Progressive Web App - Service Worker
 */

// 定义PWA版本号 - 更新此处以触发更新
const CACHE_VERSION = 'v2.16';

// 缓存配置
const CACHE_SETTINGS = {
  // 设置为true可触发完全清理缓存（用于重大更新或修复异常情况）
  clearCaches: false,
  // 自动更新开关
  autoUpdate: true,
  // 调试日志
  debug: false,
  // 过期时间（单位：天）
  expiration: {
    static: 30,
    dynamic: 7,
    cdn: 90
  }
};

// 缓存名称
const CACHE_NAMES = {
  static: `qbin-static-${CACHE_VERSION}`,
  dynamic: `qbin-dynamic-${CACHE_VERSION}`,
  cdn: `qbin-cdn-v${CACHE_VERSION.replace('v', '').split('.')[0]}` // 仅使用主版本号
};

// 资源分类
const RESOURCES = {
  // 静态资源
  static: [
    '/favicon.ico',
    '/manifest.json',
    '/pwa-loader',
    '/home',
    '/document',
  ],
  // 页面模板
  templates: ['/e', '/c', '/m', '/p'],
  // CDN资源
  cdn: [
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/',
    'https://cdn.jsdelivr.net/npm/cherry-markdown@0.10.0/dist/',
    'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/',
    'https://cdn.jsdelivr.net/npm/echarts@4.6.0/dist/',
    'https://cdn.jsdelivr.net/npm/mermaid@10.3.1/dist/',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
    'https://api.dicebear.com/9.x/',
  ],
  // 关键CDN资源（预缓存）
  criticalCdn: [
    'https://cdn.jsdelivr.net/npm/cherry-markdown@0.10.0/dist/cherry-markdown.core.js',
    'https://cdn.jsdelivr.net/npm/cherry-markdown@0.10.0/dist/cherry-markdown.min.css',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/loader.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/editor/editor.main.css',
  ]
};

// 日志函数
const logger = {
  log: CACHE_SETTINGS.debug ? console.log.bind(console, '[SW]') : () => {},
  warn: console.warn.bind(console, '[SW]'),
  error: console.error.bind(console, '[SW]')
};

/**
 * 安装事件处理 - 初始化缓存并预缓存关键资源
 */
self.addEventListener('install', event => {
  logger.log('安装事件触发，版本:', CACHE_VERSION);
  
  // 如果开启了自动更新模式，就跳过等待阶段直接激活
  if (CACHE_SETTINGS.autoUpdate) {
    self.skipWaiting();
    logger.log('自动更新模式已启用，跳过等待阶段');
  }

  event.waitUntil(
    cacheInitialization()
      .then(() => {
        logger.log('缓存初始化完成，版本:', CACHE_VERSION);
        return self.skipWaiting();
      })
      .catch(err => {
        logger.error('缓存初始化失败:', err);
        return self.skipWaiting();
      })
  );
});

/**
 * 缓存初始化 - 创建缓存并预缓存关键资源
 */
async function cacheInitialization() {
  try {
    const staticCache = await caches.open(CACHE_NAMES.static);
    
    // 预缓存静态资源和模板
    await Promise.all([
      cacheResources(staticCache, RESOURCES.static),
      cacheResources(staticCache, RESOURCES.templates),
      caches.open(CACHE_NAMES.dynamic),
      caches.open(CACHE_NAMES.cdn),
      cacheCriticalCdnResources()
    ]);
    
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * 缓存资源列表
 */
async function cacheResources(cache, resources) {
  const fetchPromises = resources.map(async (resource) => {
    try {
      const response = await fetch(resource);
      if (response.status === 200) {
        return cache.put(resource, response);
      }
    } catch (err) {
      logger.warn(`资源缓存失败: ${resource}`, err);
    }
    return Promise.resolve();
  });
  
  return Promise.all(fetchPromises);
}

/**
 * 预缓存关键CDN资源
 */
async function cacheCriticalCdnResources() {
  try {
    const cdnCache = await caches.open(CACHE_NAMES.cdn);
    
    const fetchPromises = RESOURCES.criticalCdn.map(async url => {
      try {
        const request = new Request(url, { mode: 'cors', credentials: 'omit' });
        const cachedResponse = await cdnCache.match(request);

        if (!cachedResponse) {
          logger.log(`预缓存CDN资源: ${url}`);
          const response = await fetch(request);
          if (response && response.ok) {
            await cdnCache.put(request, response);
          }
        }
        return true;
      } catch (err) {
        logger.warn(`预缓存CDN资源失败: ${url}`, err);
        return false;
      }
    });
    
    await Promise.all(fetchPromises);
    return Promise.resolve();
  } catch (err) {
    logger.warn('预缓存CDN资源过程失败:', err);
    return Promise.resolve();
  }
}

/**
 * 请求拦截处理
 */
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // 仅处理GET请求
  if (request.method !== 'GET') return;

  // 跳过敏感资源和授权请求
  if (['.pem', '.key', '.cert'].some(ext => url.pathname.includes(ext))) return;
  if (['token=', 'auth=', 'key='].some(param => url.search.includes(param))) return;

  try {
    // CDN或跨域资源处理
    if (url.origin !== self.location.origin) {
      if(isCdnResource(request.url)) event.respondWith(handleCdnRequest(request));
      return;
    }

    const path = url.pathname;

    // 处理根路径和模板路径
    if (path === '/' || isPageTemplate(path)) {
      event.respondWith(handleTemplateRoutes(request));
      return;
    }

    // 处理静态资源
    if (isStaticResource(path)) {
      event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.static));
    }
    // else if (isRealtimeResource(path)) {
    //   event.respondWith(networkFirstStrategy(request, CACHE_NAMES.dynamic));
    // } else {
    //   event.respondWith(networkFirstStrategy(request, CACHE_NAMES.dynamic));
    // }
  } catch (err) {
    logger.error('缓存策略处理错误:', err);
  }
});

/**
 * 缓存优先策略 - 适用于静态资源和页面模板
 */
async function cacheFirstStrategy(request, cacheName) {
  logger.log(`缓存优先策略: ${request.url}`);

  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    logger.log(`返回缓存: ${request.url}`);
    return cachedResponse;
  }

  try {
    logger.log(`从网络获取: ${request.url}`);
    const response = await fetch(request);

    if (response.ok) {
      const clonedResponse = response.clone();
      await cache.put(request, clonedResponse);
    }

    return response;
  } catch (err) {
    logger.warn(`网络请求失败: ${request.url}`, err);
    
    // 再次检查缓存
    const recheck = await cache.match(request);
    if (recheck) return recheck;

    return createErrorResponse('无法加载资源');
  }
}

/**
 * 处理CDN请求 - Stale While Revalidate模式
 */
async function handleCdnRequest(request) {
  logger.log(`处理CDN请求: ${request.url}`);
  
  const cdnRequest = new Request(request.url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-cache'
  });

  const cache = await caches.open(CACHE_NAMES.cdn);
  const cachedResponse = await cache.match(cdnRequest);

  // 后台更新缓存
  const backgroundUpdate = (async () => {
    try {
      // 如果有缓存，尝试验证并更新
      if (cachedResponse) {
        const response = await fetch(cdnRequest);
        if (response.ok) {
          await cache.put(cdnRequest, response);
        }
      } 
      // 无缓存，直接获取并缓存
      else {
        const response = await fetch(cdnRequest);
        if (response.ok) {
          const enhancedResponse = new Response(response.clone().body, {
            status: response.status,
            statusText: response.statusText,
            headers: addDateHeader(response.headers)
          });
          await cache.put(cdnRequest, enhancedResponse);
        }
      }
    } catch (err) {
      logger.warn(`CDN资源后台更新失败: ${cdnRequest.url}`, err);
    }
  })();

  // 有缓存直接返回
  if (cachedResponse) {
    backgroundUpdate.catch(err => logger.warn(`CDN后台更新错误: ${cdnRequest.url}`, err));
    return cachedResponse;
  }

  // 无缓存从网络获取
  try {
    const networkResponse = await fetch(cdnRequest);
    await backgroundUpdate;

    if (networkResponse.ok) {
      return networkResponse;
    } else {
      return createErrorResponse('CDN资源加载失败', networkResponse.status);
    }
  } catch (err) {
    logger.warn(`CDN资源获取失败: ${cdnRequest.url}`, err);
    
    // 再次尝试从缓存获取
    const recheckCache = await cache.match(cdnRequest);
    if (recheckCache) return recheckCache;

    return createErrorResponse('无法加载CDN资源');
  }
}

/**
 * 处理页面模板路由
 */
async function handleTemplateRoutes(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  let templatePath, templateUrl;

  try {
    // 确定模板路径
    if (path === '/') {
      // 根路径 - 获取首选编辑器类型
      const editorType = await getCache("qbin-editor") || 'm';
      templatePath = ['e', 'c', 'm'].includes(editorType) ? `/${editorType}` : '/m';
    } else {
      // 非根路径 - 取前两个字符作为模板标识
      templatePath = path.substring(0, 2);
    }

    // 构建模板URL
    templateUrl = new URL(templatePath, self.location.origin);
    templateUrl.search = url.search;

    // 创建模板请求
    const templateRequest = new Request(templateUrl.toString(), {
      method: 'GET',
      headers: request.headers,
      credentials: request.credentials,
      redirect: 'follow',
      ...(request.mode !== 'navigate' && { mode: request.mode })
    });

    return await cacheFirstStrategy(templateRequest, CACHE_NAMES.static);
  } catch (err) {
    logger.error(`模板路由处理失败: ${path}`, err);

    // 尝试从缓存获取备用响应
    if (templateUrl) {
      try {
        const cache = await caches.open(CACHE_NAMES.static);
        const fallbackRequest = new Request(templateUrl.toString(), {
          method: 'GET',
          headers: request.headers,
          credentials: request.credentials,
          redirect: 'follow',
          ...(request.mode !== 'navigate' && { mode: request.mode })
        });

        const fallback = await cache.match(fallbackRequest);
        if (fallback) return fallback;
      } catch (err) {
        logger.error(`备用模板获取失败`, err);
      }
    }

    return createErrorResponse('页面加载失败');
  }
}

/**
 * 激活事件处理 - 清理旧缓存并通知客户端
 */
self.addEventListener('activate', event => {
  logger.log('激活事件触发');

  event.waitUntil(
    Promise.all([
      CACHE_SETTINGS.clearCaches ? clearAllCaches() : cleanupOldCaches(),
      cleanupExpiredResources()
    ])
    .then(() => self.clients.claim())
    .then(() => notifyClients('SW_ACTIVATED'))
    .catch(err => {
      logger.warn('缓存清理过程出错:', err);
      return self.clients.claim();
    })
  );
});

/**
 * 清理所有应用缓存
 */
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const appCaches = cacheNames.filter(name => 
      name.startsWith('qbin-') && !name.startsWith('qbin-cdn-'));
    
    logger.log(`清理所有应用缓存（${appCaches.length}个）`);
    
    await Promise.all(
      appCaches.map(cacheName => {
        logger.log(`删除缓存: ${cacheName}`);
        return caches.delete(cacheName);
      })
    );
    
    // 初始化新缓存
    await caches.open(CACHE_NAMES.static);
    await caches.open(CACHE_NAMES.dynamic);
    
    return Promise.resolve();
  } catch (err) {
    logger.warn('清理应用缓存失败:', err);
    return Promise.resolve();
  }
}

/**
 * 清理旧版本缓存
 */
async function cleanupOldCaches() {
  try {
    const cacheNames = await caches.keys();
    const currentVersion = CACHE_VERSION;
    const currentMajor = extractMajorVersion(currentVersion);
    
    // 按类型分组缓存
    const oldCaches = {
      static: cacheNames.filter(name => name.startsWith('qbin-static-') && name !== CACHE_NAMES.static),
      dynamic: cacheNames.filter(name => name.startsWith('qbin-dynamic-') && name !== CACHE_NAMES.dynamic),
      cdn: cacheNames.filter(name => name.startsWith('qbin-cdn-') && name !== CACHE_NAMES.cdn),
      other: cacheNames.filter(name => 
        name.includes('qbin-') && 
        !name.startsWith('qbin-static-') && 
        !name.startsWith('qbin-dynamic-') && 
        !name.startsWith('qbin-cdn-'))
    };
    
    // 检查版本变更
    let previousVersion = null;
    if (oldCaches.static.length > 0) {
      previousVersion = extractVersionFromCacheName(oldCaches.static[0]);
      logger.log(`检测到先前版本: ${previousVersion}`);
    }
    
    const versionChanged = previousVersion && previousVersion !== currentVersion;
    
    // 删除所有旧缓存（静态和动态）
    const deletePromises = [
      ...oldCaches.static.map(name => caches.delete(name)),
      ...oldCaches.dynamic.map(name => caches.delete(name)),
      ...oldCaches.other.map(name => caches.delete(name))
    ];
    
    // 仅删除主版本号不同的CDN缓存
    oldCaches.cdn.forEach(name => {
      const cacheMajor = extractMajorVersion(extractVersionFromCacheName(name));
      if (cacheMajor !== currentMajor) {
        deletePromises.push(caches.delete(name));
      }
    });
    
    await Promise.all(deletePromises);
    
    // 如果版本变更且启用自动更新，通知客户端刷新
    if (versionChanged && CACHE_SETTINGS.autoUpdate) {
      logger.log('版本已变更，通知客户端刷新');
      await notifyClients('SW_UPDATED_REFRESH_NEEDED');
    }
    
    return Promise.resolve();
  } catch (err) {
    logger.warn('清理旧缓存失败:', err);
    return Promise.resolve();
  }
}

/**
 * 清理过期的缓存资源
 */
async function cleanupExpiredResources() {
  try {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    await Promise.all([
      cleanExpiredCache(CACHE_NAMES.static, now - CACHE_SETTINGS.expiration.static * msPerDay),
      cleanExpiredCache(CACHE_NAMES.dynamic, now - CACHE_SETTINGS.expiration.dynamic * msPerDay),
      cleanExpiredCache(CACHE_NAMES.cdn, now - CACHE_SETTINGS.expiration.cdn * msPerDay)
    ]);
    
    return Promise.resolve();
  } catch (err) {
    logger.warn('清理过期资源失败:', err);
    return Promise.resolve();
  }
}

/**
 * 清理指定缓存中的过期条目
 */
async function cleanExpiredCache(cacheName, expirationTime) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    const deletePromises = [];

    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;

      const dateHeader = response.headers.get('date');
      if (!dateHeader) continue;

      const responseTime = new Date(dateHeader).getTime();
      if (responseTime < expirationTime) {
        logger.log(`删除过期资源: ${request.url}`);
        deletePromises.push(cache.delete(request));
      }
    }

    await Promise.all(deletePromises);
    return Promise.resolve();
  } catch (err) {
    logger.warn(`清理缓存 ${cacheName} 失败:`, err);
    return Promise.resolve();
  }
}

/**
 * 消息事件处理
 */
self.addEventListener('message', event => {
  const message = event.data;
  if (!message || !message.type) return;

  switch (message.type) {
    case 'SKIP_WAITING':
      logger.log('收到跳过等待消息，立即激活');
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      // 回复客户端当前版本信息
      sendMessageToClient(event.source, {
        type: 'SW_VERSION',
        version: CACHE_VERSION
      });
      break;
      
    case 'CHECK_UPDATE':
      // 响应检查更新请求
      logger.log('收到检查更新请求');
      sendMessageToClient(event.source, {
        type: 'SW_VERSION',
        version: CACHE_VERSION,
        checkUpdate: true
      });
      break;
      
    case 'PREPARE_UNREGISTER':
      // 注销前清理缓存
      logger.log('收到准备注销请求，清理缓存');
      clearAllCaches()
        .then(() => {
          sendMessageToClient(event.source, {
            type: 'UNREGISTER_PREPARED',
            success: true
          });
        })
        .catch(err => {
          logger.error('准备注销过程出错:', err);
          sendMessageToClient(event.source, {
            type: 'UNREGISTER_PREPARED',
            success: false,
            error: err.message
          });
        });
      break;
  }
});

// 工具函数

/**
 * 从IndexedDB获取缓存数据
 */
async function getCache(key) {
  try {
    const dbName = 'qbinv2';
    const version = 3;
    const storeName = 'qbinv2';
    const db = await new Promise(resolve => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, {keyPath: 'key'});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (!db) return null;

    return await new Promise(resolve => {
      const tx = db.transaction([storeName], 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 发送消息给客户端
 */
function sendMessageToClient(client, message) {
  if (client && client.postMessage) {
    client.postMessage(message);
  }
}

/**
 * 通知所有客户端
 */
async function notifyClients(type) {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      sendMessageToClient(client, {
        type: type,
        version: CACHE_VERSION,
        clearCaches: CACHE_SETTINGS.clearCaches
      });
    });
    return Promise.resolve();
  } catch (err) {
    logger.warn('通知客户端失败:', err);
    return Promise.resolve();
  }
}

/**
 * 创建标准错误响应
 */
function createErrorResponse(message, status = 503) {
  return new Response(message, {
    status: status,
    headers: {'Content-Type': 'text/plain; charset=UTF-8'}
  });
}

/**
 * 添加日期头信息
 */
function addDateHeader(headers) {
  const newHeaders = new Headers(headers);
  if (!newHeaders.has('date')) {
    newHeaders.set('date', new Date().toUTCString());
  }
  return newHeaders;
}

/**
 * 从缓存名称中提取版本号
 */
function extractVersionFromCacheName(cacheName) {
  const parts = cacheName.split('-');
  return parts[parts.length - 1];
}

/**
 * 提取主版本号
 */
function extractMajorVersion(version) {
  return version.replace('v', '').split('.')[0];
}

/**
 * 资源类型判断函数
 */
function isStaticResource(path) {
  return RESOURCES.static.some(staticPath => path.startsWith(staticPath)) || 
         path.startsWith('/static/');
}

function isPageTemplate(path) {
  return RESOURCES.templates.some(templatePath => path === templatePath) ||
         path.match(/^\/[cmep](\/.*)?$/);
}

function isRealtimeResource(path) {
  return path.startsWith('/r/');
}

function isCdnResource(url) {
  return RESOURCES.cdn.some(cdnPath => url.startsWith(cdnPath));
}
