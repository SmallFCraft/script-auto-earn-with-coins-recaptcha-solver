/**
 * Data Management Module
 * Part of Ateex Auto v3.0 Modular Edition
 * Handles stats, localStorage operations, export/import functionality
 */

// Load utils module
const utils = ateexGlobalState.modulesLoaded.utils;
const { 
  logInfo, logError, logSuccess, logWarning, logDebug, 
  safeJsonParse, safeJsonStringify, formatDuration, 
  formatNumber, calculateRate, calculateETA 
} = utils;

// ============= STATS MANAGEMENT =============

/**
 * Load saved stats from localStorage
 */
function loadSavedStats() {
  try {
    const saved = localStorage.getItem("ateex_stats");
    if (saved) {
      const stats = safeJsonParse(saved);
      if (stats) {
        ateexGlobalState.totalCycles = stats.totalCycles || 0;
        ateexGlobalState.totalCoins = stats.totalCoins || 0;
        ateexGlobalState.startTime = stats.startTime || Date.now();
        
        logSuccess(`📊 Loaded saved stats: ${stats.totalCycles} cycles, ${stats.totalCoins} coins`);
        return stats;
      }
    }
    
    logInfo("📊 No saved stats found, starting fresh");
    ateexGlobalState.startTime = Date.now();
    return null;
  } catch (error) {
    logError(`Could not load saved stats: ${error.message}`);
    // Initialize with defaults on error
    ateexGlobalState.totalCycles = 0;
    ateexGlobalState.totalCoins = 0;
    ateexGlobalState.startTime = Date.now();
    return null;
  }
}

/**
 * Save current stats to localStorage
 */
function saveStats() {
  try {
    const stats = {
      totalCycles: ateexGlobalState.totalCycles,
      totalCoins: ateexGlobalState.totalCoins,
      startTime: ateexGlobalState.startTime,
      lastSync: Date.now(),
      version: ateexGlobalState.version
    };
    
    localStorage.setItem("ateex_stats", safeJsonStringify(stats));
    logDebug("📊 Stats saved to localStorage");
    return true;
  } catch (error) {
    logError(`Error saving stats: ${error.message}`);
    return false;
  }
}

/**
 * Update stats (cycles and coins)
 */
function updateStats(cycles = 0, coins = 0) {
  if (cycles > 0) {
    ateexGlobalState.totalCycles += cycles;
    ateexGlobalState.lastCycleTime = Date.now();
  }
  
  if (coins > 0) {
    ateexGlobalState.totalCoins += coins;
  }
  
  // Auto-save stats
  saveStats();
  
  logDebug(`📊 Stats updated: +${cycles} cycles, +${coins} coins`);
}

/**
 * Reset stats to zero
 */
function resetStats() {
  try {
    ateexGlobalState.totalCycles = 0;
    ateexGlobalState.totalCoins = 0;
    ateexGlobalState.startTime = Date.now();
    ateexGlobalState.lastCycleTime = 0;
    
    // Reset auto stats start time if enabled
    if (ateexGlobalState.autoStatsEnabled) {
      ateexGlobalState.autoStatsStartTime = Date.now();
    }
    
    saveStats();
    logSuccess("📊 Stats reset successfully");
    return true;
  } catch (error) {
    logError(`Error resetting stats: ${error.message}`);
    return false;
  }
}

/**
 * Get current stats summary
 */
function getStatsummary() {
  const runtime = ateexGlobalState.autoStatsStartTime 
    ? Date.now() - ateexGlobalState.autoStatsStartTime
    : Date.now() - ateexGlobalState.startTime;
    
  const cycleRate = calculateRate(ateexGlobalState.totalCycles, ateexGlobalState.startTime);
  const coinRate = calculateRate(ateexGlobalState.totalCoins, ateexGlobalState.startTime);
  
  return {
    cycles: ateexGlobalState.totalCycles,
    coins: ateexGlobalState.totalCoins,
    runtime: runtime,
    runtimeFormatted: formatDuration(runtime),
    cycleRate: cycleRate,
    coinRate: coinRate,
    startTime: ateexGlobalState.startTime,
    autoStatsStartTime: ateexGlobalState.autoStatsStartTime,
    lastCycleTime: ateexGlobalState.lastCycleTime
  };
}

