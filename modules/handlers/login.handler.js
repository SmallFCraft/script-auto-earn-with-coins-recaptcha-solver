/**
 * Login Handler Module - Enhanced login page logic
 * Handles credential input, form filling, reCAPTCHA integration, and auto-submission
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const credentialsModule = AteexModules.credentialsModule;
  const domUtils = AteexModules.domUtils;
  const encryptionUtils = AteexModules.encryptionUtils;
  const errorManager = AteexModules.errorManager;
  const uiManager = AteexModules.uiManager;

  const { LOGIN_CONFIG, SECURITY_CONFIG, MESSAGE_TYPES } = constants;

  // ============= LOGIN HANDLER CLASS =============

  class LoginHandler {
    constructor() {
      this.isInitialized = false;
      this.currentCredentials = null;
      this.messageHandlers = new Map();
      this.captchaListeners = [];
      this.fallbackInterval = null;
      this.isProcessing = false;
      this.retryCount = 0;
    }

    // ============= INITIALIZATION =============

    async initialize() {
      if (this.isInitialized) {
        return true;
      }

      try {
        // Set up message handlers
        this.setupMessageHandlers();

        // Set up event listeners
        this.setupEventListeners();

        this.isInitialized = true;
        errorManager.logSuccess("Login Handler", "Initialized successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "login_handler_init",
          category: "login",
        });
        return false;
      }
    }

    // Set up message handlers for reCAPTCHA communication
    setupMessageHandlers() {
      const handleCaptchaMessage = event => {
        if (!encryptionUtils.validateMessageOrigin(event)) {
          return;
        }

        const validatedData = encryptionUtils.validateMessageData(event.data);
        if (
          !validatedData ||
          validatedData.type !== MESSAGE_TYPES.CAPTCHA_SOLVED
        ) {
          return;
        }

        errorManager.logSuccess(
          "Login",
          "✅ Received captcha solved message from iframe"
        );
        this.onCaptchaSolved(validatedData);
      };

      window.addEventListener("message", handleCaptchaMessage);
      this.messageHandlers.set("captcha_message", handleCaptchaMessage);
    }

    // Set up event listeners
    setupEventListeners() {
      // Listen for custom recaptcha events
      const handleCaptchaEvent = event => {
        errorManager.logSuccess(
          "Login",
          "✅ Received custom recaptchaSolved event"
        );
        this.onCaptchaSolved(event.detail);
      };

      window.addEventListener("recaptchaSolved", handleCaptchaEvent);
      this.captchaListeners.push(handleCaptchaEvent);
    }

    // ============= MAIN LOGIN HANDLING =============

    // Handle login page main logic
    async handleLoginPage() {
      if (this.isProcessing) {
        errorManager.logInfo("Login", "Login process already in progress");
        return;
      }

      // Check if script should run
      if (!this.shouldHandleLogin()) {
        return;
      }

      this.isProcessing = true;
      this.retryCount = 0;

      try {
        errorManager.logInfo("Login", "🔑 Starting login page handling");

        // STEP 1: Get and validate credentials
        const credentials = await this.getValidCredentials();
        if (!credentials) {
          errorManager.logWarning("Login", "No valid credentials available");
          return;
        }

        // STEP 2: Mark credentials as ready
        this.markCredentialsReady();

        // STEP 3: Wait before proceeding (randomized delay)
        await this.randomDelay();

        // STEP 4: Fill login form
        const formFilled = await this.fillLoginForm(credentials);
        if (!formFilled) {
          errorManager.logError("Login", "Failed to fill login form");
          return;
        }

        // STEP 5: Handle reCAPTCHA
        const captchaHandled = await this.handleRecaptcha();

        // STEP 6: Submit form (whether captcha succeeded or not)
        await this.attemptFormSubmission();

        // STEP 7: Set up fallback detection
        this.setupFallbackDetection();

        errorManager.logSuccess("Login", "✅ Login process completed");
      } catch (error) {
        errorManager.handleError(error, {
          context: "handle_login_page",
          category: "login",
        });
      } finally {
        this.isProcessing = false;
      }
    }

    // ============= CREDENTIAL MANAGEMENT =============

    // Get and validate credentials
    async getValidCredentials() {
      try {
        // Check if we already have valid credentials
        if (
          this.currentCredentials &&
          this.validateCredentials(this.currentCredentials)
        ) {
          return this.currentCredentials;
        }

        // Get credentials from module
        errorManager.logInfo("Login", "Getting credentials...");
        const credentials = await credentialsModule.getCredentials();

        if (!credentials) {
          errorManager.logWarning("Login", "User cancelled credential input");
          uiManager.showNotification(
            "⚠️ Login cancelled - credentials required",
            "warning"
          );
          return null;
        }

        // Validate credentials
        if (!this.validateCredentials(credentials)) {
          errorManager.logError("Login", "Invalid credentials provided");
          credentialsModule.clearCredentials();
          uiManager.showNotification(
            "❌ Invalid credentials - please check format",
            "error"
          );
          return null;
        }

        this.currentCredentials = credentials;
        errorManager.logSuccess("Login", "Valid credentials obtained");
        return credentials;
      } catch (error) {
        errorManager.handleError(error, {
          context: "get_valid_credentials",
          category: "login",
        });
        return null;
      }
    }

    // Validate credential format
    validateCredentials(credentials) {
      if (!credentials || !credentials.email || !credentials.password) {
        return false;
      }

      // Use encryption utils for validation
      return (
        encryptionUtils.isValidEmail(credentials.email) &&
        encryptionUtils.isValidPassword(credentials.password)
      );
    }

    // Mark credentials as ready
    markCredentialsReady() {
      coreModule.setState("credentialsReady", true);
      errorManager.logSuccess(
        "Login",
        "Credentials ready - reCAPTCHA can now proceed"
      );

      // Notify all iframes
      this.notifyCredentialsReady();
    }

    // Notify iframes that credentials are ready
    notifyCredentialsReady() {
      const message = {
        type: MESSAGE_TYPES.CREDENTIALS_READY,
        timestamp: Date.now(),
      };

      domUtils.sendMessageToAllFrames(message);
      errorManager.logDebug(
        "Login",
        "Notified iframes about credentials readiness"
      );
    }

    // ============= FORM HANDLING =============

    // Fill login form with credentials
    async fillLoginForm(credentials) {
      try {
        errorManager.logInfo("Login", "📝 Filling login form...");

        // Find form elements
        const formElements = this.getLoginFormElements();
        if (!formElements) {
          errorManager.logError("Login", "Could not find login form");
          return false;
        }

        const { emailInputs, passwordInputs } = formElements;

        // Fill email/username field
        if (emailInputs.length > 0) {
          const emailInput = emailInputs[0];
          await this.fillInputField(emailInput, credentials.email);
          errorManager.logInfo("Login", "✅ Email/username field filled");
        } else {
          errorManager.logError("Login", "Could not find email input field");
          return false;
        }

        // Fill password field
        if (passwordInputs.length > 0) {
          const passwordInput = passwordInputs[0];
          await this.fillInputField(passwordInput, credentials.password);
          errorManager.logInfo("Login", "✅ Password field filled");
        } else {
          errorManager.logError("Login", "Could not find password input field");
          return false;
        }

        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "fill_login_form",
          category: "login",
        });
        return false;
      }
    }

    // Get login form elements
    getLoginFormElements() {
      // Try specific login form selector first
      let formElements = domUtils.getFormElements('form[action*="login"]');

      // Fallback to any form
      if (!formElements) {
        formElements = domUtils.getFormElements("form");
      }

      return formElements;
    }

    // Fill input field with proper events
    async fillInputField(input, value) {
      if (!input || !value) return;

      // Focus the field
      input.focus();
      await this.sleep(100);

      // Clear existing value
      input.value = "";

      // Set new value
      input.value = value;

      // Trigger events for validation
      domUtils.triggerEvent(input, "input");
      domUtils.triggerEvent(input, "change");
      domUtils.triggerEvent(input, "blur");

      await this.sleep(100);
    }

    // ============= RECAPTCHA HANDLING =============

    // Handle reCAPTCHA solving
    async handleRecaptcha() {
      try {
        errorManager.logInfo("Login", "🔍 Checking reCAPTCHA status...");

        // Check if captcha was already solved
        if (coreModule.getState("captchaSolved")) {
          errorManager.logSuccess("Login", "✅ reCAPTCHA already solved");
          return true;
        }

        // Look for reCAPTCHA elements
        const recaptchaElements = domUtils.getRecaptchaElements();

        if (recaptchaElements.containers.length > 0) {
          errorManager.logInfo(
            "Login",
            "🔄 Found reCAPTCHA, waiting for solver..."
          );
          coreModule.setState("captchaInProgress", true);

          // Wait for reCAPTCHA to be solved
          const solved = await this.waitForCaptchaSolution();

          if (solved) {
            errorManager.logSuccess(
              "Login",
              "✅ reCAPTCHA solved successfully"
            );
            return true;
          } else {
            errorManager.logWarning(
              "Login",
              "⚠️ reCAPTCHA not solved within timeout"
            );
            return false;
          }
        } else {
          errorManager.logInfo("Login", "ℹ️ No reCAPTCHA found on page");
          return true;
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "handle_recaptcha",
          category: "login",
        });
        return false;
      }
    }

    // Wait for captcha solution with timeout
    async waitForCaptchaSolution() {
      const maxWaitTime = LOGIN_CONFIG.CAPTCHA_TIMEOUT;
      let waitTime = 0;
      const checkInterval = 1000;

      errorManager.logInfo(
        "Login",
        `⏱️ Starting captcha wait (max ${maxWaitTime / 1000}s)`
      );

      while (!coreModule.getState("captchaSolved") && waitTime < maxWaitTime) {
        await this.sleep(checkInterval);
        waitTime += checkInterval;

        // Log progress every 10 seconds
        if (waitTime % 10000 === 0) {
          errorManager.logInfo(
            "Login",
            `⏳ Still waiting for reCAPTCHA... ${waitTime / 1000}s elapsed`
          );
        }
      }

      const solved = coreModule.getState("captchaSolved");

      if (solved) {
        errorManager.logInfo("Login", "⏱️ Waiting for state propagation...");
        await this.sleep(3000);
      }

      return solved;
    }

    // Handle captcha solved event
    onCaptchaSolved(data) {
      coreModule.setState("captchaSolved", true);
      coreModule.setState("captchaInProgress", false);
      coreModule.setState("lastSolvedTime", data.timestamp || Date.now());

      errorManager.logInfo("Login", "🔄 Updated captcha state: solved = true");

      // Auto-submit form after delay
      setTimeout(async () => {
        if (!this.isProcessing) return;

        errorManager.logInfo(
          "Login",
          "🚀 Auto-submitting form after captcha solve..."
        );
        await this.attemptFormSubmission();
      }, 2000);
    }

    // ============= FORM SUBMISSION =============

    // Enhanced form submission with retry mechanism
    async attemptFormSubmission() {
      try {
        // Rate limiting
        if (!encryptionUtils.rateLimit("form_submission", 3, 300000)) {
          errorManager.logWarning("Login", "Form submission rate limited");
          return false;
        }

        errorManager.logInfo("Login", "🔐 Attempting form submission...");

        const maxAttempts = LOGIN_CONFIG.MAX_SUBMISSION_ATTEMPTS;
        let success = false;

        for (let attempt = 1; attempt <= maxAttempts && !success; attempt++) {
          errorManager.logInfo(
            "Login",
            `📝 Submission attempt ${attempt}/${maxAttempts}`
          );

          success = await this.tryFormSubmission(attempt);

          if (!success && attempt < maxAttempts) {
            errorManager.logWarning(
              "Login",
              `⏳ Attempt ${attempt} failed, waiting before retry...`
            );
            await this.sleep(2000);
          }
        }

        if (success) {
          errorManager.logSuccess(
            "Login",
            "✅ Form submission completed successfully"
          );
          this.startLoginMonitoring();
        } else {
          errorManager.logError(
            "Login",
            "❌ All form submission attempts failed"
          );
          this.handleSubmissionFailure();
        }

        return success;
      } catch (error) {
        errorManager.handleError(error, {
          context: "attempt_form_submission",
          category: "login",
        });
        return false;
      }
    }

    // Try single form submission
    async tryFormSubmission(attempt) {
      try {
        const formElements = this.getLoginFormElements();
        if (!formElements) {
          errorManager.logWarning("Login", "No login form found");
          return false;
        }

        const { form, emailInputs, passwordInputs, submitButtons } =
          formElements;

        // Method 1: Form submission (preferred)
        if (form && this.isFormReady(emailInputs[0], passwordInputs[0])) {
          return await this.submitForm(form, emailInputs[0], passwordInputs[0]);
        }

        // Method 2: Button click
        if (submitButtons.length > 0) {
          return await this.clickSubmitButton(submitButtons);
        }

        // Method 3: Enter key simulation (last resort)
        if (attempt >= 3 && passwordInputs.length > 0) {
          return await this.simulateEnterKey(passwordInputs[0]);
        }

        return false;
      } catch (error) {
        errorManager.logError(
          "Login",
          `Error in submission attempt: ${error.message}`
        );
        return false;
      }
    }

    // Check if form is ready for submission
    isFormReady(emailInput, passwordInput) {
      return (
        emailInput &&
        passwordInput &&
        emailInput.value &&
        passwordInput.value &&
        emailInput.value.trim().length > 0 &&
        passwordInput.value.trim().length > 0
      );
    }

    // Submit form directly
    async submitForm(form, emailInput, passwordInput) {
      try {
        // Trigger validation events
        domUtils.triggerEvent(emailInput, "blur");
        domUtils.triggerEvent(passwordInput, "blur");
        await this.sleep(500);

        // Submit form
        form.submit();
        errorManager.logSuccess("Login", "✅ Form submitted directly");
        return true;
      } catch (error) {
        errorManager.logError(
          "Login",
          `Form submission error: ${error.message}`
        );
        return false;
      }
    }

    // Click submit button
    async clickSubmitButton(submitButtons) {
      try {
        for (const button of submitButtons) {
          if (this.isButtonClickable(button)) {
            errorManager.logInfo(
              "Login",
              `🔘 Clicking button: ${
                button.textContent?.trim() || button.value || "No text"
              }`
            );

            // Focus and click with proper events
            button.focus();
            await this.sleep(100);

            domUtils.triggerEvent(button, "mousedown");
            domUtils.triggerEvent(button, "mouseup");
            button.click();

            errorManager.logSuccess("Login", "✅ Submit button clicked");
            return true;
          }
        }

        errorManager.logWarning("Login", "No clickable submit buttons found");
        return false;
      } catch (error) {
        errorManager.logError("Login", `Button click error: ${error.message}`);
        return false;
      }
    }

    // Check if button is clickable
    isButtonClickable(button) {
      return (
        button &&
        !button.disabled &&
        domUtils.isVisible(button) &&
        button.offsetParent !== null
      );
    }

    // Simulate Enter key on password field
    async simulateEnterKey(passwordField) {
      try {
        errorManager.logInfo("Login", "🔑 Simulating Enter key press");

        passwordField.focus();
        await this.sleep(100);

        const enterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
        });

        passwordField.dispatchEvent(enterEvent);
        document.dispatchEvent(enterEvent);

        errorManager.logInfo("Login", "🔑 Enter key simulation completed");
        return true;
      } catch (error) {
        errorManager.logError(
          "Login",
          `Enter key simulation error: ${error.message}`
        );
        return false;
      }
    }

    // ============= MONITORING AND FALLBACK =============

    // Start login result monitoring
    startLoginMonitoring() {
      setTimeout(() => {
        credentialsModule.monitorLoginResult();
      }, 1000);
    }

    // Handle submission failure
    handleSubmissionFailure() {
      uiManager.showNotification("❌ Login submission failed", "error");

      // Final fallback: reload page
      errorManager.logWarning(
        "Login",
        "🔄 Will reload page in 5 seconds as fallback"
      );
      setTimeout(() => {
        errorManager.logInfo(
          "Login",
          "🔄 Reloading page due to submission failure"
        );
        window.location.reload();
      }, 5000);
    }

    // Set up fallback detection for reCAPTCHA
    setupFallbackDetection() {
      if (this.fallbackInterval) {
        clearInterval(this.fallbackInterval);
      }

      let checkCount = 0;
      const maxChecks = LOGIN_CONFIG.FALLBACK_MAX_CHECKS;

      this.fallbackInterval = setInterval(() => {
        checkCount++;

        try {
          const recaptchaElements = domUtils.getRecaptchaElements();
          const hasToken = recaptchaElements.responses.some(
            el => el.value && el.value.length > 0
          );
          const hasSuccessIndicator = recaptchaElements.checkboxes.some(
            el => el.getAttribute("aria-checked") === "true"
          );

          if (hasToken || hasSuccessIndicator) {
            errorManager.logSuccess(
              "Login",
              "🎉 Fallback detection: reCAPTCHA solved!"
            );

            // Update state and attempt submission
            coreModule.setState("captchaSolved", true);
            coreModule.setState("captchaInProgress", false);

            clearInterval(this.fallbackInterval);
            this.fallbackInterval = null;

            // Trigger form submission
            setTimeout(async () => {
              await this.attemptFormSubmission();
            }, 1000);

            return;
          }

          // Log progress periodically
          if (checkCount % 5 === 0) {
            errorManager.logDebug(
              "Login",
              `⏳ Fallback check ${checkCount}/${maxChecks}`
            );
          }

          // Stop after max attempts
          if (checkCount >= maxChecks) {
            errorManager.logInfo("Login", "⏹️ Fallback detection stopped");
            clearInterval(this.fallbackInterval);
            this.fallbackInterval = null;
          }
        } catch (error) {
          errorManager.logError(
            "Login",
            `Fallback detection error: ${error.message}`
          );
        }
      }, LOGIN_CONFIG.FALLBACK_CHECK_INTERVAL);

      errorManager.logInfo("Login", "✅ Fallback detection active");
    }

    // ============= UTILITY FUNCTIONS =============

    // Check if login should be handled
    shouldHandleLogin() {
      // Check if auto stats is enabled
      if (!coreModule.getState("autoStatsEnabled")) {
        errorManager.logWarning("Login", "⏳ Waiting - auto stats not enabled");
        return false;
      }

      // Check if script is stopped
      if (window.scriptStopped) {
        errorManager.logInfo("Login", "🛑 Script stopped");
        return false;
      }

      return true;
    }

    // Random delay for human-like behavior
    async randomDelay() {
      const minDelay = LOGIN_CONFIG.MIN_DELAY;
      const maxDelay = LOGIN_CONFIG.MAX_DELAY;
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;

      errorManager.logInfo(
        "Login",
        `⏱️ Random delay: ${Math.round(delay / 1000)}s`
      );
      await this.sleep(delay);
    }

    // Sleep utility
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============= CLEANUP =============

    cleanup() {
      // Clear intervals
      if (this.fallbackInterval) {
        clearInterval(this.fallbackInterval);
        this.fallbackInterval = null;
      }

      // Remove message handlers
      this.messageHandlers.forEach((handler, type) => {
        window.removeEventListener("message", handler);
      });
      this.messageHandlers.clear();

      // Remove event listeners
      this.captchaListeners.forEach(listener => {
        window.removeEventListener("recaptchaSolved", listener);
      });
      this.captchaListeners = [];

      this.isInitialized = false;
      this.isProcessing = false;

      errorManager.logInfo("Login Handler", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const loginHandler = new LoginHandler();

  // ============= EXPORTS =============

  exports.LoginHandler = LoginHandler;
  exports.loginHandler = loginHandler;

  // Main API
  exports.initialize = () => loginHandler.initialize();
  exports.handleLoginPage = () => loginHandler.handleLoginPage();
  exports.cleanup = () => loginHandler.cleanup();

  // Advanced API
  exports.getValidCredentials = () => loginHandler.getValidCredentials();
  exports.fillLoginForm = credentials =>
    loginHandler.fillLoginForm(credentials);
  exports.handleRecaptcha = () => loginHandler.handleRecaptcha();
  exports.attemptFormSubmission = () => loginHandler.attemptFormSubmission();

  // Legacy compatibility
  exports.setupCaptchaFallbackDetection = () =>
    loginHandler.setupFallbackDetection();
})(exports);
