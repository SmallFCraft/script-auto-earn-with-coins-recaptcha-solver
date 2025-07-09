/**
 * Credentials Module - Secure credential management with advanced encryption
 * Handles user authentication, credential storage, validation, and UI
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const encryptionUtils = AteexModules.encryptionUtils;
  const storageManager = AteexModules.storageManager;
  const errorManager = AteexModules.errorManager;
  const domUtils = AteexModules.domUtils;

  const { STORAGE_CONFIG, SECURITY_CONFIG, UI_CONFIG, ATEEX_CONFIG } =
    constants;

  // ============= CREDENTIAL MANAGEMENT CLASS =============

  class CredentialsManager {
    constructor() {
      this.credentialsKey = STORAGE_CONFIG.KEYS.CREDENTIALS;
      this.credentialsExpiryKey = STORAGE_CONFIG.KEYS.CREDENTIALS_EXPIRY;
      this.expiryDuration = STORAGE_CONFIG.EXPIRY.CREDENTIALS;
      this.isProcessing = false;
    }

    // ============= VALIDATION FUNCTIONS =============

    isValidEmail(email) {
      return encryptionUtils.validateEmail(email);
    }

    isValidUsername(username) {
      return encryptionUtils.validateUsername(username);
    }

    // Validate username OR email
    isValidUsernameOrEmail(input) {
      if (!input || typeof input !== "string" || input.trim().length === 0) {
        return false;
      }

      const sanitized = encryptionUtils.sanitizeInput(input.trim());

      // Check if it's an email
      if (sanitized.includes("@")) {
        return this.isValidEmail(sanitized);
      }

      // Otherwise check if it's a valid username
      return this.isValidUsername(sanitized);
    }

    // Validate password with enhanced security
    isValidPassword(password) {
      return encryptionUtils.validatePassword(password);
    }

    // Check password strength
    checkPasswordStrength(password) {
      return encryptionUtils.checkPasswordStrength(password);
    }

    // ============= SECURE STORAGE OPERATIONS =============

    // Save credentials securely with rate limiting
    async saveCredentials(
      usernameOrEmail,
      password,
      enableAutoStatsAfterSave = true
    ) {
      try {
        // Rate limiting for save operations
        if (!encryptionUtils.advancedRateLimit("CREDENTIAL_SAVE")) {
          throw new Error("Too many save attempts. Please wait.");
        }

        if (!this.isValidUsernameOrEmail(usernameOrEmail)) {
          throw new Error("Invalid username or email format");
        }

        if (!this.isValidPassword(password)) {
          throw new Error(
            `Password must be at least ${SECURITY_CONFIG.VALIDATION.PASSWORD_MIN_LENGTH} characters`
          );
        }

        // Check password strength and warn if weak
        const strength = this.checkPasswordStrength(password);
        if (strength.strength === "weak") {
          errorManager.logWarning(
            "Password Strength",
            "Weak password detected",
            {
              suggestions: strength.suggestions,
            }
          );
        }

        // Store as 'email' field for backward compatibility, but can contain username
        const credentials = {
          email: encryptionUtils.sanitizeInput(usernameOrEmail.trim()),
          password: password, // Don't sanitize password to preserve exact input
          timestamp: Date.now(),
          version: "4.0.0",
        };

        const success = await encryptionUtils.secureStorage.setItem(
          this.credentialsKey,
          credentials
        );

        if (!success) {
          throw new Error("Failed to encrypt and save credentials");
        }

        // Set expiry time
        const expiryTime = Date.now() + this.expiryDuration;
        storageManager.set(this.credentialsExpiryKey, expiryTime.toString());

        errorManager.logSuccess(
          "Credentials",
          "Credentials saved securely with AES-GCM encryption"
        );

        // Enable auto stats after successful save (if requested)
        if (enableAutoStatsAfterSave && coreModule.enableFeature) {
          coreModule.enableFeature("autoStats");
        }

        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "credential_save",
          category: "authentication",
          severity: "medium",
        });
        return false;
      }
    }

    // Load credentials securely with validation
    async loadCredentials() {
      try {
        // Rate limiting for load operations
        if (!encryptionUtils.advancedRateLimit("CREDENTIAL_LOAD")) {
          return null;
        }

        const expiryTime = storageManager.get(this.credentialsExpiryKey);

        if (!expiryTime) {
          return null;
        }

        // Check if credentials have expired
        if (Date.now() > parseInt(expiryTime)) {
          errorManager.logInfo(
            "Credentials",
            "Credentials expired, clearing..."
          );
          this.clearCredentials();
          return null;
        }

        const credentials = await encryptionUtils.secureStorage.getItem(
          this.credentialsKey
        );

        if (!credentials) {
          errorManager.logInfo(
            "Credentials",
            "No credentials found or decryption failed"
          );
          return null;
        }

        // Validate loaded credentials structure
        if (!credentials.email || !credentials.password) {
          errorManager.logWarning(
            "Credentials",
            "Invalid credential structure, clearing..."
          );
          this.clearCredentials();
          return null;
        }

        // Validate loaded credentials (support both username and email)
        if (
          !this.isValidUsernameOrEmail(credentials.email) ||
          !this.isValidPassword(credentials.password)
        ) {
          errorManager.logWarning(
            "Credentials",
            "Invalid credentials format, clearing..."
          );
          this.clearCredentials();
          return null;
        }

        errorManager.logInfo(
          "Credentials",
          "Credentials loaded and validated successfully"
        );
        return credentials;
      } catch (error) {
        errorManager.handleError(error, {
          context: "credential_load",
          category: "authentication",
          severity: "low",
        });
        this.clearCredentials();
        return null;
      }
    }

    // Clear credentials and related data
    clearCredentials() {
      try {
        encryptionUtils.secureStorage.removeItem(this.credentialsKey);
        storageManager.remove(this.credentialsExpiryKey);

        // Disable auto stats when credentials are cleared
        if (coreModule.disableFeature) {
          coreModule.disableFeature("autoStats");
        }

        // Clear rate limits for credential operations
        encryptionUtils.clearRateLimit("CREDENTIAL_SAVE");
        encryptionUtils.clearRateLimit("CREDENTIAL_LOAD");

        errorManager.logInfo("Credentials", "Credentials cleared successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "credential_clear",
          category: "authentication",
          severity: "low",
        });
        return false;
      }
    }

    // Check if credentials exist and are valid
    async hasValidCredentials() {
      const credentials = await this.loadCredentials();
      return credentials !== null;
    }

    // ============= CREDENTIAL INPUT UI =============

    // Get credentials with enhanced popup input if needed
    async getCredentials() {
      // Prevent multiple concurrent credential requests
      if (this.isProcessing) {
        errorManager.logInfo(
          "Credentials",
          "Credential request already in progress"
        );
        return null;
      }

      try {
        this.isProcessing = true;

        // Try to load existing credentials first
        let credentials = await this.loadCredentials();

        if (credentials) {
          errorManager.logInfo("Credentials", "Using saved credentials");
          return credentials;
        }

        // If no valid credentials, prompt user
        errorManager.logInfo(
          "Credentials",
          "No valid credentials found, prompting user..."
        );

        return await this.showCredentialsModal();
      } finally {
        this.isProcessing = false;
      }
    }

    // Enhanced credentials modal with better UX
    async showCredentialsModal() {
      return new Promise(resolve => {
        // Create modal backdrop
        const modal = domUtils.createElement(
          "div",
          {},
          {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.8)",
            zIndex: UI_CONFIG.MODAL.Z_INDEX,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          }
        );

        modal.innerHTML = `
          <div style="
            background: linear-gradient(135deg, ${UI_CONFIG.COLORS.PRIMARY} 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            color: white;
            max-width: 450px;
            width: 90%;
            animation: modalFadeIn 0.3s ease-out;
          ">
            <style>
              @keyframes modalFadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
              }
            </style>
            
            <h2 style="margin: 0 0 20px 0; text-align: center; display: flex; align-items: center; justify-content: center;">
              🔐 <span style="margin-left: 10px;">Ateex Auto Login v4.0</span>
            </h2>
            
            <p style="margin: 0 0 25px 0; text-align: center; opacity: 0.9; line-height: 1.4;">
              Enter your Ateex Cloud credentials to start auto-earning. They will be encrypted with AES-GCM and stored securely.
            </p>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                📧 Username/Email:
              </label>
              <input type="text" id="ateex-email" placeholder="username or your@email.com" style="
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                box-sizing: border-box;
                background: rgba(255,255,255,0.9);
                color: #333;
              ">
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                🔒 Password:
              </label>
              <div style="position: relative;">
                <input type="password" id="ateex-password" placeholder="Your password" style="
                  width: 100%;
                  padding: 12px;
                  border: none;
                  border-radius: 8px;
                  font-size: 14px;
                  box-sizing: border-box;
                  background: rgba(255,255,255,0.9);
                  color: #333;
                  padding-right: 40px;
                ">
                <button type="button" id="ateex-toggle-password" style="
                  position: absolute;
                  right: 8px;
                  top: 50%;
                  transform: translateY(-50%);
                  background: none;
                  border: none;
                  cursor: pointer;
                  font-size: 18px;
                " title="Toggle password visibility">👁️</button>
              </div>
              <div id="password-strength" style="
                margin-top: 5px;
                font-size: 12px;
                height: 16px;
              "></div>
            </div>

            <div style="margin-bottom: 25px;">
              <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="ateex-remember" checked style="
                  margin-right: 8px;
                  transform: scale(1.2);
                ">
                <span style="font-size: 13px; opacity: 0.9;">
                  💾 Remember for 24 hours (AES-GCM encrypted)
                </span>
              </label>
            </div>

            <div style="display: flex; gap: 12px;">
              <button id="ateex-cancel" style="
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 8px;
                background: rgba(255,255,255,0.2);
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
              ">❌ Cancel</button>
              <button id="ateex-save" style="
                flex: 2;
                padding: 12px;
                border: none;
                border-radius: 8px;
                background: rgba(255,255,255,0.9);
                color: #333;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: background 0.2s;
              ">💾 Save & Continue</button>
            </div>

            <div id="ateex-error" style="
              margin-top: 15px;
              padding: 12px;
              background: rgba(255,0,0,0.2);
              border-radius: 8px;
              font-size: 13px;
              display: none;
              border-left: 4px solid rgba(255,255,255,0.5);
            "></div>
          </div>
        `;

        document.body.appendChild(modal);

        // Get form elements
        const emailInput = document.getElementById("ateex-email");
        const passwordInput = document.getElementById("ateex-password");
        const togglePasswordBtn = document.getElementById(
          "ateex-toggle-password"
        );
        const passwordStrengthDiv =
          document.getElementById("password-strength");
        const rememberCheckbox = document.getElementById("ateex-remember");
        const errorDiv = document.getElementById("ateex-error");
        const saveButton = document.getElementById("ateex-save");
        const cancelButton = document.getElementById("ateex-cancel");

        // Focus email input with delay for better UX
        setTimeout(() => emailInput.focus(), 300);

        // Password visibility toggle
        togglePasswordBtn.onclick = () => {
          const isPassword = passwordInput.type === "password";
          passwordInput.type = isPassword ? "text" : "password";
          togglePasswordBtn.textContent = isPassword ? "🙈" : "👁️";
        };

        // Real-time password strength checking
        passwordInput.oninput = () => {
          const password = passwordInput.value;
          if (password.length === 0) {
            passwordStrengthDiv.textContent = "";
            return;
          }

          const strength = this.checkPasswordStrength(password);
          const colors = {
            invalid: "#ff4444",
            weak: "#ff8800",
            medium: "#ffcc00",
            strong: "#44aa44",
            "very-strong": "#00aa00",
          };

          passwordStrengthDiv.style.color = colors[strength.strength] || "#fff";
          passwordStrengthDiv.textContent = `Strength: ${strength.strength}${
            strength.suggestions.length > 0
              ? " - " + strength.suggestions[0]
              : ""
          }`;
        };

        // Enhanced error display function
        const showError = (message, isSuccess = false) => {
          errorDiv.textContent = message;
          errorDiv.style.display = "block";
          errorDiv.style.background = isSuccess
            ? "rgba(76,175,80,0.2)"
            : "rgba(255,0,0,0.2)";
          errorDiv.style.borderLeftColor = isSuccess
            ? "rgba(76,175,80,0.8)"
            : "rgba(255,0,0,0.8)";

          setTimeout(
            () => {
              errorDiv.style.display = "none";
            },
            isSuccess ? 2000 : 5000
          );
        };

        // Save button handler
        saveButton.onclick = async () => {
          const usernameOrEmail = emailInput.value.trim();
          const password = passwordInput.value;
          const remember = rememberCheckbox.checked;

          if (!usernameOrEmail || !password) {
            showError("Please fill in both username/email and password");
            return;
          }

          if (!this.isValidUsernameOrEmail(usernameOrEmail)) {
            showError("Please enter a valid username or email address");
            return;
          }

          if (!this.isValidPassword(password)) {
            showError(
              `Password must be at least ${SECURITY_CONFIG.VALIDATION.PASSWORD_MIN_LENGTH} characters`
            );
            return;
          }

          // Disable save button during processing
          saveButton.disabled = true;
          saveButton.textContent = "⏳ Saving...";

          try {
            const credentials = { email: usernameOrEmail, password };

            if (remember) {
              // Save credentials and enable auto stats
              const saved = await this.saveCredentials(
                usernameOrEmail,
                password,
                true
              );
              if (!saved) {
                showError("Failed to save credentials");
                return;
              }

              // Show success message
              showError("✅ Credentials saved! Auto Stats starting...", true);
              setTimeout(() => {
                document.body.removeChild(modal);
                resolve(credentials);
              }, 1500);
            } else {
              // Don't save but still enable auto stats for this session
              if (coreModule.enableFeature) {
                coreModule.enableFeature("autoStats");
              }
              showError("✅ Auto Stats enabled for this session!", true);
              setTimeout(() => {
                document.body.removeChild(modal);
                resolve(credentials);
              }, 1000);
            }
          } catch (error) {
            errorManager.handleError(error, {
              context: "credential_modal_save",
            });
            showError("An error occurred while saving credentials");
          } finally {
            saveButton.disabled = false;
            saveButton.textContent = "💾 Save & Continue";
          }
        };

        // Cancel button handler
        cancelButton.onclick = () => {
          domUtils.fadeOut(modal, 200).then(() => {
            document.body.removeChild(modal);
            resolve(null);
          });
        };

        // Enhanced keyboard handlers
        modal.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveButton.click();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelButton.click();
          }
        });

        // Hover effects
        saveButton.onmouseenter = () => {
          saveButton.style.background = "rgba(255,255,255,1)";
        };
        saveButton.onmouseleave = () => {
          saveButton.style.background = "rgba(255,255,255,0.9)";
        };

        cancelButton.onmouseenter = () => {
          cancelButton.style.background = "rgba(255,255,255,0.3)";
        };
        cancelButton.onmouseleave = () => {
          cancelButton.style.background = "rgba(255,255,255,0.2)";
        };
      });
    }

    // ============= LOGIN ERROR DETECTION =============

    // Enhanced login error detection
    detectLoginErrors() {
      // Common error selectors for login failures
      const errorSelectors = [
        ".alert-danger",
        ".error-message",
        ".login-error",
        '[class*="error"]',
        '[id*="error"]',
        ".invalid-feedback",
        ".text-danger",
        ".form-error",
        ".validation-error",
      ];

      for (const selector of errorSelectors) {
        const errorElements = domUtils.qSelectorAll(selector);

        for (const errorElement of errorElements) {
          if (errorElement && domUtils.isVisible(errorElement)) {
            const errorText = errorElement.textContent.trim().toLowerCase();

            if (this.isCredentialError(errorText)) {
              errorManager.logError(
                "Login Error",
                `Login error detected: ${errorText}`
              );

              // Clear potentially invalid credentials
              this.clearCredentials();

              // Log security event
              encryptionUtils.logSecurityEvent("login_failure", {
                errorText: errorText,
                selector: selector,
                url: window.location.href,
              });

              return true;
            }
          }
        }
      }

      return false;
    }

    // Check if error text indicates credential issues
    isCredentialError(errorText) {
      const credentialErrorKeywords = [
        "invalid",
        "incorrect",
        "wrong",
        "failed",
        "email",
        "password",
        "login",
        "authentication",
        "credentials",
        "unauthorized",
        "access denied",
        "bad login",
        "signin failed",
        "user not found",
      ];

      return credentialErrorKeywords.some(keyword =>
        errorText.includes(keyword)
      );
    }

    // Enhanced login monitoring with better detection
    monitorLoginResult() {
      let attempts = 0;
      const maxAttempts = 15; // Monitor for 15 seconds
      const startUrl = window.location.href;

      errorManager.logInfo(
        "Login Monitor",
        "Starting login result monitoring..."
      );

      const checkInterval = setInterval(() => {
        attempts++;

        // Check for login errors
        if (this.detectLoginErrors()) {
          clearInterval(checkInterval);
          errorManager.logWarning(
            "Login Monitor",
            "Login failed - credentials cleared"
          );
          return;
        }

        // Check if URL changed (successful login)
        const currentUrl = window.location.href;
        if (currentUrl !== startUrl) {
          errorManager.logSuccess(
            "Login Monitor",
            "Login successful - URL changed"
          );
          clearInterval(checkInterval);
          return;
        }

        // Check if we're no longer on login page
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/login")) {
          errorManager.logSuccess(
            "Login Monitor",
            "Login successful - redirected away from login page"
          );
          clearInterval(checkInterval);
          return;
        }

        // Check for success indicators
        const successSelectors = [
          ".alert-success",
          ".success-message",
          '[class*="success"]',
        ];

        for (const selector of successSelectors) {
          const successElement = domUtils.qSelector(selector);
          if (successElement && domUtils.isVisible(successElement)) {
            errorManager.logSuccess(
              "Login Monitor",
              "Login success indicator found"
            );
            clearInterval(checkInterval);
            return;
          }
        }

        // Stop monitoring after max attempts
        if (attempts >= maxAttempts) {
          errorManager.logInfo(
            "Login Monitor",
            "Login monitoring timeout - no clear result detected"
          );
          clearInterval(checkInterval);
        }
      }, 1000);
    }
  }

  // ============= SINGLETON INSTANCE =============

  const credentialsManager = new CredentialsManager();

  // ============= EXPORTS =============

  exports.CredentialsManager = CredentialsManager;
  exports.credentialsManager = credentialsManager;

  // Main API
  exports.saveCredentials = (
    usernameOrEmail,
    password,
    enableAutoStatsAfterSave
  ) =>
    credentialsManager.saveCredentials(
      usernameOrEmail,
      password,
      enableAutoStatsAfterSave
    );
  exports.loadCredentials = () => credentialsManager.loadCredentials();
  exports.clearCredentials = () => credentialsManager.clearCredentials();
  exports.getCredentials = () => credentialsManager.getCredentials();
  exports.hasValidCredentials = () => credentialsManager.hasValidCredentials();

  // Validation functions
  exports.isValidEmail = email => credentialsManager.isValidEmail(email);
  exports.isValidUsername = username =>
    credentialsManager.isValidUsername(username);
  exports.isValidUsernameOrEmail = input =>
    credentialsManager.isValidUsernameOrEmail(input);
  exports.isValidPassword = password =>
    credentialsManager.isValidPassword(password);
  exports.checkPasswordStrength = password =>
    credentialsManager.checkPasswordStrength(password);

  // Error detection and monitoring
  exports.detectLoginErrors = () => credentialsManager.detectLoginErrors();
  exports.monitorLoginResult = () => credentialsManager.monitorLoginResult();
})(exports);
