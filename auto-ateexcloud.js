// ==UserScript==
// @name         Ateex Cloud Auto Script - Enhanced Core with Module Loader
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Enhanced core script with dynamic module loading from GitHub
// @author       phmyhu_1710
// @match        https://dash.ateex.cloud/*
// @match        *://*/recaptcha/*
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-ready
// ==/UserScript==

(function () {
  "use strict";

  // Prevent multiple instances
  if (window.ateexAutoRunning) {
    console.log("[Ateex Auto] Script already running, skipping...");
    return;
  }
  window.ateexAutoRunning = true;

  // ============= ENHANCED MODULE LOADER SYSTEM =============

  // Configuration
  const MODULE_CONFIG = {
    baseUrl:
      "https://raw.githubusercontent.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main",
    fallbackUrl:
      "https://cdn.jsdelivr.net/gh/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver@main",
    version: "3.0",
    cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
    retryAttempts: 3,
    retryDelay: 2000,
    loadTimeout: 15000,
    modules: {
      "shared-utils": {
        path: "/modules/shared-utils.js",
        required: true,
        priority: 1,
        description: "Shared constants and utility functions",
      },
      "logging-system": {
        path: "/modules/logging-system.js",
        required: true,
        priority: 2,
        dependencies: ["shared-utils"],
        description: "Enhanced logging and debugging system",
      },
      "credentials-manager": {
        path: "/modules/credentials-manager.js",
        required: true,
        priority: 3,
        dependencies: ["shared-utils", "logging-system"],
        description: "Secure credentials handling",
      },
      "recaptcha-solver": {
        path: "/modules/recaptcha-solver.js",
        required: true,
        priority: 3,
        dependencies: ["shared-utils", "logging-system"],
        description: "reCAPTCHA solving functionality",
      },
      "stats-system": {
        path: "/modules/stats-system.js",
        required: true,
        priority: 4,
        dependencies: ["shared-utils", "logging-system"],
        description: "Statistics and history management",
      },
      "ui-manager": {
        path: "/modules/ui-manager.js",
        required: true,
        priority: 5,
        dependencies: [
          "shared-utils",
          "logging-system",
          "stats-system",
          "credentials-manager",
        ],
        description: "UI management and counter system",
      },
      "page-handlers": {
        path: "/modules/page-handlers.js",
        required: true,
        priority: 6,
        dependencies: [
          "shared-utils",
          "logging-system",
          "credentials-manager",
          "recaptcha-solver",
          "stats-system",
          "ui-manager",
        ],
        description: "Page-specific automation handlers",
      },
      "main-app": {
        path: "/modules/main-app.js",
        required: true,
        priority: 7,
        dependencies: [
          "shared-utils",
          "logging-system",
          "credentials-manager",
          "recaptcha-solver",
          "stats-system",
          "ui-manager",
          "page-handlers",
        ],
        description: "Main application orchestrator",
      },
    },
  };

  // ============= SHARED CONTEXT SYSTEM =============

  // Initialize global state
  if (!window.ateexGlobalState) {
    window.ateexGlobalState = {
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
      modulesLoaded: {},
      moduleLoadPromises: {},
      moduleErrors: {},
      initializationComplete: false,
    };
  }

  // Create shared context for modules
  if (!window.ateexContext) {
    window.ateexContext = {
      // Global state reference
      state: window.ateexGlobalState,

      // Module registry
      modules: {},

      // Event bus for inter-module communication
      events: new EventTarget(),

      // Configuration
      config: MODULE_CONFIG,

      // Shared utilities (will be populated by modules)
      utils: {},

      // Logging functions (basic versions, will be enhanced by logging module)
      log: function (message, level = "INFO") {
        const colors = {
          INFO: "#4CAF50",
          WARNING: "#FF9800",
          ERROR: "#F44336",
          SUCCESS: "#8BC34A",
          DEBUG: "#9E9E9E",
        };
        const icons = {
          INFO: "ℹ️",
          WARNING: "⚠️",
          ERROR: "❌",
          SUCCESS: "✅",
          DEBUG: "🔍",
        };
        console.log(
          `%c[Ateex Auto] ${icons[level] || icons.INFO} ${message}`,
          `color: ${colors[level] || colors.INFO}`
        );
      },

      // Basic sleep function
      sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      },

      // Module communication helpers
      emit: function (eventName, data) {
        this.events.dispatchEvent(new CustomEvent(eventName, { detail: data }));
      },

      on: function (eventName, callback) {
        this.events.addEventListener(eventName, callback);
      },

      off: function (eventName, callback) {
        this.events.removeEventListener(eventName, callback);
      },
    };
  }

  // ============= ENHANCED MODULE LOADER IMPLEMENTATION =============

  class EnhancedModuleLoader {
    constructor(config) {
      this.config = config;
      this.loadedModules = new Map();
      this.loadPromises = new Map();
      this.dependencyGraph = new Map();
      this.loadOrder = [];
      this.context = window.ateexContext;

      // Build dependency graph
      this.buildDependencyGraph();
    }

    // Build dependency graph and determine load order
    buildDependencyGraph() {
      const modules = this.config.modules;
      const visited = new Set();
      const visiting = new Set();
      const sorted = [];

      // Topological sort to resolve dependencies
      const visit = moduleName => {
        if (visiting.has(moduleName)) {
          throw new Error(
            `Circular dependency detected involving ${moduleName}`
          );
        }
        if (visited.has(moduleName)) return;

        visiting.add(moduleName);

        const moduleInfo = modules[moduleName];
        if (moduleInfo && moduleInfo.dependencies) {
          for (const dep of moduleInfo.dependencies) {
            if (!modules[dep]) {
              throw new Error(
                `Module ${moduleName} depends on non-existent module ${dep}`
              );
            }
            visit(dep);
          }
        }

        visiting.delete(moduleName);
        visited.add(moduleName);
        sorted.push(moduleName);
      };

      // Sort by priority first, then by dependencies
      const moduleNames = Object.keys(modules).sort((a, b) => {
        return (modules[a].priority || 999) - (modules[b].priority || 999);
      });

      for (const moduleName of moduleNames) {
        visit(moduleName);
      }

      this.loadOrder = sorted;
      this.context.log(
        `Module load order determined: ${sorted.join(" → ")}`,
        "DEBUG"
      );
    }

    // Get cache key for module
    getCacheKey(moduleName) {
      return `ateex_module_${moduleName}_${this.config.version}`;
    }

    // Get cache expiry key
    getCacheExpiryKey(moduleName) {
      return `ateex_module_${moduleName}_expiry`;
    }

    // Check if module is cached and valid
    isCached(moduleName) {
      try {
        const cacheKey = this.getCacheKey(moduleName);
        const expiryKey = this.getCacheExpiryKey(moduleName);

        const cachedCode = GM_getValue(cacheKey);
        const expiry = GM_getValue(expiryKey);

        if (!cachedCode || !expiry) return false;

        return Date.now() < parseInt(expiry);
      } catch (e) {
        this.context.log(
          `Cache check failed for ${moduleName}: ${e.message}`,
          "WARNING"
        );
        return false;
      }
    }

    // Get cached module
    getCached(moduleName) {
      try {
        const cacheKey = this.getCacheKey(moduleName);
        return GM_getValue(cacheKey);
      } catch (e) {
        this.context.log(
          `Failed to get cached module ${moduleName}: ${e.message}`,
          "ERROR"
        );
        return null;
      }
    }

    // Cache module
    cacheModule(moduleName, code) {
      try {
        const cacheKey = this.getCacheKey(moduleName);
        const expiryKey = this.getCacheExpiryKey(moduleName);
        const expiry = Date.now() + this.config.cacheExpiry;

        GM_setValue(cacheKey, code);
        GM_setValue(expiryKey, expiry.toString());

        this.context.log(`Module ${moduleName} cached successfully`, "DEBUG");
      } catch (e) {
        this.context.log(
          `Failed to cache module ${moduleName}: ${e.message}`,
          "WARNING"
        );
      }
    }

    // Fetch module from URL
    async fetchModule(url) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          timeout: 10000,
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

    // Load single module
    async loadModule(moduleName) {
      // Return existing promise if already loading
      if (this.loadPromises.has(moduleName)) {
        return this.loadPromises.get(moduleName);
      }

      // Return cached module if already loaded
      if (this.loadedModules.has(moduleName)) {
        return this.loadedModules.get(moduleName);
      }

      const moduleInfo = this.config.modules[moduleName];
      if (!moduleInfo) {
        throw new Error(`Module ${moduleName} not found in configuration`);
      }

      const loadPromise = this._loadModuleInternal(moduleName, moduleInfo);
      this.loadPromises.set(moduleName, loadPromise);

      try {
        const result = await loadPromise;
        this.loadedModules.set(moduleName, result);
        return result;
      } finally {
        this.loadPromises.delete(moduleName);
      }
    }

    // Internal module loading logic
    async _loadModuleInternal(moduleName, moduleInfo) {
      this.context.log(
        `Loading module: ${moduleName} - ${moduleInfo.description}`,
        "INFO"
      );

      // Check cache first
      if (this.isCached(moduleName)) {
        const cachedCode = this.getCached(moduleName);
        if (cachedCode) {
          this.context.log(`Using cached module: ${moduleName}`, "DEBUG");
          return this.executeModule(moduleName, cachedCode);
        }
      }

      // Try to fetch from primary URL
      const primaryUrl = this.config.baseUrl + moduleInfo.path;
      const fallbackUrl = this.config.fallbackUrl + moduleInfo.path;

      let code = null;
      let lastError = null;

      // Try primary URL
      try {
        this.context.log(`Fetching ${moduleName} from primary URL...`, "DEBUG");
        code = await this.fetchModule(primaryUrl);
      } catch (error) {
        lastError = error;
        this.context.log(
          `Primary URL failed for ${moduleName}: ${error.message}`,
          "WARNING"
        );
      }

      // Try fallback URL if primary failed
      if (!code) {
        try {
          this.context.log(
            `Fetching ${moduleName} from fallback URL...`,
            "DEBUG"
          );
          code = await this.fetchModule(fallbackUrl);
        } catch (error) {
          lastError = error;
          this.context.log(
            `Fallback URL failed for ${moduleName}: ${error.message}`,
            "ERROR"
          );
        }
      }

      if (!code) {
        throw new Error(
          `Failed to load module ${moduleName}: ${
            lastError?.message || "Unknown error"
          }`
        );
      }

      // Cache the module
      this.cacheModule(moduleName, code);

      // Execute the module
      return this.executeModule(moduleName, code);
    }

    // Execute module code
    executeModule(moduleName, code) {
      try {
        this.context.log(`Executing module: ${moduleName}`, "DEBUG");

        // Create module context
        const moduleContext = {
          window: window,
          document: document,
          console: console,
          GM_xmlhttpRequest: GM_xmlhttpRequest,
          GM_setValue: GM_setValue,
          GM_getValue: GM_getValue,
          ateexGlobalState: window.ateexGlobalState,
          log: this.context.log,
          sleep: this.context.sleep,
          moduleName: moduleName,
        };

        // Execute code in context
        const moduleFunction = new Function(
          "context",
          `
          with(context) {
            ${code}
          }
          `
        );

        const result = moduleFunction(moduleContext);

        this.context.log(
          `Module ${moduleName} executed successfully`,
          "SUCCESS"
        );
        window.ateexGlobalState.modulesLoaded[moduleName] = true;

        return result;
      } catch (error) {
        this.context.log(
          `Failed to execute module ${moduleName}: ${error.message}`,
          "ERROR"
        );
        throw error;
      }
    }

    // Load all required modules
    async loadAllModules() {
      const requiredModules = Object.keys(this.config.modules).filter(
        name => this.config.modules[name].required
      );

      this.context.log(
        `Loading ${requiredModules.length} required modules...`,
        "INFO"
      );

      const loadPromises = requiredModules.map(moduleName =>
        this.loadModule(moduleName).catch(error => {
          this.context.log(
            `Failed to load required module ${moduleName}: ${error.message}`,
            "ERROR"
          );
          return null;
        })
      );

      const results = await Promise.all(loadPromises);

      const failedModules = requiredModules.filter(
        (_, index) => results[index] === null
      );

      if (failedModules.length > 0) {
        throw new Error(
          `Failed to load required modules: ${failedModules.join(", ")}`
        );
      }

      this.context.log("All required modules loaded successfully!", "SUCCESS");
      return results;
    }

    // Clear module cache
    clearCache() {
      try {
        Object.keys(this.config.modules).forEach(moduleName => {
          const cacheKey = this.getCacheKey(moduleName);
          const expiryKey = this.getCacheExpiryKey(moduleName);
          GM_setValue(cacheKey, undefined);
          GM_setValue(expiryKey, undefined);
        });
        this.context.log("Module cache cleared", "INFO");
      } catch (e) {
        this.context.log(`Failed to clear cache: ${e.message}`, "ERROR");
      }
    }
  }

  // ============= INITIALIZATION =============

  async function initialize() {
    try {
      const context = window.ateexContext;
      context.log(
        "Initializing Ateex Auto Script with Module Loader...",
        "INFO"
      );

      // Create module loader
      const moduleLoader = new EnhancedModuleLoader(MODULE_CONFIG);
      window.ateexModuleLoader = moduleLoader;

      // Load all modules
      await moduleLoader.loadAllModules();

      // Initialize the main application
      if (typeof window.initializeAteexApp === "function") {
        await window.initializeAteexApp();
      } else {
        context.log(
          "Main app initializer not found - modules may not have loaded correctly",
          "WARNING"
        );
      }

      context.log("Ateex Auto Script initialized successfully!", "SUCCESS");
    } catch (error) {
      // Use fallback logging if context is not available
      if (window.ateexContext && window.ateexContext.log) {
        window.ateexContext.log(
          `Initialization failed: ${error.message}`,
          "ERROR"
        );
      } else {
        console.error(
          `[Ateex Auto] ❌ Initialization failed: ${error.message}`
        );
      }

      // Show error to user
      if (
        confirm(
          `Failed to load Ateex Auto Script modules.\n\nError: ${error.message}\n\nWould you like to clear the module cache and try again?`
        )
      ) {
        if (window.ateexModuleLoader) {
          window.ateexModuleLoader.clearCache();
        }
        location.reload();
      }
    }
  }

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
