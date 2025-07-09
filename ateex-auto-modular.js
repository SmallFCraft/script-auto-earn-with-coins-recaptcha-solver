// ==UserScript==
// @name         Ateex Cloud Auto Script v3.1.2 - Modular Edition
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Modular auto script for Ateex Cloud with GitHub-based module loading
// @author       phmyhu_1710
// @match        https://dash.ateex.cloud/*
// @match        *://*/recaptcha/*
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @connect      raw.githubusercontent.com
// @connect      github.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-ready
// ==/UserScript==

(function () {
  "use strict";

  // ============= GLOBAL CONSTANTS =============
  const SCRIPT_VERSION = "3.0.0";
  const GITHUB_BASE_URL =
    "https://raw.githubusercontent.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/modules";
  const MODULE_CACHE_PREFIX = "ateex_module_";
  const MODULE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // Prevent multiple instances
  if (window.ateexAutoRunning) {
    console.log("[Ateex Auto v3.1.2] Script already running, skipping...");
    return;
  }
  window.ateexAutoRunning = true;

  // ============= GLOBAL STATE INITIALIZATION =============
  if (!window.ateexGlobalState) {
    window.ateexGlobalState = {
      // Core state
      version: SCRIPT_VERSION,
      modulesLoaded: {},
      moduleLoadPromises: {},

      // Legacy compatibility
      captchaSolved: false,
      captchaInProgress: false,
      lastSolvedTime: 0,
      lastAutomatedQueriesTime: 0,
      totalCycles: 0,
      totalCoins: 0,
      startTime: Date.now(),
      lastCycleTime: 0,
      credentialsReady: false,
      autoStatsEnabled: false,
      setupCompleted: false,
      autoStatsStartTime: null,
    };
  }

  // ============= MODULE LOADING SYSTEM =============

  /**
   * Module configuration with dependencies
   */
  const MODULE_CONFIG = {
    utils: {
      file: "utils.js",
      dependencies: [],
      description: "Core utilities and logging system",
    },
    credentials: {
      file: "credentials.js",
      dependencies: ["utils"],
      description: "Secure credentials management",
    },
    data: {
      file: "data-management.js",
      dependencies: ["utils"],
      description: "Stats and data management",
    },
    ui: {
      file: "ui-management.js",
      dependencies: ["utils", "data"],
      description: "UI components and management",
    },
    recaptcha: {
      file: "recaptcha-solver.js",
      dependencies: ["utils", "credentials"],
      description: "reCAPTCHA solver with AI",
    },
    autoEarn: {
      file: "auto-earning.js",
      dependencies: ["utils", "credentials", "data", "ui", "recaptcha"],
      description: "Auto-earning logic and page handlers",
    },
  };

  /**
   * Enhanced logging system
   */
  function log(message, level = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[Ateex Auto v${SCRIPT_VERSION}]`;

    switch (level) {
      case "ERROR":
        console.error(`${prefix} [${timestamp}] ❌ ${message}`);
        break;
      case "WARN":
        console.warn(`${prefix} [${timestamp}] ⚠️ ${message}`);
        break;
      case "SUCCESS":
        console.log(`${prefix} [${timestamp}] ✅ ${message}`);
        break;
      case "DEBUG":
        console.log(`${prefix} [${timestamp}] 🔍 ${message}`);
        break;
      default:
        console.log(`${prefix} [${timestamp}] ℹ️ ${message}`);
    }
  }

  /**
   * Get cached module or fetch from GitHub
   */
  async function loadModule(moduleName) {
    if (window.ateexGlobalState.modulesLoaded[moduleName]) {
      return window.ateexGlobalState.modulesLoaded[moduleName];
    }

    // Check if already loading
    if (window.ateexGlobalState.moduleLoadPromises[moduleName]) {
      return window.ateexGlobalState.moduleLoadPromises[moduleName];
    }

    const config = MODULE_CONFIG[moduleName];
    if (!config) {
      throw new Error(`Unknown module: ${moduleName}`);
    }

    log(`Loading module: ${moduleName} - ${config.description}`, "DEBUG");

    // Create loading promise
    const loadPromise = (async () => {
      try {
        // Load dependencies first
        for (const dep of config.dependencies) {
          await loadModule(dep);
        }

        // Check cache first
        const cacheKey = MODULE_CACHE_PREFIX + moduleName;
        const cached = GM_getValue(cacheKey);

        if (cached) {
          const cacheData = JSON.parse(cached);
          const now = Date.now();

          if (now - cacheData.timestamp < MODULE_CACHE_DURATION) {
            log(`Using cached module: ${moduleName}`, "DEBUG");
            const moduleExports = executeModule(cacheData.code, moduleName);
            window.ateexGlobalState.modulesLoaded[moduleName] = moduleExports;
            return moduleExports;
          }
        }

        // Fetch from GitHub
        const url = `${GITHUB_BASE_URL}/${config.file}`;
        log(`Fetching module from: ${url}`, "DEBUG");

        const code = await fetchModuleCode(url);

        // Cache the module
        GM_setValue(
          cacheKey,
          JSON.stringify({
            code: code,
            timestamp: Date.now(),
            version: SCRIPT_VERSION,
          })
        );

        // Execute module
        const moduleExports = executeModule(code, moduleName);
        window.ateexGlobalState.modulesLoaded[moduleName] = moduleExports;

        log(`Successfully loaded module: ${moduleName}`, "SUCCESS");
        return moduleExports;
      } catch (error) {
        log(`Failed to load module ${moduleName}: ${error.message}`, "ERROR");

        // Try to use cached version as fallback
        const cacheKey = MODULE_CACHE_PREFIX + moduleName;
        const cached = GM_getValue(cacheKey);

        if (cached) {
          log(`Using stale cache as fallback for: ${moduleName}`, "WARN");
          const cacheData = JSON.parse(cached);
          const moduleExports = executeModule(cacheData.code, moduleName);
          window.ateexGlobalState.modulesLoaded[moduleName] = moduleExports;
          return moduleExports;
        }

        throw error;
      }
    })();

    window.ateexGlobalState.moduleLoadPromises[moduleName] = loadPromise;
    return loadPromise;
  }

  /**
   * Fetch module code from URL
   */
  function fetchModuleCode(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        timeout: 30000,
        onload: function (response) {
          if (response.status === 200) {
            resolve(response.responseText);
          } else {
            reject(
              new Error(`HTTP ${response.status}: ${response.statusText}`)
            );
          }
        },
        onerror: function (error) {
          reject(
            new Error(`Network error: ${error.message || "Unknown error"}`)
          );
        },
        ontimeout: function () {
          reject(new Error("Request timeout"));
        },
      });
    });
  }

  /**
   * Execute module code in isolated scope
   */
  function executeModule(code, moduleName) {
    try {
      // Create module context
      const moduleContext = {
        window: window,
        document: document,
        console: console,
        GM_xmlhttpRequest: GM_xmlhttpRequest,
        GM_setValue: GM_setValue,
        GM_getValue: GM_getValue,
        GM_deleteValue: GM_deleteValue,
        ateexGlobalState: window.ateexGlobalState,
        log: log,
        loadModule: loadModule,
        MODULE_NAME: moduleName,
      };

      // Execute module code
      const moduleFunction = new Function(
        ...Object.keys(moduleContext),
        `
        const exports = {};
        const module = { exports: exports };
        
        ${code}
        
        return module.exports || exports;
        `
      );

      const moduleExports = moduleFunction(...Object.values(moduleContext));
      log(`Module ${moduleName} executed successfully`, "DEBUG");

      return moduleExports;
    } catch (error) {
      log(`Error executing module ${moduleName}: ${error.message}`, "ERROR");
      throw error;
    }
  }

  /**
   * Initialize the application
   */
  async function initializeApp() {
    try {
      log("🚀 Initializing Ateex Auto v3.1.2 - Modular Edition", "SUCCESS");

      // Load core modules first
      log("Loading core modules...", "INFO");

      const utils = await loadModule("utils");
      const credentials = await loadModule("credentials");
      const data = await loadModule("data");
      const ui = await loadModule("ui");

      log("Core modules loaded successfully", "SUCCESS");

      // Initialize based on current page
      const currentUrl = window.location.href;
      const currentPath = window.location.pathname;

      // Handle reCAPTCHA iframe separately
      if (currentUrl.includes("recaptcha")) {
        log("Detected reCAPTCHA iframe, loading solver...", "INFO");
        const recaptcha = await loadModule("recaptcha");
        if (recaptcha && recaptcha.initCaptchaSolver) {
          recaptcha.initCaptchaSolver();
        }
        return;
      }

      // Load auto-earning module for main pages
      if (window.top === window.self) {
        log("Loading auto-earning module...", "INFO");
        const autoEarn = await loadModule("autoEarn");

        if (autoEarn && autoEarn.initialize) {
          await autoEarn.initialize();
        }

        log("🎉 Ateex Auto v3.1.2 initialized successfully!", "SUCCESS");
      }
    } catch (error) {
      log(`Failed to initialize application: ${error.message}`, "ERROR");

      // Fallback to legacy mode if available
      if (window.ateexLegacyMode) {
        log("Attempting to fallback to legacy mode...", "WARN");
        // Could implement legacy fallback here
      }
    }
  }

  /**
   * Clear module cache (for development/debugging)
   */
  window.ateexClearModuleCache = function () {
    Object.keys(MODULE_CONFIG).forEach(moduleName => {
      const cacheKey = MODULE_CACHE_PREFIX + moduleName;
      GM_deleteValue(cacheKey);
    });
    log("Module cache cleared", "INFO");
  };

  /**
   * Clear spam logs and reset spam tracker
   */
  window.ateexClearSpamLogs = function () {
    // Clear console
    console.clear();

    // Reset spam tracker if utils module is loaded
    if (window.ateexGlobalState.modulesLoaded.utils) {
      const utils = window.ateexGlobalState.modulesLoaded.utils;
      if (utils.logSpamTracker) {
        utils.logSpamTracker.clear();
        log("Spam log tracker cleared", "INFO");
      }
    }

    log("Console and spam logs cleared", "SUCCESS");
  };

  /**
   * Get module loading status
   */
  window.ateexGetModuleStatus = function () {
    const status = {};
    Object.keys(MODULE_CONFIG).forEach(moduleName => {
      status[moduleName] = {
        loaded: !!window.ateexGlobalState.modulesLoaded[moduleName],
        loading: !!window.ateexGlobalState.moduleLoadPromises[moduleName],
        config: MODULE_CONFIG[moduleName],
      };
    });
    return status;
  };

  // ============= STARTUP =============

  // Start the application
  initializeApp().catch(error => {
    log(`Critical error during startup: ${error.message}`, "ERROR");
  });
})();
