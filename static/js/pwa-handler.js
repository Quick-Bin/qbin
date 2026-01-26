/**
 * QBin PWA 处理程序
 */
(function() {
    // 客户端配置
    const PWA_CONFIG = {
        version: '1.5',                // 客户端版本号 - 用于service worker注册的缓存控制
        autoUpdateInterval: 60 * 1000  // 自动检查更新间隔（毫秒）
    };
    
    // 环境检测
    const ENVIRONMENT = {
        isSupported: 'serviceWorker' in navigator,
        isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
        hasIndexedDB: 'indexedDB' in window,
        hasCacheAPI: 'caches' in window
    };

    // 初始化全局PWA对象
    window.QBinPWA = {
        // 状态
        ...ENVIRONMENT, 
        registration: null,
        offlineReady: false,
        updateAvailable: false,
        lastKnownVersion: null,
        
        // 公开API
        checkForUpdates,
        applyUpdate: forceServiceWorkerUpdate,
        unregister: unregisterServiceWorker,
        reregister: reregisterServiceWorker
    };

    /**
     * 初始化PWA功能
     */
    function initPWA() {
        // 首先检查是否需要紧急更新
        checkEmergencyUpdate().then(updated => {
            if (!updated) {
                // 正常注册
                registerServiceWorker();
            }
        });
    }

    /**
     * 注册Service Worker
     */
    function registerServiceWorker() {
        if (!ENVIRONMENT.isSupported || !ENVIRONMENT.isHTTPS) return;

        window.addEventListener('load', () => {
            // 使用稳定的URL，加上版本参数
            const swUrl = `/service-worker.js?v=${PWA_CONFIG.version}`;
            
            navigator.serviceWorker.register(swUrl, { scope: "/" })
                .then(registration => {
                    window.QBinPWA.registration = registration;
                    console.log('Service Worker 注册成功');
                    
                    // 监听worker状态变化
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // 新版本等待激活
                                window.QBinPWA.updateAvailable = true;
                                showUpdateNotification();
                            } else if (newWorker.state === 'activated') {
                                window.QBinPWA.offlineReady = true;
                                window.QBinPWA.updateAvailable = false;
                            }
                        });
                    });
                    
                    // 如果已经激活
                    if (registration.active) {
                        window.QBinPWA.offlineReady = true;
                        
                        // 向Service Worker请求版本信息
                        if (navigator.serviceWorker.controller) {
                            requestVersionInfo();
                        }
                    }
                })
                .catch(error => {
                    console.warn('Service Worker 注册失败:', error);
                });
            
            // 添加消息监听
            setupMessageHandlers();
            
            // 添加在线/离线状态监听
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
            updateOnlineStatus();
        });
    }
    
    /**
     * 设置Service Worker消息处理
     */
    function setupMessageHandlers() {
        navigator.serviceWorker.addEventListener('message', event => {
            if (!event.data || !event.data.type) return;
            
            const { type, version, clearCaches } = event.data;
            
            switch (type) {
                case 'SW_ACTIVATED':
                    console.log('收到Service Worker激活消息，版本:', version);
                    handleVersionInfo(version);
                    
                    window.QBinPWA.offlineReady = true;
                    window.QBinPWA.updateAvailable = false;
                    
                    // 如果是清理缓存模式激活，并且有准备注销回调，则执行注销
                    if (clearCaches && window.QBinPWA._unregisterCallback) {
                        completeUnregistration();
                    }
                    break;
                    
                case 'SW_VERSION':
                    console.log('当前Service Worker版本:', version);
                    handleVersionInfo(version, event.data.checkUpdate);
                    break;
                    
                case 'SW_UPDATED_REFRESH_NEEDED':
                    console.log('收到Service Worker更新通知');
                    
                    if (window.QBinPWA.lastKnownVersion !== version) {
                        window.QBinPWA.lastKnownVersion = version;
                        
                        // 延迟刷新
                        setTimeout(() => window.location.reload(), 1000);
                    }
                    break;
                    
                case 'UNREGISTER_PREPARED':
                    console.log('Service Worker已准备好注销:', event.data.success);
                    if (event.data.success) {
                        completeUnregistration();
                    } else if (window.QBinPWA._unregisterCallback) {
                        window.QBinPWA._unregisterCallback(false);
                        delete window.QBinPWA._unregisterCallback;
                    }
                    break;
                    
                case 'SW_CHECK_VERSION':
                    // 服务工作线程请求版本检查
                    if (window.QBinPWA.registration) {
                        window.QBinPWA.registration.update()
                            .then(() => requestVersionInfo())
                            .catch(err => console.warn('更新检查失败:', err));
                    }
                    break;
            }
        });
        
        // 添加用于处理控制器变化的监听器
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Service Worker控制器已变更');
        });
    }
    
    /**
     * 处理版本信息
     */
    function handleVersionInfo(newVersion, isCheckUpdate = false) {
        if (!window.QBinPWA.lastKnownVersion) {
            window.QBinPWA.lastKnownVersion = newVersion;
            return;
        }
        
        // 检查版本是否变化
        if (window.QBinPWA.lastKnownVersion !== newVersion) {
            // 比较版本大小
            if (compareVersions(newVersion, window.QBinPWA.lastKnownVersion) > 0) {
                console.log(`检测到版本升级: ${window.QBinPWA.lastKnownVersion} -> ${newVersion}`);
                window.QBinPWA.lastKnownVersion = newVersion;
                window.QBinPWA.updateAvailable = true;
                
                // 显示更新通知
                if (isCheckUpdate) {
                    showUpdateNotification();
                } else {
                    // 自动更新
                    window.location.reload();
                }
            }
        } else if (isCheckUpdate) {
            // 用户主动检查但无更新
            return '当前已是最新版本';
        }
    }
    
    /**
     * 比较两个版本号
     * @returns 1: versionA > versionB, -1: versionA < versionB, 0: 相等
     */
    function compareVersions(versionA, versionB) {
        // 移除v前缀并分割为数组
        const a = versionA.replace(/^v/, '').split('.').map(Number);
        const b = versionB.replace(/^v/, '').split('.').map(Number);
        
        // 比较每部分
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const partA = i < a.length ? a[i] : 0;
            const partB = i < b.length ? b[i] : 0;
            
            if (partA > partB) return 1;
            if (partA < partB) return -1;
        }
        
        return 0; // 版本相同
    }
    
    /**
     * 检查更新
     */
    function checkForUpdates() {
        return new Promise((resolve) => {
            if (!window.QBinPWA.isSupported || !navigator.serviceWorker.controller) {
                resolve(false);
                return;
            }
            
            console.log('正在检查更新...');
            
            // 超时处理
            const timeoutId = setTimeout(() => {
                console.warn('更新检查超时');
                resolve(false);
            }, 5000);
            
            // 单次消息处理
            const messageHandler = function(event) {
                if (event.data && event.data.type === 'SW_VERSION' && event.data.checkUpdate) {
                    clearTimeout(timeoutId);
                    navigator.serviceWorker.removeEventListener('message', messageHandler);
                    
                    const hasUpdate = handleVersionCheckResult(event.data.version);
                    resolve(hasUpdate);
                }
            };
            
            navigator.serviceWorker.addEventListener('message', messageHandler);
            
            // 发送检查请求
            navigator.serviceWorker.controller.postMessage({
                type: 'CHECK_UPDATE'
            });
        });
    }
    
    /**
     * 处理版本检查结果
     */
    function handleVersionCheckResult(newVersion) {
        const currentVersion = window.QBinPWA.lastKnownVersion;
        
        if (!currentVersion) {
            window.QBinPWA.lastKnownVersion = newVersion;
            return false;
        }
        
        if (currentVersion !== newVersion) {
            const comparison = compareVersions(newVersion, currentVersion);
            if (comparison > 0) {
                console.log('发现新版本:', newVersion);
                window.QBinPWA.updateAvailable = true;
                return true;
            }
        }
        
        console.log('当前已是最新版本');
        return false;
    }
    
    /**
     * 注销Service Worker
     */
    function unregisterServiceWorker() {
        return new Promise((resolve) => {
            if (!window.QBinPWA.isSupported) {
                resolve(false);
                return;
            }
            
            console.log('开始PWA注销流程...');
            
            // 存储回调
            window.QBinPWA._unregisterCallback = resolve;
            
            // 检查是否有活动的Service Worker
            if (navigator.serviceWorker.controller) {
                console.log('通知Service Worker准备注销');
                // 通知准备注销
                navigator.serviceWorker.controller.postMessage({
                    type: 'PREPARE_UNREGISTER'
                });
                
                // 设置超时
                setTimeout(() => {
                    if (window.QBinPWA._unregisterCallback) {
                        console.warn('注销准备超时，直接执行注销');
                        completeUnregistration();
                    }
                }, 5000);
            } else {
                // 没有活动的Service Worker，直接完成注销
                completeUnregistration();
            }
        });
    }
    
    /**
     * 完成Service Worker注销
     */
    function completeUnregistration() {
        console.log('执行Service Worker注销');
        
        navigator.serviceWorker.getRegistrations()
            .then(registrations => {
                const unregisterPromises = registrations.map(registration => {
                    console.log('注销Service Worker:', registration.scope);
                    return registration.unregister();
                });
                return Promise.all(unregisterPromises);
            })
            .then(results => {
                const success = results.some(result => result === true);
                console.log('Service Worker注销结果:', success);
                
                if (window.QBinPWA._unregisterCallback) {
                    window.QBinPWA._unregisterCallback(success);
                    delete window.QBinPWA._unregisterCallback;
                }
                
                // 重置PWA状态
                window.QBinPWA.offlineReady = false;
                window.QBinPWA.updateAvailable = false;
                
                if (success) {
                    alert('PWA已成功注销，刷新页面后将不再支持离线访问');
                }
            })
            .catch(error => {
                console.error('注销Service Worker失败:', error);
                
                if (window.QBinPWA._unregisterCallback) {
                    window.QBinPWA._unregisterCallback(false);
                    delete window.QBinPWA._unregisterCallback;
                }
            });
    }
    
    /**
     * 请求Service Worker的当前版本信息
     */
    function requestVersionInfo() {
        if (navigator.serviceWorker.controller) {
            console.log('向Service Worker请求版本信息');
            navigator.serviceWorker.controller.postMessage({
                type: 'GET_VERSION'
            });
        }
    }
    
    /**
     * 显示更新通知
     */
    function showUpdateNotification() {
        // 创建一个简单的更新通知
        if (!document.getElementById('update-notification')) {
            const notification = document.createElement('div');
            notification.id = 'update-notification';
            notification.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:10px;background:#4CAF50;color:white;border-radius:4px;z-index:9999;box-shadow:0 2px 10px rgba(0,0,0,0.2);display:flex;align-items:center;';
            
            notification.innerHTML = '<span>新版本可用</span><button style="margin-left:10px;padding:5px 10px;border:none;border-radius:3px;background:white;color:#4CAF50;cursor:pointer;">更新</button>';
            
            // 更新按钮点击事件
            notification.querySelector('button').addEventListener('click', () => {
                forceServiceWorkerUpdate();
                document.body.removeChild(notification);
            });
            
            document.body.appendChild(notification);
        }
    }
    
    /**
     * 强制Service Worker更新
     */
    function forceServiceWorkerUpdate() {
        if (window.QBinPWA.registration && window.QBinPWA.registration.waiting) {
            console.log('正在强制激活新Service Worker...');
            // 发送消息给等待中的Service Worker
            window.QBinPWA.registration.waiting.postMessage({type: 'SKIP_WAITING'});
            
            // 等待控制器变化完成后刷新页面
            let refreshed = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshed) {
                    refreshed = true;
                    console.log('新Service Worker已激活，正在刷新页面');
                    window.location.reload();
                }
            });
            
            return Promise.resolve(true);
        } else {
            // 如果没有等待的Service Worker，重新注册
            return navigator.serviceWorker.getRegistration()
                .then(registration => {
                    if (registration) {
                        return registration.update()
                            .then(() => {
                                if (registration.waiting) {
                                    registration.waiting.postMessage({type: 'SKIP_WAITING'});
                                    return true;
                                }
                                window.location.reload();
                                return true;
                            });
                    } else {
                        window.location.reload();
                        return true;
                    }
                })
                .catch(err => {
                    console.error('更新Service Worker失败:', err);
                    window.location.reload();
                    return false;
                });
        }
    }
    
    /**
     * 更新在线/离线状态
     */
    function updateOnlineStatus() {
        const isOnline = navigator.onLine;
        window.QBinPWA.isOnline = isOnline;
        
        // 在这里处理离线状态通知（如需要）
    }
    
    /**
     * 强制重新注册Service Worker
     */
    function reregisterServiceWorker() {
        // 保存CLIENT_VERSION到localStorage
        const oldVersion = PWA_CONFIG.version;
        const newVersion = Date.now(); // 使用时间戳作为临时版本号
        
        localStorage.setItem('pwa_emergency_update', JSON.stringify({
            oldVersion: oldVersion,
            newVersion: newVersion,
            timestamp: Date.now()
        }));
        
        // 刷新页面，使用新的版本号注册
        window.location.href = `/?pwa_update=${newVersion}`;
        return Promise.resolve(true);
    }
    
    /**
     * 检查是否需要执行紧急更新
     */
    function checkEmergencyUpdate() {
        try {
            const updateInfo = localStorage.getItem('pwa_emergency_update');
            if (updateInfo) {
                const info = JSON.parse(updateInfo);
                
                // 清除存储的信息
                localStorage.removeItem('pwa_emergency_update');
                
                // 注销并重新注册
                console.log('执行紧急更新流程');
                return unregisterServiceWorker();
            }
        } catch (err) {
            console.error('检查紧急更新失败:', err);
        }
        
        return Promise.resolve(false);
    }
    
    // 启动初始化过程
    initPWA();
})();
