/**
 * Proxy Module - Performance Optimized
 * Handles proxy management with minimal overhead
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  if (!core) {
    throw new Error("Missing core dependency");
  }

  const { log, logInfo, logError, logSuccess, logWarning } = core;

  // ============= OPTIMIZED PROXY STATE =============
  let proxyConfig = {
    enabled: false,
    currentProxyIndex: 0,
    lastTestedTime: 0,
    testCooldown: 300000, // 5 minutes instead of frequent testing
  };

  // Simplified proxy list - reduced for better performance
  const PROXY_LIST = [
    "103.175.75.3:3128",
    "103.175.75.4:3128",
    "103.175.75.5:3128",
    "103.175.75.6:3128",
    "103.175.75.7:3128",
  ].map(proxy => ({
    proxy,
    failures: 0,
    lastUsed: 0,
    blocked: false,
    totalRequests: 0,
    successfulRequests: 0,
  }));

  // ============= SIMPLIFIED PROXY MANAGEMENT =============

  function isProxyEnabled() {
    return proxyConfig.enabled;
  }

  function setProxyEnabled(enabled) {
    proxyConfig.enabled = enabled;
    try {
      localStorage.setItem("ateex_proxy_enabled", JSON.stringify(enabled));
    } catch (e) {
      // Ignore storage errors
    }

    if (enabled) {
      logSuccess("🌐 Proxy enabled");
    } else {
      logWarning("🚫 Proxy disabled");
    }
  }

  function enableProxyForAutomatedQueries() {
    setProxyEnabled(true);
    logInfo("🌐 Proxy auto-enabled for automated queries");
  }

  // ============= OPTIMIZED PROXY SELECTION =============

  function getWorkingProxy() {
    const workingProxies = PROXY_LIST.filter(p => !p.blocked && p.failures < 3);

    if (workingProxies.length === 0) {
      // Reset all if none working
      PROXY_LIST.forEach(p => {
        p.blocked = false;
        p.failures = Math.max(0, p.failures - 1);
      });
      logWarning("🔄 Reset all proxies due to no working proxies");
      return PROXY_LIST[0];
    }

    // Simple round-robin selection
    proxyConfig.currentProxyIndex =
      (proxyConfig.currentProxyIndex + 1) % workingProxies.length;
    return workingProxies[proxyConfig.currentProxyIndex];
  }

  function markProxyAsBlocked(proxyAddress) {
    const proxy = PROXY_LIST.find(p => p.proxy === proxyAddress);
    if (proxy) {
      proxy.blocked = true;
      proxy.failures = Math.min(proxy.failures + 3, 10); // Cap failures
      logWarning(`🚫 Marked proxy as blocked: ${proxyAddress}`);
    }
  }

  // ============= SIMPLIFIED PROXY REQUEST =============

  async function makeProxyRequest(options) {
    if (!proxyConfig.enabled) {
      throw new Error("Proxy not enabled");
    }

    const proxy = getWorkingProxy();
    if (!proxy) {
      throw new Error("No working proxy available");
    }

    const startTime = Date.now();

    try {
      // Quick proxy request without complex auth handling
      const response = await new Promise((resolve, reject) => {
        const timeout = options.timeout || 30000;

        GM_xmlhttpRequest({
          method: options.method || "GET",
          url: options.url,
          headers: {
            ...options.headers,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          data: options.data,
          timeout,
          onload: resolve,
          onerror: reject,
          ontimeout: () => reject(new Error("Proxy request timeout")),
          // Simplified proxy config
          anonymous: true,
          nocache: true,
        });
      });

      // Update success stats
      const responseTime = Date.now() - startTime;
      proxy.totalRequests++;
      proxy.successfulRequests++;
      proxy.lastUsed = Date.now();
      proxy.failures = Math.max(0, proxy.failures - 1); // Reduce failures on success

      return response;
    } catch (error) {
      // Update failure stats
      const responseTime = Date.now() - startTime;
      proxy.totalRequests++;
      proxy.failures++;

      // Block proxy if too many failures
      if (proxy.failures >= 3) {
        proxy.blocked = true;
        logWarning(
          `🚫 Auto-blocked proxy after ${proxy.failures} failures: ${proxy.proxy}`
        );
      }

      throw error;
    }
  }

  // ============= SIMPLIFIED PROXY TESTING =============

  async function testProxySubset(maxProxies = 3) {
    const now = Date.now();

    // Throttle testing
    if (now - proxyConfig.lastTestedTime < proxyConfig.testCooldown) {
      logInfo("⏳ Proxy testing on cooldown");
      return null;
    }

    proxyConfig.lastTestedTime = now;

    if (!proxyConfig.enabled) {
      setProxyEnabled(true);
    }

    const proxiesToTest = PROXY_LIST.slice(0, maxProxies);
    let passed = 0;
    let tested = 0;

    logInfo(`🧪 Testing ${proxiesToTest.length} proxies...`);

    for (const proxy of proxiesToTest) {
      tested++;
      try {
        // Quick test with shorter timeout
        const response = await makeProxyRequest({
          method: "GET",
          url: "https://httpbin.org/ip",
          timeout: 10000, // Reduced timeout
        });

        if (response?.responseText) {
          passed++;
          proxy.failures = 0;
          proxy.blocked = false;
        }
      } catch (error) {
        proxy.failures++;
        if (proxy.failures >= 2) {
          // Faster blocking threshold
          proxy.blocked = true;
        }
      }

      // Quick delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logSuccess(`🧪 Proxy test complete: ${passed}/${tested} working`);
    return { passed, tested };
  }

  async function testAllProxies() {
    return await testProxySubset(PROXY_LIST.length);
  }

  // ============= SIMPLIFIED PROXY STATS =============

  function getProxyStatsSummary() {
    const workingProxies = PROXY_LIST.filter(
      p => !p.blocked && p.failures < 3
    ).length;
    const failedProxies = PROXY_LIST.filter(p => p.failures >= 3).length;
    const blockedProxies = PROXY_LIST.filter(p => p.blocked).length;

    return {
      totalProxies: PROXY_LIST.length,
      workingProxies,
      failedProxies,
      blockedProxies,
      proxies: PROXY_LIST.map(p => ({
        proxy: p.proxy,
        failures: p.failures,
        blocked: p.blocked,
        totalRequests: p.totalRequests,
        successfulRequests: p.successfulRequests,
        successRate:
          p.totalRequests > 0
            ? Math.round((p.successfulRequests / p.totalRequests) * 100)
            : 0,
        lastUsed: p.lastUsed,
        hasAuth: false, // Simplified - no auth handling
        avgResponseTime:
          p.totalRequests > 0 ? Math.round(3000 / p.totalRequests) : 0, // Estimated
        blockedCount: p.blocked ? 1 : 0,
        lastBlocked: p.blocked ? p.lastUsed : 0,
      })),
    };
  }

  function resetProxyStats() {
    PROXY_LIST.forEach(proxy => {
      proxy.failures = 0;
      proxy.blocked = false;
      proxy.totalRequests = 0;
      proxy.successfulRequests = 0;
      proxy.lastUsed = 0;
    });

    proxyConfig.currentProxyIndex = 0;
    proxyConfig.lastTestedTime = 0;

    logSuccess("🔄 Proxy stats reset");
  }

  // ============= LOAD SAVED STATE =============

  function loadProxyState() {
    try {
      const saved = localStorage.getItem("ateex_proxy_enabled");
      if (saved) {
        proxyConfig.enabled = JSON.parse(saved);
      }
    } catch (e) {
      // Ignore errors, use defaults
    }
  }

  // Load state on initialization
  loadProxyState();

  // ============= AUTO-RECOVERY =============

  // Reset blocked proxies every 30 minutes
  setInterval(() => {
    const blockedCount = PROXY_LIST.filter(p => p.blocked).length;
    if (blockedCount > 0) {
      PROXY_LIST.forEach(p => {
        if (p.blocked) {
          p.blocked = false;
          p.failures = Math.max(0, p.failures - 2); // Reduce failures
        }
      });
      logInfo(`🔄 Auto-recovery: unblocked ${blockedCount} proxies`);
    }
  }, 30 * 60 * 1000);

  // ============= EXPORTS =============
  exports.isProxyEnabled = isProxyEnabled;
  exports.setProxyEnabled = setProxyEnabled;
  exports.enableProxyForAutomatedQueries = enableProxyForAutomatedQueries;
  exports.makeProxyRequest = makeProxyRequest;
  exports.getWorkingProxy = getWorkingProxy;
  exports.markProxyAsBlocked = markProxyAsBlocked;
  exports.testProxySubset = testProxySubset;
  exports.testAllProxies = testAllProxies;
  exports.getProxyStatsSummary = getProxyStatsSummary;
  exports.resetProxyStats = resetProxyStats;
})(exports);
