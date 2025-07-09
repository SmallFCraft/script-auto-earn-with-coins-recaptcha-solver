// ============= MAIN APPLICATION MODULE =============
// This module orchestrates the entire application initialization and coordination

(function () {
  "use strict";

  const context = window.ateexContext;
  const utils = context.utils;

  context.log("Loading Main Application Module...", "INFO");

  // ============= APPLICATION STATE =============

  let appState = {
    initialized: false,
    currentPage: null,
    reloadListenerSetup: false,
    errorDetectionActive: false,
  };

  // ============= ERROR PAGE DETECTION =============

  // Initialize error page detection
  function initErrorPageDetection() {
    if (appState.errorDetectionActive) return;

    try {
      // Check for common error indicators
      const errorIndicators = [
        "error",
        "Error",
        "ERROR",
        "not found",
        "Not Found",
        "NOT FOUND",
        "404",
        "500",
        "502",
        "503",
        "Bad Gateway",
        "Service Unavailable",
        "Internal Server Error",
        "Page Not Found",
        "Access Denied",
      ];

      const pageText = document.body ? document.body.textContent : "";
      const pageTitle = document.title || "";

      const hasError = errorIndicators.some(
        indicator =>
          pageText.includes(indicator) || pageTitle.includes(indicator)
      );

      if (hasError) {
        context.logWarning("🚨 Error page detected, redirecting to home page");
        setTimeout(() => {
          window.location.href = utils.URLS.HOME;
        }, 3000);
        return;
      }

      // Check for specific error elements
      const errorElements = document.querySelectorAll(
        ".error, .Error, .ERROR, .not-found, .error-page"
      );

      if (errorElements.length > 0) {
        context.logWarning("🚨 Error elements found, redirecting to home page");
        setTimeout(() => {
          window.location.href = utils.URLS.HOME;
        }, 3000);
        return;
      }

      appState.errorDetectionActive = true;
      context.logDebug("Error page detection initialized");
    } catch (error) {
      context.logError("Error in error page detection", error);
    }
  }

  // ============= RELOAD LISTENER SYSTEM =============

  // Setup reload listener for iframe communication
  function setupReloadListener() {
    if (appState.reloadListenerSetup) return;

    try {
      // Listen for reload requests from iframe
      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "ateex_reload_main") {
          context.logInfo("Received reload request from iframe");
          setTimeout(() => {
            context.logInfo("Reloading main page as requested by iframe");
            window.location.reload();
          }, 1000);
        }
      });

      appState.reloadListenerSetup = true;
      context.logDebug("Reload listener setup completed");
    } catch (error) {
      context.logError("Error setting up reload listener", error);
    }
  }

  // ============= CAPTCHA SOLVER INITIALIZATION =============

  // Initialize captcha solver for iframe
  function initCaptchaSolver() {
    try {
      context.logInfo("Initializing reCAPTCHA solver for iframe...");

      // Listen for credentials ready message from parent (with spam prevention)
      let lastCredentialsMessage = 0;
      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "ateex_credentials_ready") {
          const now = Date.now();
          // Only log once every 30 seconds to prevent spam
          if (now - lastCredentialsMessage > 30000) {
            context.logInfo(
              "Received credentials ready message from parent window"
            );
            lastCredentialsMessage = now;
          }
          context.state.credentialsReady = true;
        }
      });

      context.logInfo(
        "Checking credentials before allowing reCAPTCHA solver..."
      );

      // Start reCAPTCHA solver if available
      if (context.recaptchaSolver) {
        context.recaptchaSolver.start();
      } else {
        context.logWarning("reCAPTCHA solver module not available");
      }
    } catch (error) {
      context.logError("Error initializing captcha solver", error);
    }
  }

  // ============= STATS LOADING =============

  // Load saved stats from localStorage
  function loadSavedStats() {
    try {
      const saved = GM_getValue("ateex_stats");
      if (saved) {
        const stats = JSON.parse(saved);
        context.state.totalCycles = stats.totalCycles || 0;
        context.state.totalCoins = stats.totalCoins || 0;
        context.state.startTime = stats.startTime || Date.now();

        context.logSuccess(
          `📊 Loaded saved stats: ${stats.totalCycles} cycles, ${stats.totalCoins} coins`
        );

        // Force immediate UI update after loading
        setTimeout(() => {
          if (context.ui && document.getElementById("ateex-counter")) {
            context.ui.updateCounter();
          }
        }, 100);
      } else {
        context.log("📊 No saved stats found, starting fresh");
        // Initialize with current time
        context.state.startTime = Date.now();
      }
    } catch (e) {
      context.logError("Could not load saved stats: " + e.message);
      // Initialize with defaults on error
      context.state.totalCycles = 0;
      context.state.totalCoins = 0;
      context.state.startTime = Date.now();
    }
  }

  // ============= CREDENTIALS INITIALIZATION =============

  // Initialize credentials and auto stats
  async function initializeCredentialsAndStats() {
    try {
      // Check auto stats state first (backward compatibility + new flow)
      const autoStatsWasEnabled = context.credentials
        ? context.credentials.autoStats.check()
        : false;

      context.logInfo(
        `Auto stats state check: ${
          autoStatsWasEnabled ? "enabled" : "disabled"
        }`
      );

      if (autoStatsWasEnabled) {
        context.logSuccess(
          "🚀 Auto Stats already enabled from previous session"
        );

        // Create UI immediately for existing users
        if (context.ui) {
          context.ui.createCounter();
          // Force immediate update to show loaded data
          context.ui.updateCounter();
        }
        context.logInfo("🚀 Auto Stats runtime active - UI created");

        // Send credentials ready message to any iframes
        setTimeout(() => {
          try {
            const message = { type: "ateex_credentials_ready" };
            window.postMessage(message, "*");

            // Also send to all iframes
            const iframes = document.querySelectorAll("iframe");
            iframes.forEach(iframe => {
              try {
                iframe.contentWindow.postMessage(message, "*");
              } catch (e) {
                // Ignore cross-origin errors
              }
            });
          } catch (e) {
            context.logError("Error sending credentials ready message", e);
          }
        }, 1000);
      } else {
        // Check if we have credentials but auto stats not enabled
        const existingCreds = context.credentials
          ? context.credentials.load()
          : null;
        if (existingCreds && existingCreds.email && existingCreds.password) {
          context.logInfo(
            "🔧 Credentials found but auto stats disabled - creating UI anyway"
          );

          // Create UI for users with credentials even if auto stats not enabled
          if (context.ui) {
            context.ui.createCounter();
            context.ui.updateCounter();
          }
        } else {
          context.logInfo(
            "💡 Auto Stats will be enabled when you first visit a page that requires credentials"
          );
        }
      }

      // Check if credentials already exist and set flag
      const existingCreds = context.credentials
        ? context.credentials.load()
        : null;
      if (existingCreds && existingCreds.email && existingCreds.password) {
        // Set global CONFIG for backward compatibility
        window.CONFIG = existingCreds;
        context.state.credentialsReady = true;
        context.logInfo(
          "Existing credentials found and loaded - reCAPTCHA allowed"
        );

        // Notify iframes that credentials are ready
        setTimeout(() => {
          try {
            const message = {
              type: "ateex_credentials_ready",
              timestamp: Date.now(),
            };

            const frames = document.querySelectorAll("iframe");
            if (frames.length > 0) {
              frames.forEach(frame => {
                try {
                  frame.contentWindow.postMessage(message, "*");
                } catch (e) {
                  // Ignore cross-origin errors
                }
              });
              context.logDebug(
                `Existing credentials message sent to ${frames.length} iframes`
              );
            }
          } catch (e) {
            context.logError(
              "Error sending existing credentials message: " + e.message
            );
          }
        }, 1000); // Wait 1 second for iframes to load

        // Send message to new iframes when they appear (less frequent)
        let lastIframeCount = 0;
        setInterval(() => {
          if (context.state.credentialsReady) {
            const frames = document.querySelectorAll("iframe");
            // Only send if new iframes appeared
            if (frames.length > lastIframeCount) {
              try {
                const message = {
                  type: "ateex_credentials_ready",
                  timestamp: Date.now(),
                };

                frames.forEach(frame => {
                  try {
                    frame.contentWindow.postMessage(message, "*");
                  } catch (e) {
                    // Ignore cross-origin errors
                  }
                });

                context.logDebug(
                  `Sent credentials ready to ${frames.length} iframes`
                );
              } catch (e) {
                // Ignore errors
              }
            }
            lastIframeCount = frames.length;
          }
        }, 5000); // Check every 5 seconds instead of 3
      }

      // Load saved stats
      loadSavedStats();

      return autoStatsWasEnabled;
    } catch (error) {
      context.logError("Error initializing credentials and stats", error);
      return false;
    }
  }

  // ============= MAIN APPLICATION LOGIC =============

  // Main application function
  async function main() {
    try {
      const currentPath = window.location.pathname;
      const currentUrl = window.location.href;

      context.logInfo(`Current path: ${currentPath}`);
      context.logInfo(`Current URL: ${currentUrl}`);

      appState.currentPage = currentPath;

      // Setup reload listener on main window
      setupReloadListener();

      // Initialize error page detection for all pages
      initErrorPageDetection();

      // Handle reCAPTCHA iframe separately - NO UI creation
      if (currentUrl.includes("recaptcha")) {
        context.logInfo("Detected reCAPTCHA iframe");
        initCaptchaSolver();
        return; // Only handle captcha, nothing else
      }

      // Initialize UI for main pages only (credentials will be handled per page)
      if (window.top === window.self) {
        const autoStatsEnabled = await initializeCredentialsAndStats();

        // Handle different pages based on current location
        if (context.pageHandlers) {
          context.pageHandlers.initialize();
        } else {
          context.logWarning("Page handlers module not available");
        }

        // If auto stats not enabled, show setup message
        if (!autoStatsEnabled) {
          context.logInfo(
            "💡 Auto Stats will be enabled when you first visit a page that requires credentials"
          );
        }
      }

      appState.initialized = true;
      context.logSuccess("🎉 Main application initialized successfully!");
    } catch (error) {
      context.logError("Error in main application", error);
    }
  }

  // ============= APPLICATION CONTROL =============

  // Stop application
  function stopApplication() {
    try {
      appState.initialized = false;

      // Stop page handlers
      if (context.pageHandlers) {
        context.pageHandlers.stop();
      }

      // Stop UI updates
      if (context.ui) {
        context.ui.stopUpdates();
      }

      // Stop stats auto-save
      if (context.stats) {
        context.stats.stopAutoSave();
      }

      // Stop reCAPTCHA solver
      if (context.recaptchaSolver) {
        context.recaptchaSolver.stop();
      }

      context.logInfo("🛑 Application stopped");
    } catch (error) {
      context.logError("Error stopping application", error);
    }
  }

  // Restart application
  function restartApplication() {
    try {
      context.logInfo("🔄 Restarting application...");
      stopApplication();
      setTimeout(() => {
        main();
      }, 1000);
    } catch (error) {
      context.logError("Error restarting application", error);
    }
  }

  // ============= HEALTH CHECK =============

  // Application health check
  function healthCheck() {
    const health = {
      initialized: appState.initialized,
      modulesLoaded: Object.keys(context.state.modulesLoaded).length,
      autoStatsEnabled: context.state.autoStatsEnabled,
      currentPage: appState.currentPage,
      errors: [],
      warnings: [],
    };

    // Check required modules
    const requiredModules = [
      "shared-utils",
      "logging-system",
      "credentials-manager",
      "recaptcha-solver",
      "stats-system",
      "ui-manager",
      "page-handlers",
    ];
    const missingModules = requiredModules.filter(
      module => !context.state.modulesLoaded[module]
    );

    if (missingModules.length > 0) {
      health.errors.push(`Missing modules: ${missingModules.join(", ")}`);
    }

    // Check UI state
    if (
      context.state.autoStatsEnabled &&
      context.ui &&
      !context.ui.getState().counterCreated
    ) {
      health.warnings.push("Auto stats enabled but UI not created");
    }

    // Check credentials
    if (context.state.autoStatsEnabled && context.credentials) {
      const creds = context.credentials.load();
      if (!creds) {
        health.warnings.push("Auto stats enabled but no credentials found");
      }
    }

    return health;
  }

  // ============= EXPORT TO SHARED CONTEXT =============

  // Add main app functions to context
  context.mainApp = {
    main: main,
    stop: stopApplication,
    restart: restartApplication,
    healthCheck: healthCheck,
    getState: () => ({ ...appState }),
    initCaptchaSolver: initCaptchaSolver,
    setupReloadListener: setupReloadListener,
    initErrorDetection: initErrorPageDetection,
  };

  // Export main function to global scope
  window.initializeAteexApp = main;

  // Add to global scope for backward compatibility
  Object.assign(window, {
    main,
    initCaptchaSolver,
    setupReloadListener,
    initErrorPageDetection,
  });

  // Mark module as loaded
  context.state.modulesLoaded["main-app"] = true;
  context.modules["main-app"] = context.mainApp;

  context.log("Main Application Module loaded successfully!", "SUCCESS");
})();
