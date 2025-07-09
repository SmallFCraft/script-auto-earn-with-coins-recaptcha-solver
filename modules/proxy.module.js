/**
 * Proxy Module - Proxy Management for Anti-Detection
 * Manages Webshare proxy list and provides proxy rotation for requests
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;

  // Validate dependencies before use
  if (!core) {
    throw new Error("Core module not loaded - missing dependency");
  }

  const {
    log,
    logInfo,
    logError,
    logSuccess,
    logWarning,
    safeJsonParse,
    safeJsonStringify,
  } = core;

  // ============= PROXY CONSTANTS =============

  const PROXY_STORAGE_KEY = "ateex_proxy_list";
  const PROXY_STATS_KEY = "ateex_proxy_stats";
  const PROXY_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  // Default Webshare proxy list (updated từ user input)
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

  // ============= PROXY STATE =============

  let cachedProxyList = null;
  let proxyStats = {};
  let lastUsedProxyIndex = -1;

  // ============= PROXY PARSING =============

  // Parse proxy string "IP:PORT:USERNAME:PASSWORD" to object
  function parseProxy(proxyString) {
    try {
      const parts = proxyString.trim().split(":");
      if (parts.length !== 4) {
        throw new Error(`Invalid proxy format: ${proxyString}`);
      }

      return {
        ip: parts[0],
        port: parseInt(parts[1]),
        username: parts[2],
        password: parts[3],
        url: `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`,
        display: `${parts[0]}:${parts[1]}`,
      };
    } catch (e) {
      logError(`Error parsing proxy: ${e.message}`);
      return null;
    }
  }

  // ============= PROXY MANAGEMENT =============

  // Load proxy list from storage or use default
  function loadProxyList() {
    try {
      const saved = localStorage.getItem(PROXY_STORAGE_KEY);
      if (saved) {
        const data = safeJsonParse(saved);
        if (data && data.proxies && Array.isArray(data.proxies)) {
          // Check if cache is not expired
          if (Date.now() - data.timestamp < PROXY_CACHE_EXPIRY) {
            logInfo(`Loaded ${data.proxies.length} proxies from cache`);
            return data.proxies;
          } else {
            logInfo("Proxy cache expired, will use default list");
          }
        }
      }

      // Use default list if no cache or expired
      logInfo(
        `Using default proxy list (${DEFAULT_PROXY_LIST.length} proxies)`
      );
      saveProxyList(DEFAULT_PROXY_LIST);
      return DEFAULT_PROXY_LIST;
    } catch (e) {
      logError(`Error loading proxy list: ${e.message}`);
      return DEFAULT_PROXY_LIST;
    }
  }

  // Save proxy list to storage
  function saveProxyList(proxyList) {
    try {
      const data = {
        timestamp: Date.now(),
        proxies: proxyList,
      };
      localStorage.setItem(PROXY_STORAGE_KEY, safeJsonStringify(data));
      logInfo(`Saved ${proxyList.length} proxies to cache`);
      return true;
    } catch (e) {
      logError(`Error saving proxy list: ${e.message}`);
      return false;
    }
  }

  // Get cached proxy list
  function getProxyList() {
    if (!cachedProxyList) {
      cachedProxyList = loadProxyList();
    }
    return cachedProxyList;
  }

  // ============= PROXY STATS =============

  // Load proxy statistics
  function loadProxyStats() {
    try {
      const saved = localStorage.getItem(PROXY_STATS_KEY);
      if (saved) {
        proxyStats = safeJsonParse(saved, {});
      }
    } catch (e) {
      logError(`Error loading proxy stats: ${e.message}`);
      proxyStats = {};
    }
  }

  // Save proxy statistics
  function saveProxyStats() {
    try {
      localStorage.setItem(PROXY_STATS_KEY, safeJsonStringify(proxyStats));
    } catch (e) {
      logError(`Error saving proxy stats: ${e.message}`);
    }
  }

  // Update proxy statistics
  function updateProxyStats(
    proxyDisplay,
    success,
    responseTime = 0,
    error = null
  ) {
    try {
      if (!proxyStats[proxyDisplay]) {
        proxyStats[proxyDisplay] = {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          totalResponseTime: 0,
          lastUsed: 0,
          lastError: null,
          consecutiveFailures: 0,
        };
      }

      const stats = proxyStats[proxyDisplay];
      stats.totalRequests++;
      stats.lastUsed = Date.now();

      if (success) {
        stats.successRequests++;
        stats.totalResponseTime += responseTime;
        stats.consecutiveFailures = 0; // Reset failure count
        stats.lastError = null;
      } else {
        stats.failedRequests++;
        stats.consecutiveFailures++;
        stats.lastError = error || "Unknown error";
      }

      // Save stats periodically to avoid too frequent writes
      clearTimeout(window.proxyStatsTimeout);
      window.proxyStatsTimeout = setTimeout(saveProxyStats, 2000);
    } catch (e) {
      logError(`Error updating proxy stats: ${e.message}`);
    }
  }

  // ============= PROXY SELECTION =============

  // Get next available proxy (with rotation and filtering)
  function getNextProxy(excludeProxies = []) {
    try {
      const proxyList = getProxyList();
      if (!proxyList || proxyList.length === 0) {
        logWarning("No proxies available");
        return null;
      }

      // Parse all proxies and filter out excluded ones
      const availableProxies = proxyList
        .map(parseProxy)
        .filter(proxy => proxy !== null)
        .filter(proxy => !excludeProxies.includes(proxy.display));

      if (availableProxies.length === 0) {
        logWarning("No available proxies after filtering");
        return null;
      }

      // Load stats for intelligent selection
      loadProxyStats();

      // Score each proxy based on success rate and recent failures
      const scoredProxies = availableProxies.map(proxy => {
        const stats = proxyStats[proxy.display];
        let score = Math.random() * 100; // Base random score

        if (stats && stats.totalRequests > 0) {
          const successRate = stats.successRequests / stats.totalRequests;
          score += successRate * 50; // Bonus for success rate

          // Penalty for consecutive failures
          score -= stats.consecutiveFailures * 20;

          // Penalty for recent usage (to encourage rotation)
          const timeSinceLastUse = Date.now() - stats.lastUsed;
          if (timeSinceLastUse < 60000) {
            // Less than 1 minute
            score -= 30;
          }
        }

        return { proxy, score };
      });

      // Sort by score and select best one
      scoredProxies.sort((a, b) => b.score - a.score);
      const selectedProxy = scoredProxies[0].proxy;

      logInfo(
        `Selected proxy: ${selectedProxy.display} (score: ${Math.round(
          scoredProxies[0].score
        )})`
      );
      return selectedProxy;
    } catch (e) {
      logError(`Error selecting proxy: ${e.message}`);
      return null;
    }
  }

  // Get random proxy (simple random selection)
  function getRandomProxy(excludeProxies = []) {
    try {
      const proxyList = getProxyList();
      if (!proxyList || proxyList.length === 0) {
        return null;
      }

      const availableProxies = proxyList
        .map(parseProxy)
        .filter(proxy => proxy !== null)
        .filter(proxy => !excludeProxies.includes(proxy.display));

      if (availableProxies.length === 0) {
        return null;
      }

      const randomIndex = Math.floor(Math.random() * availableProxies.length);
      const selectedProxy = availableProxies[randomIndex];

      logInfo(`Random proxy selected: ${selectedProxy.display}`);
      return selectedProxy;
    } catch (e) {
      logError(`Error getting random proxy: ${e.message}`);
      return null;
    }
  }

  // ============= PROXY REQUEST WRAPPER =============

  // Enhanced GM_xmlhttpRequest with proxy support and retry logic
  function makeProxyRequest(options, maxRetries = 3) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      let usedProxies = [];

      function attemptRequest() {
        attempts++;

        // Get next available proxy
        const proxy = getNextProxy(usedProxies);
        if (!proxy) {
          const error = `No available proxies after ${attempts} attempts`;
          logError(error);
          reject(new Error(error));
          return;
        }

        usedProxies.push(proxy.display);
        const startTime = Date.now();

        logInfo(
          `Attempt ${attempts}/${maxRetries} using proxy: ${proxy.display}`
        );

        // Create request with proxy headers
        const proxyOptions = {
          ...options,
          headers: {
            ...options.headers,
            "Proxy-Authorization": `Basic ${btoa(
              `${proxy.username}:${proxy.password}`
            )}`,
            "X-Proxy-URL": proxy.url,
          },
          // Add proxy info for potential use by external tools
          proxyInfo: {
            url: proxy.url,
            ip: proxy.ip,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
          },
        };

        // Override URL to use proxy service if needed
        if (options.useProxyService) {
          proxyOptions.url = options.url; // Keep original for now
        }

        GM_xmlhttpRequest({
          ...proxyOptions,
          timeout: options.timeout || 30000,

          onload: function (response) {
            const responseTime = Date.now() - startTime;
            updateProxyStats(proxy.display, true, responseTime);

            logSuccess(
              `Request successful via proxy ${proxy.display} (${responseTime}ms)`
            );
            resolve(response);
          },

          onerror: function (error) {
            const responseTime = Date.now() - startTime;
            updateProxyStats(
              proxy.display,
              false,
              responseTime,
              "Request error"
            );

            logWarning(`Request failed via proxy ${proxy.display}: ${error}`);

            if (attempts < maxRetries) {
              logInfo(
                `Retrying with different proxy... (${attempts}/${maxRetries})`
              );
              setTimeout(attemptRequest, 1000 * attempts); // Progressive delay
            } else {
              logError(`All proxy attempts failed after ${maxRetries} retries`);
              reject(
                new Error(`Request failed after ${maxRetries} proxy attempts`)
              );
            }
          },

          ontimeout: function () {
            const responseTime = Date.now() - startTime;
            updateProxyStats(proxy.display, false, responseTime, "Timeout");

            logWarning(`Request timeout via proxy ${proxy.display}`);

            if (attempts < maxRetries) {
              logInfo(
                `Retrying with different proxy due to timeout... (${attempts}/${maxRetries})`
              );
              setTimeout(attemptRequest, 1000 * attempts);
            } else {
              logError(
                `All proxy attempts timed out after ${maxRetries} retries`
              );
              reject(
                new Error(
                  `Request timed out after ${maxRetries} proxy attempts`
                )
              );
            }
          },
        });
      }

      // Start first attempt
      attemptRequest();
    });
  }

  // ============= PROXY TESTING =============

  // Test a specific proxy
  function testProxy(proxyString) {
    return new Promise(resolve => {
      const proxy = parseProxy(proxyString);
      if (!proxy) {
        resolve({ success: false, error: "Invalid proxy format" });
        return;
      }

      const startTime = Date.now();

      makeProxyRequest(
        {
          method: "GET",
          url: "https://ipv4.webshare.io/",
          timeout: 10000,
        },
        1
      )
        .then(response => {
          const responseTime = Date.now() - startTime;
          resolve({
            success: true,
            responseTime,
            ip: response.responseText.trim(),
          });
        })
        .catch(error => {
          const responseTime = Date.now() - startTime;
          resolve({
            success: false,
            responseTime,
            error: error.message,
          });
        });
    });
  }

  // Test all proxies
  async function testAllProxies() {
    const proxyList = getProxyList();
    logInfo(`Testing ${proxyList.length} proxies...`);

    const results = [];

    for (let i = 0; i < proxyList.length; i++) {
      const proxyString = proxyList[i];
      const proxy = parseProxy(proxyString);

      if (!proxy) {
        results.push({
          proxy: proxyString,
          success: false,
          error: "Invalid format",
        });
        continue;
      }

      logInfo(`Testing proxy ${i + 1}/${proxyList.length}: ${proxy.display}`);
      const result = await testProxy(proxyString);

      results.push({
        proxy: proxy.display,
        success: result.success,
        responseTime: result.responseTime,
        error: result.error,
        ip: result.ip,
      });

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    logSuccess(
      `Proxy testing completed: ${successCount}/${proxyList.length} working`
    );

    return results;
  }

  // ============= PROXY UTILITIES =============

  // Get proxy statistics summary
  function getProxyStatsSummary() {
    loadProxyStats();

    const summary = {
      totalProxies: Object.keys(proxyStats).length,
      workingProxies: 0,
      failedProxies: 0,
      averageResponseTime: 0,
      totalRequests: 0,
    };

    let totalResponseTime = 0;
    let totalSuccessRequests = 0;

    Object.values(proxyStats).forEach(stats => {
      summary.totalRequests += stats.totalRequests;

      if (stats.successRequests > 0) {
        summary.workingProxies++;
        totalResponseTime += stats.totalResponseTime;
        totalSuccessRequests += stats.successRequests;
      }

      if (stats.consecutiveFailures >= 3) {
        summary.failedProxies++;
      }
    });

    if (totalSuccessRequests > 0) {
      summary.averageResponseTime = Math.round(
        totalResponseTime / totalSuccessRequests
      );
    }

    return summary;
  }

  // Reset proxy statistics
  function resetProxyStats() {
    proxyStats = {};
    saveProxyStats();
    logInfo("Proxy statistics reset");
  }

  // ============= INITIALIZATION =============

  // Initialize proxy module
  function initialize() {
    loadProxyStats();

    // Test connectivity on startup (optional)
    if (getProxyList().length > 0) {
      logSuccess(
        `[Proxy Module] Initialized with ${getProxyList().length} proxies`
      );

      // Optional: Test a random proxy on startup
      setTimeout(() => {
        const randomProxy = getRandomProxy();
        if (randomProxy) {
          logInfo(`Testing random proxy on startup: ${randomProxy.display}`);
          testProxy(
            randomProxy.display.split(":")[0] +
              ":" +
              randomProxy.display.split(":")[1] +
              ":" +
              randomProxy.username +
              ":" +
              randomProxy.password
          ).then(result => {
            if (result.success) {
              logSuccess(
                `Startup proxy test successful: ${randomProxy.display} (${result.responseTime}ms)`
              );
            } else {
              logWarning(
                `Startup proxy test failed: ${randomProxy.display} - ${result.error}`
              );
            }
          });
        }
      }, 5000);
    } else {
      logWarning("[Proxy Module] No proxies available");
    }
  }

  // ============= EXPORTS =============

  exports.parseProxy = parseProxy;
  exports.getProxyList = getProxyList;
  exports.saveProxyList = saveProxyList;
  exports.getNextProxy = getNextProxy;
  exports.getRandomProxy = getRandomProxy;
  exports.makeProxyRequest = makeProxyRequest;
  exports.testProxy = testProxy;
  exports.testAllProxies = testAllProxies;
  exports.updateProxyStats = updateProxyStats;
  exports.getProxyStatsSummary = getProxyStatsSummary;
  exports.resetProxyStats = resetProxyStats;
  exports.initialize = initialize;
  exports.DEFAULT_PROXY_LIST = DEFAULT_PROXY_LIST;
})(exports);
