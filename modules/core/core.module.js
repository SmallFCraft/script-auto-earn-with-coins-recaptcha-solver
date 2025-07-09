/**
 * Core Module - Central orchestrator for core functionality
 * Provides unified interface to storage, error handling, DOM operations, and utilities
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const storage = AteexModules.storageManager;
  const errorManager = AteexModules.errorManager;
  const domUtils = AteexModules.domUtils;

  const { WORKFLOW_CONFIG, LOGGING_CONFIG, MESSAGE_TYPES, ATEEX_CONFIG } =
    constants;

  // ============= CORE STATE MANAGEMENT =============

  class CoreState {
    constructor() {
      this.initialized = false;
      this.currentPage = null;
      this.lastActivity = Date.now();
      this.sessionId = this.generateSessionId();
      this.features = new Map();
      this.eventHandlers = new Map();
    }

    generateSessionId() {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateActivity() {
      this.lastActivity = Date.now();
    }

    setCurrentPage(page) {
      this.currentPage = page;
      this.updateActivity();
      this.notifyPageChange(page);
    }

    notifyPageChange(page) {
      this.emit("pageChange", { page, timestamp: Date.now() });
    }

    registerFeature(name, enabled = true) {
      this.features.set(name, enabled);
    }

    isFeatureEnabled(name) {
      return this.features.get(name) || false;
    }

    on(event, handler) {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      this.eventHandlers.get(event).push(handler);
    }

    emit(event, data) {
      const handlers = this.eventHandlers.get(event) || [];
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (e) {
          errorManager.handleError(e, { context: "event_emission", event });
        }
      });
    }
  }

  // ============= MAIN CORE CLASS =============

  class AteexCore {
    constructor() {
      this.state = new CoreState();
      this.initialized = false;
      this.startTime = Date.now();
      this.version = "4.0.0";
    }

    // ============= INITIALIZATION =============

    async initialize() {
      if (this.initialized) {
        return true;
      }

      try {
        errorManager.logInfo(
          "Core Initialization",
          "Starting core system initialization..."
        );

        // Initialize storage
        await this.initializeStorage();

        // Initialize error handling
        await this.initializeErrorHandling();

        // Initialize DOM utilities
        await this.initializeDOMUtils();

        // Initialize page detection
        await this.initializePageDetection();

        // Initialize event system
        await this.initializeEventSystem();

        // Initialize monitoring
        await this.initializeMonitoring();

        // Set up cleanup handlers
        this.setupCleanupHandlers();

        this.initialized = true;
        this.state.initialized = true;

        errorManager.logSuccess(
          "Core Initialization",
          "Core system initialized successfully"
        );

        // Store initialization info
        storage.setJSON("core_init_info", {
          version: this.version,
          timestamp: Date.now(),
          sessionId: this.state.sessionId,
        });

        return true;
      } catch (e) {
        errorManager.handleError(e, { context: "core_initialization" });
        return false;
      }
    }

    async initializeStorage() {
      try {
        // Test storage functionality
        const testKey = "core_storage_test";
        const testValue = "test_" + Date.now();

        storage.set(testKey, testValue);
        const retrieved = storage.get(testKey);

        if (retrieved !== testValue) {
          throw new Error("Storage functionality test failed");
        }

        storage.remove(testKey);

        // Clean up expired items
        storage.storage.cleanupExpired();

        errorManager.logInfo(
          "Storage",
          "Storage system initialized and tested"
        );
        return true;
      } catch (e) {
        errorManager.handleError(e, { context: "storage_initialization" });
        return false;
      }
    }

    async initializeErrorHandling() {
      try {
        // Set up core-specific error handlers
        errorManager.registerHandler("core", error => {
          errorManager.logError("Core Error", error.message, error.context);

          // Core errors might require restart
          if (error.severity === "critical") {
            this.handleCriticalError(error);
          }

          return errorManager.attemptRecovery(error);
        });

        // Set up unhandled error catching
        this.setupGlobalErrorHandling();

        errorManager.logInfo(
          "Error Handling",
          "Error handling system initialized"
        );
        return true;
      } catch (e) {
        console.error("Failed to initialize error handling:", e);
        return false;
      }
    }

    async initializeDOMUtils() {
      try {
        // Test DOM utilities
        const testElement = domUtils.createElement("div", {
          "data-test": "core-test",
        });

        if (!testElement) {
          throw new Error("DOM utilities not functioning");
        }

        // Set up DOM event listeners
        this.setupDOMEventListeners();

        errorManager.logInfo("DOM Utils", "DOM utilities initialized");
        return true;
      } catch (e) {
        errorManager.handleError(e, { context: "dom_initialization" });
        return false;
      }
    }

    async initializePageDetection() {
      try {
        const currentPage = this.detectCurrentPage();
        this.state.setCurrentPage(currentPage);

        // Set up page change monitoring
        this.setupPageChangeMonitoring();

        errorManager.logInfo(
          "Page Detection",
          `Current page detected: ${currentPage}`
        );
        return true;
      } catch (e) {
        errorManager.handleError(e, { context: "page_detection" });
        return false;
      }
    }

    async initializeEventSystem() {
      try {
        // Set up cross-frame messaging
        domUtils.setupMessageListener(event => {
          this.handleCrossFrameMessage(event);
        });

        // Set up custom event system
        this.setupCustomEvents();

        errorManager.logInfo("Event System", "Event system initialized");
        return true;
      } catch (e) {
        errorManager.handleError(e, { context: "event_system" });
        return false;
      }
    }

    async initializeMonitoring() {
      try {
        // Set up health monitoring
        this.startHealthMonitoring();

        // Set up performance monitoring
        this.startPerformanceMonitoring();

        errorManager.logInfo("Monitoring", "Monitoring systems initialized");
        return true;
      } catch (e) {
        errorManager.handleError(e, { context: "monitoring" });
        return false;
      }
    }

    // ============= PAGE DETECTION =============

    detectCurrentPage() {
      const url = window.location.href;
      const pathname = window.location.pathname;

      if (pathname.includes(ATEEX_CONFIG.PAGES.LOGIN)) {
        return "login";
      } else if (
        pathname.includes(ATEEX_CONFIG.PAGES.HOME) ||
        pathname === "/"
      ) {
        return "home";
      } else if (pathname.includes(ATEEX_CONFIG.PAGES.EARN)) {
        return "earn";
      } else if (pathname.includes(ATEEX_CONFIG.PAGES.LOGOUT)) {
        return "logout";
      } else if (url.includes("recaptcha")) {
        return "recaptcha";
      } else {
        return "unknown";
      }
    }

    setupPageChangeMonitoring() {
      // Monitor URL changes
      let lastUrl = window.location.href;

      const checkUrlChange = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          const newPage = this.detectCurrentPage();
          if (newPage !== this.state.currentPage) {
            this.state.setCurrentPage(newPage);
          }
        }
      };

      // Use both popstate and periodic checking
      window.addEventListener("popstate", checkUrlChange);
      setInterval(checkUrlChange, 2000);
    }

    // ============= EVENT HANDLING =============

    setupGlobalErrorHandling() {
      // Add additional error handlers beyond what errorManager already does
      window.addEventListener("beforeunload", () => {
        // Save any pending data before page unload
        this.saveSessionData();
      });
    }

    setupDOMEventListeners() {
      // Document ready/load events
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          this.state.emit("documentReady", { timestamp: Date.now() });
        });
      }

      // Focus/blur events for activity tracking
      window.addEventListener("focus", () => {
        this.state.updateActivity();
        this.state.emit("windowFocus", { timestamp: Date.now() });
      });

      window.addEventListener("blur", () => {
        this.state.emit("windowBlur", { timestamp: Date.now() });
      });
    }

    setupCustomEvents() {
      // Set up internal event handlers
      this.state.on("pageChange", data => {
        errorManager.logInfo("Page Change", `Navigated to: ${data.page}`);

        // Store page visit
        this.recordPageVisit(data.page);
      });
    }

    handleCrossFrameMessage(event) {
      try {
        const data = event.data;

        if (typeof data === "object" && data.type) {
          switch (data.type) {
            case MESSAGE_TYPES.CAPTCHA_SOLVED:
              this.state.emit("captchaSolved", data);
              break;
            case MESSAGE_TYPES.CREDENTIALS_READY:
              this.state.emit("credentialsReady", data);
              break;
            case MESSAGE_TYPES.ERROR_OCCURRED:
              errorManager.handleError(data.error, data.context);
              break;
            case MESSAGE_TYPES.STATUS_UPDATE:
              this.state.emit("statusUpdate", data);
              break;
          }
        }
      } catch (e) {
        errorManager.handleError(e, { context: "cross_frame_message" });
      }
    }

    // ============= MONITORING =============

    startHealthMonitoring() {
      setInterval(() => {
        try {
          const health = this.performHealthCheck();

          if (health.status !== "healthy") {
            errorManager.logWarning(
              "Health Check",
              `System health: ${health.status}`,
              health
            );
          }
        } catch (e) {
          errorManager.handleError(e, { context: "health_monitoring" });
        }
      }, WORKFLOW_CONFIG.MONITORING.HEALTH_CHECK_INTERVAL);
    }

    startPerformanceMonitoring() {
      // Monitor memory usage periodically
      setInterval(() => {
        try {
          if (performance.memory) {
            const memoryInfo = {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit,
            };

            // Log if memory usage is high
            const usagePercent = (memoryInfo.used / memoryInfo.limit) * 100;
            if (usagePercent > 80) {
              errorManager.logWarning(
                "Memory Usage",
                `High memory usage: ${usagePercent.toFixed(1)}%`,
                memoryInfo
              );
            }
          }
        } catch (e) {
          // Ignore - performance.memory not available in all browsers
        }
      }, 300000); // Every 5 minutes
    }

    performHealthCheck() {
      const health = {
        status: "healthy",
        issues: [],
        metrics: {},
      };

      try {
        // Check core components
        if (!this.initialized) {
          health.status = "degraded";
          health.issues.push("Core not initialized");
        }

        // Check storage
        try {
          storage.set("health_check", Date.now());
          storage.remove("health_check");
        } catch (e) {
          health.status = "degraded";
          health.issues.push("Storage not functioning");
        }

        // Check error manager
        const errorStats = errorManager.getErrorStats();
        if (errorStats.recentErrors > 10) {
          health.status = "degraded";
          health.issues.push("High error rate");
        }

        health.metrics = {
          uptime: Date.now() - this.startTime,
          lastActivity: Date.now() - this.state.lastActivity,
          currentPage: this.state.currentPage,
          errorStats: errorStats,
        };
      } catch (e) {
        health.status = "critical";
        health.issues.push("Health check failed");
      }

      return health;
    }

    // ============= UTILITY METHODS =============

    recordPageVisit(page) {
      try {
        const visits = storage.getJSON("page_visits", []);
        visits.push({
          page: page,
          timestamp: Date.now(),
          sessionId: this.state.sessionId,
        });

        // Keep only last 100 visits
        if (visits.length > 100) {
          visits.splice(0, visits.length - 100);
        }

        storage.setJSON("page_visits", visits);
      } catch (e) {
        errorManager.handleError(e, { context: "page_visit_recording" });
      }
    }

    saveSessionData() {
      try {
        const sessionData = {
          sessionId: this.state.sessionId,
          startTime: this.startTime,
          endTime: Date.now(),
          currentPage: this.state.currentPage,
          lastActivity: this.state.lastActivity,
          features: Object.fromEntries(this.state.features),
        };

        storage.setJSON("last_session", sessionData);
      } catch (e) {
        errorManager.handleError(e, { context: "session_data_save" });
      }
    }

    setupCleanupHandlers() {
      window.addEventListener("beforeunload", () => {
        this.saveSessionData();
      });
    }

    handleCriticalError(error) {
      try {
        errorManager.logError(
          "Critical Error",
          "System encountered critical error",
          error
        );

        // Save error info
        storage.setJSON("critical_error", {
          error: error,
          timestamp: Date.now(),
          sessionId: this.state.sessionId,
        });

        // Attempt recovery based on error type
        if (error.category === "module" || error.category === "core") {
          // Module errors might require restart
          setTimeout(() => {
            if (confirm("A critical error occurred. Reload the page?")) {
              window.location.reload();
            }
          }, 5000);
        }
      } catch (e) {
        console.error("Failed to handle critical error:", e);
      }
    }

    // ============= PUBLIC API =============

    // Delay utility
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Random delay for human-like behavior
    randomDelay(min = 1000, max = 3000) {
      const delay = Math.random() * (max - min) + min;
      return this.delay(delay);
    }

    // Get current page
    getCurrentPage() {
      return this.state.currentPage;
    }

    // Get session info
    getSessionInfo() {
      return {
        sessionId: this.state.sessionId,
        startTime: this.startTime,
        uptime: Date.now() - this.startTime,
        currentPage: this.state.currentPage,
        lastActivity: this.state.lastActivity,
        initialized: this.initialized,
      };
    }

    // Register event listeners
    on(event, handler) {
      this.state.on(event, handler);
    }

    // Emit events
    emit(event, data) {
      this.state.emit(event, data);
    }

    // Feature management
    enableFeature(name) {
      this.state.registerFeature(name, true);
      errorManager.logInfo("Feature", `Enabled feature: ${name}`);
    }

    disableFeature(name) {
      this.state.registerFeature(name, false);
      errorManager.logInfo("Feature", `Disabled feature: ${name}`);
    }

    isFeatureEnabled(name) {
      return this.state.isFeatureEnabled(name);
    }

    // Get system status
    getSystemStatus() {
      return {
        core: this.initialized,
        storage: !!storage,
        errorManager: !!errorManager,
        domUtils: !!domUtils,
        health: this.performHealthCheck(),
      };
    }
  }

  // ============= SINGLETON INSTANCE =============

  const core = new AteexCore();

  // ============= EXPORTS =============

  exports.AteexCore = AteexCore;
  exports.core = core;
  exports.initialize = () => core.initialize();

  // Event system
  exports.on = (event, handler) => core.on(event, handler);
  exports.emit = (event, data) => core.emit(event, data);

  // Utilities
  exports.delay = ms => core.delay(ms);
  exports.randomDelay = (min, max) => core.randomDelay(min, max);

  // State access
  exports.getCurrentPage = () => core.getCurrentPage();
  exports.getSessionInfo = () => core.getSessionInfo();
  exports.getSystemStatus = () => core.getSystemStatus();

  // Feature management
  exports.enableFeature = name => core.enableFeature(name);
  exports.disableFeature = name => core.disableFeature(name);
  exports.isFeatureEnabled = name => core.isFeatureEnabled(name);
})(exports);
