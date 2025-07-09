// ============= STATS SYSTEM MODULE =============
// This module handles statistics, history tracking, and analytics

(function() {
  "use strict";

  const context = window.ateexContext;
  const utils = context.utils;
  
  context.log("Loading Stats System Module...", "INFO");

  // ============= STATS CONFIGURATION =============

  let statsConfig = {
    targetCoins: utils.APP_CONSTANTS.DEFAULT_TARGET_COINS,
    autoSaveInterval: 60000, // 1 minute
    maxHistoryEntries: 1000,
    performanceTracking: true
  };

  // ============= TARGET COINS MANAGEMENT =============

  // Get target coins with backup recovery
  function getTargetCoins() {
    try {
      const saved = GM_getValue(utils.STORAGE_KEYS.TARGET_COINS);
      if (saved) {
        const target = parseInt(saved);
        if (target && target > 0) {
          return target;
        }
      }

      // Try backup if main failed
      const backup = GM_getValue(utils.STORAGE_KEYS.TARGET_COINS + "_backup");
      if (backup) {
        const backupTarget = parseInt(backup);
        if (backupTarget && backupTarget > 0) {
          context.logWarning(`Using backup target coins: ${backupTarget}`);
          // Restore main from backup
          GM_setValue(utils.STORAGE_KEYS.TARGET_COINS, backup);
          return backupTarget;
        }
      }

      context.logDebug(`No valid target found, using default: ${utils.APP_CONSTANTS.DEFAULT_TARGET_COINS}`);
      return utils.APP_CONSTANTS.DEFAULT_TARGET_COINS;
    } catch (e) {
      context.logError("Error loading target coins", e);
      return utils.APP_CONSTANTS.DEFAULT_TARGET_COINS;
    }
  }

  // Set target coins with sync verification
  function setTargetCoins(target) {
    try {
      GM_setValue(utils.STORAGE_KEYS.TARGET_COINS, target.toString());

      // Verify the save was successful
      const verified = GM_getValue(utils.STORAGE_KEYS.TARGET_COINS);
      if (verified && parseInt(verified) === target) {
        context.logSuccess(`Target coins updated to: ${target} (verified)`);

        // Update config
        statsConfig.targetCoins = target;

        // Emit event for UI updates
        context.emit('targetCoinsChanged', { target: target });

        // Also save to backup location for extra safety
        try {
          GM_setValue(utils.STORAGE_KEYS.TARGET_COINS + "_backup", target.toString());
        } catch (e) {
          // Ignore backup errors
        }

        return true;
      } else {
        context.logError(`Target coins save verification failed: expected ${target}, got ${verified}`);
        return false;
      }
    } catch (e) {
      context.logError("Error saving target coins", e);
      return false;
    }
  }

  // ============= STATS HISTORY MANAGEMENT =============

  // Save stats to history
  function saveStatsToHistory() {
    try {
      const state = context.state;
      const now = Date.now();
      // Use auto stats start time for accurate runtime calculation
      const runtimeStartTime = state.autoStatsStartTime || state.startTime;
      const runtime = state.autoStatsEnabled ? now - runtimeStartTime : 0;

      const statsEntry = {
        timestamp: now,
        totalCycles: state.totalCycles,
        totalCoins: state.totalCoins,
        runtime: runtime,
        avgCycleTime: state.totalCycles > 0 ? runtime / state.totalCycles : 0,
        coinsPerHour: runtime > 0 ? Math.round((state.totalCoins * 3600000) / runtime) : 0,
        targetCoins: getTargetCoins(),
        url: window.location.href,
        userAgent: navigator.userAgent.substring(0, 100)
      };

      let history = getStatsHistory();
      history.push(statsEntry);

      // Keep only last entries based on config
      if (history.length > statsConfig.maxHistoryEntries) {
        history = history.slice(-statsConfig.maxHistoryEntries);
      }

      GM_setValue(utils.STORAGE_KEYS.STATS_HISTORY, JSON.stringify(history));
      context.logDebug("Stats saved to history");
      
      // Emit event
      context.emit('statsHistoryUpdated', { entry: statsEntry, historySize: history.length });
      
      return true;
    } catch (e) {
      context.logError("Error saving stats to history", e);
      return false;
    }
  }

  // Get stats history
  function getStatsHistory() {
    try {
      const saved = GM_getValue(utils.STORAGE_KEYS.STATS_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      context.logError("Error loading stats history", e);
      return [];
    }
  }

  // Clear stats history
  function clearStatsHistory() {
    try {
      GM_setValue(utils.STORAGE_KEYS.STATS_HISTORY, undefined);
      context.logSuccess("Stats history cleared");
      context.emit('statsHistoryCleared', {});
      return true;
    } catch (e) {
      context.logError("Error clearing stats history", e);
      return false;
    }
  }

  // ============= ANALYTICS & CALCULATIONS =============

  // Calculate ETA to target
  function calculateETA() {
    const state = context.state;
    const targetCoins = getTargetCoins();
    const currentCoins = state.totalCoins;
    const remainingCoins = Math.max(0, targetCoins - currentCoins);

    if (remainingCoins === 0) {
      return { eta: 0, message: "Target reached!" };
    }

    const runtime = state.autoStatsEnabled && state.autoStatsStartTime 
      ? Date.now() - state.autoStatsStartTime 
      : Date.now() - state.startTime;

    if (runtime < 60000 || state.totalCoins === 0) {
      return { eta: null, message: "Calculating..." };
    }

    const coinsPerMs = state.totalCoins / runtime;
    const etaMs = remainingCoins / coinsPerMs;

    return {
      eta: etaMs,
      message: utils.formatDuration(etaMs),
      coinsPerHour: Math.round(coinsPerMs * 3600000),
      remainingCoins: remainingCoins
    };
  }

  // Get performance metrics
  function getPerformanceMetrics() {
    const state = context.state;
    const runtime = state.autoStatsEnabled && state.autoStatsStartTime 
      ? Date.now() - state.autoStatsStartTime 
      : Date.now() - state.startTime;

    const avgCycleTime = state.totalCycles > 0 ? runtime / state.totalCycles : 0;
    const coinsPerHour = runtime > 0 ? Math.round((state.totalCoins * 3600000) / runtime) : 0;
    const cyclesPerHour = runtime > 0 ? Math.round((state.totalCycles * 3600000) / runtime) : 0;

    return {
      runtime: runtime,
      runtimeFormatted: utils.formatDuration(runtime),
      totalCycles: state.totalCycles,
      totalCoins: state.totalCoins,
      avgCycleTime: avgCycleTime,
      avgCycleTimeFormatted: utils.formatDuration(avgCycleTime),
      coinsPerHour: coinsPerHour,
      cyclesPerHour: cyclesPerHour,
      efficiency: state.totalCycles > 0 ? (state.totalCoins / state.totalCycles) : 0,
      targetCoins: getTargetCoins(),
      progress: getTargetCoins() > 0 ? (state.totalCoins / getTargetCoins() * 100) : 0
    };
  }

  // ============= CYCLE MANAGEMENT =============

  // Increment cycle counter
  function incrementCycle() {
    if (window.top !== window.self) return false;

    const state = context.state;
    state.totalCycles++;
    state.totalCoins += utils.APP_CONSTANTS.COINS_PER_CYCLE;
    state.lastCycleTime = Date.now();

    context.logSuccess(`Cycle ${state.totalCycles} completed! Total coins: ${state.totalCoins}`);

    // Emit event for UI updates
    context.emit('cycleCompleted', {
      cycle: state.totalCycles,
      coins: state.totalCoins,
      timestamp: state.lastCycleTime
    });

    // Auto-save to history periodically
    if (state.totalCycles % 20 === 0) {
      saveStatsToHistory();
    }

    // Sync data
    syncAllData();

    return true;
  }

  // Reset stats
  function resetStats() {
    const state = context.state;
    state.totalCycles = 0;
    state.totalCoins = 0;
    
    // Reset both start times to current time for accurate runtime calculation
    const now = Date.now();
    state.startTime = now;
    state.autoStatsStartTime = now;
    state.lastCycleTime = 0;

    // Clear stored stats
    try {
      GM_setValue("ateex_stats", undefined);
    } catch (e) {
      context.logError("Error clearing stored stats", e);
    }

    context.logSuccess("📊 Stats reset to zero - runtime restarted");
    
    // Emit event
    context.emit('statsReset', { timestamp: now });

    return true;
  }

  // ============= DATA SYNCHRONIZATION =============

  // Sync all data systems to ensure consistency
  function syncAllData() {
    try {
      // Verify target coins consistency
      const currentTarget = getTargetCoins();
      const backupTarget = GM_getValue(utils.STORAGE_KEYS.TARGET_COINS + "_backup");

      if (!backupTarget || parseInt(backupTarget) !== currentTarget) {
        GM_setValue(utils.STORAGE_KEYS.TARGET_COINS + "_backup", currentTarget.toString());
        context.logDebug(`Target backup synced: ${currentTarget}`);
      }

      // Save current stats to ensure they're preserved
      try {
        const state = context.state;
        GM_setValue("ateex_stats", JSON.stringify({
          totalCycles: state.totalCycles,
          totalCoins: state.totalCoins,
          startTime: state.startTime,
          lastSync: Date.now(),
        }));
      } catch (e) {
        context.logError("Error syncing stats", e);
      }

      context.logDebug("Data sync completed successfully");
      return true;
    } catch (e) {
      context.logError("Error during data sync", e);
      return false;
    }
  }

  // ============= EXPORT/IMPORT FUNCTIONALITY =============

  // Export all stats data
  function exportStatsData() {
    try {
      const data = {
        stats: getPerformanceMetrics(),
        history: getStatsHistory(),
        config: statsConfig,
        exportDate: new Date().toISOString(),
        version: context.config.version
      };

      return JSON.stringify(data, null, 2);
    } catch (e) {
      context.logError("Error exporting stats data", e);
      return null;
    }
  }

  // Import stats data
  function importStatsData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.history && Array.isArray(data.history)) {
        GM_setValue(utils.STORAGE_KEYS.STATS_HISTORY, JSON.stringify(data.history));
        context.logSuccess(`Imported ${data.history.length} history entries`);
      }

      if (data.config && data.config.targetCoins) {
        setTargetCoins(data.config.targetCoins);
      }

      context.emit('statsDataImported', { data: data });
      return true;
    } catch (e) {
      context.logError("Error importing stats data", e);
      return false;
    }
  }

  // ============= AUTO-SAVE SYSTEM =============

  // Auto-save interval
  let autoSaveInterval = null;

  function startAutoSave() {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
    }

    autoSaveInterval = setInterval(() => {
      if (context.state.autoStatsEnabled) {
        syncAllData();
        
        // Save to history every 10 minutes
        const now = Date.now();
        const lastSave = GM_getValue("ateex_last_auto_save", 0);
        if (now - lastSave > 10 * 60 * 1000) {
          saveStatsToHistory();
          GM_setValue("ateex_last_auto_save", now.toString());
        }
      }
    }, statsConfig.autoSaveInterval);

    context.logDebug("Auto-save system started");
  }

  function stopAutoSave() {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
      context.logDebug("Auto-save system stopped");
    }
  }

  // ============= INITIALIZATION =============

  // Initialize stats system
  function initializeStatsSystem() {
    // Load target coins
    statsConfig.targetCoins = getTargetCoins();
    
    // Start auto-save
    startAutoSave();
    
    // Listen for auto stats events
    context.on('autoStatsEnabled', () => {
      context.logDebug("Stats system: Auto stats enabled");
    });
    
    context.on('autoStatsDisabled', () => {
      context.logDebug("Stats system: Auto stats disabled");
    });

    context.logDebug("Stats system initialized");
  }

  // ============= EXPORT TO SHARED CONTEXT =============

  // Add stats functions to context
  context.stats = {
    // Target management
    getTargetCoins,
    setTargetCoins,
    
    // History management
    saveToHistory: saveStatsToHistory,
    getHistory: getStatsHistory,
    clearHistory: clearStatsHistory,
    
    // Analytics
    calculateETA,
    getMetrics: getPerformanceMetrics,
    
    // Cycle management
    incrementCycle,
    resetStats,
    
    // Data management
    syncData: syncAllData,
    exportData: exportStatsData,
    importData: importStatsData,
    
    // Auto-save control
    startAutoSave,
    stopAutoSave,
    
    // Configuration
    getConfig: () => ({ ...statsConfig }),
    setConfig: (newConfig) => Object.assign(statsConfig, newConfig)
  };

  // Add to global scope for backward compatibility
  Object.assign(window, {
    incrementCycle,
    getTargetCoins,
    setTargetCoins,
    saveStatsToHistory,
    getStatsHistory,
    syncAllData
  });

  // Mark module as loaded
  context.state.modulesLoaded['stats-system'] = true;
  context.modules['stats-system'] = context.stats;

  // Initialize
  initializeStatsSystem();

  context.log("Stats System Module loaded successfully!", "SUCCESS");

})();
