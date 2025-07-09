// ==UserScript==
// @name         Ateex Cloud Auto Script - Modular
// @namespace    http://tampermonkey.net/
// @version      3.1.2
// @description  Modular auto script for Ateex Cloud with dynamic module loading
// @author       phmyhu_1710
// @match        https://dash.ateex.cloud/*
// @match        *://*/recaptcha/*
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @connect      raw.githubusercontent.com
// @connect      github.com
// @connect      ipv4.webshare.io
// @connect      httpbin.org
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-ready
// ==/UserScript==

(function () {
  "use strict";

  // Prevent multiple instances
  if (window.ateexModularRunning) {
    console.log("[Ateex Modular] Script already running, skipping...");
    return;
  }
  window.ateexModularRunning = true;

  // ============= MODULE LOADER CONFIGURATION =============
  const SOURCE_URLS = [
    "https://raw.githubusercontent.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/modules/",
    "https://cdn.jsdelivr.net/gh/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver@main/modules/",
    "https://gitcdn.xyz/repo/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/modules/",
  ];
  const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days (extended)
  const CACHE_PREFIX = "ateex_module_";
  const VERSION = "3.1.2";

  // Module definitions with dependencies
  const MODULES = {
    core: {
      url: "core.module.js",
      dependencies: [],
      required: true,
    },
    credentials: {
      url: "credentials.module.js",
      dependencies: ["core"],
      required: true,
    },
    data: {
      url: "data.module.js",
      dependencies: ["core"],
      required: true,
    },
    proxy: {
      url: "proxy.module.js",
      dependencies: ["core"],
      required: true,
    },
    ui: {
      url: "ui.module.js",
      dependencies: ["core", "data"],
      required: true,
    },
    recaptcha: {
      url: "recaptcha.module.js",
      dependencies: ["core", "data", "proxy"],
      required: true,
    },
    workflow: {
      url: "workflow.module.js",
      dependencies: ["core", "credentials", "data", "ui", "recaptcha"],
      required: true,
    },
  };

  // Global module storage
  window.AteexModules = window.AteexModules || {};

  // ============= MODULE LOADER SYSTEM =============
  class ModuleLoader {
    constructor() {
      this.loadedModules = new Set();
      this.loadingPromises = new Map();
      this.retryCount = new Map();
      this.maxRetries = 3;
    }

    // Get cached module
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

        console.log(`[Module Loader] Using cached module: ${moduleName}`);
        return data.code;
      } catch (e) {
        console.error(`[Module Loader] Cache error for ${moduleName}:`, e);
        return null;
      }
    }

    // Save module to cache
    cacheModule(moduleName, code) {
      try {
        const cacheKey = CACHE_PREFIX + moduleName;
        const data = {
          code: code,
          timestamp: Date.now(),
          version: VERSION,
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
        console.log(`[Module Loader] Cached module: ${moduleName}`);
      } catch (e) {
        console.error(`[Module Loader] Failed to cache ${moduleName}:`, e);
      }
    }

    // Fetch module with fallback sources
    async fetchModule(moduleName) {
      const moduleConfig = MODULES[moduleName];
      if (!moduleConfig) {
        throw new Error(`Unknown module: ${moduleName}`);
      }

      let lastError = null;

      // Try each source URL until one succeeds
      for (let i = 0; i < SOURCE_URLS.length; i++) {
        const baseUrl = SOURCE_URLS[i];
        const url = baseUrl + moduleConfig.url;

        console.log(
          `[Module Loader] Attempting source ${i + 1}/${
            SOURCE_URLS.length
          }: ${url}`
        );

        try {
          const code = await this._fetchFromUrl(url);
          console.log(
            `[Module Loader] Successfully fetched from source ${i + 1}`
          );
          return code;
        } catch (error) {
          lastError = error;
          console.warn(
            `[Module Loader] Source ${i + 1} failed:`,
            error.message
          );

          // If not the last source, continue to next
          if (i < SOURCE_URLS.length - 1) {
            console.log(`[Module Loader] Trying next source...`);
            continue;
          }
        }
      }

      // All sources failed
      throw new Error(
        `Failed to fetch module ${moduleName} from all sources. Last error: ${lastError?.message}`
      );
    }

    // Helper method to fetch from a single URL
    async _fetchFromUrl(url) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          timeout: 15000, // Reduced timeout for faster fallback
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

    // Execute module code
    executeModule(moduleName, code) {
      try {
        console.log(`[Module Loader] Executing module: ${moduleName}`);

        // Create module context
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
          code + "\n//# sourceURL=ateex-module-" + moduleName + ".js"
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
          sessionStorage
        );

        // Store module exports
        window.AteexModules[moduleName] = moduleContext.exports;
        console.log(
          `[Module Loader] Module loaded successfully: ${moduleName}`
        );

        return moduleContext.exports;
      } catch (e) {
        console.error(
          `[Module Loader] Failed to execute module ${moduleName}:`,
          e
        );
        throw e;
      }
    }

    // Load a single module
    async loadModule(moduleName) {
      // Check if already loaded
      if (this.loadedModules.has(moduleName)) {
        return window.AteexModules[moduleName];
      }

      // Check if already loading
      if (this.loadingPromises.has(moduleName)) {
        return this.loadingPromises.get(moduleName);
      }

      // Create loading promise
      const loadingPromise = this._loadModuleInternal(moduleName);
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

    // Internal module loading logic
    async _loadModuleInternal(moduleName) {
      const moduleConfig = MODULES[moduleName];
      if (!moduleConfig) {
        throw new Error(`Unknown module: ${moduleName}`);
      }

      // Load dependencies first
      for (const dep of moduleConfig.dependencies) {
        await this.loadModule(dep);
      }

      // Try to get from cache first
      let code = this.getCachedModule(moduleName);

      // If not cached or cache failed, fetch from GitHub
      if (!code) {
        const retries = this.retryCount.get(moduleName) || 0;

        try {
          code = await this.fetchModule(moduleName);
          this.cacheModule(moduleName, code);
          this.retryCount.delete(moduleName);
        } catch (e) {
          console.error(`[Module Loader] Failed to fetch ${moduleName}:`, e);

          if (retries < this.maxRetries) {
            this.retryCount.set(moduleName, retries + 1);
            console.log(
              `[Module Loader] Retrying ${moduleName} (${retries + 1}/${
                this.maxRetries
              })...`
            );
            await new Promise(resolve =>
              setTimeout(resolve, 2000 * (retries + 1))
            );
            return this._loadModuleInternal(moduleName);
          }

          throw new Error(
            `Failed to load module ${moduleName} after ${this.maxRetries} attempts`
          );
        }
      }

      // Execute module
      return this.executeModule(moduleName, code);
    }

    // Load all required modules
    async loadAllModules() {
      const requiredModules = Object.entries(MODULES)
        .filter(([_, config]) => config.required)
        .map(([name, _]) => name);

      console.log("[Module Loader] Loading required modules:", requiredModules);

      for (const moduleName of requiredModules) {
        try {
          await this.loadModule(moduleName);
        } catch (e) {
          console.error(
            `[Module Loader] Failed to load required module ${moduleName}:`,
            e
          );
          throw e;
        }
      }

      console.log("[Module Loader] All modules loaded successfully");
    }

    // Clear module cache
    clearCache() {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log("[Module Loader] Module cache cleared");
    }
  }

  // ============= INITIALIZATION =============
  async function initialize() {
    console.log("[Ateex Modular] Starting modular script v" + VERSION);

    const loader = new ModuleLoader();
    window.AteexModuleLoader = loader;

    try {
      // Load all modules
      await loader.loadAllModules();

      // Initialize core system
      if (window.AteexModules.core && window.AteexModules.core.initialize) {
        await window.AteexModules.core.initialize();
      }

      // Start main workflow
      if (window.AteexModules.workflow && window.AteexModules.workflow.start) {
        await window.AteexModules.workflow.start();
      }

      console.log("[Ateex Modular] Initialization completed successfully");
    } catch (e) {
      console.error("[Ateex Modular] Initialization failed:", e);

      // Fallback: try to load from backup or show error
      showErrorUI(
        "Failed to load modules. Please check your internet connection and refresh the page."
      );
    }
  }

  // Show error UI
  function showErrorUI(message) {
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 99999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
    errorDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">⚠️ Ateex Modular Error</div>
            <div>${message}</div>
            <button onclick="location.reload()" style="
                margin-top: 10px;
                padding: 5px 10px;
                border: none;
                border-radius: 3px;
                background: white;
                color: #f44336;
                cursor: pointer;
            ">Reload Page</button>
        `;
    document.body.appendChild(errorDiv);
  }

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
