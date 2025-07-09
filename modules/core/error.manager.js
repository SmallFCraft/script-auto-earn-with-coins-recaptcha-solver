/**
 * Error Manager - Centralized error handling and logging
 * Provides error categorization, recovery strategies, and notification system
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const storage = AteexModules.storageManager;
  const { ERROR_CONFIG, LOGGING_CONFIG, MESSAGE_TYPES } = constants;

  // ============= ERROR CATEGORIES =============

  const ErrorCategories = {
    NETWORK: "network",
    AUTHENTICATION: "authentication",
    CAPTCHA: "captcha",
    VALIDATION: "validation",
    STORAGE: "storage",
    MODULE: "module",
    DOM: "dom",
    SECURITY: "security",
    WORKFLOW: "workflow",
    UNKNOWN: "unknown",
  };

  const ErrorSeverity = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
  };

  // ============= ERROR TRACKING =============

  class ErrorTracker {
    constructor() {
      this.errors = [];
      this.errorCounts = new Map();
      this.recoveryAttempts = new Map();
      this.maxErrors = 1000; // Limit memory usage
    }

    addError(error) {
      // Clean old errors if too many
      if (this.errors.length >= this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors / 2);
      }

      const errorRecord = {
        id: this.generateErrorId(),
        timestamp: Date.now(),
        category: error.category || ErrorCategories.UNKNOWN,
        severity: error.severity || ErrorSeverity.MEDIUM,
        message: error.message,
        stack: error.stack,
        context: error.context || {},
        recovered: false,
        recoveryAttempts: 0,
      };

      this.errors.push(errorRecord);
      this.updateErrorCounts(errorRecord.category);

      return errorRecord;
    }

    generateErrorId() {
      return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateErrorCounts(category) {
      const count = this.errorCounts.get(category) || 0;
      this.errorCounts.set(category, count + 1);
    }

    getErrorStats() {
      const now = Date.now();
      const hourAgo = now - 60 * 60 * 1000;
      const recentErrors = this.errors.filter(err => err.timestamp > hourAgo);

      return {
        totalErrors: this.errors.length,
        recentErrors: recentErrors.length,
        errorsByCategory: Object.fromEntries(this.errorCounts),
        criticalErrors: this.errors.filter(
          err => err.severity === ErrorSeverity.CRITICAL
        ).length,
        recoveredErrors: this.errors.filter(err => err.recovered).length,
      };
    }

    markRecovered(errorId) {
      const error = this.errors.find(err => err.id === errorId);
      if (error) {
        error.recovered = true;
        error.recoveredAt = Date.now();
      }
    }

    getRecentErrors(limit = 10) {
      return this.errors
        .slice(-limit)
        .reverse()
        .map(err => ({
          id: err.id,
          timestamp: err.timestamp,
          category: err.category,
          severity: err.severity,
          message: err.message,
          recovered: err.recovered,
        }));
    }
  }

  // ============= MAIN ERROR MANAGER =============

  class ErrorManager {
    constructor() {
      this.tracker = new ErrorTracker();
      this.handlers = new Map();
      this.recoveryStrategies = new Map();
      this.setupDefaultHandlers();
      this.setupDefaultRecoveryStrategies();
    }

    setupDefaultHandlers() {
      // Network error handler
      this.registerHandler(ErrorCategories.NETWORK, error => {
        this.logError("Network Error", error.message, error.context);
        return this.attemptRecovery(error);
      });

      // Authentication error handler
      this.registerHandler(ErrorCategories.AUTHENTICATION, error => {
        this.logError("Authentication Error", error.message, error.context);
        // Clear invalid credentials
        if (storage && storage.removeSecureData) {
          storage.removeSecureData("credentials");
        }
        return this.attemptRecovery(error);
      });

      // Captcha error handler
      this.registerHandler(ErrorCategories.CAPTCHA, error => {
        this.logWarning("Captcha Error", error.message, error.context);
        return this.attemptRecovery(error);
      });

      // Module error handler
      this.registerHandler(ErrorCategories.MODULE, error => {
        this.logError("Module Error", error.message, error.context);
        // Clear module cache if it's a loading error
        if (error.message.includes("load") && storage && storage.clearCache) {
          storage.clearCache();
        }
        return this.attemptRecovery(error);
      });

      // Storage error handler
      this.registerHandler(ErrorCategories.STORAGE, error => {
        this.logWarning("Storage Error", error.message, error.context);
        return this.attemptRecovery(error);
      });
    }

    setupDefaultRecoveryStrategies() {
      // Network recovery
      this.registerRecoveryStrategy(ErrorCategories.NETWORK, async error => {
        await this.delay(ERROR_CONFIG.RECOVERY.RETRY_DELAY);
        return { success: false, retry: true };
      });

      // Authentication recovery
      this.registerRecoveryStrategy(
        ErrorCategories.AUTHENTICATION,
        async error => {
          // Redirect to login page
          try {
            window.location.href =
              constants.ATEEX_CONFIG.BASE_URL +
              constants.ATEEX_CONFIG.PAGES.LOGIN;
            return { success: true, retry: false };
          } catch (e) {
            return { success: false, retry: false };
          }
        }
      );

      // Captcha recovery
      this.registerRecoveryStrategy(ErrorCategories.CAPTCHA, async error => {
        // Wait and retry captcha
        await this.delay(30000); // Wait 30 seconds
        return { success: false, retry: true };
      });

      // Module recovery
      this.registerRecoveryStrategy(ErrorCategories.MODULE, async error => {
        // Try to reload the page
        if (ERROR_CONFIG.RECOVERY.FALLBACK_ACTIONS.RELOAD_PAGE) {
          await this.delay(5000);
          window.location.reload();
          return { success: true, retry: false };
        }
        return { success: false, retry: false };
      });
    }

    // ============= PUBLIC API =============

    handleError(error, context = {}) {
      // Normalize error
      const normalizedError = this.normalizeError(error, context);

      // Add to tracker
      const errorRecord = this.tracker.addError(normalizedError);

      // Get appropriate handler
      const handler = this.handlers.get(normalizedError.category);

      if (handler) {
        try {
          return handler(normalizedError);
        } catch (handlerError) {
          this.logError("Error Handler Failed", handlerError.message, {
            originalError: normalizedError,
          });
        }
      }

      // Default handling
      this.logError(
        "Unhandled Error",
        normalizedError.message,
        normalizedError.context
      );
      return false;
    }

    normalizeError(error, context = {}) {
      if (error instanceof Error) {
        return {
          message: error.message,
          stack: error.stack,
          category: this.categorizeError(error.message),
          severity: this.determineSeverity(error.message),
          context: context,
        };
      }

      if (typeof error === "string") {
        return {
          message: error,
          stack: new Error().stack,
          category: this.categorizeError(error),
          severity: this.determineSeverity(error),
          context: context,
        };
      }

      return {
        message: error?.message || "Unknown error",
        stack: error?.stack || new Error().stack,
        category: error?.category || this.categorizeError(error?.message || ""),
        severity: error?.severity || ErrorSeverity.MEDIUM,
        context: { ...context, ...error?.context },
      };
    }

    categorizeError(message) {
      const lowerMessage = message.toLowerCase();

      // Check patterns from config
      for (const [category, patterns] of Object.entries(
        ERROR_CONFIG.PATTERNS
      )) {
        for (const pattern of patterns) {
          if (lowerMessage.includes(pattern.toLowerCase())) {
            return category.toLowerCase();
          }
        }
      }

      // Additional categorization
      if (
        lowerMessage.includes("storage") ||
        lowerMessage.includes("localstorage")
      ) {
        return ErrorCategories.STORAGE;
      }

      if (
        lowerMessage.includes("module") ||
        lowerMessage.includes("import") ||
        lowerMessage.includes("require")
      ) {
        return ErrorCategories.MODULE;
      }

      if (
        lowerMessage.includes("dom") ||
        lowerMessage.includes("element") ||
        lowerMessage.includes("selector")
      ) {
        return ErrorCategories.DOM;
      }

      if (
        lowerMessage.includes("security") ||
        lowerMessage.includes("cors") ||
        lowerMessage.includes("origin")
      ) {
        return ErrorCategories.SECURITY;
      }

      return ErrorCategories.UNKNOWN;
    }

    determineSeverity(message) {
      const lowerMessage = message.toLowerCase();

      // Critical errors
      if (
        lowerMessage.includes("critical") ||
        lowerMessage.includes("fatal") ||
        lowerMessage.includes("cannot continue") ||
        lowerMessage.includes("system failure")
      ) {
        return ErrorSeverity.CRITICAL;
      }

      // High severity
      if (
        lowerMessage.includes("authentication failed") ||
        lowerMessage.includes("module load failed") ||
        lowerMessage.includes("security violation")
      ) {
        return ErrorSeverity.HIGH;
      }

      // Low severity
      if (
        lowerMessage.includes("warning") ||
        lowerMessage.includes("retry") ||
        lowerMessage.includes("temporary")
      ) {
        return ErrorSeverity.LOW;
      }

      return ErrorSeverity.MEDIUM;
    }

    async attemptRecovery(error) {
      const strategy = this.recoveryStrategies.get(error.category);
      if (!strategy) {
        return false;
      }

      const maxRetries = ERROR_CONFIG.RECOVERY.MAX_RETRIES;
      const currentAttempts =
        this.tracker.recoveryAttempts.get(error.category) || 0;

      if (currentAttempts >= maxRetries) {
        this.logError(
          "Recovery Failed",
          `Max retries exceeded for ${error.category}`
        );
        return false;
      }

      try {
        this.tracker.recoveryAttempts.set(error.category, currentAttempts + 1);
        const result = await strategy(error);

        if (result.success) {
          this.tracker.markRecovered(error.id);
          this.logSuccess(
            "Error Recovered",
            `Successfully recovered from ${error.category} error`
          );
          // Reset retry count on success
          this.tracker.recoveryAttempts.set(error.category, 0);
        }

        return result;
      } catch (recoveryError) {
        this.logError("Recovery Strategy Failed", recoveryError.message, {
          originalError: error,
        });
        return false;
      }
    }

    // ============= REGISTRATION METHODS =============

    registerHandler(category, handler) {
      this.handlers.set(category, handler);
    }

    registerRecoveryStrategy(category, strategy) {
      this.recoveryStrategies.set(category, strategy);
    }

    // ============= CONVENIENCE METHODS =============

    logError(title, message, context = {}) {
      const prefix = LOGGING_CONFIG.PREFIXES.ERROR;
      const color = LOGGING_CONFIG.COLORS.ERROR;
      console.log(
        `%c${prefix} [${title}] ${message}`,
        `color: ${color}; font-weight: bold;`,
        context
      );
    }

    logWarning(title, message, context = {}) {
      const prefix = LOGGING_CONFIG.PREFIXES.WARNING;
      const color = LOGGING_CONFIG.COLORS.WARNING;
      console.log(
        `%c${prefix} [${title}] ${message}`,
        `color: ${color}; font-weight: bold;`,
        context
      );
    }

    logSuccess(title, message, context = {}) {
      const prefix = LOGGING_CONFIG.PREFIXES.SUCCESS;
      const color = LOGGING_CONFIG.COLORS.SUCCESS;
      console.log(
        `%c${prefix} [${title}] ${message}`,
        `color: ${color}; font-weight: bold;`,
        context
      );
    }

    logInfo(title, message, context = {}) {
      const prefix = LOGGING_CONFIG.PREFIXES.INFO;
      const color = LOGGING_CONFIG.COLORS.INFO;
      console.log(
        `%c${prefix} [${title}] ${message}`,
        `color: ${color}; font-weight: bold;`,
        context
      );
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============= MONITORING METHODS =============

    getErrorStats() {
      return this.tracker.getErrorStats();
    }

    getRecentErrors(limit = 10) {
      return this.tracker.getRecentErrors(limit);
    }

    clearErrors() {
      this.tracker.errors = [];
      this.tracker.errorCounts.clear();
      this.tracker.recoveryAttempts.clear();
    }

    // ============= NOTIFICATION METHODS =============

    notifyError(error, context = {}) {
      // Send error notification to other modules
      try {
        window.dispatchEvent(
          new CustomEvent("ateex-error", {
            detail: {
              type: MESSAGE_TYPES.ERROR_OCCURRED,
              error: this.normalizeError(error, context),
              timestamp: Date.now(),
            },
          })
        );
      } catch (e) {
        // Fail silently
      }
    }

    // ============= GLOBAL ERROR HANDLERS =============

    setupGlobalHandlers() {
      // Unhandled promise rejections
      window.addEventListener("unhandledrejection", event => {
        this.handleError(event.reason, { type: "unhandledrejection" });
        event.preventDefault();
      });

      // Global error handler
      window.addEventListener("error", event => {
        this.handleError(event.error, {
          type: "global",
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });
    }

    // ============= HEALTH CHECK =============

    performHealthCheck() {
      const stats = this.getErrorStats();
      const health = {
        status: "healthy",
        issues: [],
        recommendations: [],
      };

      // Check error rate
      if (stats.recentErrors > 10) {
        health.status = "degraded";
        health.issues.push("High error rate detected");
        health.recommendations.push(
          "Review error logs and consider restarting"
        );
      }

      // Check critical errors
      if (stats.criticalErrors > 0) {
        health.status = "critical";
        health.issues.push("Critical errors detected");
        health.recommendations.push("Immediate attention required");
      }

      // Check error categories
      const networkErrors =
        stats.errorsByCategory[ErrorCategories.NETWORK] || 0;
      if (networkErrors > 5) {
        health.issues.push("Network connectivity issues");
        health.recommendations.push("Check network connection");
      }

      return health;
    }
  }

  // ============= SINGLETON INSTANCE =============

  const errorManager = new ErrorManager();

  // Setup global handlers
  errorManager.setupGlobalHandlers();

  // ============= EXPORTS =============

  exports.ErrorManager = ErrorManager;
  exports.errorManager = errorManager;
  exports.ErrorCategories = ErrorCategories;
  exports.ErrorSeverity = ErrorSeverity;

  // Convenience functions
  exports.handleError = (error, context) =>
    errorManager.handleError(error, context);
  exports.logError = (title, message, context) =>
    errorManager.logError(title, message, context);
  exports.logWarning = (title, message, context) =>
    errorManager.logWarning(title, message, context);
  exports.logSuccess = (title, message, context) =>
    errorManager.logSuccess(title, message, context);
  exports.logInfo = (title, message, context) =>
    errorManager.logInfo(title, message, context);
  exports.getErrorStats = () => errorManager.getErrorStats();
  exports.getRecentErrors = limit => errorManager.getRecentErrors(limit);
  exports.performHealthCheck = () => errorManager.performHealthCheck();
})(exports);
