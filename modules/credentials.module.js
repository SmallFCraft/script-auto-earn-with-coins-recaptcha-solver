/**
 * Credentials Module - Performance Optimized
 * Handles credential management with minimal overhead
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  if (!core) {
    throw new Error("Missing core dependency");
  }

  const { log, logInfo, logError, logSuccess, logWarning } = core;

  // ============= OPTIMIZED VALIDATION =============

  // Simplified validation functions - minimal overhead
  function isValidUsernameOrEmail(value) {
    if (!value || typeof value !== "string" || value.length < 3) return false;
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernamePattern = /^[a-zA-Z0-9_.-]{3,30}$/;
    
    return emailPattern.test(value) || usernamePattern.test(value);
  }

  function isValidPassword(value) {
    return value && typeof value === "string" && value.length >= 6 && value.length <= 128;
  }

  // ============= OPTIMIZED CREDENTIAL MANAGEMENT =============

  function saveCredentials(email, password) {
    try {
      const creds = {
        email: email?.trim() || "",
        password: password || "",
        timestamp: Date.now(),
      };
      localStorage.setItem("ateex_credentials", JSON.stringify(creds));
      return true;
    } catch (error) {
      logError("Save credentials error: " + error.message);
      return false;
    }
  }

  function loadCredentials() {
    try {
      const saved = localStorage.getItem("ateex_credentials");
      if (saved) {
        const creds = JSON.parse(saved);
        return creds.email && creds.password ? creds : null;
      }
    } catch (error) {
      logError("Load credentials error: " + error.message);
    }
    return null;
  }

  function clearCredentials() {
    try {
      localStorage.removeItem("ateex_credentials");
      core.state.credentialsReady = false;
      logInfo("Credentials cleared");
    } catch (error) {
      logError("Clear credentials error: " + error.message);
    }
  }

  // ============= SIMPLIFIED CREDENTIAL PROMPT =============

  async function getCredentials() {
    try {
      // Quick check for existing credentials
      const existing = loadCredentials();
      if (existing?.email && existing?.password) {
        if (isValidUsernameOrEmail(existing.email) && isValidPassword(existing.password)) {
          core.state.autoStatsEnabled = true;
          core.saveAutoStatsState();
          logSuccess("Loaded existing credentials");
          return existing;
        } else {
          clearCredentials();
        }
      }

      // Quick UI creation with better styling
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 999999; display: flex;
        align-items: center; justify-content: center; font-family: Arial;
      `;

      const content = document.createElement("div");
      content.style.cssText = `
        background: white; padding: 30px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        width: 400px; max-width: 90vw;
      `;

      content.innerHTML = `
        <h2 style="margin: 0 0 20px 0; color: #333; text-align: center;">Ateex Auto Script Setup</h2>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Email/Username:</label>
          <input type="text" id="ateex-email" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px;" placeholder="Enter your email or username">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">Password:</label>
          <input type="password" id="ateex-password" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px;" placeholder="Enter your password">
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="ateex-save" style="flex: 1; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold;">Start Auto Script</button>
          <button id="ateex-cancel" style="flex: 1; padding: 12px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold;">Cancel</button>
        </div>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);

      // Quick promise-based handling
      return new Promise((resolve) => {
        const emailInput = content.querySelector("#ateex-email");
        const passwordInput = content.querySelector("#ateex-password");
        const saveBtn = content.querySelector("#ateex-save");
        const cancelBtn = content.querySelector("#ateex-cancel");

        const cleanup = () => {
          document.body.removeChild(modal);
        };

        const validate = () => {
          const email = emailInput.value.trim();
          const password = passwordInput.value;
          
          if (!email || !password) {
            saveBtn.style.opacity = "0.5";
            saveBtn.disabled = true;
            return false;
          }
          
          if (!isValidUsernameOrEmail(email)) {
            saveBtn.textContent = "Invalid Email/Username";
            saveBtn.style.backgroundColor = "#ff9800";
            return false;
          }
          
          if (!isValidPassword(password)) {
            saveBtn.textContent = "Password too short";
            saveBtn.style.backgroundColor = "#ff9800";
            return false;
          }
          
          saveBtn.textContent = "Start Auto Script";
          saveBtn.style.backgroundColor = "#4CAF50";
          saveBtn.style.opacity = "1";
          saveBtn.disabled = false;
          return true;
        };

        // Real-time validation
        emailInput.addEventListener("input", validate);
        passwordInput.addEventListener("input", validate);

        // Quick Enter key handling
        const handleEnter = (e) => {
          if (e.key === "Enter" && validate()) {
            saveBtn.click();
          }
        };
        emailInput.addEventListener("keydown", handleEnter);
        passwordInput.addEventListener("keydown", handleEnter);

        saveBtn.addEventListener("click", () => {
          const email = emailInput.value.trim();
          const password = passwordInput.value;

          if (validate() && saveCredentials(email, password)) {
            core.state.autoStatsEnabled = true;
            core.saveAutoStatsState();
            cleanup();
            logSuccess("Credentials saved - Auto Script enabled");
            resolve({ email, password });
          }
        });

        cancelBtn.addEventListener("click", () => {
          cleanup();
          logWarning("Setup cancelled by user");
          resolve(null);
        });

        // Quick focus and initial validation
        setTimeout(() => {
          emailInput.focus();
          validate();
        }, 100);
      });

    } catch (error) {
      logError("Credential prompt error: " + error.message);
      return null;
    }
  }

  // ============= OPTIMIZED LOGIN MONITORING =============

  function monitorLoginResult() {
    let checkCount = 0;
    const maxChecks = 15; // Reduced from 30 to 15

    const monitorInterval = setInterval(() => {
      checkCount++;

      try {
        const currentUrl = window.location.href;

        // Quick success detection
        if (currentUrl.includes("/home") || currentUrl.includes("/dashboard") || 
            currentUrl.includes("/earn") || currentUrl === "https://dash.ateex.cloud/") {
          
          clearInterval(monitorInterval);
          logSuccess("✅ Login successful - redirected to: " + currentUrl);
          
          // Quick redirect to earn page
          setTimeout(() => {
            if (currentUrl.includes("/home") || currentUrl === "https://dash.ateex.cloud/") {
              window.location.href = "https://dash.ateex.cloud/earn";
            }
          }, 1500); // Reduced from 2s to 1.5s
          return;
        }

        // Quick error detection
        if (currentUrl.includes("/login")) {
          const errorSelectors = [
            ".alert-danger", ".error", ".invalid-feedback", 
            "[class*='error']", "[id*='error']"
          ];

          for (const selector of errorSelectors) {
            const errorElement = document.querySelector(selector);
            if (errorElement?.textContent?.trim()) {
              clearInterval(monitorInterval);
              logError("❌ Login failed: " + errorElement.textContent.trim());
              clearCredentials();
              return;
            }
          }
        }

        if (checkCount >= maxChecks) {
          clearInterval(monitorInterval);
          logWarning("⚠️ Login monitoring timeout");
        }
      } catch (error) {
        logError("Monitor error: " + error.message);
      }
    }, 2000); // Check every 2 seconds

    // Quick cleanup after max time
    setTimeout(() => clearInterval(monitorInterval), maxChecks * 2000);
  }

  // ============= EXPORTS =============
  exports.getCredentials = getCredentials;
  exports.saveCredentials = saveCredentials;
  exports.loadCredentials = loadCredentials;
  exports.clearCredentials = clearCredentials;
  exports.isValidUsernameOrEmail = isValidUsernameOrEmail;
  exports.isValidPassword = isValidPassword;
  exports.monitorLoginResult = monitorLoginResult;
})(exports);
