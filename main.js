// ==UserScript==
// @name         Ateex Cloud Auto Script - Modular (Performance Optimized)
// @namespace    http://tampermonkey.net/
// @version      3.2.0
// @description  Optimized auto script for Ateex Cloud with enhanced performance
// @author       phmyhu_1710
// @match        https://dash.ateex.cloud/*
// @match        *://*/recaptcha/*
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @connect      httpbin.org
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-ready
// ==/UserScript==

(function () {
  "use strict";

  // Prevent multiple instances - enhanced check
  if (window.ateexModularRunning) {
    return;
  }
  window.ateexModularRunning = true;

  // ============= PERFORMANCE OPTIMIZED MODULE SYSTEM =============

  // Optimized global module registry
  window.AteexModules = window.AteexModules || {};

  // Module loading state
  const moduleState = {
    loadedModules: new Set(),
    totalModules: 7,
    startTime: Date.now(),
  };

  // Optimized module URLs - reduced redundancy
  const MODULE_BASE_URL =
    "https://raw.githubusercontent.com/phmyhu/auto-ateexcloud/main/modules/";
  const MODULES = [
    { name: "core", file: "core.module.js" },
    { name: "credentials", file: "credentials.module.js" },
    { name: "data", file: "data.module.js" },
    { name: "proxy", file: "proxy.module.js" },
    { name: "recaptcha", file: "recaptcha.module.js" },
    { name: "ui", file: "ui.module.js" },
    { name: "workflow", file: "workflow.module.js" },
  ];

  // Quick dependency mapping for loading order
  const MODULE_DEPS = {
    core: [],
    data: ["core"],
    credentials: ["core"],
    proxy: ["core"],
    ui: ["core", "data"],
    recaptcha: ["core", "data", "proxy"],
    workflow: ["core", "credentials", "data", "ui", "recaptcha", "proxy"],
  };

  // ============= OPTIMIZED MODULE LOADER =============

  function loadModule(moduleInfo) {
    return new Promise((resolve, reject) => {
      // Quick dependency check
      const missingDeps = MODULE_DEPS[moduleInfo.name].filter(
        dep => !moduleState.loadedModules.has(dep)
      );

      if (missingDeps.length > 0) {
        reject(new Error(`Missing dependencies: ${missingDeps.join(", ")}`));
        return;
      }

      const script = document.createElement("script");
      const moduleUrl = MODULE_BASE_URL + moduleInfo.file;

      // Quick module wrapper
      const moduleWrapper = `
        (function() {
          const exports = {};
          ${
            moduleInfo.name === "core"
              ? "window.AteexModules = window.AteexModules || {};"
              : ""
          }
          try {
            // MODULE CODE WILL BE INSERTED HERE
            ${
              moduleInfo.name === "core"
                ? "window.AteexModules.core = exports;"
                : ""
            }
            ${
              moduleInfo.name !== "core"
                ? `window.AteexModules.${moduleInfo.name} = exports;`
                : ""
            }
            console.log("✅ Module loaded: ${moduleInfo.name}");
          } catch (error) {
            console.error("❌ Module error: ${moduleInfo.name}", error);
            throw error;
          }
        })();
      `;

      // Quick error handling
      script.onerror = () =>
        reject(new Error(`Failed to load ${moduleInfo.name}`));

      // Fast loading via GM_xmlhttpRequest
      GM_xmlhttpRequest({
        method: "GET",
        url: moduleUrl,
        timeout: 10000, // Reduced timeout
        onload: function (response) {
          if (response.status === 200) {
            try {
              // Quick code injection
              const fullCode = moduleWrapper.replace(
                "// MODULE CODE WILL BE INSERTED HERE",
                response.responseText
              );

              script.textContent = fullCode;
              document.head.appendChild(script);

              moduleState.loadedModules.add(moduleInfo.name);
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`HTTP ${response.status} for ${moduleInfo.name}`));
          }
        },
        onerror: () =>
          reject(new Error(`Network error loading ${moduleInfo.name}`)),
        ontimeout: () =>
          reject(new Error(`Timeout loading ${moduleInfo.name}`)),
      });
    });
  }

  // ============= OPTIMIZED SEQUENTIAL LOADING =============

  async function loadModulesSequentially() {
    const loadStart = Date.now();

    for (const moduleInfo of MODULES) {
      try {
        await loadModule(moduleInfo);
      } catch (error) {
        console.error(`❌ Failed to load ${moduleInfo.name}:`, error.message);
        return false;
      }
    }

    const loadTime = Date.now() - loadStart;
    console.log(`✅ All modules loaded in ${loadTime}ms`);
    return true;
  }

  // ============= OPTIMIZED INITIALIZATION =============

  async function initializeModules() {
    try {
      // Quick environment check
      if (
        window.location.protocol !== "https:" &&
        !window.location.href.includes("recaptcha")
      ) {
        console.warn("⚠️ Script may not work properly on non-HTTPS pages");
      }

      // Fast module loading
      const loadSuccess = await loadModulesSequentially();
      if (!loadSuccess) {
        console.error("❌ Module loading failed - script stopped");
        return;
      }

      // Quick validation
      const requiredModules = ["core", "workflow"];
      const missingCritical = requiredModules.filter(
        name => !window.AteexModules[name]
      );

      if (missingCritical.length > 0) {
        console.error("❌ Critical modules missing:", missingCritical);
        return;
      }

      // Fast startup
      const initStart = Date.now();
      await window.AteexModules.workflow.start();

      const totalTime = Date.now() - moduleState.startTime;
      console.log(`🚀 Ateex Auto Script started in ${totalTime}ms`);
    } catch (error) {
      console.error("❌ Initialization failed:", error);
    }
  }

  // ============= OPTIMIZED ERROR HANDLING =============

  // Quick global error handler
  window.addEventListener("error", function (event) {
    if (
      event.error &&
      event.error.stack &&
      event.error.stack.includes("AteexModules")
    ) {
      console.error("🚫 Ateex Script Error:", {
        message: event.error.message,
        file: event.filename,
        line: event.lineno,
      });
    }
  });

  // Quick unhandled promise handler
  window.addEventListener("unhandledrejection", function (event) {
    if (
      event.reason &&
      event.reason.stack &&
      event.reason.stack.includes("AteexModules")
    ) {
      console.error("🚫 Ateex Promise Error:", event.reason.message);
      event.preventDefault(); // Prevent console spam
    }
  });

  // ============= OPTIMIZED STARTUP =============

  // Quick DOM ready check
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeModules);
  } else {
    // Quick startup if DOM already ready
    setTimeout(initializeModules, 100);
  }

  // Quick cleanup on page unload
  window.addEventListener("beforeunload", function () {
    window.ateexModularRunning = false;

    // Quick module cleanup
    if (window.AteexModules?.core?.state) {
      try {
        localStorage.setItem(
          "ateex_last_session",
          JSON.stringify({
            timestamp: Date.now(),
            url: window.location.href,
          })
        );
      } catch (e) {
        // Ignore storage errors
      }
    }
  });

  console.log("🚀 Ateex Auto Script (Performance Optimized) initializing...");
})();
