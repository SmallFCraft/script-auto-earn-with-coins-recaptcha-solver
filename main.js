// ==UserScript==
// @name         Ateex Cloud Auto Script - Hierarchical Modular System
// @namespace    http://tampermonkey.net/
// @version      4.0.0
// @description  Advanced modular auto script for Ateex Cloud with hierarchical module architecture
// @author       SmallFCraft
// @match        https://dash.ateex.cloud/*
// @match        *://*/recaptcha/*
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @connect      raw.githubusercontent.com
// @connect      github.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-ready
// ==/UserScript==

(function () {
  "use strict";

  // ============= CONTEXT DETECTION =============

  // Detect if we're in an iframe/recaptcha context
  const isIframe = window.self !== window.top;
  const isRecaptchaContext = window.location.href.includes("recaptcha");
  const isMainPage =
    window.location.hostname.includes("ateex.cloud") ||
    window.location.hostname.includes("dash.ateex");

  // Handle reCAPTCHA iframe context separately
  if (isRecaptchaContext && isIframe) {
    console.log(
      "[Ateex Modular] 🔍 Detected reCAPTCHA iframe context - initializing reCAPTCHA handler only"
    );

    // Simple reCAPTCHA iframe handler - no error UI, no full module loading
    function initializeRecaptchaHandler() {
      try {
        // Listen for parent messages
        window.addEventListener("message", function (event) {
          if (event.data && event.data.type === "ateex_credentials_ready") {
            console.log("[reCAPTCHA] 📨 Credentials ready message received");
          }
        });

        // Basic audio captcha solving logic would go here
        console.log("[reCAPTCHA] 🎯 reCAPTCHA handler initialized");
      } catch (e) {
        // Only log errors, don't show UI in iframe
        console.error("[reCAPTCHA] ❌ Handler error:", e.message);
      }
    }

    // Initialize the reCAPTCHA handler
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeRecaptchaHandler);
    } else {
      initializeRecaptchaHandler();
    }

    return; // Exit early for reCAPTCHA context
  }

  // Prevent multiple instances
  if (window.ateexModularRunning) {
    console.log("[Ateex Modular] Script already running, skipping...");
    return;
  }
  window.ateexModularRunning = true;

  // ============= HIERARCHICAL MODULE LOADER CONFIGURATION =============

  const SOURCE_URLS = [
    "https://raw.githubusercontent.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/",
    "https://cdn.jsdelivr.net/gh/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver@main/",
    "https://gitcdn.xyz/repo/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/",
  ];

  const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  const CACHE_PREFIX = "ateex_module_";
  const VERSION = "4.0.0";

  // Bootstrap modules (loaded first to get configuration)
  const BOOTSTRAP_MODULES = {
    constants: {
      url: "config/constants.js",
      dependencies: [],
      required: true,
      category: "config",
    },
    dependencies: {
      url: "config/dependencies.js",
      dependencies: ["constants"],
      required: true,
      category: "config",
    },
  };

  // Will be populated from dependencies.js
  let MODULES = {};
  let CONFIG_LOADED = false;

  // Global module storage
  window.AteexModules = window.AteexModules || {};

  // ============= ENHANCED MODULE LOADER SYSTEM =============

  class HierarchicalModuleLoader {
    constructor() {
      this.loadedModules = new Set();
      this.loadingPromises = new Map();
      this.retryCount = new Map();
      this.maxRetries = 3;
      this.loadOrder = [];
      this.dependencyGraph = new Map();
    }

    // ============= CACHE MANAGEMENT =============

    getCachedModule(moduleName) {
      try {
        const cacheKey = CACHE_PREFIX + moduleName;
        const cached = localStorage.getItem(cacheKey);

        if (!cached) return null;

        const data = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is expired
        if (now - data.timestamp > CACHE_DURATION) {
          localStorage.removeItem(cacheKey);
          return null;
        }

        console.log(`[Module Loader] 📦 Using cached module: ${moduleName}`);
        return data.code;
      } catch (e) {
        console.error(`[Module Loader] ❌ Cache error for ${moduleName}:`, e);
        return null;
      }
    }

    cacheModule(moduleName, code) {
      try {
        const cacheKey = CACHE_PREFIX + moduleName;
        const data = {
          code: code,
          timestamp: Date.now(),
          version: VERSION,
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
        console.log(`[Module Loader] 💾 Cached module: ${moduleName}`);
      } catch (e) {
        console.error(`[Module Loader] ❌ Failed to cache ${moduleName}:`, e);
      }
    }

    // ============= NETWORK FETCHING =============

    async fetchModule(moduleName, moduleConfig) {
      if (!moduleConfig) {
        throw new Error(`Unknown module: ${moduleName}`);
      }

      let lastError = null;

      // Try each source URL until one succeeds
      for (let i = 0; i < SOURCE_URLS.length; i++) {
        const baseUrl = SOURCE_URLS[i];
        const url = baseUrl + moduleConfig.url;

        console.log(
          `[Module Loader] 🌐 Attempting source ${i + 1}/${
            SOURCE_URLS.length
          }: ${url}`
        );

        try {
          const code = await this._fetchFromUrl(url);
          console.log(
            `[Module Loader] ✅ Successfully fetched from source ${i + 1}`
          );
          return code;
        } catch (error) {
          lastError = error;
          console.warn(
            `[Module Loader] ⚠️ Source ${i + 1} failed:`,
            error.message
          );

          // If not the last source, continue to next
          if (i < SOURCE_URLS.length - 1) {
            console.log(`[Module Loader] 🔄 Trying next source...`);
            continue;
          }
        }
      }

      // All sources failed
      throw new Error(
        `Failed to fetch module ${moduleName} from all sources. Last error: ${lastError?.message}`
      );
    }

    async _fetchFromUrl(url) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          timeout: 15000,
          onload: response => {
            if (response.status === 200) {
              resolve(response.responseText);
            } else {
              reject(
                new Error(`HTTP ${response.status}: ${response.statusText}`)
              );
            }
          },
          onerror: error => {
            reject(new Error(`Network error: ${error}`));
          },
          ontimeout: () => {
            reject(new Error("Request timeout"));
          },
        });
      });
    }

    // ============= MODULE EXECUTION =============

    executeModule(moduleName, code) {
      try {
        console.log(`[Module Loader] ⚡ Executing module: ${moduleName}`);

        // Create enhanced module context
        const moduleContext = {
          exports: {},
          AteexModules: window.AteexModules,
          GM_xmlhttpRequest: GM_xmlhttpRequest,
          GM_getValue: GM_getValue,
          GM_setValue: GM_setValue,
          window: window,
          document: document,
          console: console,
          localStorage: localStorage,
          sessionStorage: sessionStorage,
          // Add module metadata
          __moduleName: moduleName,
          __moduleVersion: VERSION,
        };

        // Execute module code in context
        const moduleFunction = new Function(
          "module",
          "exports",
          "AteexModules",
          "GM_xmlhttpRequest",
          "GM_getValue",
          "GM_setValue",
          "window",
          "document",
          "console",
          "localStorage",
          "sessionStorage",
          "__moduleName",
          "__moduleVersion",
          code + `\n//# sourceURL=ateex-module-${moduleName}.js`
        );

        moduleFunction.call(
          moduleContext,
          moduleContext,
          moduleContext.exports,
          window.AteexModules,
          GM_xmlhttpRequest,
          GM_getValue,
          GM_setValue,
          window,
          document,
          console,
          localStorage,
          sessionStorage,
          moduleName,
          VERSION
        );

        // Store module exports
        window.AteexModules[moduleName] = moduleContext.exports;
        console.log(
          `[Module Loader] ✅ Module executed successfully: ${moduleName}`
        );

        return moduleContext.exports;
      } catch (e) {
        console.error(
          `[Module Loader] ❌ Failed to execute module ${moduleName}:`,
          e
        );
        throw e;
      }
    }

    // ============= DEPENDENCY MANAGEMENT =============

    buildDependencyGraph(modules) {
      this.dependencyGraph.clear();

      Object.entries(modules).forEach(([name, config]) => {
        this.dependencyGraph.set(name, {
          dependencies: config.dependencies || [],
          category: config.category || "other",
          required: config.required || false,
        });
      });
    }

    calculateLoadOrder(modules) {
      const visited = new Set();
      const loadOrder = [];

      const visit = moduleName => {
        if (visited.has(moduleName)) {
          return;
        }

        const module = modules[moduleName];
        if (!module) {
          throw new Error(`Module not found: ${moduleName}`);
        }

        // Visit dependencies first
        module.dependencies.forEach(dep => {
          visit(dep);
        });

        visited.add(moduleName);
        loadOrder.push(moduleName);
      };

      // Visit all modules
      Object.keys(modules).forEach(moduleName => {
        visit(moduleName);
      });

      this.loadOrder = loadOrder;
      return loadOrder;
    }

    validateDependencies(modules) {
      const errors = [];

      // Check for circular dependencies
      const checkCircular = (moduleName, visited = new Set(), path = []) => {
        if (visited.has(moduleName)) {
          if (path.includes(moduleName)) {
            errors.push(
              `Circular dependency detected: ${path.join(
                " -> "
              )} -> ${moduleName}`
            );
          }
          return;
        }

        visited.add(moduleName);
        path.push(moduleName);

        const module = modules[moduleName];
        if (module && module.dependencies) {
          module.dependencies.forEach(dep => {
            checkCircular(dep, visited, [...path]);
          });
        }

        path.pop();
      };

      // Check all modules for circular dependencies
      Object.keys(modules).forEach(moduleName => {
        checkCircular(moduleName);
      });

      // Check for missing dependencies
      Object.entries(modules).forEach(([moduleName, module]) => {
        module.dependencies.forEach(dep => {
          if (!modules[dep]) {
            errors.push(
              `Module '${moduleName}' depends on missing module '${dep}'`
            );
          }
        });
      });

      return errors;
    }

    // ============= BOOTSTRAP LOADING =============

    async loadBootstrapModules() {
      console.log("[Module Loader] 🚀 Loading bootstrap modules...");

      for (const [moduleName, config] of Object.entries(BOOTSTRAP_MODULES)) {
        try {
          await this.loadSingleModule(moduleName, config);
        } catch (e) {
          console.error(
            `[Module Loader] ❌ Failed to load bootstrap module ${moduleName}:`,
            e
          );
          throw e;
        }
      }

      // Now we should have access to constants and dependencies
      if (window.AteexModules.constants) {
        console.log("[Module Loader] ✅ Constants loaded");
      }

      if (window.AteexModules.dependencies) {
        console.log("[Module Loader] ✅ Dependencies configuration loaded");
        MODULES = window.AteexModules.dependencies.MODULES;
        CONFIG_LOADED = true;

        // Build dependency graph and calculate load order
        this.buildDependencyGraph(MODULES);
        this.calculateLoadOrder(MODULES);

        // Validate dependencies
        const errors = this.validateDependencies(MODULES);
        if (errors.length > 0) {
          console.error(
            "[Module Loader] ❌ Dependency validation errors:",
            errors
          );
          throw new Error(`Dependency validation failed: ${errors.join(", ")}`);
        }

        console.log("[Module Loader] ✅ Dependency graph validated");
        console.log("[Module Loader] 📋 Load order:", this.loadOrder);
      }
    }

    // ============= SINGLE MODULE LOADING =============

    async loadSingleModule(moduleName, moduleConfig) {
      // Check if already loaded
      if (this.loadedModules.has(moduleName)) {
        return window.AteexModules[moduleName];
      }

      // Check if already loading
      if (this.loadingPromises.has(moduleName)) {
        return this.loadingPromises.get(moduleName);
      }

      // Create loading promise
      const loadingPromise = this._loadModuleInternal(moduleName, moduleConfig);
      this.loadingPromises.set(moduleName, loadingPromise);

      try {
        const result = await loadingPromise;
        this.loadedModules.add(moduleName);
        this.loadingPromises.delete(moduleName);
        return result;
      } catch (e) {
        this.loadingPromises.delete(moduleName);
        throw e;
      }
    }

    async _loadModuleInternal(moduleName, moduleConfig) {
      if (!moduleConfig) {
        throw new Error(`Unknown module: ${moduleName}`);
      }

      // Load dependencies first
      for (const dep of moduleConfig.dependencies) {
        const depConfig = MODULES[dep] || BOOTSTRAP_MODULES[dep];
        if (!depConfig) {
          throw new Error(
            `Dependency ${dep} not found for module ${moduleName}`
          );
        }
        await this.loadSingleModule(dep, depConfig);
      }

      // Try to get from cache first
      let code = this.getCachedModule(moduleName);

      // If not cached, fetch from network
      if (!code) {
        const retries = this.retryCount.get(moduleName) || 0;

        try {
          code = await this.fetchModule(moduleName, moduleConfig);
          this.cacheModule(moduleName, code);
          this.retryCount.delete(moduleName);
        } catch (e) {
          console.error(`[Module Loader] ❌ Failed to fetch ${moduleName}:`, e);

          if (retries < this.maxRetries) {
            this.retryCount.set(moduleName, retries + 1);
            console.log(
              `[Module Loader] 🔄 Retrying ${moduleName} (${retries + 1}/${
                this.maxRetries
              })...`
            );
            await new Promise(resolve =>
              setTimeout(resolve, 2000 * (retries + 1))
            );
            return this._loadModuleInternal(moduleName, moduleConfig);
          }

          throw new Error(
            `Failed to load module ${moduleName} after ${this.maxRetries} attempts`
          );
        }
      }

      // Execute module
      return this.executeModule(moduleName, code);
    }

    // ============= MAIN LOADING ORCHESTRATION =============

    async loadAllModules() {
      if (!CONFIG_LOADED) {
        throw new Error(
          "Configuration not loaded. Bootstrap modules must be loaded first."
        );
      }

      const requiredModules = Object.entries(MODULES)
        .filter(([_, config]) => config.required)
        .map(([name, _]) => name);

      console.log(
        "[Module Loader] 📦 Loading required modules:",
        requiredModules
      );
      console.log("[Module Loader] 📋 Using calculated load order");

      // Load modules in dependency order
      for (const moduleName of this.loadOrder) {
        const moduleConfig = MODULES[moduleName];
        if (moduleConfig && moduleConfig.required) {
          try {
            console.log(
              `[Module Loader] 🔄 Loading ${moduleName} (${moduleConfig.category})...`
            );
            await this.loadSingleModule(moduleName, moduleConfig);
          } catch (e) {
            console.error(
              `[Module Loader] ❌ Failed to load required module ${moduleName}:`,
              e
            );
            throw e;
          }
        }
      }

      console.log(
        "[Module Loader] ✅ All required modules loaded successfully"
      );
    }

    // ============= UTILITY METHODS =============

    clearCache() {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log("[Module Loader] 🧹 Module cache cleared");
    }

    getLoadedModules() {
      return Array.from(this.loadedModules);
    }

    getModuleInfo() {
      return {
        loaded: this.getLoadedModules(),
        loadOrder: this.loadOrder,
        dependencyGraph: Object.fromEntries(this.dependencyGraph),
        configLoaded: CONFIG_LOADED,
      };
    }
  }

  // ============= INITIALIZATION =============

  async function initialize() {
    console.log(
      "[Ateex Modular] 🚀 Starting hierarchical modular script v" + VERSION
    );

    const loader = new HierarchicalModuleLoader();
    window.AteexModuleLoader = loader;

    try {
      // Step 1: Load bootstrap modules (config)
      await loader.loadBootstrapModules();

      // Step 2: Load all application modules
      await loader.loadAllModules();

      // Step 3: Initialize core system
      if (
        window.AteexModules.coreModule &&
        window.AteexModules.coreModule.initialize
      ) {
        console.log("[Ateex Modular] 🔧 Initializing core system...");
        await window.AteexModules.coreModule.initialize();
      }

      // Step 4: Start main workflow
      if (
        window.AteexModules.workflowModule &&
        window.AteexModules.workflowModule.start
      ) {
        console.log("[Ateex Modular] ▶️ Starting workflow...");
        await window.AteexModules.workflowModule.start();
      }

      console.log("[Ateex Modular] ✅ Initialization completed successfully");

      // Log module info for debugging
      console.log("[Ateex Modular] 📊 Module Info:", loader.getModuleInfo());
    } catch (e) {
      console.error("[Ateex Modular] ❌ Initialization failed:", e);

      // Show error UI
      showErrorUI(
        `Failed to load modules: ${e.message}. Please check your internet connection and refresh the page.`
      );
    }
  }

  // ============= ERROR UI =============

  function showErrorUI(message) {
    // Don't show error UI in iframe/recaptcha contexts
    if (
      window.self !== window.top ||
      window.location.href.includes("recaptcha")
    ) {
      console.error("[Ateex Modular] ❌ Error in iframe context:", message);
      return;
    }

    // Check if error UI already exists to prevent duplicates
    if (document.getElementById("ateex-error-ui")) {
      console.warn(
        "[Ateex Modular] ⚠️ Error UI already exists, skipping duplicate"
      );
      return;
    }

    const errorDiv = document.createElement("div");
    errorDiv.id = "ateex-error-ui";
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #f44336, #d32f2f);
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border-left: 4px solid #fff;
      max-width: 400px;
    `;

    errorDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; display: flex; align-items: center;">
        <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
        Ateex Modular v${VERSION} Error
      </div>
      <div style="margin-bottom: 15px; line-height: 1.4;">${message}</div>
      <div style="display: flex; gap: 10px;">
        <button onclick="location.reload()" style="
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          background: white;
          color: #f44336;
          cursor: pointer;
          font-weight: bold;
          flex: 1;
        ">Reload Page</button>
        <button onclick="window.AteexModuleLoader?.clearCache(); location.reload()" style="
          padding: 8px 16px;
          border: 1px solid white;
          border-radius: 4px;
          background: transparent;
          color: white;
          cursor: pointer;
          flex: 1;
        ">Clear Cache & Reload</button>
      </div>
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 30000);
  }

  // ============= STARTUP =============

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // Add global reference for debugging
  window.AteexModularVersion = VERSION;
})();
