/**
 * ReCAPTCHA Module - Advanced reCAPTCHA solver with AI integration
 * Handles reCAPTCHA solving, audio processing, and cross-frame messaging
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const serverManager = AteexModules.serverManager;
  const errorManager = AteexModules.errorManager;
  const domUtils = AteexModules.domUtils;
  const encryptionUtils = AteexModules.encryptionUtils;

  const { RECAPTCHA_CONFIG, MESSAGE_TYPES, UI_CONFIG, PERFORMANCE_CONFIG } =
    constants;

  // ============= RECAPTCHA SOLVER CLASS =============

  class ReCaptchaSolver {
    constructor() {
      this.solved = false;
      this.checkBoxClicked = false;
      this.waitingForAudioResponse = false;
      this.captchaInterval = null;
      this.requestCount = 0;
      this.maxAttempts = RECAPTCHA_CONFIG.MAX_ATTEMPTS;
      this.recaptchaLanguage = "en-US";
      this.recaptchaInitialStatus = "";
      this.audioUrl = "";
      this.isInitialized = false;
      this.solverState = "idle"; // idle, running, paused, completed, failed
      this.startTime = null;
      this.credentials = null;
    }

    // ============= INITIALIZATION =============

    async initialize() {
      try {
        if (this.isInitialized) {
          return true;
        }

        // Initialize server manager
        await serverManager.initialize();

        // Initialize reCAPTCHA variables
        this.initRecaptchaVars();

        // Set up event listeners
        this.setupEventListeners();

        this.isInitialized = true;
        errorManager.logSuccess("ReCAPTCHA Solver", "Initialized successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "recaptcha_solver_init",
          category: "recaptcha",
        });
        return false;
      }
    }

    // Initialize reCAPTCHA variables from DOM
    initRecaptchaVars() {
      try {
        // Detect language
        const htmlElement = domUtils.qSelector("html");
        if (htmlElement) {
          this.recaptchaLanguage = htmlElement.getAttribute("lang") || "en-US";
        }

        // Get initial status
        const statusElement = domUtils.qSelector(
          RECAPTCHA_CONFIG.SELECTORS.STATUS
        );
        if (statusElement) {
          this.recaptchaInitialStatus = statusElement.innerText || "";
        }

        errorManager.logInfo(
          "ReCAPTCHA Init",
          `Language: ${this.recaptchaLanguage}`
        );
      } catch (error) {
        errorManager.handleError(error, {
          context: "init_recaptcha_vars",
          category: "recaptcha",
        });
      }
    }

    // Set up event listeners for messages and events
    setupEventListeners() {
      // Listen for solved messages from other frames
      window.addEventListener("message", event => {
        if (encryptionUtils.validateMessageOrigin(event)) {
          const data = encryptionUtils.validateMessageData(event.data);
          if (data && data.type === MESSAGE_TYPES.CAPTCHA_SOLVED) {
            this.handleCaptchaSolvedMessage(data);
          }
        }
      });

      // Listen for custom events
      window.addEventListener("recaptchaSolved", event => {
        this.handleCaptchaSolvedEvent(event.detail);
      });
    }

    // ============= MAIN SOLVER LOGIC =============

    // Start the reCAPTCHA solving process
    async startSolver() {
      try {
        // Check prerequisites
        if (!(await this.checkPrerequisites())) {
          return false;
        }

        // Check if already solved
        if (this.solved || coreModule.getState("captchaSolved")) {
          errorManager.logInfo("ReCAPTCHA", "Already solved, skipping");
          return true;
        }

        // Check if solver already running
        if (this.solverState === "running" && this.captchaInterval) {
          errorManager.logInfo("ReCAPTCHA", "Solver already running, skipping");
          return true;
        }

        // Auto-test servers if needed
        await serverManager.autoTestIfNeeded();

        this.solverState = "running";
        this.startTime = Date.now();
        coreModule.setState("captchaInProgress", true);

        errorManager.logInfo("ReCAPTCHA", "Starting solver...");

        // Initialize checkbox interaction
        await this.initializeCheckbox();

        // Start main solving loop
        this.startSolvingLoop();

        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "start_solver",
          category: "recaptcha",
        });
        this.solverState = "failed";
        return false;
      }
    }

    // Check if prerequisites are met for solving
    async checkPrerequisites() {
      // Check credentials readiness
      const credentialsReady = await this.checkCredentialsReady();
      if (!credentialsReady) {
        errorManager.logWarning(
          "ReCAPTCHA",
          "Credentials not ready, waiting..."
        );
        setTimeout(() => this.startSolver(), 2000);
        return false;
      }

      // Check cooldown period
      const cooldownRemaining = this.checkCooldownPeriod();
      if (cooldownRemaining > 0) {
        errorManager.logWarning(
          "ReCAPTCHA",
          `Cooldown active, waiting ${Math.ceil(cooldownRemaining / 1000)}s`
        );
        setTimeout(() => this.startSolver(), 5000);
        return false;
      }

      return true;
    }

    // Check if credentials are ready (supports both iframe and main window)
    async checkCredentialsReady() {
      let credentialsReady = coreModule.getState("credentialsReady");

      // If in iframe, check parent window
      if (window.top !== window.self) {
        try {
          if (window.top.ateexGlobalState?.credentialsReady) {
            credentialsReady = true;
            coreModule.setState("credentialsReady", true);
          }
        } catch (e) {
          // Cross-origin access blocked, use message passing
          this.requestCredentialsStatus();
        }
      }

      return credentialsReady;
    }

    // Check cooldown period after automated queries
    checkCooldownPeriod() {
      const lastAutomatedQueriesTime = coreModule.getState(
        "lastAutomatedQueriesTime"
      );
      if (!lastAutomatedQueriesTime) return 0;

      const timeSinceLastError = Date.now() - lastAutomatedQueriesTime;
      const cooldownPeriod = RECAPTCHA_CONFIG.COOLDOWN_PERIOD;

      return Math.max(0, cooldownPeriod - timeSinceLastError);
    }

    // Initialize checkbox interaction
    async initializeCheckbox() {
      const checkbox = domUtils.qSelector(RECAPTCHA_CONFIG.SELECTORS.CHECKBOX);
      if (checkbox && !domUtils.isHidden(checkbox)) {
        domUtils.click(checkbox);
        this.checkBoxClicked = true;
        errorManager.logInfo("ReCAPTCHA", "Checkbox clicked");
      }
    }

    // Start the main solving loop
    startSolvingLoop() {
      // Clear existing interval
      if (this.captchaInterval) {
        clearInterval(this.captchaInterval);
      }

      this.captchaInterval = setInterval(async () => {
        try {
          await this.solvingStep();
        } catch (error) {
          errorManager.handleError(error, {
            context: "solving_step",
            category: "recaptcha",
          });
          this.stopSolver("failed");
        }
      }, RECAPTCHA_CONFIG.SOLVER_INTERVAL);
    }

    // Single step of the solving process
    async solvingStep() {
      // Check if solved
      if (this.checkSolvedStatus()) {
        this.onSolverSuccess();
        return;
      }

      // Check max attempts
      if (this.requestCount > this.maxAttempts) {
        errorManager.logWarning(
          "ReCAPTCHA",
          "Max attempts reached, stopping solver"
        );
        this.stopSolver("failed");
        return;
      }

      // Check for automated queries detection
      if (this.checkAutomatedQueries()) {
        await this.handleAutomatedQueries();
        return;
      }

      // Handle checkbox if not clicked
      if (!this.checkBoxClicked) {
        this.handleCheckboxClick();
      }

      // Handle audio challenge
      await this.handleAudioChallenge();
    }

    // Check if reCAPTCHA is solved
    checkSolvedStatus() {
      const statusElement = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.STATUS
      );
      if (
        statusElement &&
        statusElement.innerText !== this.recaptchaInitialStatus
      ) {
        return true;
      }

      // Additional checks for solved state
      const successIndicators = [
        ".recaptcha-success",
        '[data-recaptcha-status="solved"]',
        '.rc-anchor-normal[aria-checked="true"]',
      ];

      return successIndicators.some(selector => {
        const element = domUtils.qSelector(selector);
        return element && domUtils.isVisible(element);
      });
    }

    // Handle checkbox click
    handleCheckboxClick() {
      const checkbox = domUtils.qSelector(RECAPTCHA_CONFIG.SELECTORS.CHECKBOX);
      if (checkbox && !domUtils.isHidden(checkbox)) {
        domUtils.click(checkbox);
        this.checkBoxClicked = true;
        errorManager.logInfo("ReCAPTCHA", "Checkbox clicked");
      }
    }

    // Handle audio challenge solving
    async handleAudioChallenge() {
      // Click audio button if available
      const audioButton = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_BUTTON
      );
      const imageSelect = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.IMAGE_SELECT
      );

      if (audioButton && !domUtils.isHidden(audioButton) && imageSelect) {
        domUtils.click(audioButton);
        errorManager.logInfo("ReCAPTCHA", "Audio button clicked");
        return;
      }

      // Handle reload if needed
      if (this.shouldReload()) {
        this.handleReload();
        return;
      }

      // Process audio if available
      if (this.shouldProcessAudio()) {
        await this.processAudio();
      }
    }

    // Check if reload is needed
    shouldReload() {
      const reloadButton = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.RELOAD_BUTTON
      );
      const audioErrorMessage = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_ERROR_MESSAGE
      );
      const audioSource = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_SOURCE
      );

      return (
        (!this.waitingForAudioResponse &&
          audioSource &&
          audioSource.src &&
          this.audioUrl === audioSource.src &&
          reloadButton) ||
        (audioErrorMessage &&
          audioErrorMessage.innerText.length > 0 &&
          reloadButton &&
          !reloadButton.disabled)
      );
    }

    // Handle reload button click
    handleReload() {
      const reloadButton = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.RELOAD_BUTTON
      );
      if (reloadButton) {
        domUtils.click(reloadButton);
        errorManager.logInfo("ReCAPTCHA", "Reload button clicked");
      }
    }

    // Check if audio should be processed
    shouldProcessAudio() {
      const responseField = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.RESPONSE_FIELD
      );
      const audioResponse = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_RESPONSE
      );
      const audioSource = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_SOURCE
      );

      return (
        !this.waitingForAudioResponse &&
        responseField &&
        !domUtils.isHidden(responseField) &&
        audioResponse &&
        !audioResponse.value &&
        audioSource &&
        audioSource.src &&
        audioSource.src.length > 0 &&
        this.audioUrl !== audioSource.src &&
        this.requestCount <= this.maxAttempts
      );
    }

    // Process audio challenge
    async processAudio() {
      const audioSource = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_SOURCE
      );
      if (!audioSource || !audioSource.src) return;

      this.waitingForAudioResponse = true;
      this.audioUrl = audioSource.src;

      await this.getTextFromAudio(this.audioUrl);
    }

    // ============= AUDIO PROCESSING =============

    // Get text from audio using AI server
    async getTextFromAudio(audioUrl) {
      try {
        const server = serverManager.getBestServer();
        this.requestCount++;

        // Normalize audio URL
        const normalizedUrl = audioUrl.replace("recaptcha.net", "google.com");

        // Validate language
        if (!this.recaptchaLanguage || this.recaptchaLanguage.length < 1) {
          errorManager.logWarning(
            "ReCAPTCHA",
            "Language not recognized, using default"
          );
          this.recaptchaLanguage = "en-US";
        }

        errorManager.logInfo(
          "ReCAPTCHA",
          `Solving audio with server: ${server}`
        );

        const requestStart = Date.now();

        // Use rate limiting
        if (!encryptionUtils.advancedRateLimit("AUDIO_PROCESSING")) {
          this.waitingForAudioResponse = false;
          return;
        }

        GM_xmlhttpRequest({
          method: "POST",
          url: server,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          data: `input=${encodeURIComponent(normalizedUrl)}&lang=${
            this.recaptchaLanguage
          }`,
          timeout: RECAPTCHA_CONFIG.AUDIO_TIMEOUT,
          onload: response => {
            const responseTime = Date.now() - requestStart;
            this.handleAudioResponse(response, server, responseTime);
          },
          onerror: error => {
            const responseTime = Date.now() - requestStart;
            this.handleAudioError(error, server, responseTime);
          },
          ontimeout: () => {
            this.handleAudioTimeout(server);
          },
        });
      } catch (error) {
        errorManager.handleError(error, {
          context: "get_text_from_audio",
          category: "recaptcha",
        });
        this.waitingForAudioResponse = false;
      }
    }

    // Handle audio response from server
    handleAudioResponse(response, server, responseTime) {
      try {
        if (!response || !response.responseText) {
          this.handleInvalidResponse(server, responseTime);
          return;
        }

        const responseText = response.responseText.trim();

        // Validate response
        if (!this.isValidAudioResponse(responseText)) {
          this.handleInvalidResponse(server, responseTime);
          return;
        }

        // Fill response and submit
        if (this.fillAudioResponse(responseText)) {
          errorManager.logSuccess("ReCAPTCHA", "Audio solved successfully!");
          serverManager.updateServerStats(server, true, responseTime);
        } else {
          errorManager.logWarning("ReCAPTCHA", "Could not fill response field");
          serverManager.updateServerStats(server, false, responseTime);
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "handle_audio_response",
          category: "recaptcha",
        });
        serverManager.updateServerStats(server, false, responseTime);
      } finally {
        this.waitingForAudioResponse = false;
      }
    }

    // Validate audio response from server
    isValidAudioResponse(responseText) {
      return (
        responseText &&
        responseText !== "0" &&
        !responseText.includes("<") &&
        !responseText.includes(">") &&
        responseText.length >= 2 &&
        responseText.length <= 50
      );
    }

    // Fill audio response and verify
    fillAudioResponse(responseText) {
      const audioSource = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_SOURCE
      );
      const audioResponse = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_RESPONSE
      );
      const audioButton = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.AUDIO_BUTTON
      );
      const verifyButton = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.VERIFY_BUTTON
      );

      if (
        audioSource &&
        audioSource.src &&
        this.audioUrl === audioSource.src &&
        audioResponse &&
        !audioResponse.value &&
        audioButton &&
        audioButton.style.display === "none" &&
        verifyButton
      ) {
        audioResponse.value = responseText;
        domUtils.click(verifyButton);
        return true;
      }

      return false;
    }

    // Handle invalid audio response
    handleInvalidResponse(server, responseTime) {
      errorManager.logWarning("ReCAPTCHA", "Invalid response, retrying...");
      serverManager.updateServerStats(server, false, responseTime);
      this.waitingForAudioResponse = false;
    }

    // Handle audio processing error
    handleAudioError(error, server, responseTime) {
      errorManager.logError(
        "ReCAPTCHA",
        `Audio solver error from ${server}: ${error}`
      );
      serverManager.updateServerStats(server, false, responseTime);
      this.waitingForAudioResponse = false;
    }

    // Handle audio processing timeout
    handleAudioTimeout(server) {
      errorManager.logWarning(
        "ReCAPTCHA",
        `Audio processing timeout from ${server}`
      );
      serverManager.updateServerStats(
        server,
        false,
        RECAPTCHA_CONFIG.AUDIO_TIMEOUT
      );
      this.waitingForAudioResponse = false;
    }

    // ============= AUTOMATED QUERIES HANDLING =============

    // Check for automated queries detection
    checkAutomatedQueries() {
      const doscaptcha = domUtils.qSelector(
        RECAPTCHA_CONFIG.SELECTORS.DOSCAPTCHA
      );
      return doscaptcha && doscaptcha.innerText.length > 0;
    }

    // Handle automated queries detection
    async handleAutomatedQueries() {
      errorManager.logWarning(
        "ReCAPTCHA",
        "Automated queries detected - implementing cooldown and clearing cookies"
      );

      // Clear Google cookies
      await coreModule.clearGoogleCookies(true);

      // Set cooldown period
      coreModule.setState("lastAutomatedQueriesTime", Date.now());

      this.stopSolver("paused");
    }

    // ============= EVENT HANDLING =============

    // Handle captcha solved message from other frames
    handleCaptchaSolvedMessage(data) {
      if (data.solved) {
        errorManager.logInfo(
          "ReCAPTCHA",
          "Received solved message from other frame"
        );
        this.onSolverSuccess();
      }
    }

    // Handle captcha solved custom event
    handleCaptchaSolvedEvent(detail) {
      if (detail && detail.solved) {
        errorManager.logInfo("ReCAPTCHA", "Received solved custom event");
        this.onSolverSuccess();
      }
    }

    // Request credentials status from parent window
    requestCredentialsStatus() {
      try {
        const message = {
          type: MESSAGE_TYPES.CREDENTIALS_REQUEST,
          timestamp: Date.now(),
        };

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, "*");
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: "request_credentials_status",
          category: "recaptcha",
        });
      }
    }

    // ============= SOLVER LIFECYCLE =============

    // Handle successful solving
    onSolverSuccess() {
      this.solved = true;
      this.solverState = "completed";

      errorManager.logSuccess("ReCAPTCHA", "SOLVED successfully!");

      // Update core state
      coreModule.setState("captchaSolved", true);
      coreModule.setState("captchaInProgress", false);
      coreModule.setState("lastSolvedTime", Date.now());

      // Clear solver interval
      this.stopSolver("completed");

      // Notify other frames and windows
      this.broadcastSolvedMessage();

      // Trigger custom events
      this.triggerSolvedEvents();
    }

    // Stop the solver
    stopSolver(reason = "stopped") {
      if (this.captchaInterval) {
        clearInterval(this.captchaInterval);
        this.captchaInterval = null;
      }

      this.solverState = reason;
      coreModule.setState("captchaInProgress", false);

      errorManager.logInfo("ReCAPTCHA", `Solver stopped: ${reason}`);
    }

    // Broadcast solved message to all frames
    broadcastSolvedMessage() {
      try {
        const message = {
          type: MESSAGE_TYPES.CAPTCHA_SOLVED,
          solved: true,
          timestamp: Date.now(),
          solver: "ateex-auto-captcha-v4",
        };

        // Send to parent window
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, "*");
          errorManager.logInfo("ReCAPTCHA", "📤 Sent solved message to parent");
        }

        // Send to top window
        if (window.top && window.top !== window) {
          window.top.postMessage(message, "*");
          errorManager.logInfo("ReCAPTCHA", "📤 Sent solved message to top");
        }

        // Send to all child frames
        const frames = document.querySelectorAll("iframe");
        frames.forEach(frame => {
          try {
            frame.contentWindow.postMessage(message, "*");
          } catch (e) {
            // Ignore cross-origin errors
          }
        });
      } catch (error) {
        errorManager.handleError(error, {
          context: "broadcast_solved_message",
          category: "recaptcha",
        });
      }
    }

    // Trigger custom solved events
    triggerSolvedEvents() {
      try {
        const eventDetail = {
          solved: true,
          timestamp: Date.now(),
          solver: "ateex-auto-captcha-v4",
        };

        // Trigger on current window
        window.dispatchEvent(
          new CustomEvent("recaptchaSolved", { detail: eventDetail })
        );

        // Trigger on parent window
        if (window.parent && window.parent !== window) {
          window.parent.dispatchEvent(
            new CustomEvent("recaptchaSolved", { detail: eventDetail })
          );
        }

        errorManager.logInfo("ReCAPTCHA", "📡 Triggered custom solved events");
      } catch (error) {
        errorManager.handleError(error, {
          context: "trigger_solved_events",
          category: "recaptcha",
        });
      }
    }

    // ============= STATUS AND MONITORING =============

    // Get solver status
    getStatus() {
      return {
        state: this.solverState,
        solved: this.solved,
        requestCount: this.requestCount,
        maxAttempts: this.maxAttempts,
        waitingForAudio: this.waitingForAudioResponse,
        language: this.recaptchaLanguage,
        startTime: this.startTime,
        runtime: this.startTime ? Date.now() - this.startTime : 0,
      };
    }

    // Reset solver state
    reset() {
      this.solved = false;
      this.checkBoxClicked = false;
      this.waitingForAudioResponse = false;
      this.requestCount = 0;
      this.audioUrl = "";
      this.startTime = null;
      this.solverState = "idle";

      if (this.captchaInterval) {
        clearInterval(this.captchaInterval);
        this.captchaInterval = null;
      }

      coreModule.setState("captchaSolved", false);
      coreModule.setState("captchaInProgress", false);

      errorManager.logInfo("ReCAPTCHA", "Solver reset");
    }

    // ============= CLEANUP =============

    cleanup() {
      this.stopSolver("cleanup");
      this.reset();
      errorManager.logInfo("ReCAPTCHA", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const reCaptchaSolver = new ReCaptchaSolver();

  // ============= EXPORTS =============

  exports.ReCaptchaSolver = ReCaptchaSolver;
  exports.reCaptchaSolver = reCaptchaSolver;

  // Main API
  exports.initialize = () => reCaptchaSolver.initialize();
  exports.startSolver = () => reCaptchaSolver.startSolver();
  exports.stopSolver = reason => reCaptchaSolver.stopSolver(reason);
  exports.getStatus = () => reCaptchaSolver.getStatus();
  exports.reset = () => reCaptchaSolver.reset();
  exports.cleanup = () => reCaptchaSolver.cleanup();

  // Legacy exports for backward compatibility
  exports.initCaptchaSolver = () => reCaptchaSolver.startSolver();
  exports.initRecaptchaVars = () => reCaptchaSolver.initRecaptchaVars();

  // Advanced API
  exports.checkSolvedStatus = () => reCaptchaSolver.checkSolvedStatus();
  exports.processAudio = () => reCaptchaSolver.processAudio();
})(exports);
