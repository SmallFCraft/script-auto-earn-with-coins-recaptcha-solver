/**
 * Server Manager Module - Server selection and performance monitoring
 * Handles server latency testing, scoring, selection, and health monitoring
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const dataModule = AteexModules.dataModule;
  const errorManager = AteexModules.errorManager;

  const { RECAPTCHA_CONFIG, PERFORMANCE_CONFIG, STORAGE_CONFIG } = constants;

  // ============= SERVER MANAGER CLASS =============

  class ServerManager {
    constructor() {
      this.servers = RECAPTCHA_CONFIG.SERVERS;
      this.latencies = Array(this.servers.length).fill(10000);
      this.serverHealth = {};
      this.lastPingTime = 0;
      this.pingInProgress = false;
      this.isInitialized = false;
    }

    // ============= INITIALIZATION =============

    async initialize() {
      try {
        if (this.isInitialized) {
          return true;
        }

        // Load cached latency data
        await this.loadCachedLatencies();

        // Initialize server health tracking
        this.initializeServerHealth();

        // Set up periodic health checks
        this.setupHealthChecks();

        this.isInitialized = true;
        errorManager.logSuccess("Server Manager", "Initialized successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "server_manager_init",
          category: "server",
        });
        return false;
      }
    }

    initializeServerHealth() {
      this.servers.forEach(server => {
        if (!this.serverHealth[server]) {
          this.serverHealth[server] = {
            isHealthy: true,
            lastCheck: 0,
            consecutiveFailures: 0,
            totalRequests: 0,
            successfulRequests: 0,
            averageLatency: 0,
            lastSuccessTime: 0,
          };
        }
      });
    }

    setupHealthChecks() {
      // Check server health every 10 minutes
      setInterval(() => {
        this.performHealthCheck();
      }, 10 * 60 * 1000);
    }

    // ============= LATENCY MANAGEMENT =============

    // Load cached latency data
    async loadCachedLatencies() {
      try {
        const cachedLatencies = await dataModule.loadServerLatency();

        if (cachedLatencies && Array.isArray(cachedLatencies)) {
          // Handle both old array format and new object format
          if (typeof cachedLatencies[0] === "number") {
            // Old format: array of numbers
            this.latencies = cachedLatencies.slice(0, this.servers.length);
          } else {
            // New format: array of objects with server info
            this.latencies = Array(this.servers.length).fill(10000);
            cachedLatencies.forEach(serverData => {
              const index = this.servers.indexOf(serverData.server);
              if (index !== -1 && serverData.success) {
                this.latencies[index] = serverData.latency;
              }
            });
          }

          errorManager.logInfo("Server Manager", "Loaded cached latency data");
        } else {
          errorManager.logInfo(
            "Server Manager",
            "No cached latency data found"
          );
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "load_cached_latencies",
          category: "server",
        });
      }
    }

    // Save latency data to cache
    async saveCachedLatencies() {
      try {
        const latencyData = this.servers.map((server, index) => ({
          server: server,
          latency: this.latencies[index],
          success: this.latencies[index] < 10000,
          timestamp: Date.now(),
        }));

        const success = await dataModule.saveServerLatency(latencyData);

        if (success) {
          errorManager.logInfo("Server Manager", "Latency data cached");
        }

        return success;
      } catch (error) {
        errorManager.handleError(error, {
          context: "save_cached_latencies",
          category: "server",
        });
        return false;
      }
    }

    // ============= SERVER SELECTION =============

    // Get best server based on comprehensive scoring
    getBestServer(excludeServers = []) {
      try {
        const serverStats = dataModule.getServerStats();
        let bestServer = null;
        let bestScore = -1;
        const availableServers = [];

        for (let i = 0; i < this.servers.length; i++) {
          const server = this.servers[i];
          const latency = this.latencies[i];
          const serverStat = serverStats[server];
          const health = this.serverHealth[server];

          // Skip excluded servers
          if (excludeServers.includes(server)) {
            continue;
          }

          // Skip unhealthy servers unless it's the only option
          if (!health?.isHealthy && availableServers.length > 0) {
            continue;
          }

          // Calculate comprehensive score
          const score = this.calculateServerScore(
            server,
            latency,
            serverStat,
            health
          );

          availableServers.push({
            server,
            score,
            latency,
            health: health?.isHealthy || false,
            failures: serverStat?.failures || 0,
          });

          if (score > bestScore) {
            bestScore = score;
            bestServer = server;
          }
        }

        // If no server found, use fallback strategy
        if (!bestServer) {
          return this.getFallbackServer(excludeServers);
        }

        // Validate best server isn't too unreliable
        const bestServerStats = serverStats[bestServer];
        if (bestServerStats && bestServerStats.failures >= 5) {
          errorManager.logWarning(
            "Server Selection",
            `Best server ${bestServer} has many failures, trying alternatives`
          );

          // Sort by score and try next best
          availableServers.sort((a, b) => b.score - a.score);
          for (const serverInfo of availableServers) {
            if (serverInfo.server !== bestServer && serverInfo.failures < 3) {
              errorManager.logInfo(
                "Server Selection",
                `Fallback to: ${serverInfo.server}`
              );
              return serverInfo.server;
            }
          }
        }

        errorManager.logInfo(
          "Server Selection",
          `Selected server: ${bestServer} (score: ${bestScore.toFixed(2)})`
        );

        return bestServer;
      } catch (error) {
        errorManager.handleError(error, {
          context: "get_best_server",
          category: "server",
        });
        return this.getFallbackServer(excludeServers);
      }
    }

    // Calculate comprehensive server score
    calculateServerScore(server, latency, serverStat, health) {
      let score = 0;

      // Base score from latency (0-1000 points, lower latency = higher score)
      const maxAcceptableLatency = 10000;
      const latencyScore = Math.max(
        0,
        1000 - (latency / maxAcceptableLatency) * 1000
      );
      score += latencyScore * 0.4; // 40% weight

      // Success rate score (0-1000 points)
      if (serverStat && serverStat.totalRequests > 0) {
        const successRate =
          serverStat.successfulRequests / serverStat.totalRequests;
        score += successRate * 1000 * 0.3; // 30% weight

        // Response time bonus (if available)
        if (serverStat.averageResponseTime) {
          const responseTimeScore = Math.max(
            0,
            200 - serverStat.averageResponseTime / 100
          );
          score += responseTimeScore * 0.2; // 20% weight
        }
      }

      // Health score (0-200 points)
      if (health) {
        if (health.isHealthy) {
          score += 200 * 0.1; // 10% weight
        }

        // Penalty for consecutive failures
        score -= health.consecutiveFailures * 50;

        // Bonus for recent success
        const timeSinceSuccess = Date.now() - (health.lastSuccessTime || 0);
        if (timeSinceSuccess < 60000) {
          // Within last minute
          score += 100;
        }
      }

      // Penalties
      if (serverStat) {
        // Heavy penalty for current failures
        score -= (serverStat.failures || 0) * 200;

        // Penalty for low request count (untested server)
        if (serverStat.totalRequests < 5) {
          score -= 100;
        }
      }

      return Math.max(0, score);
    }

    // Get fallback server when no good options available
    getFallbackServer(excludeServers = []) {
      const availableServers = this.servers.filter(
        server => !excludeServers.includes(server)
      );

      if (availableServers.length === 0) {
        errorManager.logWarning(
          "Server Selection",
          "No servers available, using first server"
        );
        return this.servers[0];
      }

      // Return server with lowest latency as fallback
      let bestLatency = Infinity;
      let fallbackServer = availableServers[0];

      availableServers.forEach(server => {
        const index = this.servers.indexOf(server);
        if (index !== -1 && this.latencies[index] < bestLatency) {
          bestLatency = this.latencies[index];
          fallbackServer = server;
        }
      });

      errorManager.logInfo(
        "Server Selection",
        `Using fallback server: ${fallbackServer}`
      );
      return fallbackServer;
    }

    // ============= SERVER TESTING =============

    // Test server latency
    async testServerLatency(server, timeout = 8000) {
      return new Promise(resolve => {
        const startTime = Date.now();

        GM_xmlhttpRequest({
          method: "GET",
          url: server,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          data: "",
          timeout: timeout,
          onload: response => {
            const endTime = Date.now();
            const latency = endTime - startTime;

            const success = response && response.responseText === "0";

            if (success) {
              // Update latency array
              const index = this.servers.indexOf(server);
              if (index !== -1) {
                this.latencies[index] = latency;
              }

              // Update health
              this.updateServerHealth(server, true, latency);

              errorManager.logInfo("Server Test", `${server}: ${latency}ms`);
            } else {
              this.updateServerHealth(server, false, latency);
              errorManager.logWarning(
                "Server Test",
                `${server}: Invalid response`
              );
            }

            // Update server stats
            dataModule.updateServerStats(server, success, latency);

            resolve({
              server,
              latency,
              success,
              timestamp: endTime,
            });
          },
          onerror: error => {
            const endTime = Date.now();
            const latency = endTime - startTime;

            this.updateServerHealth(server, false, latency);
            dataModule.updateServerStats(server, false, latency);

            errorManager.logError("Server Test", `${server}: ${error}`);

            resolve({
              server,
              latency: Infinity,
              success: false,
              error: error.toString(),
              timestamp: endTime,
            });
          },
          ontimeout: () => {
            this.updateServerHealth(server, false, timeout);
            dataModule.updateServerStats(server, false, timeout);

            errorManager.logWarning("Server Test", `${server}: Timeout`);

            resolve({
              server,
              latency: Infinity,
              success: false,
              error: "Timeout",
              timestamp: Date.now(),
            });
          },
        });
      });
    }

    // Test all servers
    async testAllServers() {
      if (this.pingInProgress) {
        errorManager.logInfo("Server Test", "Ping already in progress");
        return [];
      }

      try {
        this.pingInProgress = true;
        errorManager.logInfo(
          "Server Test",
          `Testing ${this.servers.length} servers...`
        );

        const testPromises = this.servers.map(server =>
          this.testServerLatency(server)
        );

        const results = await Promise.all(testPromises);

        // Save results to cache
        await this.saveCachedLatencies();

        this.lastPingTime = Date.now();

        // Log summary
        const successfulTests = results.filter(r => r.success).length;
        errorManager.logSuccess(
          "Server Test",
          `Completed testing: ${successfulTests}/${results.length} servers responded`
        );

        return results;
      } catch (error) {
        errorManager.handleError(error, {
          context: "test_all_servers",
          category: "server",
        });
        return [];
      } finally {
        this.pingInProgress = false;
      }
    }

    // ============= HEALTH MONITORING =============

    // Update server health status
    updateServerHealth(server, success, responseTime) {
      if (!this.serverHealth[server]) {
        this.initializeServerHealth();
      }

      const health = this.serverHealth[server];
      health.lastCheck = Date.now();
      health.totalRequests++;

      if (success) {
        health.successfulRequests++;
        health.consecutiveFailures = 0;
        health.isHealthy = true;
        health.lastSuccessTime = Date.now();

        // Update average latency
        health.averageLatency =
          (health.averageLatency * (health.successfulRequests - 1) +
            responseTime) /
          health.successfulRequests;
      } else {
        health.consecutiveFailures++;

        // Mark as unhealthy after 3 consecutive failures
        if (health.consecutiveFailures >= 3) {
          health.isHealthy = false;
          errorManager.logWarning(
            "Server Health",
            `Server ${server} marked as unhealthy (${health.consecutiveFailures} failures)`
          );
        }
      }
    }

    // Perform health check on all servers
    async performHealthCheck() {
      try {
        errorManager.logInfo("Health Check", "Starting server health check...");

        const healthPromises = this.servers.map(
          server => this.testServerLatency(server, 5000) // Shorter timeout for health checks
        );

        const results = await Promise.all(healthPromises);

        // Analyze results
        const healthyServers = results.filter(r => r.success).length;
        const totalServers = results.length;

        if (healthyServers === 0) {
          errorManager.logError("Health Check", "No servers are responding!");
        } else if (healthyServers < totalServers * 0.5) {
          errorManager.logWarning(
            "Health Check",
            `Only ${healthyServers}/${totalServers} servers are healthy`
          );
        } else {
          errorManager.logSuccess(
            "Health Check",
            `${healthyServers}/${totalServers} servers are healthy`
          );
        }

        return results;
      } catch (error) {
        errorManager.handleError(error, {
          context: "perform_health_check",
          category: "server",
        });
        return [];
      }
    }

    // Get server health status
    getServerHealth() {
      return this.serverHealth;
    }

    // Get healthy servers only
    getHealthyServers() {
      return this.servers.filter(
        server => this.serverHealth[server]?.isHealthy !== false
      );
    }

    // ============= RECOVERY OPERATIONS =============

    // Reset server failures (useful after extended downtime)
    resetServerFailures() {
      try {
        let resetCount = 0;

        Object.keys(this.serverHealth).forEach(server => {
          if (this.serverHealth[server].consecutiveFailures > 0) {
            this.serverHealth[server].consecutiveFailures = 0;
            this.serverHealth[server].isHealthy = true;
            resetCount++;
          }
        });

        // Also reset data module failures
        const dataResetCount = dataModule.resetServerFailures();

        errorManager.logInfo(
          "Server Recovery",
          `Reset failures for ${resetCount} servers (data: ${dataResetCount})`
        );

        return resetCount;
      } catch (error) {
        errorManager.handleError(error, {
          context: "reset_server_failures",
          category: "server",
        });
        return 0;
      }
    }

    // Force refresh server latencies
    async refreshServerLatencies() {
      try {
        errorManager.logInfo("Server Refresh", "Forcing latency refresh...");

        // Reset latencies to default
        this.latencies = Array(this.servers.length).fill(10000);

        // Test all servers
        await this.testAllServers();

        errorManager.logSuccess("Server Refresh", "Server latencies refreshed");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "refresh_server_latencies",
          category: "server",
        });
        return false;
      }
    }

    // ============= UTILITY FUNCTIONS =============

    // Check if latency data is outdated
    isLatencyDataOutdated() {
      const maxAge = 30 * 60 * 1000; // 30 minutes
      return Date.now() - this.lastPingTime > maxAge;
    }

    // Get server statistics summary
    getServerSummary() {
      const stats = dataModule.getServerStats();

      return this.servers
        .map((server, index) => ({
          server,
          latency: this.latencies[index],
          health: this.serverHealth[server],
          stats: stats[server] || null,
          score: this.calculateServerScore(
            server,
            this.latencies[index],
            stats[server],
            this.serverHealth[server]
          ),
        }))
        .sort((a, b) => b.score - a.score);
    }

    // ============= AUTO-TESTING LOGIC =============

    // Auto-test servers if needed
    async autoTestIfNeeded() {
      try {
        // Test if we need to refresh latencies
        const shouldTest =
          this.isLatencyDataOutdated() ||
          this.getHealthyServers().length === 0 ||
          this.latencies.every(latency => latency >= 10000);

        if (shouldTest && !this.pingInProgress) {
          errorManager.logInfo(
            "Auto Test",
            "Auto-testing servers due to outdated/missing data"
          );
          await this.testAllServers();
        }

        return shouldTest;
      } catch (error) {
        errorManager.handleError(error, {
          context: "auto_test_if_needed",
          category: "server",
        });
        return false;
      }
    }

    // ============= CLEANUP =============

    cleanup() {
      // Save final latency data
      this.saveCachedLatencies();

      errorManager.logInfo("Server Manager", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const serverManager = new ServerManager();

  // ============= EXPORTS =============

  exports.ServerManager = ServerManager;
  exports.serverManager = serverManager;

  // Main API
  exports.initialize = () => serverManager.initialize();
  exports.getBestServer = excludeServers =>
    serverManager.getBestServer(excludeServers);
  exports.testAllServers = () => serverManager.testAllServers();
  exports.autoTestIfNeeded = () => serverManager.autoTestIfNeeded();

  // Server testing
  exports.testServerLatency = (server, timeout) =>
    serverManager.testServerLatency(server, timeout);
  exports.performHealthCheck = () => serverManager.performHealthCheck();

  // Health and status
  exports.getServerHealth = () => serverManager.getServerHealth();
  exports.getHealthyServers = () => serverManager.getHealthyServers();
  exports.getServerSummary = () => serverManager.getServerSummary();

  // Recovery operations
  exports.resetServerFailures = () => serverManager.resetServerFailures();
  exports.refreshServerLatencies = () => serverManager.refreshServerLatencies();

  // Utilities
  exports.isLatencyDataOutdated = () => serverManager.isLatencyDataOutdated();
  exports.cleanup = () => serverManager.cleanup();

  // Legacy exports for backward compatibility
  exports.servers = serverManager.servers;
  exports.latencies = serverManager.latencies;
})(exports);
