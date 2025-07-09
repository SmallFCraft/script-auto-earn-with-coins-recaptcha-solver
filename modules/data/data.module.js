/**
 * Data Module - Data orchestration, server management, and browser data operations
 * Handles server statistics, browser data clearing, synchronization, and data integrity
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const statsManager = AteexModules.statsManager;
  const storageManager = AteexModules.storageManager;
  const errorManager = AteexModules.errorManager;

  const { DATA_CONFIG, STORAGE_CONFIG, RECAPTCHA_CONFIG, PERFORMANCE_CONFIG } =
    constants;

  // ============= DATA MANAGER CLASS =============

  class DataManager {
    constructor() {
      this.serverStats = {};
      this.serverLatencyCache = null;
      this.lastSyncTime = Date.now();
      this.syncInterval = null;
      this.isInitialized = false;
    }

    // ============= INITIALIZATION =============

    async initialize() {
      try {
        if (this.isInitialized) {
          return true;
        }

        // Initialize stats manager first
        await statsManager.initialize();

        // Load server data
        await this.loadServerStats();
        await this.loadServerLatency();

        // Set up periodic sync
        this.setupPeriodicSync();

        // Set up event listeners
        this.setupEventListeners();

        this.isInitialized = true;
        errorManager.logSuccess("Data Manager", "Initialized successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "data_manager_init",
          category: "data",
        });
        return false;
      }
    }

    setupPeriodicSync() {
      // Sync data every 5 minutes
      this.syncInterval = setInterval(() => {
        this.syncAllData();
      }, 5 * 60 * 1000);
    }

    setupEventListeners() {
      // Listen for core events
      if (coreModule.on) {
        coreModule.on("beforeunload", () => {
          this.syncAllData();
        });

        coreModule.on("targetReached", data => {
          // Save final stats when target is reached
          this.saveServerStats();
        });
      }
    }

    // ============= SERVER STATISTICS MANAGEMENT =============

    // Load server statistics from storage
    async loadServerStats() {
      try {
        const saved = storageManager.getStats(
          STORAGE_CONFIG.KEYS.SERVER_LATENCY,
          {}
        );

        if (saved && typeof saved === "object") {
          this.serverStats = saved;
          errorManager.logInfo(
            "Server Stats",
            `Loaded statistics for ${Object.keys(saved).length} servers`
          );
        } else {
          this.serverStats = {};
          errorManager.logInfo(
            "Server Stats",
            "No server statistics found, starting fresh"
          );
        }

        return this.serverStats;
      } catch (error) {
        errorManager.handleError(error, {
          context: "load_server_stats",
          category: "data",
        });
        this.serverStats = {};
        return {};
      }
    }

    // Save server statistics to storage (debounced)
    saveServerStats() {
      try {
        const success = storageManager.setStats(
          "server_stats",
          this.serverStats
        );

        if (success) {
          errorManager.logInfo("Server Stats", "Server statistics saved");
        }

        return success;
      } catch (error) {
        errorManager.handleError(error, {
          context: "save_server_stats",
          category: "data",
        });
        return false;
      }
    }

    // Update server statistics with throttling
    updateServerStats(serverUrl, success, responseTime) {
      try {
        if (!this.serverStats[serverUrl]) {
          this.serverStats[serverUrl] = {
            totalRequests: 0,
            successfulRequests: 0,
            totalResponseTime: 0,
            lastUsed: 0,
            failures: 0,
            averageResponseTime: 0,
            successRate: 0,
            createdAt: Date.now(),
          };
        }

        const serverStat = this.serverStats[serverUrl];
        serverStat.totalRequests++;
        serverStat.lastUsed = Date.now();

        if (success) {
          serverStat.successfulRequests++;
          serverStat.totalResponseTime += responseTime;
          serverStat.failures = 0; // Reset failure count on success
          serverStat.averageResponseTime = Math.round(
            serverStat.totalResponseTime / serverStat.successfulRequests
          );
        } else {
          serverStat.failures++;
        }

        // Calculate success rate
        serverStat.successRate = Math.round(
          (serverStat.successfulRequests / serverStat.totalRequests) * 100
        );

        // Throttled save to reduce storage overhead
        clearTimeout(this.serverStatsTimeout);
        this.serverStatsTimeout = setTimeout(() => {
          this.saveServerStats();
        }, PERFORMANCE_CONFIG.THROTTLE_LIMITS.API_CALLS);

        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "update_server_stats",
          category: "data",
          serverUrl: serverUrl,
        });
        return false;
      }
    }

    // Get server statistics
    getServerStats() {
      return this.serverStats;
    }

    // Get best performing servers
    getBestServers(limit = 3) {
      try {
        const servers = Object.entries(this.serverStats)
          .map(([url, stats]) => ({
            url,
            ...stats,
            score: this.calculateServerScore(stats),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        return servers;
      } catch (error) {
        errorManager.handleError(error, {
          context: "get_best_servers",
          category: "data",
        });
        return [];
      }
    }

    // Calculate server performance score
    calculateServerScore(stats) {
      if (stats.totalRequests === 0) return 0;

      const successWeight = 0.6;
      const speedWeight = 0.3;
      const reliabilityWeight = 0.1;

      // Success rate score (0-100)
      const successScore = stats.successRate;

      // Speed score (inverse of response time, normalized)
      const maxAcceptableTime = 5000; // 5 seconds
      const speedScore = Math.max(
        0,
        100 - (stats.averageResponseTime / maxAcceptableTime) * 100
      );

      // Reliability score (based on consecutive failures)
      const reliabilityScore = Math.max(0, 100 - stats.failures * 20);

      return (
        successScore * successWeight +
        speedScore * speedWeight +
        reliabilityScore * reliabilityWeight
      );
    }

    // Reset server failure counts
    resetServerFailures() {
      try {
        let resetCount = 0;

        for (const serverUrl in this.serverStats) {
          if (this.serverStats[serverUrl].failures > 0) {
            this.serverStats[serverUrl].failures = 0;
            resetCount++;
          }
        }

        if (resetCount > 0) {
          this.saveServerStats();
          errorManager.logInfo(
            "Server Stats",
            `Reset failure count for ${resetCount} servers`
          );
        }

        return resetCount;
      } catch (error) {
        errorManager.handleError(error, {
          context: "reset_server_failures",
          category: "data",
        });
        return 0;
      }
    }

    // ============= SERVER LATENCY MANAGEMENT =============

    // Load server latency from cache
    async loadServerLatency() {
      try {
        const saved = storageManager.getCache(
          STORAGE_CONFIG.KEYS.SERVER_LATENCY
        );

        if (saved) {
          this.serverLatencyCache = saved;
          errorManager.logInfo(
            "Server Latency",
            "Loaded cached server latency data"
          );
          return saved;
        } else {
          errorManager.logInfo(
            "Server Latency",
            "No cached latency data found"
          );
          return null;
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "load_server_latency",
          category: "data",
        });
        return null;
      }
    }

    // Save server latency to cache
    saveServerLatency(latencies) {
      try {
        const success = storageManager.setCache(
          STORAGE_CONFIG.KEYS.SERVER_LATENCY,
          latencies,
          STORAGE_CONFIG.EXPIRY.SERVER_LATENCY
        );

        if (success) {
          this.serverLatencyCache = latencies;
          errorManager.logInfo("Server Latency", "Server latency cached");
        }

        return success;
      } catch (error) {
        errorManager.handleError(error, {
          context: "save_server_latency",
          category: "data",
        });
        return false;
      }
    }

    // Test server latency
    async testServerLatency(serverUrl, timeout = 5000) {
      try {
        const startTime = Date.now();

        const response = await fetch(serverUrl + "/health", {
          method: "GET",
          mode: "no-cors",
          cache: "no-cache",
          signal: AbortSignal.timeout(timeout),
        });

        const endTime = Date.now();
        const latency = endTime - startTime;

        return {
          server: serverUrl,
          latency: latency,
          success: true,
          timestamp: endTime,
        };
      } catch (error) {
        return {
          server: serverUrl,
          latency: Infinity,
          success: false,
          error: error.message,
          timestamp: Date.now(),
        };
      }
    }

    // Test all configured servers
    async testAllServers() {
      try {
        const servers = RECAPTCHA_CONFIG.SERVERS;
        const latencyPromises = servers.map(server =>
          this.testServerLatency(server)
        );

        const results = await Promise.all(latencyPromises);

        // Save results to cache
        this.saveServerLatency(results);

        errorManager.logInfo("Server Test", `Tested ${results.length} servers`);
        return results;
      } catch (error) {
        errorManager.handleError(error, {
          context: "test_all_servers",
          category: "data",
        });
        return [];
      }
    }

    // ============= BROWSER DATA MANAGEMENT =============

    // Clear browser data while preserving important information
    async clearBrowserData() {
      try {
        errorManager.logInfo("Data Clear", "Starting browser data clear...");

        // Get data to preserve
        const dataToPreserve = await this.getDataToPreserve();

        // Clear all storage
        await this.clearAllStorage();

        // Restore preserved data
        await this.restorePreservedData(dataToPreserve);

        // Clear additional browser data
        await this.clearCookiesAndDatabases();

        // Log summary
        this.logClearSummary(dataToPreserve);

        errorManager.logSuccess(
          "Data Clear",
          "Browser data cleared successfully"
        );
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "clear_browser_data",
          category: "data",
        });
        return false;
      }
    }

    // Get data that should be preserved during clearing
    async getDataToPreserve() {
      const dataToPreserve = {};

      try {
        // Stats data
        const currentStats = statsManager.getPerformanceMetrics();
        if (currentStats) {
          dataToPreserve.stats = currentStats;
        }

        // Credentials (only if not expired)
        const credentialsExpiry = storageManager.get(
          STORAGE_CONFIG.KEYS.CREDENTIALS_EXPIRY
        );
        if (credentialsExpiry && Date.now() < parseInt(credentialsExpiry)) {
          const credentials = storageManager.getSecureData(
            STORAGE_CONFIG.KEYS.CREDENTIALS
          );
          if (credentials) {
            dataToPreserve.credentials = credentials;
            dataToPreserve.credentialsExpiry = credentialsExpiry;
            errorManager.logInfo(
              "Data Preserve",
              "Valid credentials will be preserved"
            );
          }
        }

        // Target coins
        const targetCoins = statsManager.getTargetCoins();
        if (targetCoins) {
          dataToPreserve.targetCoins = targetCoins;
        }

        // Stats history
        const statsHistory = statsManager.getStatsHistory();
        if (statsHistory && statsHistory.length > 0) {
          dataToPreserve.statsHistory = statsHistory;
        }

        // Server statistics
        if (Object.keys(this.serverStats).length > 0) {
          dataToPreserve.serverStats = this.serverStats;
        }

        // Auto stats state
        const autoStatsEnabled = storageManager.getSettings(
          STORAGE_CONFIG.KEYS.AUTO_STATS_ENABLED
        );
        if (autoStatsEnabled) {
          dataToPreserve.autoStatsEnabled = autoStatsEnabled;
        }

        return dataToPreserve;
      } catch (error) {
        errorManager.handleError(error, {
          context: "get_data_to_preserve",
          category: "data",
        });
        return {};
      }
    }

    // Clear all storage systems
    async clearAllStorage() {
      try {
        // Clear localStorage
        localStorage.clear();

        // Clear sessionStorage
        sessionStorage.clear();

        errorManager.logInfo("Data Clear", "Storage cleared");
      } catch (error) {
        errorManager.handleError(error, {
          context: "clear_all_storage",
          category: "data",
        });
      }
    }

    // Restore preserved data after clearing
    async restorePreservedData(dataToPreserve) {
      try {
        let restoredCount = 0;

        // Restore stats
        if (dataToPreserve.stats) {
          statsManager.importStats(
            JSON.stringify({
              version: "4.0.0",
              stats: dataToPreserve.stats.basic,
              history: dataToPreserve.statsHistory || [],
            })
          );
          restoredCount++;
        }

        // Restore credentials
        if (dataToPreserve.credentials && dataToPreserve.credentialsExpiry) {
          storageManager.setSecureData(
            STORAGE_CONFIG.KEYS.CREDENTIALS,
            dataToPreserve.credentials
          );
          storageManager.set(
            STORAGE_CONFIG.KEYS.CREDENTIALS_EXPIRY,
            dataToPreserve.credentialsExpiry
          );
          restoredCount++;
        }

        // Restore target coins
        if (dataToPreserve.targetCoins) {
          statsManager.setTargetCoins(dataToPreserve.targetCoins);
          restoredCount++;
        }

        // Restore server stats
        if (dataToPreserve.serverStats) {
          this.serverStats = dataToPreserve.serverStats;
          this.saveServerStats();
          restoredCount++;
        }

        // Restore auto stats state
        if (dataToPreserve.autoStatsEnabled) {
          storageManager.setSettings(
            STORAGE_CONFIG.KEYS.AUTO_STATS_ENABLED,
            dataToPreserve.autoStatsEnabled
          );
          restoredCount++;
        }

        errorManager.logInfo(
          "Data Restore",
          `Restored ${restoredCount} preserved items`
        );
        return restoredCount;
      } catch (error) {
        errorManager.handleError(error, {
          context: "restore_preserved_data",
          category: "data",
        });
        return 0;
      }
    }

    // Clear cookies and databases
    async clearCookiesAndDatabases() {
      try {
        // Clear cookies
        document.cookie.split(";").forEach(c => {
          const name = c.split("=")[0].trim();
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        });

        // Clear IndexedDB databases
        if (window.indexedDB && indexedDB.databases) {
          try {
            const databases = await indexedDB.databases();
            for (const db of databases) {
              if (db.name) {
                indexedDB.deleteDatabase(db.name);
              }
            }
          } catch (e) {
            // Ignore errors for databases we can't access
          }
        }

        errorManager.logInfo("Data Clear", "Cookies and databases cleared");
      } catch (error) {
        errorManager.handleError(error, {
          context: "clear_cookies_databases",
          category: "data",
        });
      }
    }

    // Log summary of clearing operation
    logClearSummary(dataToPreserved) {
      const preservedItems = Object.keys(dataToPreserved).length;

      if (preservedItems > 0) {
        errorManager.logSuccess(
          "Data Clear",
          `Browser data cleared, preserved ${preservedItems} important items`
        );

        // Log specific preserved items
        Object.keys(dataToPreserved).forEach(key => {
          errorManager.logInfo(
            "Preserved",
            `${key}: ${typeof dataToPreserved[key]}`
          );
        });
      } else {
        errorManager.logWarning(
          "Data Clear",
          "Browser data cleared, no items preserved"
        );
      }
    }

    // ============= DATA SYNCHRONIZATION =============

    // Synchronize all data systems
    async syncAllData() {
      try {
        const syncStartTime = Date.now();

        // Sync stats
        await statsManager.saveStats();

        // Sync server stats
        this.saveServerStats();

        // Verify important data integrity
        await this.verifyDataIntegrity();

        this.lastSyncTime = Date.now();
        const syncDuration = this.lastSyncTime - syncStartTime;

        errorManager.logInfo(
          "Data Sync",
          `Synchronization completed in ${syncDuration}ms`
        );
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "sync_all_data",
          category: "data",
        });
        return false;
      }
    }

    // Verify data integrity
    async verifyDataIntegrity() {
      try {
        const issues = [];

        // Check stats consistency
        const currentStats = statsManager.getPerformanceMetrics();
        if (!currentStats || !currentStats.basic) {
          issues.push("Stats data inconsistency detected");
        }

        // Check target coins
        const targetCoins = statsManager.getTargetCoins();
        if (!targetCoins || targetCoins < DATA_CONFIG.TARGETS.MIN_COINS) {
          issues.push("Invalid target coins value");
          statsManager.setTargetCoins(DATA_CONFIG.TARGETS.DEFAULT_COINS);
        }

        // Check server stats structure
        for (const [url, stats] of Object.entries(this.serverStats)) {
          if (!stats.totalRequests || typeof stats.successRate !== "number") {
            issues.push(`Invalid server stats for ${url}`);
            delete this.serverStats[url];
          }
        }

        if (issues.length > 0) {
          errorManager.logWarning(
            "Data Integrity",
            `Found ${issues.length} issues`,
            { issues }
          );
        }

        return issues.length === 0;
      } catch (error) {
        errorManager.handleError(error, {
          context: "verify_data_integrity",
          category: "data",
        });
        return false;
      }
    }

    // ============= DATA EXPORT/IMPORT =============

    // Export all data
    exportAllData() {
      try {
        const exportData = {
          version: "4.0.0",
          timestamp: Date.now(),
          stats: statsManager.exportStats(),
          serverStats: this.serverStats,
          targetCoins: statsManager.getTargetCoins(),
          lastSync: this.lastSyncTime,
        };

        return JSON.stringify(exportData, null, 2);
      } catch (error) {
        errorManager.handleError(error, {
          context: "export_all_data",
          category: "data",
        });
        return null;
      }
    }

    // Import all data
    importAllData(jsonData) {
      try {
        const importData = JSON.parse(jsonData);

        if (!importData.version || !importData.stats) {
          throw new Error("Invalid import data format");
        }

        // Import stats
        if (importData.stats) {
          statsManager.importStats(importData.stats);
        }

        // Import server stats
        if (importData.serverStats) {
          this.serverStats = importData.serverStats;
          this.saveServerStats();
        }

        // Import target coins
        if (importData.targetCoins) {
          statsManager.setTargetCoins(importData.targetCoins);
        }

        // Sync after import
        this.syncAllData();

        errorManager.logSuccess("Import", "All data imported successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "import_all_data",
          category: "data",
        });
        return false;
      }
    }

    // ============= CLEANUP =============

    cleanup() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }

      if (this.serverStatsTimeout) {
        clearTimeout(this.serverStatsTimeout);
      }

      // Final sync
      this.syncAllData();

      this.isInitialized = false;
      errorManager.logInfo("Data Manager", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const dataManager = new DataManager();

  // ============= EXPORTS =============

  exports.DataManager = DataManager;
  exports.dataManager = dataManager;

  // Main API
  exports.initialize = () => dataManager.initialize();
  exports.syncAllData = () => dataManager.syncAllData();
  exports.clearBrowserData = () => dataManager.clearBrowserData();

  // Server management
  exports.updateServerStats = (url, success, time) =>
    dataManager.updateServerStats(url, success, time);
  exports.getServerStats = () => dataManager.getServerStats();
  exports.getBestServers = limit => dataManager.getBestServers(limit);
  exports.resetServerFailures = () => dataManager.resetServerFailures();
  exports.testAllServers = () => dataManager.testAllServers();

  // Server latency
  exports.loadServerLatency = () => dataManager.loadServerLatency();
  exports.saveServerLatency = latencies =>
    dataManager.saveServerLatency(latencies);

  // Data export/import
  exports.exportAllData = () => dataManager.exportAllData();
  exports.importAllData = jsonData => dataManager.importAllData(jsonData);

  // Cleanup
  exports.cleanup = () => dataManager.cleanup();

  // Re-export stats manager functions for backward compatibility
  exports.getTargetCoins = () => statsManager.getTargetCoins();
  exports.setTargetCoins = target => statsManager.setTargetCoins(target);
  exports.incrementCycle = coinsEarned =>
    statsManager.incrementCycle(coinsEarned);
  exports.saveStatsToHistory = () => statsManager.saveStatsToHistory();
  exports.getStatsHistory = () => statsManager.getStatsHistory();
  exports.loadSavedStats = () => statsManager.loadSavedStats();
})(exports);
