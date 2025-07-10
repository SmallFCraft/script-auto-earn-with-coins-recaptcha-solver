/**
 * Data Module - Performance Optimized
 * Handles data management with minimal I/O overhead
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  if (!core) {
    throw new Error("Missing core dependency");
  }

  const { log, logInfo, logError, logSuccess, logWarning } = core;

  // ============= OPTIMIZED DATA CACHE =============
  let cache = {
    stats: {
      totalCycles: 0,
      totalCoins: 0,
      startTime: Date.now(),
      sessionStartTime: Date.now(),
    },
    serverStats: {},
    serverLatency: [],
    lastSaveTime: 0,
    dirty: false,
  };

  const SAVE_THROTTLE_MS = 2000; // Save at most every 2s instead of every update

  // ============= OPTIMIZED DATA PERSISTENCE =============

  function saveDataThrottled() {
    const now = Date.now();
    if (now - cache.lastSaveTime < SAVE_THROTTLE_MS && cache.dirty) {
      // Schedule a save instead of saving immediately
      setTimeout(() => {
        if (cache.dirty) {
          forceSaveData();
        }
      }, SAVE_THROTTLE_MS);
      return;
    }
    forceSaveData();
  }

  function forceSaveData() {
    try {
      const dataToSave = {
        stats: cache.stats,
        serverStats: cache.serverStats,
        serverLatency: cache.serverLatency,
        timestamp: Date.now(),
      };

      localStorage.setItem("ateex_data", JSON.stringify(dataToSave));
      cache.lastSaveTime = Date.now();
      cache.dirty = false;
    } catch (error) {
      logError("Save data error: " + error.message);
    }
  }

  function loadSavedStats() {
    try {
      const saved = localStorage.getItem("ateex_data");
      if (saved) {
        const data = JSON.parse(saved);

        // Load with validation
        if (data.stats) {
          cache.stats = {
            totalCycles: data.stats.totalCycles || 0,
            totalCoins: data.stats.totalCoins || 0,
            startTime: data.stats.startTime || Date.now(),
            sessionStartTime: Date.now(),
          };
        }

        if (data.serverStats) {
          cache.serverStats = data.serverStats;
        }

        if (data.serverLatency && Array.isArray(data.serverLatency)) {
          cache.serverLatency = data.serverLatency;
        }

        // Update global state
        core.state.totalCycles = cache.stats.totalCycles;
        core.state.totalCoins = cache.stats.totalCoins;
        core.state.startTime = cache.stats.startTime;
      }
    } catch (error) {
      logError("Load data error: " + error.message);
      // Reset to defaults on error
      resetStats();
    }
  }

  function resetStats() {
    cache.stats = {
      totalCycles: 0,
      totalCoins: 0,
      startTime: Date.now(),
      sessionStartTime: Date.now(),
    };

    cache.serverStats = {};
    cache.serverLatency = [];
    cache.dirty = true;

    // Update global state
    core.state.totalCycles = 0;
    core.state.totalCoins = 0;
    core.state.startTime = Date.now();

    saveDataThrottled();
    logInfo("Stats reset");
  }

  // ============= OPTIMIZED CYCLE MANAGEMENT =============

  function incrementCycle() {
    cache.stats.totalCycles++;
    cache.stats.totalCoins += 1; // Assume 1 coin per cycle
    cache.dirty = true;

    // Update global state
    core.state.totalCycles = cache.stats.totalCycles;
    core.state.totalCoins = cache.stats.totalCoins;
    core.state.lastCycleTime = Date.now();

    // Throttled save
    saveDataThrottled();
  }

  // ============= OPTIMIZED SERVER STATISTICS =============

  function updateServerStats(serverUrl, success, responseTime) {
    if (!cache.serverStats[serverUrl]) {
      cache.serverStats[serverUrl] = {
        totalRequests: 0,
        successfulRequests: 0,
        failures: 0,
        totalResponseTime: 0,
        lastUsed: 0,
      };
    }

    const stats = cache.serverStats[serverUrl];
    stats.totalRequests++;
    stats.totalResponseTime += responseTime;
    stats.lastUsed = Date.now();

    if (success) {
      stats.successfulRequests++;
      // Reset failures on success
      stats.failures = Math.max(0, stats.failures - 1);
    } else {
      stats.failures++;
    }

    cache.dirty = true;
    // Don't save immediately - let throttling handle it
  }

  function getServerStats() {
    return cache.serverStats;
  }

  // ============= OPTIMIZED LATENCY MANAGEMENT =============

  function saveServerLatency(latencyArray) {
    if (Array.isArray(latencyArray) && latencyArray.length > 0) {
      cache.serverLatency = [...latencyArray];
      cache.dirty = true;
      saveDataThrottled();
    }
  }

  function loadServerLatency() {
    return cache.serverLatency.length > 0 ? [...cache.serverLatency] : null;
  }

  // ============= OPTIMIZED BROWSER DATA CLEARING =============

  async function clearBrowserData() {
    const promises = [];

    // Clear various storage types with error handling
    const clearOperations = [
      () => {
        try {
          sessionStorage.clear();
        } catch (e) {
          // Ignore errors
        }
      },
      () => {
        try {
          // Clear only specific items, keep our data
          const itemsToKeep = [
            "ateex_data",
            "ateex_credentials",
            "ateex_auto_stats",
          ];
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if (!itemsToKeep.includes(key)) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Ignore errors
        }
      },
    ];

    // Run clearing operations
    for (const operation of clearOperations) {
      try {
        operation();
      } catch (e) {
        // Ignore individual errors
      }
    }

    // Quick cache clearing for specific domains
    if (typeof caches !== "undefined") {
      try {
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames.map(name => caches.delete(name));
        await Promise.allSettled(deletePromises);
      } catch (e) {
        // Ignore cache clearing errors
      }
    }
  }

  // ============= OPTIMIZED STATS CALCULATIONS =============

  function getStats() {
    const now = Date.now();
    const totalRunTime = now - cache.stats.startTime;
    const sessionRunTime = now - cache.stats.sessionStartTime;

    // Quick calculations without complex math
    const avgCycleTime =
      cache.stats.totalCycles > 0
        ? Math.round(totalRunTime / cache.stats.totalCycles / 1000)
        : 0;

    const coinsPerHour =
      sessionRunTime > 0
        ? Math.round((cache.stats.totalCoins * 3600000) / sessionRunTime)
        : 0;

    return {
      totalCycles: cache.stats.totalCycles,
      totalCoins: cache.stats.totalCoins,
      totalRunTime,
      sessionRunTime,
      avgCycleTime,
      coinsPerHour,
      startTime: cache.stats.startTime,
      sessionStartTime: cache.stats.sessionStartTime,
    };
  }

  // Quick format for display
  function formatRunTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // ============= BROWSER DETECTION =============

  function detectBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("chrome") && !userAgent.includes("edge"))
      return "chrome";
    if (userAgent.includes("firefox")) return "firefox";
    if (userAgent.includes("safari") && !userAgent.includes("chrome"))
      return "safari";
    if (userAgent.includes("edge")) return "edge";
    if (userAgent.includes("opera")) return "opera";

    return "unknown";
  }

  // ============= PERIODIC SAVE =============

  // Auto-save every 30 seconds if dirty
  setInterval(() => {
    if (cache.dirty) {
      forceSaveData();
    }
  }, 30000);

  // Save on page unload
  window.addEventListener("beforeunload", () => {
    if (cache.dirty) {
      forceSaveData();
    }
  });

  // ============= EXPORTS =============
  exports.loadSavedStats = loadSavedStats;
  exports.resetStats = resetStats;
  exports.incrementCycle = incrementCycle;
  exports.updateServerStats = updateServerStats;
  exports.getServerStats = getServerStats;
  exports.saveServerLatency = saveServerLatency;
  exports.loadServerLatency = loadServerLatency;
  exports.clearBrowserData = clearBrowserData;
  exports.getStats = getStats;
  exports.formatRunTime = formatRunTime;
  exports.detectBrowser = detectBrowser;
})(exports);
