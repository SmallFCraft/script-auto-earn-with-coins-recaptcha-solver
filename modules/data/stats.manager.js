/**
 * Stats Manager Module - Statistics tracking and calculation
 * Handles cycle counting, target management, history tracking, and performance metrics
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const storageManager = AteexModules.storageManager;
  const errorManager = AteexModules.errorManager;

  const { DATA_CONFIG, STORAGE_CONFIG, PERFORMANCE_CONFIG } = constants;

  // ============= STATS MANAGER CLASS =============

  class StatsManager {
    constructor() {
      this.stats = {
        totalCycles: 0,
        totalCoins: 0,
        startTime: Date.now(),
        lastCycleTime: null,
        autoStatsStartTime: null,
        targetCoins: DATA_CONFIG.TARGETS.DEFAULT_COINS,
      };

      this.history = [];
      this.isAutoStatsEnabled = false;

      // Debounced save function to prevent excessive storage writes
      this.debouncedSave = this.debounce(
        () => this.saveStats(),
        PERFORMANCE_CONFIG.DEBOUNCE_DELAYS.STATS_SAVE
      );
    }

    // ============= INITIALIZATION =============

    async initialize() {
      try {
        await this.loadSavedStats();
        await this.loadTargetCoins();
        await this.loadStatsHistory();

        // Set up periodic auto-save
        this.setupAutoSave();

        errorManager.logSuccess("Stats Manager", "Initialized successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "stats_manager_init",
          category: "data",
        });
        return false;
      }
    }

    setupAutoSave() {
      // Auto-save every 30 seconds
      setInterval(() => {
        this.saveStats();
      }, DATA_CONFIG.STATS.SAVE_INTERVAL);
    }

    // ============= BASIC STATS OPERATIONS =============

    // Load saved statistics from storage
    async loadSavedStats() {
      try {
        const saved = storageManager.getStats("main_stats");

        if (saved) {
          this.stats = {
            ...this.stats,
            ...saved,
            // Ensure required fields exist
            totalCycles: saved.totalCycles || 0,
            totalCoins: saved.totalCoins || 0,
            startTime: saved.startTime || Date.now(),
            lastCycleTime: saved.lastCycleTime || null,
            autoStatsStartTime: saved.autoStatsStartTime || null,
          };

          errorManager.logSuccess(
            "Stats",
            `📊 Loaded saved stats: ${this.stats.totalCycles} cycles, ${this.stats.totalCoins} coins`
          );
          return true;
        } else {
          // Initialize with defaults
          this.stats.startTime = Date.now();
          errorManager.logInfo("Stats", "No saved stats found, using defaults");
          return false;
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "load_saved_stats",
          category: "data",
        });

        // Initialize with defaults on error
        this.resetStats();
        return false;
      }
    }

    // Save statistics to storage
    saveStats() {
      try {
        const statsToSave = {
          ...this.stats,
          lastSaved: Date.now(),
          version: "4.0.0",
        };

        const success = storageManager.setStats("main_stats", statsToSave);

        if (success) {
          // Also save backup
          storageManager.setStats("main_stats_backup", statsToSave);
        }

        return success;
      } catch (error) {
        errorManager.handleError(error, {
          context: "save_stats",
          category: "data",
        });
        return false;
      }
    }

    // Reset all statistics
    resetStats() {
      this.stats = {
        totalCycles: 0,
        totalCoins: 0,
        startTime: Date.now(),
        lastCycleTime: null,
        autoStatsStartTime: null,
        targetCoins: this.stats.targetCoins, // Preserve target
      };

      this.saveStats();
      errorManager.logInfo("Stats", "Statistics reset to defaults");
    }

    // ============= CYCLE MANAGEMENT =============

    // Increment cycle count and coins
    incrementCycle(coinsEarned = 15) {
      try {
        const now = Date.now();

        this.stats.totalCycles++;
        this.stats.totalCoins += coinsEarned;
        this.stats.lastCycleTime = now;

        // Set auto stats start time if not set and auto stats is enabled
        if (this.isAutoStatsEnabled && !this.stats.autoStatsStartTime) {
          this.stats.autoStatsStartTime = now;
        }

        errorManager.logSuccess(
          "Cycle",
          `Cycle ${this.stats.totalCycles} completed! Total coins: ${this.stats.totalCoins} (+${coinsEarned})`
        );

        // Save to history periodically
        if (this.stats.totalCycles % 5 === 0) {
          this.saveStatsToHistory();
        }

        // Check if target reached
        if (this.stats.totalCoins >= this.stats.targetCoins) {
          this.onTargetReached();
        }

        // Debounced save to prevent excessive writes
        this.debouncedSave();

        return this.stats.totalCycles;
      } catch (error) {
        errorManager.handleError(error, {
          context: "increment_cycle",
          category: "data",
        });
        return null;
      }
    }

    // Handle target reached event
    onTargetReached() {
      errorManager.logSuccess(
        "Target",
        `🎉 Target of ${this.stats.targetCoins} coins reached!`
      );

      // Save final stats to history
      this.saveStatsToHistory();

      // Emit event for other modules
      if (coreModule.emit) {
        coreModule.emit("targetReached", {
          totalCycles: this.stats.totalCycles,
          totalCoins: this.stats.totalCoins,
          targetCoins: this.stats.targetCoins,
          timestamp: Date.now(),
        });
      }
    }

    // ============= TARGET COINS MANAGEMENT =============

    // Load target coins from storage with backup recovery
    async loadTargetCoins() {
      try {
        let target = storageManager.getSettings(
          STORAGE_CONFIG.KEYS.TARGET_COINS
        );

        if (target && target > 0) {
          this.stats.targetCoins = target;
          return target;
        }

        // Try backup if main failed
        const backup = storageManager.getSettings(
          STORAGE_CONFIG.KEYS.TARGET_COINS + "_backup"
        );
        if (backup && backup > 0) {
          errorManager.logWarning(
            "Target Coins",
            `Using backup target: ${backup}`
          );
          // Restore main from backup
          storageManager.setSettings(STORAGE_CONFIG.KEYS.TARGET_COINS, backup);
          this.stats.targetCoins = backup;
          return backup;
        }

        // Use default
        this.stats.targetCoins = DATA_CONFIG.TARGETS.DEFAULT_COINS;
        this.setTargetCoins(this.stats.targetCoins); // Save default

        return this.stats.targetCoins;
      } catch (error) {
        errorManager.handleError(error, {
          context: "load_target_coins",
          category: "data",
        });

        this.stats.targetCoins = DATA_CONFIG.TARGETS.DEFAULT_COINS;
        return this.stats.targetCoins;
      }
    }

    // Set target coins with validation and backup
    setTargetCoins(target) {
      try {
        // Validate target
        if (
          !target ||
          target < DATA_CONFIG.TARGETS.MIN_COINS ||
          target > DATA_CONFIG.TARGETS.MAX_COINS
        ) {
          throw new Error(
            `Target must be between ${DATA_CONFIG.TARGETS.MIN_COINS} and ${DATA_CONFIG.TARGETS.MAX_COINS}`
          );
        }

        const targetInt = parseInt(target);

        // Save to storage
        const success = storageManager.setSettings(
          STORAGE_CONFIG.KEYS.TARGET_COINS,
          targetInt
        );

        if (success) {
          // Verify the save
          const verified = storageManager.getSettings(
            STORAGE_CONFIG.KEYS.TARGET_COINS
          );
          if (verified === targetInt) {
            // Save backup
            storageManager.setSettings(
              STORAGE_CONFIG.KEYS.TARGET_COINS + "_backup",
              targetInt
            );

            this.stats.targetCoins = targetInt;
            errorManager.logSuccess(
              "Target Coins",
              `Target set to ${targetInt} coins`
            );
            return true;
          } else {
            throw new Error(
              `Save verification failed: expected ${targetInt}, got ${verified}`
            );
          }
        }

        return false;
      } catch (error) {
        errorManager.handleError(error, {
          context: "set_target_coins",
          category: "data",
          target: target,
        });
        return false;
      }
    }

    getTargetCoins() {
      return this.stats.targetCoins;
    }

    // ============= STATISTICS HISTORY =============

    // Save current stats to history
    saveStatsToHistory() {
      try {
        const now = Date.now();
        const runtime = this.calculateRuntime();

        const statsEntry = {
          id: `stats_${now}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: now,
          totalCycles: this.stats.totalCycles,
          totalCoins: this.stats.totalCoins,
          runtime: runtime,
          avgCycleTime: this.calculateAverageCycleTime(),
          coinsPerHour: this.calculateCoinsPerHour(),
          targetCoins: this.stats.targetCoins,
          efficiency: this.calculateEfficiency(),
          session: {
            startTime: this.stats.startTime,
            autoStatsStartTime: this.stats.autoStatsStartTime,
            isAutoStatsEnabled: this.isAutoStatsEnabled,
          },
        };

        this.history.push(statsEntry);

        // Keep only recent entries
        if (this.history.length > DATA_CONFIG.STATS.MAX_HISTORY_ENTRIES) {
          this.history = this.history.slice(
            -DATA_CONFIG.STATS.MAX_HISTORY_ENTRIES
          );
        }

        // Save to storage
        const success = storageManager.setStats(
          STORAGE_CONFIG.KEYS.STATS_HISTORY,
          this.history
        );

        if (success) {
          errorManager.logInfo(
            "Stats History",
            `Saved history entry (${this.history.length} total)`
          );
        }

        return success;
      } catch (error) {
        errorManager.handleError(error, {
          context: "save_stats_history",
          category: "data",
        });
        return false;
      }
    }

    // Load stats history from storage
    async loadStatsHistory() {
      try {
        const history = storageManager.getStats(
          STORAGE_CONFIG.KEYS.STATS_HISTORY,
          []
        );

        if (Array.isArray(history)) {
          this.history = history;
          errorManager.logInfo(
            "Stats History",
            `Loaded ${history.length} history entries`
          );
        } else {
          this.history = [];
          errorManager.logInfo(
            "Stats History",
            "No valid history found, starting fresh"
          );
        }

        return this.history;
      } catch (error) {
        errorManager.handleError(error, {
          context: "load_stats_history",
          category: "data",
        });
        this.history = [];
        return [];
      }
    }

    getStatsHistory() {
      return this.history;
    }

    clearStatsHistory() {
      this.history = [];
      storageManager.removeStats(STORAGE_CONFIG.KEYS.STATS_HISTORY);
      errorManager.logInfo("Stats History", "History cleared");
    }

    // ============= CALCULATIONS =============

    // Calculate total runtime
    calculateRuntime() {
      const now = Date.now();
      if (this.isAutoStatsEnabled && this.stats.autoStatsStartTime) {
        return now - this.stats.autoStatsStartTime;
      }
      return now - this.stats.startTime;
    }

    // Calculate average cycle time
    calculateAverageCycleTime() {
      if (this.stats.totalCycles === 0) return 0;

      const runtime = this.calculateRuntime();
      return Math.round(runtime / this.stats.totalCycles);
    }

    // Calculate coins per hour
    calculateCoinsPerHour() {
      const runtime = this.calculateRuntime();
      if (runtime === 0) return 0;

      return Math.round((this.stats.totalCoins * 3600000) / runtime);
    }

    // Calculate efficiency (coins per cycle / expected coins per cycle)
    calculateEfficiency() {
      if (this.stats.totalCycles === 0) return 0;

      const actualCoinsPerCycle =
        this.stats.totalCoins / this.stats.totalCycles;
      const expectedCoinsPerCycle = 15; // Assuming 15 coins per cycle

      return Math.round((actualCoinsPerCycle / expectedCoinsPerCycle) * 100);
    }

    // Calculate ETA to target
    calculateETA() {
      const remainingCoins = Math.max(
        0,
        this.stats.targetCoins - this.stats.totalCoins
      );

      if (remainingCoins === 0) {
        return { completed: true, eta: 0 };
      }

      const coinsPerHour = this.calculateCoinsPerHour();
      if (coinsPerHour === 0) {
        return { completed: false, eta: Infinity };
      }

      const hoursRemaining = remainingCoins / coinsPerHour;
      const msRemaining = hoursRemaining * 3600000;

      return {
        completed: false,
        eta: msRemaining,
        hoursRemaining: hoursRemaining,
        remainingCoins: remainingCoins,
      };
    }

    // ============= PERFORMANCE METRICS =============

    getPerformanceMetrics() {
      const runtime = this.calculateRuntime();
      const eta = this.calculateETA();

      return {
        basic: {
          totalCycles: this.stats.totalCycles,
          totalCoins: this.stats.totalCoins,
          targetCoins: this.stats.targetCoins,
          runtime: runtime,
        },
        calculated: {
          avgCycleTime: this.calculateAverageCycleTime(),
          coinsPerHour: this.calculateCoinsPerHour(),
          efficiency: this.calculateEfficiency(),
          eta: eta,
        },
        session: {
          startTime: this.stats.startTime,
          autoStatsStartTime: this.stats.autoStatsStartTime,
          lastCycleTime: this.stats.lastCycleTime,
          isAutoStatsEnabled: this.isAutoStatsEnabled,
        },
        progress: {
          percentage: Math.round(
            (this.stats.totalCoins / this.stats.targetCoins) * 100
          ),
          remaining: Math.max(
            0,
            this.stats.targetCoins - this.stats.totalCoins
          ),
        },
      };
    }

    // Get simplified stats for UI display
    getDisplayStats() {
      const metrics = this.getPerformanceMetrics();

      return {
        cycles: metrics.basic.totalCycles,
        coins: metrics.basic.totalCoins,
        target: metrics.basic.targetCoins,
        progress: metrics.progress.percentage,
        coinsPerHour: metrics.calculated.coinsPerHour,
        eta: metrics.calculated.eta,
        runtime: this.formatDuration(metrics.basic.runtime),
      };
    }

    // ============= AUTO STATS MANAGEMENT =============

    enableAutoStats() {
      if (!this.isAutoStatsEnabled) {
        this.isAutoStatsEnabled = true;
        this.stats.autoStatsStartTime = Date.now();

        storageManager.setSettings(
          STORAGE_CONFIG.KEYS.AUTO_STATS_ENABLED,
          true
        );
        storageManager.setSettings(
          "auto_stats_start_time",
          this.stats.autoStatsStartTime
        );

        errorManager.logSuccess("Auto Stats", "Auto statistics enabled");

        // Emit event
        if (coreModule.emit) {
          coreModule.emit("autoStatsEnabled", {
            timestamp: this.stats.autoStatsStartTime,
          });
        }
      }
    }

    disableAutoStats() {
      if (this.isAutoStatsEnabled) {
        this.isAutoStatsEnabled = false;

        // Save final stats before disabling
        this.saveStatsToHistory();

        storageManager.setSettings(
          STORAGE_CONFIG.KEYS.AUTO_STATS_ENABLED,
          false
        );

        errorManager.logInfo("Auto Stats", "Auto statistics disabled");

        // Emit event
        if (coreModule.emit) {
          coreModule.emit("autoStatsDisabled", {
            finalStats: this.getPerformanceMetrics(),
          });
        }
      }
    }

    isAutoStatsActive() {
      return this.isAutoStatsEnabled;
    }

    // ============= UTILITY FUNCTIONS =============

    // Format duration in human readable format
    formatDuration(ms) {
      if (ms < 60000) {
        return `${Math.round(ms / 1000)}s`;
      } else if (ms < 3600000) {
        return `${Math.round(ms / 60000)}m`;
      } else {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.round((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
      }
    }

    // Debounce function to limit frequency of operations
    debounce(func, delay) {
      let timeoutId;
      return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
    }

    // ============= DATA EXPORT/IMPORT =============

    exportStats() {
      try {
        const exportData = {
          version: "4.0.0",
          timestamp: Date.now(),
          stats: this.stats,
          history: this.history,
          metrics: this.getPerformanceMetrics(),
        };

        return JSON.stringify(exportData, null, 2);
      } catch (error) {
        errorManager.handleError(error, {
          context: "export_stats",
          category: "data",
        });
        return null;
      }
    }

    importStats(jsonData) {
      try {
        const importData = JSON.parse(jsonData);

        if (!importData.version || !importData.stats) {
          throw new Error("Invalid import data format");
        }

        // Validate and import stats
        this.stats = {
          ...this.stats,
          ...importData.stats,
        };

        // Import history if available
        if (importData.history && Array.isArray(importData.history)) {
          this.history = importData.history;
        }

        // Save imported data
        this.saveStats();
        storageManager.setStats(
          STORAGE_CONFIG.KEYS.STATS_HISTORY,
          this.history
        );

        errorManager.logSuccess("Import", "Statistics imported successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "import_stats",
          category: "data",
        });
        return false;
      }
    }
  }

  // ============= SINGLETON INSTANCE =============

  const statsManager = new StatsManager();

  // ============= EXPORTS =============

  exports.StatsManager = StatsManager;
  exports.statsManager = statsManager;

  // Main API
  exports.initialize = () => statsManager.initialize();
  exports.incrementCycle = coinsEarned =>
    statsManager.incrementCycle(coinsEarned);
  exports.resetStats = () => statsManager.resetStats();

  // Target management
  exports.getTargetCoins = () => statsManager.getTargetCoins();
  exports.setTargetCoins = target => statsManager.setTargetCoins(target);

  // History management
  exports.saveStatsToHistory = () => statsManager.saveStatsToHistory();
  exports.getStatsHistory = () => statsManager.getStatsHistory();
  exports.clearStatsHistory = () => statsManager.clearStatsHistory();

  // Auto stats
  exports.enableAutoStats = () => statsManager.enableAutoStats();
  exports.disableAutoStats = () => statsManager.disableAutoStats();
  exports.isAutoStatsActive = () => statsManager.isAutoStatsActive();

  // Metrics and calculations
  exports.getPerformanceMetrics = () => statsManager.getPerformanceMetrics();
  exports.getDisplayStats = () => statsManager.getDisplayStats();
  exports.calculateETA = () => statsManager.calculateETA();

  // Data management
  exports.saveStats = () => statsManager.saveStats();
  exports.loadSavedStats = () => statsManager.loadSavedStats();
  exports.exportStats = () => statsManager.exportStats();
  exports.importStats = jsonData => statsManager.importStats(jsonData);
})(exports);