// ============= TARGET MANAGEMENT =============

/**
 * Save target settings
 */
function saveTarget(targetCoins) {
  try {
    const target = {
      coins: parseInt(targetCoins),
      setTime: Date.now(),
      version: ateexGlobalState.version
    };
    
    localStorage.setItem("ateex_target", safeJsonStringify(target));
    logSuccess(`🎯 Target set: ${formatNumber(targetCoins)} coins`);
    return true;
  } catch (error) {
    logError(`Error saving target: ${error.message}`);
    return false;
  }
}

/**
 * Load target settings
 */
function loadTarget() {
  try {
    const saved = localStorage.getItem("ateex_target");
    if (saved) {
      const target = safeJsonParse(saved);
      if (target && target.coins) {
        logDebug(`🎯 Target loaded: ${formatNumber(target.coins)} coins`);
        return target;
      }
    }
    return null;
  } catch (error) {
    logError(`Error loading target: ${error.message}`);
    return null;
  }
}

/**
 * Clear target
 */
function clearTarget() {
  try {
    localStorage.removeItem("ateex_target");
    logInfo("🎯 Target cleared");
    return true;
  } catch (error) {
    logError(`Error clearing target: ${error.message}`);
    return false;
  }
}

/**
 * Get target progress
 */
function getTargetProgress() {
  const target = loadTarget();
  if (!target) {
    return null;
  }
  
  const current = ateexGlobalState.totalCoins;
  const remaining = Math.max(0, target.coins - current);
  const progress = Math.min(100, (current / target.coins) * 100);
  
  const coinRate = calculateRate(ateexGlobalState.totalCoins, ateexGlobalState.startTime);
  const eta = calculateETA(current, target.coins, coinRate);
  
  return {
    target: target.coins,
    current: current,
    remaining: remaining,
    progress: progress,
    eta: eta,
    completed: current >= target.coins
  };
}

// ============= HISTORY MANAGEMENT =============

/**
 * Save session to history
 */
function saveSessionToHistory() {
  try {
    const history = getHistory();
    const session = {
      id: Date.now(),
      startTime: ateexGlobalState.startTime,
      endTime: Date.now(),
      cycles: ateexGlobalState.totalCycles,
      coins: ateexGlobalState.totalCoins,
      runtime: Date.now() - ateexGlobalState.startTime,
      version: ateexGlobalState.version
    };
    
    history.sessions.push(session);
    
    // Keep only last 50 sessions
    if (history.sessions.length > 50) {
      history.sessions = history.sessions.slice(-50);
    }
    
    history.lastUpdate = Date.now();
    localStorage.setItem("ateex_history", safeJsonStringify(history));
    
    logInfo("📚 Session saved to history");
    return true;
  } catch (error) {
    logError(`Error saving session to history: ${error.message}`);
    return false;
  }
}

/**
 * Get history data
 */
function getHistory() {
  try {
    const saved = localStorage.getItem("ateex_history");
    if (saved) {
      const history = safeJsonParse(saved);
      if (history && history.sessions) {
        return history;
      }
    }
    
    return {
      sessions: [],
      lastUpdate: Date.now(),
      version: ateexGlobalState.version
    };
  } catch (error) {
    logError(`Error loading history: ${error.message}`);
    return { sessions: [], lastUpdate: Date.now(), version: ateexGlobalState.version };
  }
}

/**
 * Clear history
 */
function clearHistory() {
  try {
    localStorage.removeItem("ateex_history");
    logInfo("📚 History cleared");
    return true;
  } catch (error) {
    logError(`Error clearing history: ${error.message}`);
    return false;
  }
}

// ============= EXPORT/IMPORT FUNCTIONALITY =============

