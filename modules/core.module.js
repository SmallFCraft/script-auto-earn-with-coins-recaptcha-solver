/**
 * Core Module - Optimized for Performance
 * Essential functionality with minimal overhead
 */

(function (exports) {
  "use strict";

  // ============= GLOBAL STATE & CONSTANTS =============
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
    };
  }

  const PERFORMANCE_MODE = true; // Always performance mode

  // ============= MINIMAL LOGGING SYSTEM =============
  const LOG_LEVELS = {
    INFO: { color: "#4CAF50", icon: "ℹ️" },
    WARNING: { color: "#FF9800", icon: "⚠️" },
    ERROR: { color: "#F44336", icon: "❌" },
    SUCCESS: { color: "#8BC34A", icon: "✅" },
    DEBUG: { color: "#9E9E9E", icon: "🔍" },
  };

  // Aggressive spam control
  const logSpamTracker = new Map();
  const SPAM_THRESHOLD = 60000; // 60 seconds between same messages

  // Ultra-minimal spam control
  function logWithSpamControl(message, level = "INFO", spamKey = null) {
    // Skip all non-critical logs in performance mode
    if (PERFORMANCE_MODE && level !== "ERROR" && level !== "SUCCESS") {
      return;
    }

    if (spamKey) {
      const now = Date.now();
      const lastLogged = logSpamTracker.get(spamKey);
      if (lastLogged && now - lastLogged < SPAM_THRESHOLD) {
        return;
      }
      logSpamTracker.set(spamKey, now);
    }

    // Only log critical messages
    if (level === "ERROR" || level === "SUCCESS" || message.includes("Cycle")) {
      const levelInfo = LOG_LEVELS[level] || LOG_LEVELS.INFO;
      console.log(`[Ateex] ${levelInfo.icon} ${message}`);
    }
  }

  // Minimal log functions - only for critical messages
  function log(message, level = "INFO") {
    if (PERFORMANCE_MODE && level !== "ERROR" && level !== "SUCCESS") return;
    logWithSpamControl(message, level);
  }

  function logInfo(message) {
    if (PERFORMANCE_MODE) return; // Skip info logs
    log(message, "INFO");
  }

  function logWarning(message) {
    if (PERFORMANCE_MODE) return; // Skip warning logs
    log(message, "WARNING");
  }

  function logError(message) {
    log(message, "ERROR"); // Always log errors
  }

  function logSuccess(message) {
    log(message, "SUCCESS"); // Always log success
  }

  function logDebug(message) {
    // Always skip debug logs in performance mode
    return;
  }

  // ============= UTILITY FUNCTIONS =============
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function qSelector(selector) {
    return document.querySelector(selector);
  }

  function isHidden(el) {
    return el.offsetParent === null;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return defaultValue;
    }
  }

  function safeJsonStringify(obj, defaultValue = "{}") {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return defaultValue;
    }
  }

  function formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Simplified debounce
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Simplified throttle
  function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // ============= RUNTIME CONTROL SYSTEM =============

  function enableAutoStats() {
    if (window.ateexGlobalState.autoStatsEnabled) {
      return false;
    }

    window.ateexGlobalState.autoStatsEnabled = true;
    window.ateexGlobalState.setupCompleted = true;
    window.ateexGlobalState.autoStatsStartTime = Date.now();
    window.ateexGlobalState.startTime =
      window.ateexGlobalState.autoStatsStartTime;

    // Quick save without error handling
    try {
      localStorage.setItem("ateex_auto_stats_enabled", "true");
      localStorage.setItem("ateex_setup_completed", "true");
      localStorage.setItem(
        "ateex_auto_stats_start_time",
        window.ateexGlobalState.autoStatsStartTime.toString()
      );
    } catch (e) {}

    logSuccess("🚀 Auto Stats enabled");
    return true;
  }

  function disableAutoStats() {
    window.ateexGlobalState.autoStatsEnabled = false;
    window.ateexGlobalState.setupCompleted = false;
    window.ateexGlobalState.autoStatsStartTime = null;

    try {
      localStorage.removeItem("ateex_auto_stats_enabled");
      localStorage.removeItem("ateex_setup_completed");
      localStorage.removeItem("ateex_auto_stats_start_time");
    } catch (e) {}

    const counter = document.getElementById("ateex-counter");
    if (counter) {
      counter.style.display = "none";
    }

    return true;
  }

  function checkAutoStatsState() {
    try {
      const enabled =
        localStorage.getItem("ateex_auto_stats_enabled") === "true";
      const setupCompleted =
        localStorage.getItem("ateex_setup_completed") === "true";
      const startTime = localStorage.getItem("ateex_auto_stats_start_time");

      if (enabled && setupCompleted) {
        window.ateexGlobalState.autoStatsEnabled = true;
        window.ateexGlobalState.setupCompleted = true;
        window.ateexGlobalState.autoStatsStartTime = startTime
          ? parseInt(startTime)
          : Date.now();
        window.ateexGlobalState.startTime =
          window.ateexGlobalState.autoStatsStartTime;
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  // ============= BROWSER DATA MANAGEMENT =============

  async function clearGoogleCookies(shouldReload = false) {
    try {
      const googleCookieNames = [
        "NID",
        "1P_JAR",
        "CONSENT",
        "SOCS",
        "AEC",
        "DV",
        "__Secure-1PAPISID",
        "__Secure-1PSID",
        "__Secure-3PAPISID",
        "__Secure-3PSID",
        "APISID",
        "HSID",
        "SAPISID",
        "SID",
        "SIDCC",
        "SSID",
        "SEARCH_SAMESITE",
        "OTZ",
        "ANID",
        "IDE",
        "__Secure-ENID",
      ];

      googleCookieNames.forEach(cookieName => {
        const domains = [
          ".google.com",
          ".googleapis.com",
          ".gstatic.com",
          ".recaptcha.net",
        ];
        domains.forEach(domain => {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        });
      });

      // Quick storage cleanup
      try {
        Object.keys(localStorage).forEach(key => {
          if (
            key.includes("google") ||
            key.includes("recaptcha") ||
            key.includes("captcha")
          ) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (
            key.includes("google") ||
            key.includes("recaptcha") ||
            key.includes("captcha")
          ) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {}

      // Quick cleanup without extensive checks
      if (shouldReload) {
        setTimeout(() => {
          if (window.top !== window.self) {
            try {
              window.top.postMessage(
                {
                  type: "ateex_reload_required",
                  reason: "google_cookies_cleared",
                },
                "*"
              );
            } catch (e) {
              window.location.reload();
            }
          } else {
            window.location.reload();
          }
        }, 1500); // Reduced delay
      }
    } catch (error) {
      logError("Error clearing Google cookies: " + error.message);
    }
  }

  // ============= SIMPLIFIED ERROR HANDLING =============

  function detectErrorPage() {
    try {
      const pageText = document.body?.textContent?.toLowerCase() || "";
      const pageTitle = document.title.toLowerCase();

      const errorPatterns = [
        /502\s*bad\s*gateway/i,
        /500\s*internal\s*server\s*error/i,
        /503\s*service\s*unavailable/i,
        /504\s*gateway\s*timeout/i,
        /419\s*page\s*expired/i,
        /403\s*forbidden/i,
        /404\s*not\s*found/i,
        /server\s*error/i,
        /something.*went.*wrong/i,
        /maintenance\s*mode/i,
      ];

      return errorPatterns.some(
        pattern => pattern.test(pageText) || pattern.test(pageTitle)
      );
    } catch (e) {
      return false;
    }
  }

  function handleErrorPage() {
    if (window.top !== window.self) return;

    const currentUrl = window.location.href;
    const baseUrl = "https://dash.ateex.cloud/";

    if (currentUrl === baseUrl) return;

    window.scriptStopped = true;

    setTimeout(() => {
      window.location.href = baseUrl;
    }, 2000); // Faster redirect
  }

  function initBasicErrorDetection() {
    setTimeout(() => {
      if (detectErrorPage()) {
        handleErrorPage();
      }
    }, 1000); // Faster initial check

    // Less frequent checks for performance
    setInterval(() => {
      if (!window.scriptStopped && detectErrorPage()) {
        handleErrorPage();
      }
    }, 60000); // Every 60 seconds instead of 30
  }

  // ============= MODULE INITIALIZATION =============

  async function initialize() {
    checkAutoStatsState();
    initBasicErrorDetection();

    // Minimal message listeners
    if (window.top === window.self) {
      window.addEventListener("message", function (event) {
        if (event.data?.type === "ateex_reload_required") {
          setTimeout(() => window.location.reload(), 1000);
        }
      });
    }

    logSuccess("[Core] Initialized");
  }

  // ============= EXPORTS =============

  exports.state = window.ateexGlobalState;
  exports.PERFORMANCE_MODE = PERFORMANCE_MODE;

  // Logging functions
  exports.log = log;
  exports.logInfo = logInfo;
  exports.logWarning = logWarning;
  exports.logError = logError;
  exports.logSuccess = logSuccess;
  exports.logDebug = logDebug;
  exports.logWithSpamControl = logWithSpamControl;

  // Utility functions
  exports.sleep = sleep;
  exports.qSelector = qSelector;
  exports.isHidden = isHidden;
  exports.generateId = generateId;
  exports.safeJsonParse = safeJsonParse;
  exports.safeJsonStringify = safeJsonStringify;
  exports.formatDuration = formatDuration;
  exports.debounce = debounce;
  exports.throttle = throttle;

  // Runtime control
  exports.enableAutoStats = enableAutoStats;
  exports.disableAutoStats = disableAutoStats;
  exports.checkAutoStatsState = checkAutoStatsState;

  // Browser data management
  exports.clearGoogleCookies = clearGoogleCookies;

  // Error handling
  exports.detectErrorPage = detectErrorPage;
  exports.handleErrorPage = handleErrorPage;
  exports.initBasicErrorDetection = initBasicErrorDetection;

  // Module initialization
  exports.initialize = initialize;
})(exports);
