/**
 * Navigation Handler Module - Page detection and routing
 * Handles page navigation, URL routing, iframe detection, and workflow orchestration
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const errorManager = AteexModules.errorManager;
  const credentialsModule = AteexModules.credentialsModule;
  const uiManager = AteexModules.uiManager;
  const recaptchaModule = AteexModules.recaptchaModule;
  const statsManager = AteexModules.statsManager;
  const dataModule = AteexModules.dataModule;

  const { PAGE_CONFIG, WORKFLOW_CONFIG, MESSAGE_TYPES } = constants;

  // ============= NAVIGATION HANDLER CLASS =============

  class NavigationHandler {
    constructor() {
      this.currentPage = null;
      this.lastPageCheck = 0;
      this.navigationInterval = null;
      this.messageListeners = new Map();
      this.isInitialized = false;
      this.credentialsReady = false;
      this.autoStatsEnabled = false;
    }

    // ============= INITIALIZATION =============

    async initialize() {
      if (this.isInitialized) {
        return true;
      }

      try {
        // Set up page detection
        this.setupPageDetection();

        // Set up iframe communication
        this.setupIframeCommunication();

        // Set up navigation monitoring
        this.setupNavigationMonitoring();

        this.isInitialized = true;
        errorManager.logSuccess(
          "Navigation Handler",
          "Initialized successfully"
        );
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "navigation_handler_init",
          category: "navigation",
        });
        return false;
      }
    }

    // Set up page detection logic
    setupPageDetection() {
      // Detect current page immediately
      this.detectCurrentPage();

      // Set up periodic page checks
      this.navigationInterval = setInterval(() => {
        this.checkPageChanges();
      }, PAGE_CONFIG.CHECK_INTERVAL);
    }

    // Set up iframe communication
    setupIframeCommunication() {
      window.addEventListener("message", event => {
        this.handleMessage(event);
      });

      // Listen for iframe load events
      document.addEventListener("DOMContentLoaded", () => {
        this.setupIframeMonitoring();
      });
    }

    // Set up navigation monitoring
    setupNavigationMonitoring() {
      // Monitor hash changes
      window.addEventListener("hashchange", () => {
        this.onPageChange();
      });

      // Monitor popstate events
      window.addEventListener("popstate", () => {
        this.onPageChange();
      });

      // Monitor pushstate/replacestate
      this.monitorHistoryAPI();
    }

    // ============= PAGE DETECTION =============

    // Detect current page type
    detectCurrentPage() {
      const currentUrl = window.location.href;
      const currentPath = window.location.pathname;
      const hostname = window.location.hostname;

      // Special handling for recaptcha iframes
      if (this.isRecaptchaIframe(currentUrl)) {
        this.currentPage = {
          type: "recaptcha",
          url: currentUrl,
          path: currentPath,
          isIframe: true,
          hostname: hostname,
        };
        return this.currentPage;
      }

      // Detect main pages
      const pageType = this.identifyPageType(currentPath, currentUrl);

      this.currentPage = {
        type: pageType,
        url: currentUrl,
        path: currentPath,
        isIframe: window.top !== window.self,
        hostname: hostname,
        isAteexDomain: this.isAteexDomain(hostname),
      };

      errorManager.logInfo(
        "Navigation",
        `Current page detected: ${pageType} (${currentPath})`
      );
      return this.currentPage;
    }

    // Identify page type from URL patterns
    identifyPageType(path, url) {
      // Check for popup/ads pages first
      if (this.isPopupPage(path, url)) {
        return "popup";
      }

      // Check for main page types
      if (path.includes("/login") || path.includes("signin")) {
        return "login";
      }

      if (path.includes("/earn") && !path.includes("clickcoin")) {
        return "earn";
      }

      if (path.includes("/home") || path === "/" || path === "") {
        return "home";
      }

      if (path.includes("/logout") || path.includes("signout")) {
        return "logout";
      }

      if (path.includes("/profile") || path.includes("/account")) {
        return "profile";
      }

      if (path.includes("/settings") || path.includes("/config")) {
        return "settings";
      }

      // Default to unknown
      return "unknown";
    }

    // Check if current URL is a recaptcha iframe
    isRecaptchaIframe(url) {
      return (
        url.includes("recaptcha") ||
        url.includes("google.com/recaptcha") ||
        url.includes("gstatic.com/recaptcha")
      );
    }

    // Check if current page is a popup/ads page
    isPopupPage(path, url) {
      const popupPatterns = [
        "clickcoin",
        "ads",
        "popup",
        "/earn/clickcoin",
        "advertisement",
        "promo",
        "offer",
      ];

      return popupPatterns.some(
        pattern => path.includes(pattern) || url.includes(pattern)
      );
    }

    // Check if hostname is an Ateex domain
    isAteexDomain(hostname) {
      const ateexDomains = [
        "ateex.me",
        "www.ateex.me",
        "ateex.com",
        "www.ateex.com",
      ];

      return ateexDomains.includes(hostname.toLowerCase());
    }

    // Check for page changes
    checkPageChanges() {
      const now = Date.now();
      if (now - this.lastPageCheck < PAGE_CONFIG.CHECK_INTERVAL) {
        return;
      }

      this.lastPageCheck = now;

      const previousPage = this.currentPage;
      const currentPage = this.detectCurrentPage();

      // Check if page actually changed
      if (
        !previousPage ||
        previousPage.type !== currentPage.type ||
        previousPage.path !== currentPage.path
      ) {
        this.onPageChange(previousPage, currentPage);
      }
    }

    // Handle page change event
    onPageChange(previousPage = null, currentPage = null) {
      if (!currentPage) {
        currentPage = this.detectCurrentPage();
      }

      errorManager.logInfo(
        "Navigation",
        `Page changed: ${previousPage?.type || "none"} → ${currentPage.type}`
      );

      // Emit page change event
      this.emitPageChangeEvent(previousPage, currentPage);

      // Handle the new page
      this.handlePageNavigation(currentPage);
    }

    // ============= PAGE HANDLING =============

    // Handle navigation to a specific page
    async handlePageNavigation(page) {
      try {
        errorManager.logInfo("Navigation", `Handling page: ${page.type}`);

        switch (page.type) {
          case "recaptcha":
            await this.handleRecaptchaPage(page);
            break;
          case "login":
            await this.handleLoginPage(page);
            break;
          case "earn":
            await this.handleEarnPage(page);
            break;
          case "home":
            await this.handleHomePage(page);
            break;
          case "logout":
            await this.handleLogoutPage(page);
            break;
          case "popup":
            await this.handlePopupPage(page);
            break;
          case "profile":
          case "settings":
            await this.handleConfigPage(page);
            break;
          case "unknown":
            await this.handleUnknownPage(page);
            break;
          default:
            errorManager.logWarning(
              "Navigation",
              `Unhandled page type: ${page.type}`
            );
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: `handle_page_${page.type}`,
          category: "navigation",
        });
      }
    }

    // Handle recaptcha iframe page
    async handleRecaptchaPage(page) {
      errorManager.logInfo("Navigation", "🔄 Detected reCAPTCHA iframe");

      // Set up credentials listening for iframe
      this.setupCredentialsListener();

      // Initialize recaptcha solver
      if (recaptchaModule.initialize) {
        await recaptchaModule.initialize();
      }

      // Start recaptcha solver
      recaptchaModule.startSolver();
    }

    // Handle login page
    async handleLoginPage(page) {
      if (!this.shouldHandlePage(page)) return;

      errorManager.logInfo("Navigation", "🔐 Handling login page");

      // Ensure UI is initialized for main window
      if (page.isIframe === false) {
        await this.ensureUIInitialized();
      }

      // Load login handler dynamically and handle
      if (AteexModules.loginHandler) {
        await AteexModules.loginHandler.handleLoginPage();
      } else {
        errorManager.logWarning("Navigation", "Login handler not available");
      }
    }

    // Handle earn page
    async handleEarnPage(page) {
      if (!this.shouldHandlePage(page)) return;

      errorManager.logInfo("Navigation", "💰 Handling earn page");

      // Ensure UI is initialized
      if (page.isIframe === false) {
        await this.ensureUIInitialized();
      }

      // Load earn handler dynamically and handle
      if (AteexModules.earnHandler) {
        await AteexModules.earnHandler.handleEarnPage();
      } else {
        errorManager.logWarning("Navigation", "Earn handler not available");
      }
    }

    // Handle home page
    async handleHomePage(page) {
      if (!this.shouldHandlePage(page)) return;

      errorManager.logInfo("Navigation", "🏠 Handling home page");

      // Ensure UI is initialized
      if (page.isIframe === false) {
        await this.ensureUIInitialized();
      }

      // Navigate to earn page if auto stats is enabled
      if (this.autoStatsEnabled && this.credentialsReady) {
        setTimeout(() => {
          this.navigateToEarnPage();
        }, WORKFLOW_CONFIG.NAVIGATION_DELAY);
      }
    }

    // Handle logout page
    async handleLogoutPage(page) {
      errorManager.logInfo("Navigation", "🚪 Handling logout page");

      // Clear session data
      this.clearSessionData();

      // Navigate to login after delay
      setTimeout(() => {
        this.navigateToLoginPage();
      }, WORKFLOW_CONFIG.LOGOUT_DELAY);
    }

    // Handle popup/ads page
    async handlePopupPage(page) {
      errorManager.logInfo("Navigation", "🗨️ Handling popup page");

      // Close popup after delay
      setTimeout(() => {
        this.closePopupPage();
      }, WORKFLOW_CONFIG.POPUP_DELAY);
    }

    // Handle configuration pages (profile, settings)
    async handleConfigPage(page) {
      if (!this.shouldHandlePage(page)) return;

      errorManager.logInfo(
        "Navigation",
        `⚙️ Handling config page: ${page.type}`
      );

      // Ensure UI is initialized
      if (page.isIframe === false) {
        await this.ensureUIInitialized();
      }
    }

    // Handle unknown page
    async handleUnknownPage(page) {
      errorManager.logDebug("Navigation", `❓ Unknown page: ${page.path}`);

      // Still ensure UI is initialized for Ateex domains
      if (page.isAteexDomain && page.isIframe === false) {
        await this.ensureUIInitialized();
      }
    }

    // ============= UI MANAGEMENT =============

    // Ensure UI is initialized
    async ensureUIInitialized() {
      try {
        // Check auto stats state
        this.autoStatsEnabled = statsManager.isAutoStatsActive();

        // Load existing credentials
        await this.checkExistingCredentials();

        // Initialize UI manager
        await uiManager.initialize();

        // Load saved data
        dataModule.loadSavedStats();

        // Create counter if auto stats is enabled
        if (this.autoStatsEnabled) {
          uiManager.ensureCounterExists();
          uiManager.updateCounter();
          errorManager.logSuccess(
            "Navigation",
            "🚀 Auto Stats runtime active - UI created"
          );
        } else {
          // For new users, prompt for credentials
          this.promptForCredentials();
        }

        // Set up counter updates
        this.setupCounterUpdates();
      } catch (error) {
        errorManager.handleError(error, {
          context: "ensure_ui_initialized",
          category: "navigation",
        });
      }
    }

    // Check for existing credentials
    async checkExistingCredentials() {
      try {
        const existingCreds = credentialsModule.loadCredentials();

        if (existingCreds && existingCreds.email && existingCreds.password) {
          this.credentialsReady = true;
          coreModule.setState("credentialsReady", true);

          errorManager.logSuccess(
            "Navigation",
            "Existing credentials found and loaded"
          );

          // Notify iframes about credentials
          this.notifyCredentialsReady();

          return existingCreds;
        }

        return null;
      } catch (error) {
        errorManager.handleError(error, {
          context: "check_existing_credentials",
          category: "navigation",
        });
        return null;
      }
    }

    // Prompt for credentials (for new users)
    promptForCredentials() {
      setTimeout(async () => {
        try {
          errorManager.logInfo("Navigation", "🔐 Setting up credentials...");

          const newCredentials = await credentialsModule.getCredentials();

          if (newCredentials) {
            this.credentialsReady = true;
            coreModule.setState("credentialsReady", true);

            errorManager.logSuccess(
              "Navigation",
              "✅ Credentials obtained - Auto Stats enabled"
            );

            // Notify iframes
            this.notifyCredentialsReady();

            // Create UI now that setup is complete
            uiManager.ensureCounterExists();
            uiManager.updateCounter();
          } else {
            errorManager.logWarning(
              "Navigation",
              "❌ User cancelled credential setup - Auto Stats remains disabled"
            );
          }
        } catch (error) {
          errorManager.handleError(error, {
            context: "prompt_for_credentials",
            category: "navigation",
          });
        }
      }, WORKFLOW_CONFIG.CREDENTIAL_PROMPT_DELAY);
    }

    // Set up counter updates
    setupCounterUpdates() {
      // Update counter periodically
      setInterval(() => {
        if (this.autoStatsEnabled) {
          uiManager.updateCounter();
        }
      }, WORKFLOW_CONFIG.COUNTER_UPDATE_INTERVAL);
    }

    // ============= IFRAME COMMUNICATION =============

    // Set up credentials listener for iframes
    setupCredentialsListener() {
      let lastCredentialsMessage = 0;

      const handleCredentialsMessage = event => {
        if (event.data && event.data.type === MESSAGE_TYPES.CREDENTIALS_READY) {
          const now = Date.now();

          // Prevent spam (only log once per minute)
          if (now - lastCredentialsMessage > 60000) {
            errorManager.logInfo(
              "Navigation",
              "Received credentials ready message from parent window"
            );
            lastCredentialsMessage = now;
          }

          this.credentialsReady = true;
          coreModule.setState("credentialsReady", true);
        }
      };

      window.addEventListener("message", handleCredentialsMessage);
      this.messageListeners.set("credentials", handleCredentialsMessage);
    }

    // Set up iframe monitoring
    setupIframeMonitoring() {
      if (this.credentialsReady) {
        // Initial notification
        setTimeout(() => {
          this.notifyCredentialsReady();
        }, 1000);

        // Monitor for new iframes
        let lastIframeCount = 0;
        setInterval(() => {
          if (this.credentialsReady) {
            const frames = document.querySelectorAll("iframe");
            if (frames.length > lastIframeCount) {
              this.notifyCredentialsReady();
            }
            lastIframeCount = frames.length;
          }
        }, WORKFLOW_CONFIG.IFRAME_CHECK_INTERVAL);
      }
    }

    // Notify iframes that credentials are ready
    notifyCredentialsReady() {
      try {
        const message = {
          type: MESSAGE_TYPES.CREDENTIALS_READY,
          timestamp: Date.now(),
        };

        // Send to all iframes
        const frames = document.querySelectorAll("iframe");
        frames.forEach(frame => {
          try {
            frame.contentWindow.postMessage(message, "*");
          } catch (e) {
            // Ignore cross-origin errors
          }
        });

        if (frames.length > 0) {
          errorManager.logDebug(
            "Navigation",
            `Notified ${frames.length} iframes about credentials`
          );
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "notify_credentials_ready",
          category: "navigation",
        });
      }
    }

    // Handle incoming messages
    handleMessage(event) {
      try {
        if (!event.data || typeof event.data !== "object") {
          return;
        }

        const { type, data } = event.data;

        switch (type) {
          case MESSAGE_TYPES.CREDENTIALS_READY:
            this.handleCredentialsReadyMessage(data);
            break;
          case MESSAGE_TYPES.CAPTCHA_SOLVED:
            this.handleCaptchaSolvedMessage(data);
            break;
          case MESSAGE_TYPES.PAGE_NAVIGATION:
            this.handlePageNavigationMessage(data);
            break;
          default:
          // Ignore unknown messages
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "handle_message",
          category: "navigation",
        });
      }
    }

    // Handle credentials ready message
    handleCredentialsReadyMessage(data) {
      this.credentialsReady = true;
      coreModule.setState("credentialsReady", true);
    }

    // Handle captcha solved message
    handleCaptchaSolvedMessage(data) {
      if (data && data.solved) {
        errorManager.logSuccess(
          "Navigation",
          "Received captcha solved notification"
        );
        // Forward to relevant handlers
        this.emitCaptchaSolvedEvent(data);
      }
    }

    // Handle page navigation message
    handlePageNavigationMessage(data) {
      if (data && data.url) {
        this.navigateToUrl(data.url);
      }
    }

    // ============= NAVIGATION UTILITIES =============

    // Navigate to earn page
    navigateToEarnPage() {
      const earnUrl = this.buildUrl("/earn");
      this.navigateToUrl(earnUrl);
    }

    // Navigate to login page
    navigateToLoginPage() {
      const loginUrl = this.buildUrl("/login");
      this.navigateToUrl(loginUrl);
    }

    // Navigate to specific URL
    navigateToUrl(url) {
      try {
        errorManager.logInfo("Navigation", `Navigating to: ${url}`);

        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          window.location.pathname = url;
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "navigate_to_url",
          category: "navigation",
        });
      }
    }

    // Build URL for current domain
    buildUrl(path) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : "";

      return `${protocol}//${hostname}${port}${path}`;
    }

    // Close popup page
    closePopupPage() {
      try {
        // Try multiple close methods
        if (window.close) {
          window.close();
        }

        // Fallback: navigate back or to home
        if (window.history.length > 1) {
          window.history.back();
        } else {
          this.navigateToEarnPage();
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "close_popup_page",
          category: "navigation",
        });
      }
    }

    // Clear session data
    clearSessionData() {
      try {
        // Clear temporary state
        coreModule.setState("credentialsReady", false);
        this.credentialsReady = false;

        // Optionally clear persistent data based on settings
        // (credentials are preserved unless explicitly cleared by user)

        errorManager.logInfo("Navigation", "Session data cleared");
      } catch (error) {
        errorManager.handleError(error, {
          context: "clear_session_data",
          category: "navigation",
        });
      }
    }

    // ============= UTILITY FUNCTIONS =============

    // Check if page should be handled
    shouldHandlePage(page) {
      return page.isAteexDomain && !page.isIframe && page.type !== "recaptcha";
    }

    // Monitor History API
    monitorHistoryAPI() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        setTimeout(() => this.onPageChange(), 100);
      };

      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => this.onPageChange(), 100);
      };
    }

    // Emit page change event
    emitPageChangeEvent(previousPage, currentPage) {
      try {
        const event = new CustomEvent("ateexPageChange", {
          detail: { previousPage, currentPage },
        });
        window.dispatchEvent(event);
      } catch (error) {
        // Ignore event errors
      }
    }

    // Emit captcha solved event
    emitCaptchaSolvedEvent(data) {
      try {
        const event = new CustomEvent("ateexCaptchaSolved", {
          detail: data,
        });
        window.dispatchEvent(event);
      } catch (error) {
        // Ignore event errors
      }
    }

    // Get current page info
    getCurrentPage() {
      return this.currentPage;
    }

    // Check if navigation is ready
    isReady() {
      return this.isInitialized;
    }

    // ============= CLEANUP =============

    cleanup() {
      // Clear intervals
      if (this.navigationInterval) {
        clearInterval(this.navigationInterval);
      }

      // Remove message listeners
      this.messageListeners.forEach((listener, type) => {
        window.removeEventListener("message", listener);
      });
      this.messageListeners.clear();

      this.isInitialized = false;
      errorManager.logInfo("Navigation Handler", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const navigationHandler = new NavigationHandler();

  // ============= EXPORTS =============

  exports.NavigationHandler = NavigationHandler;
  exports.navigationHandler = navigationHandler;

  // Main API
  exports.initialize = () => navigationHandler.initialize();
  exports.handlePageNavigation = page =>
    navigationHandler.handlePageNavigation(page);
  exports.detectCurrentPage = () => navigationHandler.detectCurrentPage();
  exports.getCurrentPage = () => navigationHandler.getCurrentPage();

  // Navigation utilities
  exports.navigateToEarnPage = () => navigationHandler.navigateToEarnPage();
  exports.navigateToLoginPage = () => navigationHandler.navigateToLoginPage();
  exports.navigateToUrl = url => navigationHandler.navigateToUrl(url);

  // State utilities
  exports.isReady = () => navigationHandler.isReady();
  exports.shouldHandlePage = page => navigationHandler.shouldHandlePage(page);

  // Cleanup
  exports.cleanup = () => navigationHandler.cleanup();

  // Legacy compatibility
  exports.start = () => navigationHandler.initialize();
})(exports);
