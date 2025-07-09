/**
 * Proxy Module - Proxy Management for reCAPTCHA requests
 * Handles proxy selection, rotation, and fallback mechanisms
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;

  // Validate dependencies before use
  if (!core) {
    throw new Error("Core module not loaded - missing dependency");
  }
  const { log, logInfo, logError, logSuccess, logWarning, logDebug } = core;

  // ============= PROXY CONFIGURATION =============

  // Default proxy list từ Webshare
  const DEFAULT_PROXY_LIST = [
    "38.154.227.167:5868:kdzrrkqv:763ww9x8x6x3",
    "198.23.239.134:6540:kdzrrkqv:763ww9x8x6x3",
    "207.244.217.165:6712:kdzrrkqv:763ww9x8x6x3",
    "107.172.163.27:6543:kdzrrkqv:763ww9x8x6x3",
    "216.10.27.159:6837:kdzrrkqv:763ww9x8x6x3",
    "136.0.207.84:6661:kdzrrkqv:763ww9x8x6x3",
    "64.64.118.149:6732:kdzrrkqv:763ww9x8x6x3",
    "142.147.128.93:6593:kdzrrkqv:763ww9x8x6x3",
    "104.239.105.125:6655:kdzrrkqv:763ww9x8x6x3",
    "206.41.172.74:6634:kdzrrkqv:763ww9x8x6x3",
  ];

  const PROXY_STORAGE_KEY = "ateex_proxy_list";
  const PROXY_STATS_KEY = "ateex_proxy_stats";
  const MAX_PROXY_RETRIES = 3;
  const PROXY_TIMEOUT = 15000; // 15 seconds timeout

  // ============= PROXY MANAGEMENT =============

  let proxyList = [];
  let proxyStats = {};
  let lastUsedProxyIndex = -1;

  // Parse proxy string để support cả 2 định dạng
  function parseProxy(proxyString) {
    const parts = proxyString.split(":");

    if (parts.length === 2) {
      // Format: "ip:port"
      return {
        host: parts[0],
        port: parseInt(parts[1]),
        username: null,
        password: null,
        proxy: `${parts[0]}:${parts[1]}`,
      };
    } else if (parts.length === 4) {
      // Format: "ip:port:username:password"
      return {
        host: parts[0],
        port: parseInt(parts[1]),
        username: parts[2],
        password: parts[3],
        proxy: `${parts[0]}:${parts[1]}`,
      };
    } else {
      throw new Error(`Invalid proxy format: ${proxyString}`);
    }
  }

  // Load proxy list từ localStorage hoặc sử dụng default
  function loadProxyList() {
    try {
      const saved = localStorage.getItem(PROXY_STORAGE_KEY);
      if (saved) {
        const savedList = JSON.parse(saved);
        if (Array.isArray(savedList) && savedList.length > 0) {
          proxyList = savedList.map(parseProxy);
          logSuccess(`📡 Loaded ${proxyList.length} proxies from storage`);
          return;
        }
      }

      // Sử dụng default list nếu không có trong storage
      proxyList = DEFAULT_PROXY_LIST.map(parseProxy);
      saveProxyList();
      logSuccess(`📡 Initialized with ${proxyList.length} default proxies`);
    } catch (e) {
      logError("Error loading proxy list: " + e.message);
      // Fallback về default list
      proxyList = DEFAULT_PROXY_LIST.map(parseProxy);
      logWarning("Using default proxy list as fallback");
    }
  }

  // Save proxy list to localStorage
  function saveProxyList() {
    try {
      const proxyStrings = proxyList.map(proxy => {
        if (proxy.username && proxy.password) {
          return `${proxy.host}:${proxy.port}:${proxy.username}:${proxy.password}`;
        } else {
          return `${proxy.host}:${proxy.port}`;
        }
      });
      localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(proxyStrings));
    } catch (e) {
      logError("Error saving proxy list: " + e.message);
    }
  }

  // Load proxy statistics
  function loadProxyStats() {
    try {
      const saved = localStorage.getItem(PROXY_STATS_KEY);
      if (saved) {
        proxyStats = JSON.parse(saved);
      } else {
        proxyStats = {};
      }
    } catch (e) {
      logError("Error loading proxy stats: " + e.message);
      proxyStats = {};
    }
  }

  // Save proxy statistics
  function saveProxyStats() {
    try {
      // Throttled save để giảm localStorage overhead
      clearTimeout(window.proxyStatsTimeout);
      window.proxyStatsTimeout = setTimeout(() => {
        localStorage.setItem(PROXY_STATS_KEY, JSON.stringify(proxyStats));
      }, 2000);
    } catch (e) {
      logError("Error saving proxy stats: " + e.message);
    }
  }

  // Update proxy statistics
  function updateProxyStats(proxyKey, success, responseTime) {
    if (!proxyStats[proxyKey]) {
      proxyStats[proxyKey] = {
        totalRequests: 0,
        successfulRequests: 0,
        totalResponseTime: 0,
        lastUsed: 0,
        failures: 0,
        avgResponseTime: 0,
      };
    }

    const stats = proxyStats[proxyKey];
    stats.totalRequests++;
    stats.lastUsed = Date.now();

    if (success) {
      stats.successfulRequests++;
      stats.totalResponseTime += responseTime;
      stats.avgResponseTime = Math.round(
        stats.totalResponseTime / stats.successfulRequests
      );
      stats.failures = 0; // Reset failures on success
    } else {
      stats.failures++;
    }

    saveProxyStats();
  }

  // Chọn proxy ngẫu nhiên với logic thông minh
  function selectRandomProxy(excludeProxies = []) {
    if (proxyList.length === 0) {
      loadProxyList();
    }

    if (proxyList.length === 0) {
      logError("No proxies available");
      return null;
    }

    // Filter ra những proxy bị exclude
    const availableProxies = proxyList.filter(proxy => {
      const proxyKey = proxy.proxy;
      return !excludeProxies.includes(proxyKey);
    });

    if (availableProxies.length === 0) {
      logWarning("All proxies excluded, using full list");
      return proxyList[Math.floor(Math.random() * proxyList.length)];
    }

    // Weighted random selection dựa trên success rate
    const proxiesWithWeights = availableProxies.map(proxy => {
      const stats = proxyStats[proxy.proxy];
      let weight = 1; // Base weight

      if (stats && stats.totalRequests > 0) {
        const successRate = stats.successfulRequests / stats.totalRequests;
        weight = successRate * 10; // Higher success rate = higher weight

        // Penalty cho proxy có failures gần đây
        if (stats.failures > 0) {
          weight = weight / (stats.failures * 2);
        }
      }

      return { proxy, weight: Math.max(weight, 0.1) }; // Minimum weight
    });

    // Random weighted selection
    const totalWeight = proxiesWithWeights.reduce(
      (sum, item) => sum + item.weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const item of proxiesWithWeights) {
      random -= item.weight;
      if (random <= 0) {
        return item.proxy;
      }
    }

    // Fallback về random proxy nếu weighted selection fails
    return availableProxies[
      Math.floor(Math.random() * availableProxies.length)
    ];
  }

  // Get proxy configuration cho GM_xmlhttpRequest
  function getProxyConfig(proxy) {
    if (!proxy) return null;

    const config = {
      proxy: proxy.proxy,
    };

    // Thêm authentication nếu có
    if (proxy.username && proxy.password) {
      config.proxyAuth = `${proxy.username}:${proxy.password}`;
    }

    return config;
  }

  // ============= PROXY REQUEST WRAPPER =============

  // Enhanced GM_xmlhttpRequest với proxy support và retry logic
  function makeProxyRequest(options) {
    return new Promise((resolve, reject) => {
      const excludedProxies = [];
      let attempt = 0;

      function attemptRequest() {
        attempt++;

        if (attempt > MAX_PROXY_RETRIES) {
          logError("All proxy attempts failed");
          reject(new Error("All proxy attempts failed"));
          return;
        }

        // Chọn proxy cho attempt này
        const selectedProxy = selectRandomProxy(excludedProxies);
        if (!selectedProxy) {
          logError("No available proxy for request");
          reject(new Error("No available proxy"));
          return;
        }

        const proxyConfig = getProxyConfig(selectedProxy);
        const requestStart = Date.now();

        logInfo(
          `🔄 Proxy attempt ${attempt}/${MAX_PROXY_RETRIES}: ${selectedProxy.proxy}`
        );

        // Merge proxy config vào request options
        const requestOptions = {
          ...options,
          timeout: PROXY_TIMEOUT,
          onload: function (response) {
            const responseTime = Date.now() - requestStart;

            if (response.status === 200) {
              updateProxyStats(selectedProxy.proxy, true, responseTime);
              logSuccess(
                `✅ Proxy success: ${selectedProxy.proxy} (${responseTime}ms)`
              );
              resolve(response);
            } else {
              updateProxyStats(selectedProxy.proxy, false, responseTime);
              logWarning(
                `⚠️ Proxy HTTP error ${response.status}: ${selectedProxy.proxy}`
              );

              // Thêm proxy vào exclude list và retry
              excludedProxies.push(selectedProxy.proxy);
              setTimeout(attemptRequest, 1000); // Wait 1s before retry
            }
          },
          onerror: function (error) {
            const responseTime = Date.now() - requestStart;
            updateProxyStats(selectedProxy.proxy, false, responseTime);
            logWarning(`❌ Proxy error: ${selectedProxy.proxy} - ${error}`);

            // Thêm proxy vào exclude list và retry
            excludedProxies.push(selectedProxy.proxy);
            setTimeout(attemptRequest, 1000); // Wait 1s before retry
          },
          ontimeout: function () {
            const responseTime = Date.now() - requestStart;
            updateProxyStats(selectedProxy.proxy, false, responseTime);
            logWarning(`⏰ Proxy timeout: ${selectedProxy.proxy}`);

            // Thêm proxy vào exclude list và retry
            excludedProxies.push(selectedProxy.proxy);
            setTimeout(attemptRequest, 1000); // Wait 1s before retry
          },
        };

        // Apply proxy config nếu có
        if (proxyConfig) {
          Object.assign(requestOptions, proxyConfig);
        }

        // Make request với proxy
        GM_xmlhttpRequest(requestOptions);
      }

      // Start first attempt
      attemptRequest();
    });
  }

  // ============= PROXY MANAGEMENT METHODS =============

  // Thêm proxy mới vào list
  function addProxy(proxyString) {
    try {
      const proxy = parseProxy(proxyString);

      // Check duplicate
      const existing = proxyList.find(p => p.proxy === proxy.proxy);
      if (existing) {
        logWarning(`Proxy already exists: ${proxy.proxy}`);
        return false;
      }

      proxyList.push(proxy);
      saveProxyList();
      logSuccess(`Added new proxy: ${proxy.proxy}`);
      return true;
    } catch (e) {
      logError("Error adding proxy: " + e.message);
      return false;
    }
  }

  // Remove proxy khỏi list
  function removeProxy(proxyString) {
    const proxyKey = proxyString.includes(":")
      ? proxyString.split(":").slice(0, 2).join(":")
      : proxyString;

    const index = proxyList.findIndex(p => p.proxy === proxyKey);
    if (index !== -1) {
      proxyList.splice(index, 1);
      saveProxyList();

      // Xóa stats của proxy này
      delete proxyStats[proxyKey];
      saveProxyStats();

      logSuccess(`Removed proxy: ${proxyKey}`);
      return true;
    } else {
      logWarning(`Proxy not found: ${proxyKey}`);
      return false;
    }
  }

  // Get proxy statistics summary
  function getProxyStatsSummary() {
    const summary = {
      totalProxies: proxyList.length,
      workingProxies: 0,
      failedProxies: 0,
      proxies: [],
    };

    proxyList.forEach(proxy => {
      const stats = proxyStats[proxy.proxy] || {
        totalRequests: 0,
        successfulRequests: 0,
        failures: 0,
        avgResponseTime: 0,
      };

      const successRate =
        stats.totalRequests > 0
          ? Math.round((stats.successfulRequests / stats.totalRequests) * 100)
          : 0;

      const proxyInfo = {
        proxy: proxy.proxy,
        hasAuth: !!(proxy.username && proxy.password),
        totalRequests: stats.totalRequests,
        successRate: successRate,
        failures: stats.failures,
        avgResponseTime: stats.avgResponseTime,
        lastUsed: stats.lastUsed,
      };

      summary.proxies.push(proxyInfo);

      if (stats.failures < 3 && successRate > 50) {
        summary.workingProxies++;
      } else if (
        stats.failures >= 3 ||
        (stats.totalRequests > 0 && successRate < 50)
      ) {
        summary.failedProxies++;
      }
    });

    return summary;
  }

  // Reset all proxy statistics
  function resetProxyStats() {
    proxyStats = {};
    localStorage.removeItem(PROXY_STATS_KEY);
    logSuccess("Proxy statistics reset");
  }

  // ============= MODULE INITIALIZATION =============

  function initialize() {
    loadProxyList();
    loadProxyStats();
    logSuccess(`[Proxy Module] Initialized with ${proxyList.length} proxies`);
  }

  // Auto-initialize
  initialize();

  // ============= EXPORTS =============

  exports.makeProxyRequest = makeProxyRequest;
  exports.selectRandomProxy = selectRandomProxy;
  exports.getProxyConfig = getProxyConfig;
  exports.addProxy = addProxy;
  exports.removeProxy = removeProxy;
  exports.getProxyStatsSummary = getProxyStatsSummary;
  exports.resetProxyStats = resetProxyStats;
  exports.updateProxyStats = updateProxyStats;
  exports.loadProxyList = loadProxyList;
  exports.saveProxyList = saveProxyList;
  exports.proxyList = proxyList;
  exports.initialize = initialize;
})(exports);
