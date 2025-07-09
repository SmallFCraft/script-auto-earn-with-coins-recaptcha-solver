// ============= ENHANCED LOGGING SYSTEM MODULE =============
// This module provides comprehensive logging, debugging, and monitoring capabilities

(function() {
  "use strict";

  const context = window.ateexContext;
  const utils = context.utils;
  
  context.log("Loading Enhanced Logging System Module...", "INFO");

  // ============= ENHANCED LOGGING CONFIGURATION =============

  const LOG_LEVELS = {
    DEBUG: { name: "DEBUG", color: "#9E9E9E", icon: "🔍", priority: 0 },
    INFO: { name: "INFO", color: "#4CAF50", icon: "ℹ️", priority: 1 },
    SUCCESS: { name: "SUCCESS", color: "#8BC34A", icon: "✅", priority: 2 },
    WARNING: { name: "WARNING", color: "#FF9800", icon: "⚠️", priority: 3 },
    ERROR: { name: "ERROR", color: "#F44336", icon: "❌", priority: 4 },
    CRITICAL: { name: "CRITICAL", color: "#D32F2F", icon: "🚨", priority: 5 }
  };

  // Logging configuration
  const LOGGING_CONFIG = {
    enableConsole: true,
    enableStorage: true,
    enableSpamControl: true,
    maxLogEntries: 1000,
    logLevel: "DEBUG", // Minimum level to log
    spamThreshold: utils.APP_CONSTANTS.SPAM_THRESHOLD,
    enableTimestamps: true,
    enableStackTrace: false // For errors
  };

  // ============= LOGGING STATE =============

  let logHistory = [];
  let spamTracker = new Map();
  let logStats = {
    totalLogs: 0,
    errorCount: 0,
    warningCount: 0,
    lastError: null,
    sessionStart: Date.now()
  };

  // ============= CORE LOGGING FUNCTIONS =============

  // Enhanced log function
  function log(message, level = "INFO", spamKey = null, metadata = {}) {
    const levelInfo = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    
    // Check log level filtering
    if (levelInfo.priority < LOG_LEVELS[LOGGING_CONFIG.logLevel].priority) {
      return;
    }

    // Anti-spam control
    if (LOGGING_CONFIG.enableSpamControl && spamKey) {
      const now = Date.now();
      const lastLogged = spamTracker.get(spamKey);
      
      if (lastLogged && now - lastLogged < LOGGING_CONFIG.spamThreshold) {
        return; // Skip this log to prevent spam
      }
      
      spamTracker.set(spamKey, now);
    }

    // Create log entry
    const logEntry = {
      timestamp: Date.now(),
      level: level,
      message: message,
      metadata: metadata,
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100) // Truncated
    };

    // Update statistics
    logStats.totalLogs++;
    if (level === "ERROR" || level === "CRITICAL") {
      logStats.errorCount++;
      logStats.lastError = logEntry;
    } else if (level === "WARNING") {
      logStats.warningCount++;
    }

    // Console output
    if (LOGGING_CONFIG.enableConsole) {
      const timestamp = LOGGING_CONFIG.enableTimestamps 
        ? `[${new Date().toLocaleTimeString()}] ` 
        : '';
      
      console.log(
        `%c${timestamp}[Ateex Auto] ${levelInfo.icon} ${message}`,
        `color: ${levelInfo.color}; font-weight: ${level === 'ERROR' || level === 'CRITICAL' ? 'bold' : 'normal'}`
      );

      // Log metadata if present
      if (Object.keys(metadata).length > 0) {
        console.log(`%c└─ Metadata:`, `color: #666; font-style: italic`, metadata);
      }
    }

    // Store in history
    if (LOGGING_CONFIG.enableStorage) {
      logHistory.push(logEntry);
      
      // Trim history if too long
      if (logHistory.length > LOGGING_CONFIG.maxLogEntries) {
        logHistory = logHistory.slice(-LOGGING_CONFIG.maxLogEntries);
      }
    }

    // Emit log event for other modules
    context.emit('log', { entry: logEntry, level: level });
  }

  // Convenience logging functions
  function logDebug(message, spamKey = null, metadata = {}) {
    log(message, "DEBUG", spamKey, metadata);
  }

  function logInfo(message, spamKey = null, metadata = {}) {
    log(message, "INFO", spamKey, metadata);
  }

  function logSuccess(message, spamKey = null, metadata = {}) {
    log(message, "SUCCESS", spamKey, metadata);
  }

  function logWarning(message, spamKey = null, metadata = {}) {
    log(message, "WARNING", spamKey, metadata);
  }

  function logError(message, error = null, metadata = {}) {
    const errorMetadata = { ...metadata };
    
    if (error) {
      errorMetadata.error = {
        name: error.name,
        message: error.message,
        stack: LOGGING_CONFIG.enableStackTrace ? error.stack : undefined
      };
    }
    
    log(message, "ERROR", null, errorMetadata);
  }

  function logCritical(message, error = null, metadata = {}) {
    const errorMetadata = { ...metadata };
    
    if (error) {
      errorMetadata.error = {
        name: error.name,
        message: error.message,
        stack: error.stack // Always include stack for critical errors
      };
    }
    
    log(message, "CRITICAL", null, errorMetadata);
  }

  // Spam-controlled logging
  function logWithSpamControl(message, level = "INFO", spamKey = null, metadata = {}) {
    log(message, level, spamKey || message, metadata);
  }

  // ============= LOGGING UTILITIES =============

  // Performance logging
  function logPerformance(operation, startTime, metadata = {}) {
    const duration = Date.now() - startTime;
    const perfMetadata = { 
      ...metadata, 
      duration: duration,
      operation: operation 
    };
    
    if (duration > 5000) {
      logWarning(`Slow operation: ${operation} took ${duration}ms`, null, perfMetadata);
    } else {
      logDebug(`Performance: ${operation} completed in ${duration}ms`, null, perfMetadata);
    }
  }

  // Module loading logging
  function logModuleEvent(moduleName, event, metadata = {}) {
    const moduleMetadata = { 
      ...metadata, 
      module: moduleName, 
      event: event 
    };
    
    switch (event) {
      case 'loading':
        logInfo(`Loading module: ${moduleName}`, null, moduleMetadata);
        break;
      case 'loaded':
        logSuccess(`Module loaded: ${moduleName}`, null, moduleMetadata);
        break;
      case 'error':
        logError(`Module error: ${moduleName}`, null, moduleMetadata);
        break;
      case 'timeout':
        logWarning(`Module timeout: ${moduleName}`, null, moduleMetadata);
        break;
    }
  }

  // Network request logging
  function logNetworkRequest(url, method, status, duration, metadata = {}) {
    const networkMetadata = {
      ...metadata,
      url: url,
      method: method,
      status: status,
      duration: duration
    };

    if (status >= 400) {
      logError(`Network error: ${method} ${url} - ${status}`, null, networkMetadata);
    } else if (duration > 10000) {
      logWarning(`Slow network request: ${method} ${url} took ${duration}ms`, null, networkMetadata);
    } else {
      logDebug(`Network: ${method} ${url} - ${status} (${duration}ms)`, null, networkMetadata);
    }
  }

  // ============= LOG MANAGEMENT =============

  // Get log history
  function getLogHistory(level = null, limit = null) {
    let filtered = logHistory;
    
    if (level) {
      filtered = filtered.filter(entry => entry.level === level);
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }

  // Get log statistics
  function getLogStats() {
    return {
      ...logStats,
      sessionDuration: Date.now() - logStats.sessionStart,
      historySize: logHistory.length,
      spamTrackerSize: spamTracker.size
    };
  }

  // Clear log history
  function clearLogHistory() {
    logHistory = [];
    spamTracker.clear();
    logStats = {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      lastError: null,
      sessionStart: Date.now()
    };
    logInfo("Log history cleared");
  }

  // Export logs to JSON
  function exportLogs() {
    const exportData = {
      logs: logHistory,
      stats: getLogStats(),
      config: LOGGING_CONFIG,
      exportTime: new Date().toISOString(),
      version: context.config.version
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // ============= EXPORT TO SHARED CONTEXT =============

  // Replace basic logging functions with enhanced versions
  context.log = log;
  context.logDebug = logDebug;
  context.logInfo = logInfo;
  context.logSuccess = logSuccess;
  context.logWarning = logWarning;
  context.logError = logError;
  context.logCritical = logCritical;
  context.logWithSpamControl = logWithSpamControl;

  // Add specialized logging functions
  context.logPerformance = logPerformance;
  context.logModuleEvent = logModuleEvent;
  context.logNetworkRequest = logNetworkRequest;

  // Add log management functions
  context.getLogHistory = getLogHistory;
  context.getLogStats = getLogStats;
  context.clearLogHistory = clearLogHistory;
  context.exportLogs = exportLogs;

  // Add to global scope for backward compatibility
  Object.assign(window, {
    log,
    logInfo,
    logWarning,
    logError,
    logSuccess,
    logDebug,
    logWithSpamControl
  });

  // Mark module as loaded
  context.state.modulesLoaded['logging-system'] = true;
  context.modules['logging-system'] = {
    log, logDebug, logInfo, logSuccess, logWarning, logError, logCritical,
    logWithSpamControl, logPerformance, logModuleEvent, logNetworkRequest,
    getLogHistory, getLogStats, clearLogHistory, exportLogs
  };

  context.log("Enhanced Logging System Module loaded successfully!", "SUCCESS");

})();
