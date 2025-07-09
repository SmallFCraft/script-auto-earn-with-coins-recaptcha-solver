/**
 * Workflow Module v4.0 - Main workflow orchestrator for hierarchical system
 * Serves as the primary entry point and delegates to the navigation handler
 */

(function (exports) {
  "use strict";

  // Get dependencies from new hierarchical structure
  const navigationHandler = AteexModules.navigationHandler;
  const coreModule = AteexModules.coreModule;
  const errorManager = AteexModules.errorManager;
  const uiManager = AteexModules.uiManager;
  const credentialsModule = AteexModules.credentialsModule;
  const recaptchaModule = AteexModules.recaptchaModule;
  const statsManager = AteexModules.statsManager;
  const dataModule = AteexModules.dataModule;

  // ============= WORKFLOW ORCHESTRATOR v4.0 =============

  class WorkflowOrchestrator {
    constructor() {
      this.isInitialized = false;
      this.isStarted = false;
    }

    // Initialize the workflow system
    async initialize() {
      if (this.isInitialized) {
        return true;
      }

      try {
        errorManager.logInfo(
          "Workflow",
          "🚀 Initializing Ateex Auto CAPTCHA v4.0..."
        );

        // Initialize core systems first
        await this.initializeCoreModules();

        this.isInitialized = true;
        errorManager.logSuccess(
          "Workflow",
          "✅ Workflow orchestrator initialized"
        );
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "workflow_init",
          category: "workflow",
        });
        return false;
      }
    }

    // Initialize core modules
    async initializeCoreModules() {
      const modules = [
        { name: "Navigation Handler", module: navigationHandler },
        { name: "Stats Manager", module: statsManager },
        { name: "Data Module", module: dataModule },
      ];

      for (const { name, module } of modules) {
        if (module.initialize) {
          const success = await module.initialize();
          if (success) {
            errorManager.logInfo("Workflow", `✅ ${name} initialized`);
          } else {
            errorManager.logWarning(
              "Workflow",
              `⚠️ ${name} initialization failed`
            );
          }
        }
      }
    }

    // Start the main workflow
    async start() {
      if (this.isStarted) {
        errorManager.logInfo("Workflow", "Workflow already started");
        return;
      }

      if (!this.isInitialized) {
        await this.initialize();
      }

      try {
        this.isStarted = true;
        errorManager.logInfo("Workflow", "🎯 Starting main workflow...");

        // Start the navigation handler (which handles all page logic)
        await navigationHandler.initialize();

        errorManager.logSuccess(
          "Workflow",
          "🚀 Ateex Auto CAPTCHA v4.0 started successfully!"
        );
      } catch (error) {
        errorManager.handleError(error, {
          context: "workflow_start",
          category: "workflow",
        });
        this.isStarted = false;
      }
    }

    // Stop the workflow
    stop() {
      if (!this.isStarted) {
        return;
      }

      try {
        errorManager.logInfo("Workflow", "🛑 Stopping workflow...");

        // Cleanup all modules
        if (navigationHandler.cleanup) navigationHandler.cleanup();
        if (uiManager.cleanup) uiManager.cleanup();
        if (recaptchaModule.cleanup) recaptchaModule.cleanup();

        this.isStarted = false;
        this.isInitialized = false;

        errorManager.logSuccess(
          "Workflow",
          "✅ Workflow stopped and cleaned up"
        );
      } catch (error) {
        errorManager.handleError(error, {
          context: "workflow_stop",
          category: "workflow",
        });
      }
    }

    // Get workflow status
    getStatus() {
      return {
        initialized: this.isInitialized,
        started: this.isStarted,
        autoStatsActive: statsManager.isAutoStatsActive(),
        credentialsReady: coreModule.getState("credentialsReady"),
        currentPage: navigationHandler.getCurrentPage(),
      };
    }
  }

  // ============= SINGLETON INSTANCE =============

  const workflowOrchestrator = new WorkflowOrchestrator();

  // ============= LEGACY COMPATIBILITY FUNCTIONS =============

  // Main start function (legacy compatibility)
  async function start() {
    return await workflowOrchestrator.start();
  }

  // Legacy page handlers (now delegated to navigation handler)
  async function handleEarnPage() {
    errorManager.logInfo("Workflow", "Delegating to navigation handler...");
    const page = { type: "earn" };
    return await navigationHandler.handlePageNavigation(page);
  }

  async function handleLoginPage() {
    errorManager.logInfo("Workflow", "Delegating to navigation handler...");
    const page = { type: "login" };
    return await navigationHandler.handlePageNavigation(page);
  }

  async function handleHomePage() {
    errorManager.logInfo("Workflow", "Delegating to navigation handler...");
    const page = { type: "home" };
    return await navigationHandler.handlePageNavigation(page);
  }

  async function handleLogoutPage() {
    errorManager.logInfo("Workflow", "Delegating to navigation handler...");
    const page = { type: "logout" };
    return await navigationHandler.handlePageNavigation(page);
  }

  function handlePopupPage() {
    errorManager.logInfo("Workflow", "Delegating to navigation handler...");
    const page = { type: "popup" };
    return navigationHandler.handlePageNavigation(page);
  }

  // Legacy captcha functions
  function setupCaptchaFallbackDetection() {
    errorManager.logInfo(
      "Workflow",
      "ℹ️ Fallback detection now handled by enhanced recaptcha module"
    );
  }

  async function attemptFormSubmission() {
    errorManager.logInfo(
      "Workflow",
      "ℹ️ Form submission now handled by login handler module"
    );
    if (AteexModules.loginHandler) {
      return await AteexModules.loginHandler.attemptFormSubmission();
    }
  }

  // ============= ENHANCED FEATURES =============

  // Get comprehensive system status
  function getSystemStatus() {
    return {
      workflow: workflowOrchestrator.getStatus(),
      navigation: {
        ready: navigationHandler.isReady(),
        currentPage: navigationHandler.getCurrentPage(),
      },
      stats: {
        active: statsManager.isAutoStatsActive(),
        metrics: statsManager.getPerformanceMetrics(),
        displayStats: statsManager.getDisplayStats(),
      },
      ui: {
        counterVisible: !!document.getElementById("ateex-counter"),
        notificationCount: uiManager.notifications?.size || 0,
      },
    };
  }

  // Initialize and start the system
  async function initializeAndStart() {
    try {
      await workflowOrchestrator.initialize();
      await workflowOrchestrator.start();

      // Show system status
      const status = getSystemStatus();
      errorManager.logSuccess("Workflow", "🎉 System fully operational!");
      errorManager.logInfo(
        "Workflow",
        `📊 System Status: ${JSON.stringify(status, null, 2)}`
      );

      return true;
    } catch (error) {
      errorManager.handleError(error, {
        context: "initialize_and_start",
        category: "workflow",
      });
      return false;
    }
  }

  // Emergency stop function
  function emergencyStop() {
    try {
      // Set global stop flag
      window.scriptStopped = true;

      // Stop workflow
      workflowOrchestrator.stop();

      // Show notification
      if (uiManager.showNotification) {
        uiManager.showNotification(
          "🛑 Emergency stop activated",
          "warning",
          10000
        );
      }

      errorManager.logWarning(
        "Workflow",
        "🛑 Emergency stop activated by user"
      );
    } catch (error) {
      console.error("Error during emergency stop:", error);
    }
  }

  // Restart system
  async function restart() {
    try {
      errorManager.logInfo("Workflow", "🔄 Restarting system...");

      // Stop current workflow
      workflowOrchestrator.stop();

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear stop flag
      window.scriptStopped = false;

      // Restart
      return await initializeAndStart();
    } catch (error) {
      errorManager.handleError(error, {
        context: "restart_system",
        category: "workflow",
      });
      return false;
    }
  }

  // ============= EXPORTS =============

  // Main orchestrator
  exports.WorkflowOrchestrator = WorkflowOrchestrator;
  exports.workflowOrchestrator = workflowOrchestrator;

  // Primary API
  exports.start = start;
  exports.initialize = () => workflowOrchestrator.initialize();
  exports.stop = () => workflowOrchestrator.stop();
  exports.getStatus = () => workflowOrchestrator.getStatus();

  // Legacy compatibility
  exports.handleEarnPage = handleEarnPage;
  exports.handleLoginPage = handleLoginPage;
  exports.handleHomePage = handleHomePage;
  exports.handleLogoutPage = handleLogoutPage;
  exports.handlePopupPage = handlePopupPage;
  exports.setupCaptchaFallbackDetection = setupCaptchaFallbackDetection;
  exports.attemptFormSubmission = attemptFormSubmission;

  // Enhanced features
  exports.getSystemStatus = getSystemStatus;
  exports.initializeAndStart = initializeAndStart;
  exports.emergencyStop = emergencyStop;
  exports.restart = restart;

  // Legacy CONFIG support (deprecated)
  exports.CONFIG = null; // Will be handled by credentials module
})(exports);