/**
 * Export all data to JSON
 */
function exportData() {
  try {
    const exportData = {
      metadata: {
        exportTime: Date.now(),
        exportDate: new Date().toISOString(),
        version: ateexGlobalState.version,
        userAgent: navigator.userAgent
      },
      stats: {
        totalCycles: ateexGlobalState.totalCycles,
        totalCoins: ateexGlobalState.totalCoins,
        startTime: ateexGlobalState.startTime,
        autoStatsStartTime: ateexGlobalState.autoStatsStartTime,
        lastCycleTime: ateexGlobalState.lastCycleTime
      },
      target: loadTarget(),
      history: getHistory(),
      settings: {
        autoStatsEnabled: ateexGlobalState.autoStatsEnabled,
        setupCompleted: ateexGlobalState.setupCompleted
      }
    };
    
    const jsonString = safeJsonStringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ateex-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logSuccess("📤 Data exported successfully");
    return true;
  } catch (error) {
    logError(`Error exporting data: ${error.message}`);
    return false;
  }
}

/**
 * Import data from JSON
 */
function importData(jsonData) {
  try {
    const data = typeof jsonData === 'string' ? safeJsonParse(jsonData) : jsonData;
    
    if (!data || !data.stats) {
      throw new Error("Invalid data format");
    }
    
    // Import stats
    if (data.stats) {
      ateexGlobalState.totalCycles = data.stats.totalCycles || 0;
      ateexGlobalState.totalCoins = data.stats.totalCoins || 0;
      ateexGlobalState.startTime = data.stats.startTime || Date.now();
      ateexGlobalState.autoStatsStartTime = data.stats.autoStatsStartTime;
      ateexGlobalState.lastCycleTime = data.stats.lastCycleTime || 0;
      saveStats();
    }
    
    // Import target
    if (data.target) {
      localStorage.setItem("ateex_target", safeJsonStringify(data.target));
    }
    
    // Import history
    if (data.history) {
      localStorage.setItem("ateex_history", safeJsonStringify(data.history));
    }
    
    // Import settings
    if (data.settings) {
      ateexGlobalState.autoStatsEnabled = data.settings.autoStatsEnabled || false;
      ateexGlobalState.setupCompleted = data.settings.setupCompleted || false;
      
      if (ateexGlobalState.autoStatsEnabled) {
        localStorage.setItem("ateex_auto_stats_enabled", "true");
      }
    }
    
    logSuccess("📥 Data imported successfully");
    return true;
  } catch (error) {
    logError(`Error importing data: ${error.message}`);
    return false;
  }
}

/**
 * Clear all data
 */
function clearAllData() {
  try {
    // Clear stats
    ateexGlobalState.totalCycles = 0;
    ateexGlobalState.totalCoins = 0;
    ateexGlobalState.startTime = Date.now();
    ateexGlobalState.lastCycleTime = 0;
    ateexGlobalState.autoStatsStartTime = null;
    
    // Clear flags
    ateexGlobalState.autoStatsEnabled = false;
    ateexGlobalState.setupCompleted = false;
    ateexGlobalState.credentialsReady = false;
    
    // Clear localStorage
    localStorage.removeItem("ateex_stats");
    localStorage.removeItem("ateex_target");
    localStorage.removeItem("ateex_history");
    localStorage.removeItem("ateex_auto_stats_enabled");
    
    logSuccess("🗑️ All data cleared successfully");
    return true;
  } catch (error) {
    logError(`Error clearing all data: ${error.message}`);
    return false;
  }
}

// ============= MODULE EXPORTS =============

module.exports = {
  // Stats management
  loadSavedStats,
  saveStats,
  updateStats,
  resetStats,
  getStatsummary,
  
  // Target management
  saveTarget,
  loadTarget,
  clearTarget,
  getTargetProgress,
  
  // History management
  saveSessionToHistory,
  getHistory,
  clearHistory,
  
  // Export/Import
  exportData,
  importData,
  clearAllData
};
