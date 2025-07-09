// ============= SHARED UTILITIES MODULE =============
// This module contains shared constants, selectors, and utility functions
// Used by all other modules

(function () {
  "use strict";

  const context = window.ateexContext;
  context.log("Loading Shared Utils Module...", "INFO");

  // ============= CONSTANTS & SELECTORS =============

  // reCAPTCHA Selectors
  const RECAPTCHA_SELECTORS = {
    CHECK_BOX: ".recaptcha-checkbox-border",
    AUDIO_BUTTON: "#recaptcha-audio-button",
    AUDIO_SOURCE: "#audio-source",
    IMAGE_SELECT: "#rc-imageselect",
    RESPONSE_FIELD: ".rc-audiochallenge-response-field",
    AUDIO_ERROR_MESSAGE: ".rc-audiochallenge-error-message",
    AUDIO_RESPONSE: "#audio-response",
    RELOAD_BUTTON: "#recaptcha-reload-button",
    RECAPTCHA_STATUS: "#recaptcha-accessible-status",
    DOSCAPTCHA: ".rc-doscaptcha-body",
    VERIFY_BUTTON: "#recaptcha-verify-button",
  };

  // Server Configuration
  const SERVER_CONFIG = {
    RECAPTCHA_SERVERS: [
      "https://engageub.pythonanywhere.com",
      "https://engageub1.pythonanywhere.com",
    ],
    MAX_ATTEMPTS: 5,
    DEFAULT_LANGUAGE: "en-US",
    TIMEOUT: 30000,
    RETRY_DELAY: 2000,
  };

  // Storage Keys
  const STORAGE_KEYS = {
    CREDENTIALS: "ateex_secure_creds",
    CREDENTIALS_EXPIRY: "ateex_creds_expiry",
    TARGET_COINS: "ateex_target_coins",
    STATS_HISTORY: "ateex_stats_history",
    SERVER_STATS: "ateex_server_stats",
    AUTO_STATS_ENABLED: "ateex_auto_stats_enabled",
    SETUP_COMPLETED: "ateex_setup_completed",
    AUTO_STATS_START_TIME: "ateex_auto_stats_start_time",
  };

  // Application Constants
  const APP_CONSTANTS = {
    CREDENTIALS_EXPIRY_HOURS: 24,
    DEFAULT_TARGET_COINS: 1000,
    COINS_PER_CYCLE: 15,
    SPAM_THRESHOLD: 30000, // 30 seconds
    SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
    PERFORMANCE_MODE: true,
  };

  // URLs and Paths
  const URLS = {
    BASE: "https://dash.ateex.cloud",
    LOGIN: "https://dash.ateex.cloud/login",
    LOGOUT: "https://dash.ateex.cloud/logout",
    EARN: "https://dash.ateex.cloud/earn",
    HOME: "https://dash.ateex.cloud/home",
  };

  // ============= UTILITY FUNCTIONS =============

  // Enhanced sleep function with jitter
  function sleep(ms, jitter = 0) {
    const actualMs = jitter > 0 ? ms + Math.random() * jitter : ms;
    return new Promise(resolve => setTimeout(resolve, actualMs));
  }

  // Enhanced query selector with error handling
  function qSelector(selector, parent = document) {
    try {
      return parent.querySelector(selector);
    } catch (e) {
      context.log(`Invalid selector: ${selector} - ${e.message}`, "ERROR");
      return null;
    }
  }

  // Query selector all with error handling
  function qSelectorAll(selector, parent = document) {
    try {
      return parent.querySelectorAll(selector);
    } catch (e) {
      context.log(`Invalid selector: ${selector} - ${e.message}`, "ERROR");
      return [];
    }
  }

  // Check if element is hidden
  function isHidden(el) {
    if (!el) return true;
    return (
      el.offsetParent === null ||
      getComputedStyle(el).display === "none" ||
      getComputedStyle(el).visibility === "hidden"
    );
  }

  // Check if element is visible and interactable
  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !isHidden(el);
  }

  // Wait for element to appear
  function waitForElement(selector, timeout = 10000, parent = document) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const element = qSelector(selector, parent);
        if (element && isVisible(element)) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(
            new Error(`Element ${selector} not found within ${timeout}ms`)
          );
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  // Wait for element to disappear
  function waitForElementToDisappear(
    selector,
    timeout = 10000,
    parent = document
  ) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const element = qSelector(selector, parent);
        if (!element || isHidden(element)) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(
            new Error(`Element ${selector} still visible after ${timeout}ms`)
          );
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  // Safe click with retry
  function safeClick(element, retries = 3) {
    return new Promise((resolve, reject) => {
      const attempt = remaining => {
        if (!element || !isVisible(element)) {
          if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), 500);
            return;
          }
          reject(new Error("Element not clickable"));
          return;
        }

        try {
          element.click();
          resolve();
        } catch (e) {
          if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), 500);
          } else {
            reject(e);
          }
        }
      };

      attempt(retries);
    });
  }

  // Generate random delay
  function randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Format time duration
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Format number with commas
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
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

  // Simple encryption for localStorage
  function encryptData(data, key = "ateex_security_key_2024") {
    let encrypted = "";
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(encrypted);
  }

  // Simple decryption for localStorage
  function decryptData(encryptedData, key = "ateex_security_key_2024") {
    try {
      const data = atob(encryptedData);
      let decrypted = "";
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(
          data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return decrypted;
    } catch (e) {
      return null;
    }
  }

  // ============= EXPORT TO SHARED CONTEXT =============

  // Add all utilities to shared context
  context.utils = {
    // Constants
    RECAPTCHA_SELECTORS,
    SERVER_CONFIG,
    STORAGE_KEYS,
    APP_CONSTANTS,
    URLS,

    // Utility functions
    sleep,
    qSelector,
    qSelectorAll,
    isHidden,
    isVisible,
    waitForElement,
    waitForElementToDisappear,
    safeClick,
    randomDelay,
    formatDuration,
    formatNumber,
    debounce,
    throttle,
    encryptData,
    decryptData,
  };

  // Also add to global scope for backward compatibility
  Object.assign(window, {
    qSelector,
    isHidden,
    sleep,
  });

  // Mark module as loaded
  context.state.modulesLoaded["shared-utils"] = true;
  context.modules["shared-utils"] = context.utils;

  context.log("Shared Utils Module loaded successfully!", "SUCCESS");
})();
