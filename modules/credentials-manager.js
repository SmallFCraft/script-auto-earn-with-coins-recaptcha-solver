// ============= CREDENTIALS MANAGER MODULE =============
// This module handles secure credential storage, validation, and authentication

(function() {
  "use strict";

  const context = window.ateexContext;
  const utils = context.utils;
  
  context.log("Loading Credentials Manager Module...", "INFO");

  // ============= CREDENTIAL VALIDATION =============

  // Validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate username format (alphanumeric, underscore, dash, 3-20 chars)
  function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    return usernameRegex.test(username);
  }

  // Validate username OR email
  function isValidUsernameOrEmail(input) {
    if (!input || input.trim().length === 0) {
      return false;
    }

    const trimmed = input.trim();

    // Check if it's an email
    if (trimmed.includes("@")) {
      return isValidEmail(trimmed);
    }

    // Otherwise check if it's a valid username
    return isValidUsername(trimmed);
  }

  // Validate password (minimum requirements)
  function isValidPassword(password) {
    return password && password.length >= 6;
  }

  // ============= CREDENTIAL STORAGE =============

  // Save credentials securely
  function saveCredentials(usernameOrEmail, password, enableAutoStatsAfterSave = true) {
    try {
      if (!isValidUsernameOrEmail(usernameOrEmail)) {
        throw new Error("Invalid username or email format");
      }
      if (!isValidPassword(password)) {
        throw new Error("Password must be at least 6 characters");
      }

      // Store as 'email' field for backward compatibility, but can contain username
      const credentials = JSON.stringify({
        email: usernameOrEmail.trim(),
        password,
      });
      
      const encrypted = utils.encryptData(credentials);
      const expiryTime = Date.now() + utils.APP_CONSTANTS.CREDENTIALS_EXPIRY_HOURS * 60 * 60 * 1000;

      GM_setValue(utils.STORAGE_KEYS.CREDENTIALS, encrypted);
      GM_setValue(utils.STORAGE_KEYS.CREDENTIALS_EXPIRY, expiryTime.toString());

      context.log("Credentials saved securely", "SUCCESS");

      // Enable auto stats after successful save (if requested)
      if (enableAutoStatsAfterSave) {
        enableAutoStats();
      }

      return true;
    } catch (error) {
      context.logError("Error saving credentials", error);
      return false;
    }
  }

  // Load credentials securely
  function loadCredentials() {
    try {
      const encrypted = GM_getValue(utils.STORAGE_KEYS.CREDENTIALS);
      const expiryTime = GM_getValue(utils.STORAGE_KEYS.CREDENTIALS_EXPIRY);

      if (!encrypted || !expiryTime) {
        return null;
      }

      // Check if credentials have expired
      if (Date.now() > parseInt(expiryTime)) {
        context.log("Credentials expired, clearing...", "WARNING");
        clearCredentials();
        return null;
      }

      const decrypted = utils.decryptData(encrypted);
      if (!decrypted) {
        context.log("Failed to decrypt credentials", "ERROR");
        clearCredentials();
        return null;
      }

      const credentials = JSON.parse(decrypted);

      // Validate loaded credentials (support both username and email)
      if (!isValidUsernameOrEmail(credentials.email) || !isValidPassword(credentials.password)) {
        context.log("Invalid credentials format, clearing...", "WARNING");
        clearCredentials();
        return null;
      }

      return credentials;
    } catch (error) {
      context.logError("Error loading credentials", error);
      clearCredentials();
      return null;
    }
  }

  // Clear credentials
  function clearCredentials() {
    GM_setValue(utils.STORAGE_KEYS.CREDENTIALS, undefined);
    GM_setValue(utils.STORAGE_KEYS.CREDENTIALS_EXPIRY, undefined);

    // Disable auto stats when credentials are cleared
    disableAutoStats();

    context.log("Credentials cleared", "INFO");
  }

  // ============= AUTO STATS MANAGEMENT =============

  // Enable auto stats runtime
  function enableAutoStats() {
    if (context.state.autoStatsEnabled) {
      context.logWarning("Auto stats already enabled");
      return false;
    }

    context.state.autoStatsEnabled = true;
    context.state.setupCompleted = true;
    context.state.autoStatsStartTime = Date.now();

    // Reset startTime to sync with auto stats start time for accurate runtime calculation
    context.state.startTime = context.state.autoStatsStartTime;

    // Save state to localStorage for persistence
    try {
      GM_setValue(utils.STORAGE_KEYS.AUTO_STATS_ENABLED, "true");
      GM_setValue(utils.STORAGE_KEYS.SETUP_COMPLETED, "true");
      GM_setValue(utils.STORAGE_KEYS.AUTO_STATS_START_TIME, context.state.autoStatsStartTime.toString());
    } catch (e) {
      context.logError("Failed to save runtime state", e);
    }

    context.logSuccess("🚀 Auto Stats enabled - runtime started!");

    // Emit event for other modules
    context.emit('autoStatsEnabled', { startTime: context.state.autoStatsStartTime });

    return true;
  }

  // Disable auto stats runtime
  function disableAutoStats() {
    context.state.autoStatsEnabled = false;
    context.state.setupCompleted = false;
    context.state.autoStatsStartTime = null;

    // Clear state from localStorage
    try {
      GM_setValue(utils.STORAGE_KEYS.AUTO_STATS_ENABLED, undefined);
      GM_setValue(utils.STORAGE_KEYS.SETUP_COMPLETED, undefined);
      GM_setValue(utils.STORAGE_KEYS.AUTO_STATS_START_TIME, undefined);
    } catch (e) {
      context.logError("Failed to clear runtime state", e);
    }

    context.logInfo("🛑 Auto Stats disabled");

    // Emit event for other modules
    context.emit('autoStatsDisabled', {});

    return true;
  }

  // Check if auto stats should be enabled (for existing users)
  function checkAutoStatsState() {
    try {
      const enabled = GM_getValue(utils.STORAGE_KEYS.AUTO_STATS_ENABLED) === "true";
      const setupCompleted = GM_getValue(utils.STORAGE_KEYS.SETUP_COMPLETED) === "true";
      const startTime = GM_getValue(utils.STORAGE_KEYS.AUTO_STATS_START_TIME);

      if (enabled && setupCompleted) {
        context.state.autoStatsEnabled = true;
        context.state.setupCompleted = true;
        context.state.autoStatsStartTime = startTime ? parseInt(startTime) : Date.now();

        // Sync startTime with autoStatsStartTime for consistent runtime calculation
        context.state.startTime = context.state.autoStatsStartTime;

        context.logInfo("📊 Auto Stats state restored from previous session");
        return true;
      }

      // Check if user has existing credentials (backward compatibility)
      const hasCredentials = loadCredentials() !== null;
      if (hasCredentials) {
        context.logInfo("🔄 Existing user detected - auto-enabling stats");
        return enableAutoStats();
      }

      return false;
    } catch (e) {
      context.logError("Error checking auto stats state", e);
      return false;
    }
  }

  // ============= CREDENTIAL INPUT UI =============

  // Get credentials with popup input if needed
  async function getCredentials() {
    // Try to load existing credentials first
    let credentials = loadCredentials();

    if (credentials) {
      context.log("Using saved credentials", "INFO");
      return credentials;
    }

    // If no valid credentials, prompt user
    context.log("No valid credentials found, prompting user...", "INFO");

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
            Enter your Ateex Cloud credentials to start auto-earning. They will be encrypted and stored locally.
          </p>

          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Username/Email:</label>
            <input type="text" id="ateex-email" placeholder="username or your@email.com" style="
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
        const usernameOrEmail = emailInput.value.trim();
        const password = passwordInput.value;
        const remember = rememberCheckbox.checked;

        if (!usernameOrEmail || !password) {
          showError("Please fill in both username/email and password");
          return;
        }

        if (!isValidUsernameOrEmail(usernameOrEmail)) {
          showError("Please enter a valid username or email address");
          return;
        }

        if (!isValidPassword(password)) {
          showError("Password must be at least 6 characters");
          return;
        }

        const credentials = { email: usernameOrEmail, password };

        if (remember) {
          // Save credentials and enable auto stats
          if (!saveCredentials(usernameOrEmail, password, true)) {
            showError("Failed to save credentials");
            return;
          }

          // Show success message
          showError("✅ Credentials saved! Auto Stats starting...");
          setTimeout(() => {
            document.body.removeChild(modal);
            resolve(credentials);
          }, 1500);
        } else {
          // Don't save but still enable auto stats for this session
          enableAutoStats();
          showError("✅ Auto Stats enabled for this session!");
          setTimeout(() => {
            document.body.removeChild(modal);
            resolve(credentials);
          }, 1000);
        }
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

  // ============= EXPORT TO SHARED CONTEXT =============

  // Add credential functions to context
  context.credentials = {
    save: saveCredentials,
    load: loadCredentials,
    clear: clearCredentials,
    get: getCredentials,
    validate: {
      email: isValidEmail,
      username: isValidUsername,
      usernameOrEmail: isValidUsernameOrEmail,
      password: isValidPassword
    },
    autoStats: {
      enable: enableAutoStats,
      disable: disableAutoStats,
      check: checkAutoStatsState
    }
  };

  // Add to global scope for backward compatibility
  Object.assign(window, {
    saveCredentials,
    loadCredentials,
    clearCredentials,
    getCredentials,
    enableAutoStats,
    disableAutoStats,
    checkAutoStatsState
  });

  // Mark module as loaded
  context.state.modulesLoaded['credentials-manager'] = true;
  context.modules['credentials-manager'] = context.credentials;

  context.log("Credentials Manager Module loaded successfully!", "SUCCESS");

})();
