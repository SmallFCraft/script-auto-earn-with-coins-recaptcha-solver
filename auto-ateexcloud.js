// ==UserScript==
// @name         Ateex Cloud Auto Script with reCAPTCHA Solver
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Auto script for Ateex Cloud with integrated reCAPTCHA solver
// @author       phmyhu_1710
// @match        https://dash.ateex.cloud/*
// @match        *://*/recaptcha/*
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @run-at       document-ready
// ==/UserScript==

(function () {
  "use strict";

  if (window.ateexAutoRunning) {
    console.log("[Ateex Auto] Script already running, skipping...");
    return;
  }
  window.ateexAutoRunning = true;

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
    };
  }

  // reCAPTCHA Solver Constants & Variables
  var solved = false;
  var checkBoxClicked = false;
  var waitingForAudioResponse = false;
  var captchaInterval = null;
  var requestCount = 0;
  var recaptchaLanguage = "en-US";
  var recaptchaInitialStatus = "";
  var audioUrl = "";

  // reCAPTCHA Selectors
  const CHECK_BOX = ".recaptcha-checkbox-border";
  const AUDIO_BUTTON = "#recaptcha-audio-button";
  const AUDIO_SOURCE = "#audio-source";
  const IMAGE_SELECT = "#rc-imageselect";
  const RESPONSE_FIELD = ".rc-audiochallenge-response-field";
  const AUDIO_ERROR_MESSAGE = ".rc-audiochallenge-error-message";
  const AUDIO_RESPONSE = "#audio-response";
  const RELOAD_BUTTON = "#recaptcha-reload-button";
  const RECAPTCHA_STATUS = "#recaptcha-accessible-status";
  const DOSCAPTCHA = ".rc-doscaptcha-body";
  const VERIFY_BUTTON = "#recaptcha-verify-button";
  const MAX_ATTEMPTS = 5;

  // Server Lists for reCAPTCHA Solving
  var serversList = [
    "https://engageub.pythonanywhere.com",
    "https://engageub1.pythonanywhere.com",
  ];
  var latencyList = Array(serversList.length).fill(10000);

  // Legacy CONFIG object for backward compatibility
  let CONFIG = null;
  // ============= END GLOBAL STATE & CONSTANTS =============

  // ============= SIMPLE LOGGING SYSTEM =============
  const LOG_LEVELS = {
    INFO: { name: "INFO", color: "#4CAF50", icon: "ℹ️" },
    WARNING: { name: "WARNING", color: "#FF9800", icon: "⚠️" },
    ERROR: { name: "ERROR", color: "#F44336", icon: "❌" },
    SUCCESS: { name: "SUCCESS", color: "#8BC34A", icon: "✅" },
    DEBUG: { name: "DEBUG", color: "#9E9E9E", icon: "🔍" },
  };

  // Performance mode - disable heavy features for speed
  const PERFORMANCE_MODE = true; // Set to true for maximum speed

  // Simple log function with levels
  function log(message, level = "INFO") {
    // Console output only
    const levelInfo = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    console.log(
      `%c[Ateex Auto] ${levelInfo.icon} ${message}`,
      `color: ${levelInfo.color}`
    );
  }

  // Convenience functions for different log levels
  function logInfo(message) {
    log(message, "INFO");
  }
  function logWarning(message) {
    log(message, "WARNING");
  }
  function logError(message) {
    log(message, "ERROR");
  }
  function logSuccess(message) {
    log(message, "SUCCESS");
  }
  function logDebug(message) {
    log(message, "DEBUG");
  }

  // Other utility functions
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function qSelector(selector) {
    return document.querySelector(selector);
  }

  function isHidden(el) {
    return el.offsetParent === null;
  }

  // ============= END SIMPLE LOGGING SYSTEM =============

  // ============= SECURE CREDENTIALS SYSTEM =============
  const CREDENTIALS_KEY = "ateex_secure_creds";
  const CREDENTIALS_EXPIRY_KEY = "ateex_creds_expiry";
  const CREDENTIALS_EXPIRY_HOURS = 24; // Credentials expire after 24 hours

  // Simple encryption/decryption for localStorage (basic obfuscation)
  function encryptData(data) {
    const key = "ateex_security_key_2024";
    let encrypted = "";
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(encrypted);
  }

  function decryptData(encryptedData) {
    try {
      const key = "ateex_security_key_2024";
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

  // Validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password (minimum requirements)
  function isValidPassword(password) {
    return password && password.length >= 6;
  }

  // Save credentials securely
  function saveCredentials(email, password) {
    try {
      if (!isValidEmail(email)) {
        throw new Error("Invalid email format");
      }
      if (!isValidPassword(password)) {
        throw new Error("Password must be at least 6 characters");
      }

      const credentials = JSON.stringify({ email, password });
      const encrypted = encryptData(credentials);
      const expiryTime = Date.now() + CREDENTIALS_EXPIRY_HOURS * 60 * 60 * 1000;

      localStorage.setItem(CREDENTIALS_KEY, encrypted);
      localStorage.setItem(CREDENTIALS_EXPIRY_KEY, expiryTime.toString());

      log("Credentials saved securely");
      return true;
    } catch (error) {
      log("Error saving credentials: " + error.message);
      return false;
    }
  }

  // Load credentials securely
  function loadCredentials() {
    try {
      const encrypted = localStorage.getItem(CREDENTIALS_KEY);
      const expiryTime = localStorage.getItem(CREDENTIALS_EXPIRY_KEY);

      if (!encrypted || !expiryTime) {
        return null;
      }

      // Check if credentials have expired
      if (Date.now() > parseInt(expiryTime)) {
        log("Credentials expired, clearing...");
        clearCredentials();
        return null;
      }

      const decrypted = decryptData(encrypted);
      if (!decrypted) {
        log("Failed to decrypt credentials");
        clearCredentials();
        return null;
      }

      const credentials = JSON.parse(decrypted);

      // Validate loaded credentials
      if (
        !isValidEmail(credentials.email) ||
        !isValidPassword(credentials.password)
      ) {
        log("Invalid credentials format, clearing...");
        clearCredentials();
        return null;
      }

      return credentials;
    } catch (error) {
      log("Error loading credentials: " + error.message);
      clearCredentials();
      return null;
    }
  }

  // Clear credentials
  function clearCredentials() {
    localStorage.removeItem(CREDENTIALS_KEY);
    localStorage.removeItem(CREDENTIALS_EXPIRY_KEY);
    log("Credentials cleared");
  }

  // Get credentials with popup input if needed
  async function getCredentials() {
    // Try to load existing credentials first
    let credentials = loadCredentials();

    if (credentials) {
      log("Using saved credentials");
      return credentials;
    }

    // If no valid credentials, prompt user
    log("No valid credentials found, prompting user...");

    return new Promise(resolve => {
      // Create modal popup for credentials input
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      `;

      modal.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          color: white;
          max-width: 400px;
          width: 90%;
        ">
          <h2 style="margin: 0 0 20px 0; text-align: center;">🔐 Ateex Auto Login</h2>
          <p style="margin: 0 0 20px 0; text-align: center; opacity: 0.9;">
            Enter your Ateex Cloud credentials. They will be encrypted and stored locally.
          </p>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Email:</label>
            <input type="email" id="ateex-email" placeholder="your@email.com" style="
              width: 100%;
              padding: 10px;
              border: none;
              border-radius: 5px;
              font-size: 14px;
              box-sizing: border-box;
            ">
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Password:</label>
            <input type="password" id="ateex-password" placeholder="Your password" style="
              width: 100%;
              padding: 10px;
              border: none;
              border-radius: 5px;
              font-size: 14px;
              box-sizing: border-box;
            ">
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="ateex-remember" checked style="margin-right: 8px;">
              <span style="font-size: 12px; opacity: 0.9;">Remember for 24 hours (encrypted)</span>
            </label>
          </div>

          <div style="display: flex; gap: 10px;">
            <button id="ateex-cancel" style="
              flex: 1;
              padding: 12px;
              border: none;
              border-radius: 5px;
              background: rgba(255,255,255,0.2);
              color: white;
              cursor: pointer;
              font-size: 14px;
            ">Cancel</button>
            <button id="ateex-save" style="
              flex: 2;
              padding: 12px;
              border: none;
              border-radius: 5px;
              background: rgba(255,255,255,0.9);
              color: #333;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
            ">Save & Continue</button>
          </div>

          <div id="ateex-error" style="
            margin-top: 15px;
            padding: 10px;
            background: rgba(255,0,0,0.2);
            border-radius: 5px;
            font-size: 12px;
            display: none;
          "></div>
        </div>
      `;

      document.body.appendChild(modal);

      const emailInput = document.getElementById("ateex-email");
      const passwordInput = document.getElementById("ateex-password");
      const rememberCheckbox = document.getElementById("ateex-remember");
      const errorDiv = document.getElementById("ateex-error");
      const saveButton = document.getElementById("ateex-save");
      const cancelButton = document.getElementById("ateex-cancel");

      // Focus email input
      setTimeout(() => emailInput.focus(), 100);

      // Error display function
      function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        setTimeout(() => {
          errorDiv.style.display = "none";
        }, 5000);
      }

      // Save button handler
      saveButton.onclick = () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const remember = rememberCheckbox.checked;

        if (!email || !password) {
          showError("Please fill in both email and password");
          return;
        }

        if (!isValidEmail(email)) {
          showError("Please enter a valid email address");
          return;
        }

        if (!isValidPassword(password)) {
          showError("Password must be at least 6 characters");
          return;
        }

        const credentials = { email, password };

        if (remember) {
          if (!saveCredentials(email, password)) {
            showError("Failed to save credentials");
            return;
          }
        }

        document.body.removeChild(modal);
        resolve(credentials);
      };

      // Cancel button handler
      cancelButton.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      // Enter key handler
      modal.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          saveButton.click();
        } else if (e.key === "Escape") {
          cancelButton.click();
        }
      });
    });
  }

  // Note: CONFIG is defined in global constants section above

  // ============= ENHANCED STATS SYSTEM =============
  const TARGET_COINS_KEY = "ateex_target_coins";
  const STATS_HISTORY_KEY = "ateex_stats_history";
  const DEFAULT_TARGET_COINS = 1000;

  // Get target coins with backup recovery
  function getTargetCoins() {
    try {
      const saved = localStorage.getItem(TARGET_COINS_KEY);
      if (saved) {
        const target = parseInt(saved);
        if (target && target > 0) {
          return target;
        }
      }

      // Try backup if main failed
      const backup = localStorage.getItem(TARGET_COINS_KEY + "_backup");
      if (backup) {
        const backupTarget = parseInt(backup);
        if (backupTarget && backupTarget > 0) {
          logWarning(`Using backup target coins: ${backupTarget}`);
          // Restore main from backup
          localStorage.setItem(TARGET_COINS_KEY, backup);
          return backupTarget;
        }
      }

      logDebug(`No valid target found, using default: ${DEFAULT_TARGET_COINS}`);
      return DEFAULT_TARGET_COINS;
    } catch (e) {
      logError("Error loading target coins: " + e.message);
      return DEFAULT_TARGET_COINS;
    }
  }

  // Set target coins with sync verification
  function setTargetCoins(target) {
    try {
      localStorage.setItem(TARGET_COINS_KEY, target.toString());

      // Verify the save was successful
      const verified = localStorage.getItem(TARGET_COINS_KEY);
      if (verified && parseInt(verified) === target) {
        log(`Target coins updated to: ${target} (verified)`);

        // Update UI immediately to ensure sync
        updateCounter();

        // Also save to backup location for extra safety
        try {
          localStorage.setItem(TARGET_COINS_KEY + "_backup", target.toString());
        } catch (e) {
          // Ignore backup errors
        }

        return true;
      } else {
        logError(
          `Target coins save verification failed: expected ${target}, got ${verified}`
        );
        return false;
      }
    } catch (e) {
      logError("Error saving target coins: " + e.message);
      return false;
    }
  }

  // Save stats to history
  function saveStatsToHistory() {
    try {
      const state = window.ateexGlobalState;
      const now = Date.now();
      const runtime = now - state.startTime;

      const statsEntry = {
        timestamp: now,
        totalCycles: state.totalCycles,
        totalCoins: state.totalCoins,
        runtime: runtime,
        avgCycleTime: state.totalCycles > 0 ? runtime / state.totalCycles : 0,
        coinsPerHour:
          runtime > 0 ? Math.round((state.totalCoins * 3600000) / runtime) : 0,
        targetCoins: getTargetCoins(),
      };

      let history = [];
      const saved = localStorage.getItem(STATS_HISTORY_KEY);
      if (saved) {
        history = JSON.parse(saved);
      }

      history.push(statsEntry);

      // Keep only last 100 entries
      if (history.length > 100) {
        history = history.slice(-100);
      }

      localStorage.setItem(STATS_HISTORY_KEY, JSON.stringify(history));
      log("Stats saved to history");
    } catch (e) {
      log("Error saving stats to history: " + e.message);
    }
  }

  // Get stats history
  function getStatsHistory() {
    try {
      const saved = localStorage.getItem(STATS_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      log("Error loading stats history: " + e.message);
      return [];
    }
  }

  // Show target coins configuration popup
  function showTargetConfigPopup() {
    const currentTarget = getTargetCoins();

    return new Promise(resolve => {
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      `;

      modal.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          color: white;
          max-width: 400px;
          width: 90%;
        ">
          <h2 style="margin: 0 0 20px 0; text-align: center;">🎯 Set Target Coins</h2>
          <p style="margin: 0 0 20px 0; text-align: center; opacity: 0.9;">
            Set your coin earning goal. ETA will be calculated based on this target.
          </p>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Target Coins:</label>
            <input type="number" id="target-coins-input" value="${currentTarget}" min="1" max="100000" style="
              width: 100%;
              padding: 10px;
              border: none;
              border-radius: 5px;
              font-size: 14px;
              box-sizing: border-box;
              text-align: center;
            ">
            <div style="margin-top: 5px; font-size: 11px; opacity: 0.8;">
              Current: ${window.ateexGlobalState.totalCoins} coins
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button id="target-cancel" style="
              flex: 1;
              padding: 12px;
              border: none;
              border-radius: 5px;
              background: rgba(255,255,255,0.2);
              color: white;
              cursor: pointer;
              font-size: 14px;
            ">Cancel</button>
            <button id="target-save" style="
              flex: 2;
              padding: 12px;
              border: none;
              border-radius: 5px;
              background: rgba(255,255,255,0.9);
              color: #333;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
            ">Save Target</button>
          </div>

          <div id="target-error" style="
            margin-top: 15px;
            padding: 10px;
            background: rgba(255,0,0,0.2);
            border-radius: 5px;
            font-size: 12px;
            display: none;
          "></div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = document.getElementById("target-coins-input");
      const errorDiv = document.getElementById("target-error");
      const saveButton = document.getElementById("target-save");
      const cancelButton = document.getElementById("target-cancel");

      // Focus input
      setTimeout(() => input.focus(), 100);

      // Error display function
      function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        setTimeout(() => {
          errorDiv.style.display = "none";
        }, 5000);
      }

      // Save button handler
      saveButton.onclick = () => {
        const target = parseInt(input.value);

        if (!target || target < 1) {
          showError("Please enter a valid target (minimum 1 coin)");
          return;
        }

        if (target > 100000) {
          showError("Target too high (maximum 100,000 coins)");
          return;
        }

        setTargetCoins(target);
        document.body.removeChild(modal);
        resolve(target);
      };

      // Cancel button handler
      cancelButton.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      // Enter key handler
      modal.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          saveButton.click();
        } else if (e.key === "Escape") {
          cancelButton.click();
        }
      });
    });
  }

  // Show stats history popup
  function showStatsHistoryPopup() {
    const history = getStatsHistory();

    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 99999;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    let historyHtml = "";
    if (history.length === 0) {
      historyHtml =
        "<div style='text-align: center; opacity: 0.7;'>No history data available yet.</div>";
    } else {
      // Show last 10 entries
      const recentHistory = history.slice(-10).reverse();
      historyHtml = recentHistory
        .map(entry => {
          const date = new Date(entry.timestamp);
          const timeStr = date.toLocaleTimeString();
          const dateStr = date.toLocaleDateString();
          const runtimeHours = Math.floor(entry.runtime / 3600000);
          const runtimeMinutes = Math.floor((entry.runtime % 3600000) / 60000);

          return `
          <div style="
            margin-bottom: 10px;
            padding: 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 5px;
            font-size: 11px;
          ">
            <div style="font-weight: bold;">${dateStr} ${timeStr}</div>
            <div>Cycles: ${entry.totalCycles} | Coins: ${entry.totalCoins}/${entry.targetCoins}</div>
            <div>Runtime: ${runtimeHours}h ${runtimeMinutes}m | Rate: ${entry.coinsPerHour}/h</div>
          </div>
        `;
        })
        .join("");
    }

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        color: white;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <h2 style="margin: 0 0 20px 0; text-align: center;">📊 Stats History</h2>

        <div style="margin-bottom: 15px; display: flex; gap: 10px; justify-content: center;">
          <button id="show-all-history" style="
            padding: 8px 16px;
            border: none;
            border-radius: 5px;
            background: rgba(255,255,255,0.2);
            color: white;
            cursor: pointer;
            font-size: 12px;
          ">Show All (${history.length})</button>
          <button id="clear-history" style="
            padding: 8px 16px;
            border: none;
            border-radius: 5px;
            background: rgba(255,0,0,0.3);
            color: white;
            cursor: pointer;
            font-size: 12px;
          ">Clear History</button>
          <button id="export-history" style="
            padding: 8px 16px;
            border: none;
            border-radius: 5px;
            background: rgba(0,255,0,0.3);
            color: white;
            cursor: pointer;
            font-size: 12px;
          ">Export CSV</button>
        </div>

        <div style="margin-bottom: 20px;">
          ${historyHtml}
        </div>

        <div style="text-align: center;">
          <button id="history-close" style="
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            background: rgba(255,255,255,0.9);
            color: #333;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
          ">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeButton = document.getElementById("history-close");
    const showAllButton = document.getElementById("show-all-history");
    const clearHistoryButton = document.getElementById("clear-history");
    const exportButton = document.getElementById("export-history");

    let showingAll = false;

    closeButton.onclick = () => {
      document.body.removeChild(modal);
    };

    // Show all history entries
    showAllButton.onclick = () => {
      showingAll = !showingAll;
      const historyContainer = modal.querySelector(
        'div[style*="margin-bottom: 20px;"]:last-of-type'
      );

      if (showingAll) {
        // Show all entries
        const allHistoryHtml =
          history.length === 0
            ? "<div style='text-align: center; opacity: 0.7;'>No history data available yet.</div>"
            : history
                .slice()
                .reverse()
                .map(entry => {
                  const date = new Date(entry.timestamp);
                  const timeStr = date.toLocaleTimeString();
                  const dateStr = date.toLocaleDateString();
                  const runtimeHours = Math.floor(entry.runtime / 3600000);
                  const runtimeMinutes = Math.floor(
                    (entry.runtime % 3600000) / 60000
                  );

                  return `
              <div style="
                margin-bottom: 10px;
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border-radius: 5px;
                font-size: 11px;
              ">
                <div style="font-weight: bold;">${dateStr} ${timeStr}</div>
                <div>Cycles: ${entry.totalCycles} | Coins: ${entry.totalCoins}/${entry.targetCoins}</div>
                <div>Runtime: ${runtimeHours}h ${runtimeMinutes}m | Rate: ${entry.coinsPerHour}/h</div>
              </div>
            `;
                })
                .join("");

        historyContainer.innerHTML = allHistoryHtml;
        showAllButton.textContent = "Show Recent";
      } else {
        // Show recent only
        historyContainer.innerHTML = historyHtml;
        showAllButton.textContent = `Show All (${history.length})`;
      }
    };

    // Clear history
    clearHistoryButton.onclick = () => {
      if (
        confirm(
          "Are you sure you want to clear all stats history? This cannot be undone."
        )
      ) {
        try {
          localStorage.removeItem(STATS_HISTORY_KEY);
          logSuccess("Stats history cleared");
          document.body.removeChild(modal);
          alert("Stats history cleared successfully!");
        } catch (e) {
          logError("Error clearing history: " + e.message);
          alert("Error clearing history: " + e.message);
        }
      }
    };

    // Export to CSV
    exportButton.onclick = () => {
      try {
        if (history.length === 0) {
          alert("No history data to export");
          return;
        }

        const csvHeader =
          "Date,Time,Cycles,Coins,Target,Runtime(h),Rate(coins/h)\\n";
        const csvData = history
          .map(entry => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString();
            const runtimeHours = (entry.runtime / 3600000).toFixed(2);

            return `"${dateStr}","${timeStr}",${entry.totalCycles},${entry.totalCoins},${entry.targetCoins},${runtimeHours},${entry.coinsPerHour}`;
          })
          .join("\\n");

        const csvContent = csvHeader + csvData;
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ateex-stats-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        logSuccess("Stats history exported to CSV");
      } catch (e) {
        logError("Error exporting history: " + e.message);
        alert("Error exporting history: " + e.message);
      }
    };

    // Close on escape key
    modal.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeButton.click();
      }
    });

    // Close on background click
    modal.onclick = e => {
      if (e.target === modal) {
        closeButton.click();
      }
    };
  }

  // Sync all data systems to ensure consistency
  function syncAllData() {
    try {
      // Verify target coins consistency
      const currentTarget = getTargetCoins();
      const backupTarget = localStorage.getItem(TARGET_COINS_KEY + "_backup");

      if (!backupTarget || parseInt(backupTarget) !== currentTarget) {
        localStorage.setItem(
          TARGET_COINS_KEY + "_backup",
          currentTarget.toString()
        );
        logDebug(`Target backup synced: ${currentTarget}`);
      }

      // Update UI to reflect current state
      updateCounter();

      // Save current stats to ensure they're preserved
      try {
        localStorage.setItem(
          "ateex_stats",
          JSON.stringify({
            totalCycles: window.ateexGlobalState.totalCycles,
            totalCoins: window.ateexGlobalState.totalCoins,
            startTime: window.ateexGlobalState.startTime,
            lastSync: Date.now(),
          })
        );
      } catch (e) {
        logError("Error syncing stats: " + e.message);
      }

      logDebug("Data sync completed successfully");
      return true;
    } catch (e) {
      logError("Error during data sync: " + e.message);
      return false;
    }
  }

  // Auto-sync every 5 minutes to prevent data loss
  setInterval(syncAllData, 5 * 60 * 1000);

  // ============= END ENHANCED STATS SYSTEM =============

  // ============= ENHANCED SERVER MANAGEMENT =============
  const SERVER_LATENCY_KEY = "ateex_server_latency";
  const SERVER_STATS_KEY = "ateex_server_stats";
  const LATENCY_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

  // Load server latency from cache
  function loadServerLatency() {
    try {
      const saved = localStorage.getItem(SERVER_LATENCY_KEY);
      if (!saved) return null;

      const data = JSON.parse(saved);
      const now = Date.now();

      // Check if cache is expired
      if (now - data.timestamp > LATENCY_CACHE_EXPIRY) {
        log("Server latency cache expired, will re-test");
        localStorage.removeItem(SERVER_LATENCY_KEY);
        return null;
      }

      log("Loaded cached server latency data");
      return data.latencies;
    } catch (e) {
      log("Error loading server latency: " + e.message);
      return null;
    }
  }

  // Save server latency to cache
  function saveServerLatency(latencies) {
    try {
      const data = {
        timestamp: Date.now(),
        latencies: latencies,
      };
      localStorage.setItem(SERVER_LATENCY_KEY, JSON.stringify(data));
      logSuccess("Server latency cached successfully");
    } catch (e) {
      log("Error saving server latency: " + e.message);
    }
  }

  // Get server statistics
  function getServerStats() {
    try {
      const saved = localStorage.getItem(SERVER_STATS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      log("Error loading server stats: " + e.message);
      return {};
    }
  }

  // Update server statistics
  function updateServerStats(serverUrl, success, responseTime) {
    try {
      const stats = getServerStats();

      if (!stats[serverUrl]) {
        stats[serverUrl] = {
          totalRequests: 0,
          successfulRequests: 0,
          totalResponseTime: 0,
          lastUsed: 0,
          failures: 0,
        };
      }

      const serverStat = stats[serverUrl];
      serverStat.totalRequests++;
      serverStat.lastUsed = Date.now();

      if (success) {
        serverStat.successfulRequests++;
        serverStat.totalResponseTime += responseTime;
        serverStat.failures = 0; // Reset failure count on success
      } else {
        serverStat.failures++;
      }

      // Throttled save to reduce localStorage overhead
      clearTimeout(window.serverStatsTimeout);
      window.serverStatsTimeout = setTimeout(() => {
        localStorage.setItem(SERVER_STATS_KEY, JSON.stringify(stats));
      }, 1000);

      // Only log stats occasionally to reduce overhead
      if (serverStat.totalRequests % 5 === 0) {
        const successRate = (
          (serverStat.successfulRequests / serverStat.totalRequests) *
          100
        ).toFixed(1);
        const avgResponseTime =
          serverStat.successfulRequests > 0
            ? Math.round(
                serverStat.totalResponseTime / serverStat.successfulRequests
              )
            : 0;

        logDebug(
          `Server ${serverUrl} stats: ${successRate}% success, ${avgResponseTime}ms avg, ${serverStat.failures} consecutive failures`
        );
      }
    } catch (e) {
      log("Error updating server stats: " + e.message);
    }
  }

  // Get best server based on latency and stats with fallback
  function getBestServer(excludeServers = []) {
    try {
      const stats = getServerStats();
      let bestServer = null;
      let bestScore = -1;
      let availableServers = [];

      for (let i = 0; i < serversList.length; i++) {
        const server = serversList[i];
        const latency = latencyList[i];
        const serverStat = stats[server];

        // Skip excluded servers
        if (excludeServers.includes(server)) {
          log(`Skipping excluded server: ${server}`);
          continue;
        }

        // Skip servers with too many consecutive failures (but allow if no other options)
        if (serverStat && serverStat.failures >= 3) {
          log(
            `Server ${server} has ${serverStat.failures} consecutive failures`
          );
          // Don't skip completely, just lower priority
        }

        // Calculate score (lower latency = higher score, success rate bonus)
        let score = 10000 - latency; // Base score from latency

        if (serverStat && serverStat.totalRequests > 0) {
          const successRate =
            serverStat.successfulRequests / serverStat.totalRequests;
          score += successRate * 1000; // Bonus for success rate

          // Heavy penalty for recent failures
          if (serverStat.failures > 0) {
            score -= serverStat.failures * 1000;
          }

          // Extra penalty for servers with many failures
          if (serverStat.failures >= 3) {
            score -= 5000;
          }
        }

        availableServers.push({
          server,
          score,
          latency,
          failures: serverStat?.failures || 0,
        });

        log(
          `Server ${server}: latency=${latency}ms, failures=${
            serverStat?.failures || 0
          }, score=${Math.round(score)}`
        );

        if (score > bestScore) {
          bestScore = score;
          bestServer = server;
        }
      }

      // If no server found (all excluded), use fallback
      if (!bestServer && availableServers.length === 0) {
        log("No available servers, using fallback to first server");
        return serversList[0];
      }

      // If best server has too many failures, try next best
      if (bestServer) {
        const bestServerStat = stats[bestServer];
        if (bestServerStat && bestServerStat.failures >= 5) {
          log(
            `Best server ${bestServer} has too many failures (${bestServerStat.failures}), trying fallback`
          );

          // Sort by score and try next best
          availableServers.sort((a, b) => b.score - a.score);
          for (const serverInfo of availableServers) {
            if (serverInfo.server !== bestServer && serverInfo.failures < 5) {
              log(`Fallback to server: ${serverInfo.server}`);
              return serverInfo.server;
            }
          }
        }
      }

      log(
        `Best server selected: ${bestServer} (score: ${Math.round(bestScore)})`
      );
      return bestServer || serversList[0];
    } catch (e) {
      log("Error selecting best server: " + e.message);
      return serversList[0]; // Fallback to first server
    }
  }

  // Reset server failure count (call this periodically or after successful operations)
  function resetServerFailures() {
    try {
      const stats = getServerStats();
      let resetCount = 0;

      for (const serverUrl in stats) {
        if (stats[serverUrl].failures > 0) {
          stats[serverUrl].failures = 0;
          resetCount++;
        }
      }

      if (resetCount > 0) {
        localStorage.setItem(SERVER_STATS_KEY, JSON.stringify(stats));
        log(`Reset failure count for ${resetCount} servers`);
      }
    } catch (e) {
      log("Error resetting server failures: " + e.message);
    }
  }
  // ============= END ENHANCED SERVER MANAGEMENT =============

  // Detect login errors and handle them
  function detectLoginErrors() {
    // Common error selectors for login failures
    const errorSelectors = [
      ".alert-danger",
      ".error-message",
      ".login-error",
      '[class*="error"]',
      '[id*="error"]',
      ".invalid-feedback",
      ".text-danger",
    ];

    for (const selector of errorSelectors) {
      const errorElement = qSelector(selector);
      if (errorElement && errorElement.textContent.trim()) {
        const errorText = errorElement.textContent.trim().toLowerCase();

        // Check for credential-related errors
        if (
          errorText.includes("invalid") ||
          errorText.includes("incorrect") ||
          errorText.includes("wrong") ||
          errorText.includes("email") ||
          errorText.includes("password") ||
          errorText.includes("login") ||
          errorText.includes("authentication")
        ) {
          log(`Login error detected: ${errorText}`);

          // Clear potentially invalid credentials
          clearCredentials();

          alert(
            `Login failed: ${errorText}\n\nCredentials have been cleared. Please refresh the page to enter new credentials.`
          );

          return true;
        }
      }
    }

    return false;
  }

  // Monitor for login errors after form submission
  function monitorLoginResult() {
    let attempts = 0;
    const maxAttempts = 10; // Monitor for 10 seconds

    const checkInterval = setInterval(() => {
      attempts++;

      // Check for login errors
      if (detectLoginErrors()) {
        clearInterval(checkInterval);
        return;
      }

      // Check if we've been redirected (successful login)
      const currentPath = window.location.pathname;
      if (!currentPath.includes("/login")) {
        log("Login appears successful - redirected away from login page");
        clearInterval(checkInterval);
        return;
      }

      // Stop monitoring after max attempts
      if (attempts >= maxAttempts) {
        log("Login monitoring timeout - no clear result detected");
        clearInterval(checkInterval);
      }
    }, 1000);
  }
  // ============= END SECURE CREDENTIALS SYSTEM =============

  function createCounterUI() {
    if (document.getElementById("ateex-counter") || window.ateexCounterCreated)
      return;

    if (window.top !== window.self) return;

    const counterDiv = document.createElement("div");
    counterDiv.id = "ateex-counter";
    counterDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 10px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      min-width: 200px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
    `;

    counterDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">🚀 Ateex Auto Stats</div>
      <div id="cycles-count">Cycles: 0</div>
      <div id="coins-count">Coins: 0 💰</div>
      <div id="target-progress" style="margin-top: 3px; font-size: 11px; opacity: 0.9;">Target: 0/${getTargetCoins()} (0%)</div>
      <div id="runtime">Runtime: 0m 0s</div>
      <div id="avg-time">Avg/cycle: --</div>
      <div id="coins-per-hour">Rate: 0 coins/h</div>
      <div id="eta-target" style="margin-top: 5px; font-size: 11px;">ETA Target: --</div>
      <div id="next-clear" style="margin-top: 3px; font-size: 10px; opacity: 0.8;">Next clear: --</div>
      <div id="best-server" style="margin-top: 3px; font-size: 10px; opacity: 0.8;">Server: --</div>
      <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
        <div style="display: flex; gap: 5px; margin-bottom: 5px;">
          <button id="set-target-btn" style="
            flex: 1;
            padding: 6px;
            border: none;
            border-radius: 4px;
            background: rgba(255,255,255,0.2);
            color: white;
            cursor: pointer;
            font-size: 10px;
            opacity: 0.8;
            transition: opacity 0.2s;
          " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
            🎯 Set Target
          </button>
          <button id="view-stats-btn" style="
            flex: 1;
            padding: 6px;
            border: none;
            border-radius: 4px;
            background: rgba(255,255,255,0.2);
            color: white;
            cursor: pointer;
            font-size: 10px;
            opacity: 0.8;
            transition: opacity 0.2s;
          " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
            📊 History
          </button>
        </div>

        <button id="clear-credentials-btn" style="
          width: 100%;
          padding: 6px;
          border: none;
          border-radius: 4px;
          background: rgba(255,255,255,0.2);
          color: white;
          cursor: pointer;
          font-size: 10px;
          opacity: 0.8;
          transition: opacity 0.2s;
        " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
          🔐 Clear Credentials
        </button>
      </div>
    `;

    document.body.appendChild(counterDiv);

    // Add event listeners for all buttons
    const clearCredsBtn = document.getElementById("clear-credentials-btn");
    if (clearCredsBtn) {
      clearCredsBtn.onclick = () => {
        if (
          confirm(
            "Are you sure you want to clear saved credentials?\nYou will need to enter them again next time."
          )
        ) {
          clearCredentials();
          alert("Credentials cleared successfully!");
        }
      };
    }

    const setTargetBtn = document.getElementById("set-target-btn");
    if (setTargetBtn) {
      setTargetBtn.onclick = async () => {
        const newTarget = await showTargetConfigPopup();
        if (newTarget) {
          // Force sync all data after target change
          syncAllData();
          alert(`Target updated to ${newTarget} coins!`);
        }
      };
    }

    const viewStatsBtn = document.getElementById("view-stats-btn");
    if (viewStatsBtn) {
      viewStatsBtn.onclick = () => {
        showStatsHistoryPopup();
      };
    }

    window.ateexCounterCreated = true;
    log("Counter UI created");

    // Update counter immediately after creation to show current data
    updateCounter();
  }

  function updateCounter() {
    if (window.top !== window.self) return;

    const counter = document.getElementById("ateex-counter");
    if (!counter) return;

    const state = window.ateexGlobalState;
    const now = Date.now();
    const runtime = now - state.startTime;
    const runtimeMinutes = Math.floor(runtime / 60000);
    const runtimeSeconds = Math.floor((runtime % 60000) / 1000);

    const avgCycleTime =
      state.totalCycles > 0 ? runtime / state.totalCycles : 0;
    const coinsPerHour =
      runtime > 0 ? Math.round((state.totalCoins * 3600000) / runtime) : 0;

    // Use dynamic target coins
    const targetCoins = getTargetCoins();
    const coinsNeeded = targetCoins - state.totalCoins;
    const cyclesNeeded = Math.ceil(coinsNeeded / 15);
    const etaMs = cyclesNeeded * avgCycleTime;
    const etaMinutes = Math.floor(etaMs / 60000);
    const etaHours = Math.floor(etaMinutes / 60);

    // Calculate progress percentage
    const progressPercent =
      targetCoins > 0
        ? Math.min(100, Math.round((state.totalCoins / targetCoins) * 100))
        : 0;

    // Update display elements
    document.getElementById(
      "cycles-count"
    ).textContent = `Cycles: ${state.totalCycles}`;
    document.getElementById(
      "coins-count"
    ).textContent = `Coins: ${state.totalCoins} 💰`;
    document.getElementById(
      "target-progress"
    ).textContent = `Target: ${state.totalCoins}/${targetCoins} (${progressPercent}%)`;
    document.getElementById(
      "runtime"
    ).textContent = `Runtime: ${runtimeMinutes}m ${runtimeSeconds}s`;
    // Better display for avg cycle time
    const avgTimeDisplay =
      avgCycleTime > 0
        ? `${Math.round(avgCycleTime / 1000)}s`
        : "calculating...";
    document.getElementById(
      "avg-time"
    ).textContent = `Avg/cycle: ${avgTimeDisplay}`;

    // Better display for coins per hour
    const rateDisplay =
      coinsPerHour > 0 ? `${coinsPerHour} coins/h` : "calculating...";
    document.getElementById(
      "coins-per-hour"
    ).textContent = `Rate: ${rateDisplay}`;

    // Update ETA based on target with better messaging
    if (state.totalCoins >= targetCoins) {
      document.getElementById("eta-target").textContent = `🎉 Target reached!`;
    } else if (avgCycleTime > 0 && coinsNeeded > 0) {
      document.getElementById(
        "eta-target"
      ).textContent = `ETA Target: ${etaHours}h ${etaMinutes % 60}m`;
    } else if (state.totalCycles === 0) {
      document.getElementById(
        "eta-target"
      ).textContent = `ETA Target: starting...`;
    } else {
      document.getElementById(
        "eta-target"
      ).textContent = `ETA Target: calculating...`;
    }

    const cyclesUntilClear = 10 - (state.totalCycles % 10);
    if (cyclesUntilClear === 10) {
      document.getElementById("next-clear").textContent = `🧹 Cookies cleared!`;
    } else {
      document.getElementById(
        "next-clear"
      ).textContent = `🧹 Clear in: ${cyclesUntilClear} cycles`;
    }

    // Update server info with better initial display
    if (
      !window.lastServerUpdate ||
      Date.now() - window.lastServerUpdate > 15000 // Update more frequently (15s instead of 30s)
    ) {
      try {
        const bestServer = getBestServer();
        if (bestServer) {
          const serverName = bestServer
            .replace("https://", "")
            .replace(".pythonanywhere.com", "");
          const stats = getServerStats();
          const serverStat = stats[bestServer];

          if (serverStat && serverStat.totalRequests > 0) {
            const successRate = Math.round(
              (serverStat.successfulRequests / serverStat.totalRequests) * 100
            );
            const avgTime = Math.round(
              serverStat.totalResponseTime / serverStat.successfulRequests
            );
            document.getElementById(
              "best-server"
            ).textContent = `🌐 ${serverName} (${successRate}%, ${avgTime}ms)`;
          } else {
            document.getElementById(
              "best-server"
            ).textContent = `🌐 ${serverName} (ready)`;
          }
          window.lastServerUpdate = Date.now();
        } else {
          document.getElementById(
            "best-server"
          ).textContent = `🌐 Server: loading...`;
        }
      } catch (e) {
        document.getElementById(
          "best-server"
        ).textContent = `🌐 Server: checking...`;
      }
    }
  }

  function incrementCycle() {
    if (window.top !== window.self) return;

    window.ateexGlobalState.totalCycles++;
    window.ateexGlobalState.totalCoins += 15;
    window.ateexGlobalState.lastCycleTime = Date.now();

    log(
      `Cycle ${window.ateexGlobalState.totalCycles} completed! Total coins: ${window.ateexGlobalState.totalCoins}`
    );

    // Force immediate update to show new data
    updateCounter();

    // Also force sync to ensure data persistence
    syncAllData();

    // Save to enhanced stats history (always save for tracking)
    if (window.ateexGlobalState.totalCycles % 20 === 0) {
      saveStatsToHistory();
    }

    if (window.ateexGlobalState.totalCycles % 10 === 0) {
      log("Preventive Google cookies clearing (every 10 cycles)");
      clearGoogleCookies(false);
    }

    // Reset server failures every 20 cycles to give failed servers another chance
    if (window.ateexGlobalState.totalCycles % 20 === 0) {
      resetServerFailures();
    }

    // Check if target reached
    const targetCoins = getTargetCoins();
    if (window.ateexGlobalState.totalCoins >= targetCoins) {
      log(`🎉 Target of ${targetCoins} coins reached!`);
      saveStatsToHistory(); // Save final stats
    }

    try {
      localStorage.setItem(
        "ateex_stats",
        JSON.stringify({
          totalCycles: window.ateexGlobalState.totalCycles,
          totalCoins: window.ateexGlobalState.totalCoins,
          startTime: window.ateexGlobalState.startTime,
        })
      );
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  function loadSavedStats() {
    try {
      const saved = localStorage.getItem("ateex_stats");
      if (saved) {
        const stats = JSON.parse(saved);
        window.ateexGlobalState.totalCycles = stats.totalCycles || 0;
        window.ateexGlobalState.totalCoins = stats.totalCoins || 0;
        window.ateexGlobalState.startTime = stats.startTime || Date.now();

        logSuccess(
          `📊 Loaded saved stats: ${stats.totalCycles} cycles, ${stats.totalCoins} coins`
        );

        // Force immediate UI update after loading
        setTimeout(() => {
          if (document.getElementById("ateex-counter")) {
            updateCounter();
          }
        }, 100);
      } else {
        log("📊 No saved stats found, starting fresh");
        // Initialize with current time
        window.ateexGlobalState.startTime = Date.now();
      }
    } catch (e) {
      logError("Could not load saved stats: " + e.message);
      // Initialize with defaults on error
      window.ateexGlobalState.totalCycles = 0;
      window.ateexGlobalState.totalCoins = 0;
      window.ateexGlobalState.startTime = Date.now();
    }
  }

  async function clearBrowserData() {
    // Preserve important data that should survive browser data clearing
    const dataToPreserve = {
      // Stats data
      ateex_stats: localStorage.getItem("ateex_stats"),

      // Credentials (only if not expired)
      ateex_secure_creds: localStorage.getItem(CREDENTIALS_KEY),
      ateex_creds_expiry: localStorage.getItem(CREDENTIALS_EXPIRY_KEY),

      // Target coins with backup
      ateex_target_coins: localStorage.getItem(TARGET_COINS_KEY),
      ateex_target_coins_backup: localStorage.getItem(
        TARGET_COINS_KEY + "_backup"
      ),
      ateex_stats_history: localStorage.getItem(STATS_HISTORY_KEY),

      // Server management data
      ateex_server_latency: localStorage.getItem(SERVER_LATENCY_KEY),
      ateex_server_stats: localStorage.getItem(SERVER_STATS_KEY),
    };

    // Check if credentials are still valid before preserving them
    const expiryTime = dataToPreserve.ateex_creds_expiry;
    if (expiryTime && Date.now() > parseInt(expiryTime)) {
      log("Credentials expired during clear, not preserving them");
      dataToPreserve.ateex_secure_creds = null;
      dataToPreserve.ateex_creds_expiry = null;
    } else if (
      dataToPreserve.ateex_secure_creds &&
      dataToPreserve.ateex_creds_expiry
    ) {
      // Additional validation: try to decrypt credentials to ensure they're valid
      try {
        const decrypted = decryptData(dataToPreserve.ateex_secure_creds);
        if (decrypted) {
          const credentials = JSON.parse(decrypted);
          if (
            isValidEmail(credentials.email) &&
            isValidPassword(credentials.password)
          ) {
            log("Preserving valid credentials during browser data clear");
          } else {
            log("Invalid credentials format detected, not preserving them");
            dataToPreserve.ateex_secure_creds = null;
            dataToPreserve.ateex_creds_expiry = null;
          }
        } else {
          log("Failed to decrypt credentials, not preserving them");
          dataToPreserve.ateex_secure_creds = null;
          dataToPreserve.ateex_creds_expiry = null;
        }
      } catch (e) {
        log("Error validating credentials during clear: " + e.message);
        dataToPreserve.ateex_secure_creds = null;
        dataToPreserve.ateex_creds_expiry = null;
      }
    }

    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Restore preserved data
    Object.entries(dataToPreserve).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        localStorage.setItem(key, value);
      }
    });

    // If credentials were preserved, mark them as ready for immediate use
    if (
      dataToPreserve.ateex_secure_creds &&
      dataToPreserve.ateex_creds_expiry
    ) {
      window.ateexGlobalState.credentialsReady = true;
      log("Credentials preserved and marked as ready for next cycle");
    }

    document.cookie.split(";").forEach(c => {
      const name = c.split("=")[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });

    if (window.indexedDB && indexedDB.databases) {
      indexedDB.databases().then(dbs => {
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      });
    }

    await clearGoogleCookies(false);

    // Log summary of what was preserved with detailed target info
    const preservedItems = Object.entries(dataToPreserve).filter(
      ([_, value]) => value !== null && value !== undefined
    );

    // Special logging for target coins to track sync issues
    const targetPreserved = dataToPreserve.ateex_target_coins;
    const targetBackupPreserved = dataToPreserve.ateex_target_coins_backup;
    if (targetPreserved) {
      logSuccess(
        `Target coins preserved: ${targetPreserved} (backup: ${
          targetBackupPreserved || "none"
        })`
      );
    } else {
      logWarning("Target coins NOT preserved - may reset to default");
    }

    if (preservedItems.length > 0) {
      log(
        `Browser data cleared, preserved ${
          preservedItems.length
        } items: ${preservedItems.map(([key]) => key).join(", ")}`
      );
    } else {
      log("Browser data cleared, no items preserved");
    }

    // Verify target coins after restore
    setTimeout(() => {
      const currentTarget = getTargetCoins();
      log(`Target coins after restore: ${currentTarget}`);
    }, 100);
  }

  async function clearGoogleCookies(shouldReload = false) {
    try {
      log("Deep clearing ALL Google storage to reset reCAPTCHA limits...");
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
          ".google.co.uk",
          ".google.ca",
          ".googleapis.com",
          ".gstatic.com",
          ".recaptcha.net",
          ".google-analytics.com",
        ];
        domains.forEach(domain => {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        });
      });

      try {
        Object.keys(localStorage).forEach(key => {
          if (
            key.includes("google") ||
            key.includes("recaptcha") ||
            key.includes("captcha") ||
            key.includes("gapi") ||
            key.includes("analytics")
          ) {
            localStorage.removeItem(key);
          }
        });

        Object.keys(sessionStorage).forEach(key => {
          if (
            key.includes("google") ||
            key.includes("recaptcha") ||
            key.includes("captcha") ||
            key.includes("gapi") ||
            key.includes("analytics")
          ) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        log("Storage clearing error: " + e.message);
      }

      try {
        if (window.indexedDB && indexedDB.databases) {
          const databases = await indexedDB.databases();
          for (const db of databases) {
            if (
              db.name &&
              (db.name.includes("google") ||
                db.name.includes("recaptcha") ||
                db.name.includes("gapi") ||
                db.name.includes("analytics"))
            ) {
              indexedDB.deleteDatabase(db.name);
              log(`Deleted IndexedDB: ${db.name}`);
            }
          }
        }
      } catch (e) {
        log("IndexedDB clearing error: " + e.message);
      }

      try {
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            if (
              cacheName.includes("google") ||
              cacheName.includes("recaptcha") ||
              cacheName.includes("gapi") ||
              cacheName.includes("analytics")
            ) {
              await caches.delete(cacheName);
              log(`Deleted cache: ${cacheName}`);
            }
          }
        }
      } catch (e) {
        log("Cache clearing error: " + e.message);
      }

      try {
        if ("serviceWorker" in navigator) {
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            if (
              registration.scope.includes("google") ||
              registration.scope.includes("recaptcha")
            ) {
              await registration.unregister();
              log(`Unregistered SW: ${registration.scope}`);
            }
          }
        }
      } catch (e) {
        log("Service Worker clearing error: " + e.message);
      }

      log("Deep Google storage clearing completed successfully");

      if (shouldReload) {
        setTimeout(() => {
          log("Reloading page to reset reCAPTCHA state...");

          if (window.top !== window.self) {
            try {
              window.top.postMessage(
                {
                  type: "ateex_reload_required",
                  reason: "google_cookies_cleared",
                },
                "*"
              );
              log("Sent reload request to parent window");
            } catch (e) {
              try {
                window.top.location.reload();
              } catch (e2) {
                window.location.reload();
              }
            }
          } else {
            window.location.reload();
          }
        }, 2000);
      }
    } catch (error) {
      log("Error clearing Google cookies: " + error.message);
    }
  }

  function logout() {
    const logoutForm = document.querySelector('form[action*="/logout"]');
    if (logoutForm) {
      log("Logout form found, submitting...");
      logoutForm.submit();
      return;
    }

    const logoutButton =
      document.querySelector('a[href*="logout"]') ||
      document.querySelector('button[onclick*="logout"]') ||
      document.querySelector(".logout");

    if (logoutButton) {
      logoutButton.click();
      log("Logout button clicked");
    } else {
      log("No logout form/button found, redirecting to logout URL");
      window.location.href = "https://dash.ateex.cloud/logout";
    }
  }

  // ============= RECAPTCHA SOLVER FUNCTIONS =============

  function initRecaptchaVars() {
    try {
      const htmlLang = qSelector("html");
      if (htmlLang) {
        recaptchaLanguage = htmlLang.getAttribute("lang") || "en-US";
      }

      const statusElement = qSelector(RECAPTCHA_STATUS);
      if (statusElement) {
        recaptchaInitialStatus = statusElement.innerText || "";
      }

      log("Recaptcha Language is " + recaptchaLanguage);
    } catch (err) {
      log("Error initializing recaptcha vars: " + err.message);
    }
  }

  async function getTextFromAudio(URL) {
    // Use enhanced server selection
    var url = getBestServer();

    requestCount = requestCount + 1;
    URL = URL.replace("recaptcha.net", "google.com");

    if (recaptchaLanguage.length < 1) {
      log("Recaptcha Language is not recognized");
      recaptchaLanguage = "en-US";
    }

    log(
      `Solving reCAPTCHA with audio using server: ${url} (Language: ${recaptchaLanguage})`
    );

    const requestStart = Date.now();

    GM_xmlhttpRequest({
      method: "POST",
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "input=" + encodeURIComponent(URL) + "&lang=" + recaptchaLanguage,
      timeout: 60000,
      onload: function (response) {
        const responseTime = Date.now() - requestStart;
        log(
          `Response from ${url} (${responseTime}ms): ${response.responseText}`
        );

        try {
          if (response && response.responseText) {
            var responseText = response.responseText;
            // Validate Response for error messages or html elements
            if (
              responseText == "0" ||
              responseText.includes("<") ||
              responseText.includes(">") ||
              responseText.length < 2 ||
              responseText.length > 50
            ) {
              // Invalid Response, Reload the captcha
              log("Invalid Response. Retrying..");
              updateServerStats(url, false, responseTime);
            } else if (
              qSelector(AUDIO_SOURCE) &&
              qSelector(AUDIO_SOURCE).src &&
              audioUrl == qSelector(AUDIO_SOURCE).src &&
              qSelector(AUDIO_RESPONSE) &&
              !qSelector(AUDIO_RESPONSE).value &&
              qSelector(AUDIO_BUTTON).style.display == "none" &&
              qSelector(VERIFY_BUTTON)
            ) {
              qSelector(AUDIO_RESPONSE).value = responseText;
              qSelector(VERIFY_BUTTON).click();
              logSuccess("reCAPTCHA solved successfully!");
              updateServerStats(url, true, responseTime);
            } else {
              log("Could not locate text input box");
              updateServerStats(url, false, responseTime);
            }
            waitingForAudioResponse = false;
          }
        } catch (err) {
          log("Exception handling response. Retrying..: " + err.message);
          updateServerStats(url, false, responseTime);
          waitingForAudioResponse = false;
        }
      },
      onerror: function (e) {
        const responseTime = Date.now() - requestStart;
        log(`reCAPTCHA solver error from ${url}: ${e}`);
        updateServerStats(url, false, responseTime);
        waitingForAudioResponse = false;
      },
      ontimeout: function () {
        log(`Response Timed out from ${url}. Retrying..`);
        updateServerStats(url, false, 60000); // Use timeout value
        waitingForAudioResponse = false;
      },
    });
  }

  async function pingTest(url) {
    var start = new Date().getTime();
    log(`Pinging server: ${url}`);

    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "",
      timeout: 8000,
      onload: function (response) {
        var end = new Date().getTime();
        var milliseconds = end - start;

        if (response && response.responseText && response.responseText == "0") {
          // Update latency list
          for (let i = 0; i < serversList.length; i++) {
            if (url == serversList[i]) {
              latencyList[i] = milliseconds;
              log(`Server ${url} ping: ${milliseconds}ms (success)`);
            }
          }

          // Update server stats
          updateServerStats(url, true, milliseconds);
        } else {
          log(`Server ${url} ping failed: invalid response`);
          updateServerStats(url, false, milliseconds);
        }

        // Save latency cache after all pings complete
        saveServerLatency(latencyList);
      },
      onerror: function (e) {
        var end = new Date().getTime();
        var milliseconds = end - start;
        log(`Ping test error for ${url}: ${e}`);
        updateServerStats(url, false, milliseconds);
      },
      ontimeout: function () {
        log(`Ping Test Response Timed out for ${url}`);
        updateServerStats(url, false, 8000); // Use timeout value
      },
    });
  }

  function initCaptchaSolver() {
    // CRITICAL: Check if credentials are ready before allowing reCAPTCHA
    // For iframe context, check both local state and parent window
    let credentialsReady = window.ateexGlobalState.credentialsReady;

    // If in iframe, also check parent window's credentials state
    if (window.top !== window.self) {
      try {
        if (
          window.top.ateexGlobalState &&
          window.top.ateexGlobalState.credentialsReady
        ) {
          credentialsReady = true;
          // Sync the flag to local state
          window.ateexGlobalState.credentialsReady = true;
          log("Credentials ready flag synced from parent window");
        }
      } catch (e) {
        // Cross-origin access might be blocked, use message passing
        log("Cannot access parent window directly, checking via message...");
      }
    }

    if (!credentialsReady) {
      log("reCAPTCHA blocked: Credentials not ready yet. Waiting...");

      // Wait and retry every 2 seconds until credentials are ready
      setTimeout(() => {
        initCaptchaSolver();
      }, 2000);
      return;
    }

    log("Credentials ready - proceeding with reCAPTCHA solver");

    // Kiểm tra nếu captcha đã được giải
    if (window.ateexGlobalState.captchaSolved) {
      log("reCAPTCHA already solved, skipping solver initialization");
      return;
    }

    // Kiểm tra cooldown period sau automated queries
    if (window.ateexGlobalState.lastAutomatedQueriesTime) {
      const timeSinceLastError =
        Date.now() - window.ateexGlobalState.lastAutomatedQueriesTime;
      const cooldownPeriod = 60000; // 60 giây cooldown

      if (timeSinceLastError < cooldownPeriod) {
        const remainingTime = Math.ceil(
          (cooldownPeriod - timeSinceLastError) / 1000
        );
        log(`Cooldown active, waiting ${remainingTime}s before retry`);

        setTimeout(() => {
          initCaptchaSolver();
        }, 5000); // Check lại sau 5 giây
        return;
      }
    }

    // Kiểm tra nếu solver đang chạy
    if (window.ateexGlobalState.captchaInProgress && captchaInterval) {
      log("reCAPTCHA solver already in progress, skipping");
      return;
    }

    // Khởi tạo variables an toàn
    initRecaptchaVars();

    // Load cached server latency
    const cachedLatency = loadServerLatency();
    if (cachedLatency && cachedLatency.length === serversList.length) {
      latencyList = cachedLatency;
      log("Using cached server latency data");
    } else {
      log("No valid cached latency, will ping servers");
    }

    // Mark as in progress
    window.ateexGlobalState.captchaInProgress = true;

    // Xử lý iframe reCAPTCHA theo script gốc
    if (qSelector(CHECK_BOX)) {
      qSelector(CHECK_BOX).click();
    } else if (window.location.href.includes("bframe")) {
      // Only ping if we don't have cached data or it's expired
      if (!cachedLatency) {
        log("Pinging servers to determine best latency...");
        for (let i = 0; i < serversList.length; i++) {
          pingTest(serversList[i]);
        }
      } else {
        log("Using cached latency, skipping ping tests");
      }
    }

    // Clear interval cũ nếu có
    if (captchaInterval) {
      clearInterval(captchaInterval);
    }

    // Solve the captcha using audio - theo script gốc
    captchaInterval = setInterval(async function () {
      try {
        if (
          !checkBoxClicked &&
          qSelector(CHECK_BOX) &&
          !isHidden(qSelector(CHECK_BOX))
        ) {
          qSelector(CHECK_BOX).click();
          checkBoxClicked = true;
        }

        // Check if the captcha is solved
        if (
          qSelector(RECAPTCHA_STATUS) &&
          qSelector(RECAPTCHA_STATUS).innerText != recaptchaInitialStatus
        ) {
          solved = true;
          logSuccess("reCAPTCHA SOLVED successfully!");
          clearInterval(captchaInterval);

          // Update global state
          window.ateexGlobalState.captchaSolved = true;
          window.ateexGlobalState.captchaInProgress = false;
          window.ateexGlobalState.lastSolvedTime = Date.now();

          // Notify parent window if in iframe
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(
                {
                  type: "ateex_captcha_solved",
                  solved: true,
                  timestamp: Date.now(),
                },
                "*"
              );
              log("Notified parent window about captcha solution");
            }
          } catch (e) {
            log("Could not notify parent window: " + e.message);
          }

          // Trigger custom event để notify login page
          window.dispatchEvent(
            new CustomEvent("recaptchaSolved", {
              detail: { solved: true },
            })
          );
        }

        if (requestCount > MAX_ATTEMPTS) {
          log("Attempted Max Retries. Stopping the solver");
          solved = true;
          window.ateexGlobalState.captchaInProgress = false;
          clearInterval(captchaInterval);
        }

        if (!solved) {
          if (
            qSelector(AUDIO_BUTTON) &&
            !isHidden(qSelector(AUDIO_BUTTON)) &&
            qSelector(IMAGE_SELECT)
          ) {
            qSelector(AUDIO_BUTTON).click();
          }

          if (
            (!waitingForAudioResponse &&
              qSelector(AUDIO_SOURCE) &&
              qSelector(AUDIO_SOURCE).src &&
              qSelector(AUDIO_SOURCE).src.length > 0 &&
              audioUrl == qSelector(AUDIO_SOURCE).src &&
              qSelector(RELOAD_BUTTON)) ||
            (qSelector(AUDIO_ERROR_MESSAGE) &&
              qSelector(AUDIO_ERROR_MESSAGE).innerText.length > 0 &&
              qSelector(RELOAD_BUTTON) &&
              !qSelector(RELOAD_BUTTON).disabled)
          ) {
            qSelector(RELOAD_BUTTON).click();
          } else if (
            !waitingForAudioResponse &&
            qSelector(RESPONSE_FIELD) &&
            !isHidden(qSelector(RESPONSE_FIELD)) &&
            !qSelector(AUDIO_RESPONSE).value &&
            qSelector(AUDIO_SOURCE) &&
            qSelector(AUDIO_SOURCE).src &&
            qSelector(AUDIO_SOURCE).src.length > 0 &&
            audioUrl != qSelector(AUDIO_SOURCE).src &&
            requestCount <= MAX_ATTEMPTS
          ) {
            waitingForAudioResponse = true;
            audioUrl = qSelector(AUDIO_SOURCE).src;
            getTextFromAudio(audioUrl);
          } else {
            // Waiting
          }
        }

        // Stop solving when Automated queries message is shown
        if (
          qSelector(DOSCAPTCHA) &&
          qSelector(DOSCAPTCHA).innerText.length > 0
        ) {
          log(
            "Automated Queries Detected - clearing storage and implementing cooldown"
          );

          // Clear Google cookies và reload để reset limits
          await clearGoogleCookies(true);

          window.ateexGlobalState.captchaInProgress = false;
          clearInterval(captchaInterval);

          // Set cooldown period để tránh immediate retry
          window.ateexGlobalState.lastAutomatedQueriesTime = Date.now();

          // Không cần setTimeout vì sẽ reload trang
        }
      } catch (err) {
        log(
          "An error occurred while solving. Stopping the solver: " + err.message
        );
        window.ateexGlobalState.captchaInProgress = false;
        clearInterval(captchaInterval);
      }
    }, 5000); // Giữ nguyên 5 giây như script gốc
  }
  // ============= KẾT THÚC RECAPTCHA SOLVER =============

  // Xử lý trang /earn
  async function handleEarnPage() {
    log("On earn page");

    try {
      // Đợi 5 giây
      log("Waiting 5 seconds before clicking Clickcoin Start button...");
      await sleep(5000);

      // Tìm hàng Clickcoin chính xác theo HTML structure
      const clickcoinRow = Array.from(document.querySelectorAll("tr")).find(
        row => {
          const tdElements = row.querySelectorAll("td");
          return (
            tdElements.length > 0 &&
            tdElements[0].textContent.trim() === "Clickcoin"
          );
        }
      );

      if (clickcoinRow) {
        // Tìm link Start trong hàng Clickcoin
        const startLink = clickcoinRow.querySelector(
          'a[href*="/earn/clickcoin"]'
        );
        if (startLink) {
          log("Found Clickcoin Start link, clicking...");

          // Đảm bảo link mở trong tab mới
          startLink.setAttribute("target", "_blank");
          startLink.setAttribute("rel", "noopener noreferrer");

          // Click link
          startLink.click();
          log("Clickcoin Start link clicked");

          // Đợi 7 giây cho popup ads load và hoàn thành
          log("Waiting 7 seconds for popup ads to load and complete...");
          await sleep(7000);

          // Increment cycle counter
          incrementCycle();

          // Thực hiện logout
          log("Performing logout...");
          logout();

          // Đợi logout hoàn tất trước khi xóa dữ liệu
          await sleep(2000);

          // Xóa dữ liệu browser
          await clearBrowserData();
        } else {
          log("Clickcoin Start link not found");
          // Fallback: tìm button trong row
          const startButton = clickcoinRow.querySelector("button");
          if (startButton) {
            log("Found Clickcoin Start button, clicking...");
            startButton.click();
            log("Waiting 7 seconds for popup ads to load and complete...");
            await sleep(7000); // Đợi 7 giây cho popup và ads
            incrementCycle();
            logout();
            await sleep(2000);
            await clearBrowserData();
          } else {
            log("No Start button found in Clickcoin row");
          }
        }
      } else {
        log("Clickcoin row not found");
        // Debug: log all rows
        const allRows = document.querySelectorAll("tr");
        log(`Found ${allRows.length} rows in table`);
        allRows.forEach((row, index) => {
          const firstTd = row.querySelector("td");
          if (firstTd) {
            log(`Row ${index}: ${firstTd.textContent.trim()}`);
          }
        });
      }
    } catch (error) {
      log("Error in handleEarnPage: " + error.message);
    }
  }

  // Xử lý trang login
  async function handleLoginPage() {
    log("On login page");

    try {
      // Listen for messages from iframe
      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "ateex_captcha_solved") {
          log("Received captcha solved message from iframe");
          window.ateexGlobalState.captchaSolved = true;
          window.ateexGlobalState.captchaInProgress = false;
          window.ateexGlobalState.lastSolvedTime = event.data.timestamp;
          solved = true;
        }
      });

      // STEP 1: Ensure credentials are available FIRST
      log("Step 1: Checking/getting credentials...");
      if (!CONFIG || !CONFIG.email || !CONFIG.password) {
        log("No credentials available, prompting user...");
        CONFIG = await getCredentials();

        if (!CONFIG) {
          log("User cancelled credential input, stopping script");
          log("reCAPTCHA will remain blocked until credentials are provided");
          return;
        }

        logSuccess("Credentials obtained successfully");
      } else {
        logInfo("Using existing credentials");
      }

      // CRITICAL: Mark credentials as ready to allow reCAPTCHA
      window.ateexGlobalState.credentialsReady = true;
      logSuccess("Credentials ready flag set - reCAPTCHA can now proceed");

      // Notify all iframes that credentials are ready
      try {
        const message = {
          type: "ateex_credentials_ready",
          timestamp: Date.now(),
        };

        // Send to all frames
        const frames = document.querySelectorAll("iframe");
        if (frames.length > 0) {
          frames.forEach(frame => {
            try {
              frame.contentWindow.postMessage(message, "*");
            } catch (e) {
              // Ignore cross-origin errors
            }
          });
          logDebug(
            `Credentials ready message sent to ${frames.length} iframes`
          );
        }
      } catch (e) {
        logError("Error sending credentials ready message: " + e.message);
      }

      // STEP 2: Wait before proceeding (5-10 seconds as requested)
      const waitTime = Math.random() * 5000 + 5000; // 5-10 giây
      log(
        `Step 2: Waiting ${Math.round(
          waitTime / 1000
        )} seconds before auto-filling...`
      );
      await sleep(waitTime);

      // STEP 3: Validate credentials (should be valid at this point)
      log("Step 3: Validating credentials...");
      if (!CONFIG || !CONFIG.email || !CONFIG.password) {
        logError("No valid credentials available after input");
        alert(
          "Internal error: No credentials available. Please refresh the page."
        );
        return;
      }

      if (!isValidEmail(CONFIG.email)) {
        logError("Invalid email format in credentials");
        clearCredentials();
        alert(
          "Invalid email format. Please refresh the page to re-enter credentials."
        );
        return;
      }

      if (!isValidPassword(CONFIG.password)) {
        logError("Invalid password in credentials");
        clearCredentials();
        alert(
          "Invalid password format. Please refresh the page to re-enter credentials."
        );
        return;
      }

      logSuccess("Credentials validated successfully");

      // STEP 4: Fill login form
      log("Step 4: Filling login form...");

      // Fill email/username
      const emailInput = qSelector('input[name="email"]');
      if (emailInput) {
        emailInput.value = CONFIG.email;
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        logSuccess("Email filled successfully");
      } else {
        logWarning("Email input field not found, trying alternatives...");
        // Try alternative selectors
        const altEmailInput =
          qSelector('input[type="email"]') ||
          qSelector('input[placeholder*="email" i]') ||
          qSelector('input[id*="email" i]');
        if (altEmailInput) {
          altEmailInput.value = CONFIG.email;
          altEmailInput.dispatchEvent(new Event("input", { bubbles: true }));
          logSuccess("Email filled using alternative selector");
        } else {
          logError("Could not find any email input field");
        }
      }

      // Fill password
      const passwordInput = qSelector('input[name="password"]');
      if (passwordInput) {
        passwordInput.value = CONFIG.password;
        passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
        logSuccess("Password filled successfully");
      } else {
        logWarning("Password input field not found, trying alternatives...");
        // Try alternative selectors
        const altPasswordInput =
          qSelector('input[type="password"]') ||
          qSelector('input[placeholder*="password" i]') ||
          qSelector('input[id*="password" i]');
        if (altPasswordInput) {
          altPasswordInput.value = CONFIG.password;
          altPasswordInput.dispatchEvent(new Event("input", { bubbles: true }));
          logSuccess("Password filled using alternative selector");
        } else {
          logError("Could not find any password input field");
        }
      }

      log("Form filling completed");

      // STEP 5: Handle reCAPTCHA (only after form is filled)
      log("Step 5: Handling reCAPTCHA...");

      // Check if captcha was already solved in iframe
      if (window.ateexGlobalState.captchaSolved) {
        log("reCAPTCHA already solved in iframe, proceeding with login");
        solved = true;
      } else {
        // Look for reCAPTCHA element
        const recaptchaElement =
          qSelector(".g-recaptcha") ||
          qSelector("#recaptcha-element") ||
          qSelector("[data-sitekey]") ||
          qSelector('iframe[src*="recaptcha"]');

        if (recaptchaElement) {
          log("Found reCAPTCHA element, starting solver...");
          window.ateexGlobalState.captchaInProgress = true;

          // Wait for reCAPTCHA to be solved (60 seconds timeout)
          let captchaWaitTime = 0;
          const maxCaptchaWait = 60000;

          log("Waiting for reCAPTCHA to be solved...");
          while (
            !solved &&
            !window.ateexGlobalState.captchaSolved &&
            captchaWaitTime < maxCaptchaWait
          ) {
            await sleep(1000);
            captchaWaitTime += 1000;

            // Check global state
            if (window.ateexGlobalState.captchaSolved) {
              solved = true;
              log("reCAPTCHA solved by iframe!");
              break;
            }

            // Log progress every 10 seconds
            if (captchaWaitTime % 10000 === 0) {
              log(
                `Still waiting for reCAPTCHA... ${
                  captchaWaitTime / 1000
                }s elapsed`
              );
            }
          }

          if (solved || window.ateexGlobalState.captchaSolved) {
            log("reCAPTCHA solved successfully, proceeding with login");
            // Wait 2 seconds before submitting
            await sleep(2000);
          } else {
            log(
              "reCAPTCHA not solved within timeout period, attempting login anyway"
            );
          }
        } else {
          log("No reCAPTCHA found on page, proceeding with login");
        }
      }

      // STEP 6: Submit form and monitor result
      log("Step 6: Submitting login form...");

      const loginForm = qSelector('form[action*="login"]') || qSelector("form");
      if (loginForm) {
        log("Submitting login form");
        loginForm.submit();
        // Start monitoring for login result
        setTimeout(monitorLoginResult, 1000);
      } else {
        const signInButton =
          qSelector('button[type="submit"]') ||
          qSelector('input[type="submit"]') ||
          qSelector('button[class*="login"]') ||
          qSelector('button[id*="login"]');
        if (signInButton) {
          log("Clicking sign in button");
          signInButton.click();
          // Start monitoring for login result
          setTimeout(monitorLoginResult, 1000);
        } else {
          log("ERROR: No login form or submit button found");
        }
      }

      log("Login process completed, monitoring result...");
    } catch (error) {
      log("Error in handleLoginPage: " + error.message);
    }
  }

  // Xử lý trang home
  async function handleHomePage() {
    log("On home page");

    try {
      // Đợi 2-4 giây như yêu cầu
      const waitTime = Math.random() * 2000 + 2000; // 2-4 giây
      log(
        `Waiting ${Math.round(
          waitTime / 1000
        )} seconds before redirecting to earn page...`
      );
      await sleep(waitTime);

      // Chuyển đến trang earn
      log("Redirecting to earn page");
      window.location.href = "https://dash.ateex.cloud/earn";
    } catch (error) {
      log("Error in handleHomePage: " + error.message);
    }
  }

  // Setup message listener cho reload requests từ iframe
  function setupReloadListener() {
    // Chỉ setup trên main window
    if (window.top !== window.self) return;

    window.addEventListener("message", function (event) {
      if (event.data && event.data.type === "ateex_reload_required") {
        log(`Received reload request from iframe: ${event.data.reason}`);
        setTimeout(() => {
          log("Reloading main page as requested by iframe");
          window.location.reload();
        }, 1000);
      }
    });

    log("Reload listener setup completed");
  }

  // Hàm chính
  async function main() {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;

    log(`Current path: ${currentPath}`);
    log(`Current URL: ${currentUrl}`);

    // Setup reload listener trên main window
    setupReloadListener();

    // Xử lý reCAPTCHA iframe riêng biệt - KHÔNG tạo UI
    if (currentUrl.includes("recaptcha")) {
      log("Detected reCAPTCHA iframe");

      // Listen for credentials ready message from parent (with spam prevention)
      let lastCredentialsMessage = 0;
      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "ateex_credentials_ready") {
          const now = Date.now();
          // Only log once every 30 seconds to prevent spam
          if (now - lastCredentialsMessage > 30000) {
            log("Received credentials ready message from parent window");
            lastCredentialsMessage = now;
          }
          window.ateexGlobalState.credentialsReady = true;
        }
      });

      log("Checking credentials before allowing reCAPTCHA solver...");
      initCaptchaSolver();
      return; // Chỉ xử lý captcha, không làm gì khác
    }

    // Initialize UI for main pages only (credentials will be handled per page)
    if (window.top === window.self) {
      // Check if credentials already exist and set flag
      const existingCreds = loadCredentials();
      if (existingCreds && existingCreds.email && existingCreds.password) {
        CONFIG = existingCreds;
        window.ateexGlobalState.credentialsReady = true;
        log("Existing credentials found and loaded - reCAPTCHA allowed");

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
              logDebug(
                `Existing credentials message sent to ${frames.length} iframes`
              );
            }
          } catch (e) {
            logError(
              "Error sending existing credentials message: " + e.message
            );
          }
        }, 1000); // Wait 1 second for iframes to load

        // Send message to new iframes when they appear (less frequent)
        let lastIframeCount = 0;
        setInterval(() => {
          if (window.ateexGlobalState.credentialsReady) {
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

                logDebug(`Sent credentials ready to ${frames.length} iframes`);
              } catch (e) {
                // Ignore errors
              }
            }
            lastIframeCount = frames.length;
          }
        }, 5000); // Check every 5 seconds instead of 3
      }

      // Load data first, then create UI with current data
      loadSavedStats();
      createCounterUI();

      // Force immediate update to show loaded data
      updateCounter();

      if (PERFORMANCE_MODE) {
        logWarning(
          "Performance Mode ENABLED - Some features disabled for maximum speed"
        );
      }

      // Update counter more frequently for better UX
      setInterval(updateCounter, 2000); // Update every 2 seconds instead of 10
    }

    // Xử lý popup ads pages (tự động đóng)
    if (
      currentUrl.includes("clickcoin") ||
      currentUrl.includes("ads") ||
      currentUrl.includes("popup") ||
      currentPath.includes("/earn/clickcoin")
    ) {
      log("Detected ads/popup page, will auto-close");
      setTimeout(() => {
        log("Auto-closing ads page");
        window.close();
      }, Math.random() * 5000 + 8000); // 8-13 giây
      return;
    }

    // Xử lý các trang chính
    if (currentPath.includes("/earn")) {
      handleEarnPage();
    } else if (currentPath.includes("/login")) {
      handleLoginPage();
    } else if (currentPath.includes("/logout")) {
      // Xử lý trang logout - xóa dữ liệu và chuyển đến login
      log("On logout page, clearing data and redirecting to login");
      await clearBrowserData();
      setTimeout(() => {
        window.location.href = "https://dash.ateex.cloud/login";
      }, 1000);
    } else if (currentPath.includes("/home") || currentPath === "/") {
      handleHomePage();
    } else {
      log("Unknown page, no action taken");
    }
  }

  function cleanup() {
    if (captchaInterval) {
      clearInterval(captchaInterval);
    }

    const counter = document.getElementById("ateex-counter");
    if (counter) {
      counter.remove();
    }

    window.ateexAutoRunning = false;
    window.ateexCounterCreated = false;
  }

  window.addEventListener("beforeunload", cleanup);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
