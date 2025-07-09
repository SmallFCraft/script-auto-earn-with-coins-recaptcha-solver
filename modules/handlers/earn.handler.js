/**
 * Earn Handler Module - Enhanced earn page automation
 * Handles earning page interactions, cycle management, and automated clicking
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const domUtils = AteexModules.domUtils;
  const statsManager = AteexModules.statsManager;
  const encryptionUtils = AteexModules.encryptionUtils;
  const errorManager = AteexModules.errorManager;
  const uiManager = AteexModules.uiManager;

  const { EARN_CONFIG, WORKFLOW_CONFIG, PERFORMANCE_CONFIG } = constants;

  // ============= EARN HANDLER CLASS =============

  class EarnHandler {
    constructor() {
      this.isInitialized = false;
      this.isProcessing = false;
      this.currentCycle = 0;
      this.monitoringInterval = null;
      this.retryCount = 0;
      this.lastActionTime = 0;
      this.cycleStartTime = null;
    }

    // ============= INITIALIZATION =============

    async initialize() {
      if (this.isInitialized) {
        return true;
      }

      try {
        // Set up page monitoring
        this.setupPageMonitoring();

        this.isInitialized = true;
        errorManager.logSuccess("Earn Handler", "Initialized successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "earn_handler_init",
          category: "earn",
        });
        return false;
      }
    }

    // Set up page monitoring
    setupPageMonitoring() {
      // Monitor page changes and updates
      this.monitoringInterval = setInterval(() => {
        if (this.shouldMonitorPage()) {
          this.checkPageStatus();
        }
      }, EARN_CONFIG.MONITORING_INTERVAL);
    }

    // ============= MAIN EARN HANDLING =============

    // Handle earn page main logic
    async handleEarnPage() {
      if (this.isProcessing) {
        errorManager.logDebug("Earn", "Earn process already in progress");
        return;
      }

      // Check if should handle
      if (!this.shouldHandleEarn()) {
        return;
      }

      this.isProcessing = true;
      this.cycleStartTime = Date.now();

      try {
        errorManager.logInfo("Earn", "💰 Starting earn page handling");

        // STEP 1: Analyze page content
        const pageAnalysis = await this.analyzePage();

        // STEP 2: Handle based on page state
        const action = this.determineAction(pageAnalysis);

        // STEP 3: Execute action
        const result = await this.executeAction(action, pageAnalysis);

        // STEP 4: Update statistics
        this.updateCycleStats(result);

        // STEP 5: Schedule next check
        this.scheduleNextCheck(result);

        errorManager.logInfo(
          "Earn",
          `✅ Earn handling completed: ${action.type}`
        );
      } catch (error) {
        errorManager.handleError(error, {
          context: "handle_earn_page",
          category: "earn",
        });
        this.handleError();
      } finally {
        this.isProcessing = false;
      }
    }

    // ============= PAGE ANALYSIS =============

    // Analyze current page state
    async analyzePage() {
      try {
        const analysis = {
          startButtons: this.findStartButtons(),
          timers: this.findTimers(),
          ads: this.findAds(),
          progressBars: this.findProgressBars(),
          completionIndicators: this.findCompletionIndicators(),
          balanceInfo: this.findBalanceInfo(),
          errorMessages: this.findErrorMessages(),
          pageType: this.determinePageType(),
        };

        errorManager.logDebug(
          "Earn",
          `Page analysis: ${analysis.startButtons.length} buttons, ${analysis.timers.length} timers, ${analysis.ads.length} ads`
        );

        return analysis;
      } catch (error) {
        errorManager.handleError(error, {
          context: "analyze_page",
          category: "earn",
        });
        return this.getEmptyAnalysis();
      }
    }

    // Find clickable start/earn buttons
    findStartButtons() {
      const selectors = [
        "button",
        'input[type="button"]',
        'input[type="submit"]',
        ".btn",
        ".button",
        '[role="button"]',
      ];

      const elements = domUtils.qSelectorAll(selectors.join(", "));

      return elements.filter(btn => {
        if (!domUtils.isVisible(btn) || btn.disabled) {
          return false;
        }

        const text = (
          btn.textContent ||
          btn.value ||
          btn.title ||
          ""
        ).toLowerCase();
        const earnKeywords = [
          "start",
          "begin",
          "earn",
          "continue",
          "proceed",
          "click",
          "next",
          "submit",
          "go",
          "play",
        ];

        return earnKeywords.some(keyword => text.includes(keyword));
      });
    }

    // Find timer elements
    findTimers() {
      const selectors = [
        ".timer",
        ".countdown",
        ".wait",
        '[class*="time"]',
        '[class*="countdown"]',
        '[class*="wait"]',
        '[id*="timer"]',
        '[id*="countdown"]',
      ];

      const elements = domUtils.qSelectorAll(selectors.join(", "));

      return elements
        .filter(timer => {
          if (!domUtils.isVisible(timer)) return false;

          const text = timer.textContent.trim();
          // Look for time patterns: 00:30, 30s, 1:30, etc.
          const timePattern = /\d+[:.]?\d*\s*[sm]?/i;
          return timePattern.test(text);
        })
        .map(timer => ({
          element: timer,
          text: timer.textContent.trim(),
          timeRemaining: this.parseTimeRemaining(timer.textContent),
        }));
    }

    // Find ad elements
    findAds() {
      const selectors = [
        ".ad",
        ".advertisement",
        ".promo",
        '[class*="ad-"]',
        '[class*="banner"]',
        'iframe[src*="ads"]',
        'iframe[src*="doubleclick"]',
      ];

      return domUtils
        .qSelectorAll(selectors.join(", "))
        .filter(ad => domUtils.isVisible(ad));
    }

    // Find progress bars
    findProgressBars() {
      const selectors = [
        ".progress",
        ".bar",
        ".loading",
        '[class*="progress"]',
        '[class*="loading"]',
        '[role="progressbar"]',
      ];

      return domUtils
        .qSelectorAll(selectors.join(", "))
        .filter(bar => domUtils.isVisible(bar))
        .map(bar => ({
          element: bar,
          value: this.getProgressValue(bar),
        }));
    }

    // Find completion indicators
    findCompletionIndicators() {
      const selectors = [
        ".complete",
        ".done",
        ".finished",
        ".success",
        '[class*="complet"]',
        '[class*="success"]',
        '[class*="done"]',
      ];

      return domUtils
        .qSelectorAll(selectors.join(", "))
        .filter(indicator => domUtils.isVisible(indicator))
        .map(indicator => ({
          element: indicator,
          text: indicator.textContent.trim(),
        }));
    }

    // Find balance information
    findBalanceInfo() {
      const selectors = [
        ".balance",
        ".coins",
        ".points",
        ".credits",
        '[class*="balance"]',
        '[class*="coin"]',
        '[class*="point"]',
      ];

      const elements = domUtils.qSelectorAll(selectors.join(", "));

      return elements
        .filter(el => domUtils.isVisible(el))
        .map(el => ({
          element: el,
          text: el.textContent.trim(),
          value: this.extractNumericValue(el.textContent),
        }))
        .filter(info => info.value !== null);
    }

    // Find error messages
    findErrorMessages() {
      const selectors = [
        ".error",
        ".alert",
        ".warning",
        ".message",
        '[class*="error"]',
        '[class*="alert"]',
        '[role="alert"]',
      ];

      return domUtils
        .qSelectorAll(selectors.join(", "))
        .filter(msg => domUtils.isVisible(msg) && msg.textContent.trim())
        .map(msg => ({
          element: msg,
          text: msg.textContent.trim(),
          type: this.classifyErrorMessage(msg),
        }));
    }

    // Determine page type
    determinePageType() {
      const url = window.location.href.toLowerCase();
      const title = document.title.toLowerCase();

      if (url.includes("clickcoin") || url.includes("ads")) {
        return "ad_page";
      }

      if (url.includes("earn") || title.includes("earn")) {
        return "earn_main";
      }

      if (url.includes("dashboard") || url.includes("home")) {
        return "dashboard";
      }

      return "unknown";
    }

    // ============= ACTION DETERMINATION =============

    // Determine what action to take based on analysis
    determineAction(analysis) {
      // Priority 1: Handle errors
      if (analysis.errorMessages.length > 0) {
        return {
          type: "handle_error",
          priority: 1,
          data: analysis.errorMessages,
        };
      }

      // Priority 2: Wait for active timers
      const activeTimers = analysis.timers.filter(
        timer => timer.timeRemaining > 0
      );
      if (activeTimers.length > 0) {
        const shortestTime = Math.min(
          ...activeTimers.map(t => t.timeRemaining)
        );
        return {
          type: "wait_timer",
          priority: 2,
          waitTime: shortestTime,
          data: activeTimers,
        };
      }

      // Priority 3: Handle completion
      if (analysis.completionIndicators.length > 0) {
        return {
          type: "handle_completion",
          priority: 3,
          data: analysis.completionIndicators,
        };
      }

      // Priority 4: Click available buttons
      if (analysis.startButtons.length > 0) {
        return {
          type: "click_button",
          priority: 4,
          data: analysis.startButtons,
        };
      }

      // Priority 5: Wait for content to load
      return {
        type: "wait_content",
        priority: 5,
        waitTime: EARN_CONFIG.CONTENT_WAIT_TIME,
      };
    }

    // ============= ACTION EXECUTION =============

    // Execute determined action
    async executeAction(action, analysis) {
      try {
        switch (action.type) {
          case "handle_error":
            return await this.handleError(action.data);

          case "wait_timer":
            return await this.waitForTimer(action.waitTime);

          case "handle_completion":
            return await this.handleCompletion(action.data);

          case "click_button":
            return await this.clickButton(action.data);

          case "wait_content":
            return await this.waitForContent(action.waitTime);

          default:
            errorManager.logWarning(
              "Earn",
              `Unknown action type: ${action.type}`
            );
            return { success: false, message: "Unknown action" };
        }
      } catch (error) {
        errorManager.handleError(error, {
          context: `execute_action_${action.type}`,
          category: "earn",
        });
        return { success: false, error: error.message };
      }
    }

    // Handle error messages
    async handleError(errorMessages) {
      const criticalErrors = errorMessages.filter(
        msg =>
          msg.text.toLowerCase().includes("limit") ||
          msg.text.toLowerCase().includes("banned") ||
          msg.text.toLowerCase().includes("blocked")
      );

      if (criticalErrors.length > 0) {
        errorManager.logError(
          "Earn",
          `Critical error detected: ${criticalErrors[0].text}`
        );
        uiManager.showNotification("❌ Critical error on earn page", "error");
        return {
          success: false,
          critical: true,
          message: criticalErrors[0].text,
        };
      }

      // For non-critical errors, try to find dismiss buttons
      const dismissButtons = domUtils
        .qSelectorAll("button, .btn")
        .filter(btn => {
          const text = btn.textContent.toLowerCase();
          return (
            text.includes("ok") ||
            text.includes("close") ||
            text.includes("dismiss")
          );
        });

      if (dismissButtons.length > 0) {
        await this.sleep(1000);
        dismissButtons[0].click();
        errorManager.logInfo("Earn", "Dismissed error message");
      }

      return { success: true, message: "Error handled" };
    }

    // Wait for timer to complete
    async waitForTimer(timeRemaining) {
      const waitTime = Math.min(
        timeRemaining * 1000,
        EARN_CONFIG.MAX_TIMER_WAIT
      );

      errorManager.logInfo("Earn", `⏰ Waiting for timer: ${timeRemaining}s`);

      await this.sleep(waitTime);

      return { success: true, message: `Waited ${waitTime / 1000}s for timer` };
    }

    // Handle completion state
    async handleCompletion(completionIndicators) {
      errorManager.logSuccess(
        "Earn",
        `🎉 Completion detected: ${completionIndicators[0].text}`
      );

      // Look for continue/next buttons
      const continueButtons = domUtils
        .qSelectorAll("button, .btn, a")
        .filter(btn => {
          const text = btn.textContent.toLowerCase();
          return (
            text.includes("continue") ||
            text.includes("next") ||
            text.includes("proceed") ||
            text.includes("collect")
          );
        })
        .filter(btn => domUtils.isVisible(btn));

      if (continueButtons.length > 0) {
        await this.sleep(EARN_CONFIG.HUMAN_DELAY);
        continueButtons[0].click();

        errorManager.logSuccess("Earn", "✅ Clicked continue button");
        this.incrementCycle();

        return {
          success: true,
          cycleCompleted: true,
          message: "Continued after completion",
        };
      }

      return { success: true, message: "Completion handled" };
    }

    // Click available button
    async clickButton(buttons) {
      if (buttons.length === 0) {
        return { success: false, message: "No buttons available" };
      }

      const button = buttons[0];
      const buttonText = button.textContent || button.value || "Unknown";

      errorManager.logInfo("Earn", `🎯 Clicking button: "${buttonText}"`);

      // Human-like delay
      await this.sleep(EARN_CONFIG.HUMAN_DELAY);

      // Click with proper events
      button.focus();
      await this.sleep(100);

      domUtils.triggerEvent(button, "mousedown");
      domUtils.triggerEvent(button, "mouseup");
      button.click();

      errorManager.logSuccess("Earn", `✅ Clicked button: ${buttonText}`);

      // Increment cycle for earn actions
      if (this.isEarnAction(buttonText)) {
        this.incrementCycle();
      }

      return {
        success: true,
        buttonClicked: true,
        cycleCompleted: this.isEarnAction(buttonText),
        message: `Clicked: ${buttonText}`,
      };
    }

    // Wait for content to load
    async waitForContent(waitTime) {
      errorManager.logInfo(
        "Earn",
        `⏳ Waiting for content to load: ${waitTime / 1000}s`
      );

      await this.sleep(waitTime);

      return { success: true, message: "Waited for content" };
    }

    // ============= UTILITY FUNCTIONS =============

    // Check if should handle earn page
    shouldHandleEarn() {
      // Check if auto stats is enabled
      if (!statsManager.isAutoStatsActive()) {
        errorManager.logWarning("Earn", "⏳ Waiting - auto stats not enabled");
        return false;
      }

      // Check if script is stopped
      if (window.scriptStopped) {
        errorManager.logInfo("Earn", "🛑 Script stopped");
        return false;
      }

      // Rate limiting
      if (!encryptionUtils.rateLimit("earn_page_action", 10, 60000)) {
        errorManager.logWarning("Earn", "Earn page actions rate limited");
        return false;
      }

      return true;
    }

    // Check if should monitor page
    shouldMonitorPage() {
      return this.isInitialized && !this.isProcessing && this.isOnEarnPage();
    }

    // Check if currently on earn page
    isOnEarnPage() {
      const url = window.location.href.toLowerCase();
      return (
        url.includes("/earn") ||
        url.includes("/advertise") ||
        domUtils.qSelector(".earn-container") ||
        domUtils.qSelector("#earn-page") ||
        document.title.toLowerCase().includes("earn")
      );
    }

    // Check if action is an earning action
    isEarnAction(buttonText) {
      const earnKeywords = ["start", "begin", "earn", "click", "play"];
      const text = buttonText.toLowerCase();
      return earnKeywords.some(keyword => text.includes(keyword));
    }

    // Increment cycle count
    incrementCycle() {
      this.currentCycle++;
      statsManager.incrementCycle();

      const cycleTime = this.cycleStartTime
        ? Date.now() - this.cycleStartTime
        : 0;
      if (cycleTime > 0) {
        statsManager.addCycleTime(cycleTime);
      }

      errorManager.logSuccess(
        "Earn",
        `🔄 Cycle ${this.currentCycle} completed`
      );
      uiManager.updateCounter();
    }

    // Update cycle statistics
    updateCycleStats(result) {
      if (result.cycleCompleted) {
        const cycleTime = this.cycleStartTime
          ? Date.now() - this.cycleStartTime
          : 0;
        statsManager.addCycleTime(cycleTime);
      }
    }

    // Schedule next check
    scheduleNextCheck(result) {
      let delay;

      if (result.critical) {
        delay = EARN_CONFIG.ERROR_RETRY_DELAY;
      } else if (result.cycleCompleted) {
        delay = EARN_CONFIG.CYCLE_COMPLETION_DELAY;
      } else if (result.buttonClicked) {
        delay = EARN_CONFIG.ACTION_DELAY;
      } else {
        delay = EARN_CONFIG.DEFAULT_CHECK_DELAY;
      }

      setTimeout(() => {
        if (this.isOnEarnPage()) {
          this.handleEarnPage();
        }
      }, delay);
    }

    // Check page status periodically
    checkPageStatus() {
      if (!this.isOnEarnPage()) {
        return;
      }

      // Check for balance updates
      const balanceInfo = this.findBalanceInfo();
      if (balanceInfo.length > 0) {
        const currentBalance = balanceInfo[0].value;
        if (currentBalance !== null) {
          statsManager.updateCurrentBalance(currentBalance);
        }
      }
    }

    // Parse time remaining from text
    parseTimeRemaining(text) {
      const matches = text.match(/(\d+)[:.]?(\d*)\s*([sm]?)/i);
      if (!matches) return 0;

      const [, minutes, seconds = "0", unit] = matches;
      let totalSeconds = parseInt(minutes) || 0;

      if (seconds) {
        totalSeconds =
          unit === "m"
            ? totalSeconds * 60 + parseInt(seconds)
            : unit === "s"
            ? totalSeconds
            : totalSeconds * 60 + parseInt(seconds);
      } else if (unit === "m") {
        totalSeconds *= 60;
      }

      return totalSeconds;
    }

    // Get progress value from element
    getProgressValue(element) {
      // Try aria-valuenow first
      const ariaValue = element.getAttribute("aria-valuenow");
      if (ariaValue) return parseFloat(ariaValue);

      // Try style width
      const style = window.getComputedStyle(element);
      const width = style.width;
      if (width && width.includes("%")) {
        return parseFloat(width);
      }

      // Try data attributes
      const dataValue = element.dataset.value || element.dataset.progress;
      if (dataValue) return parseFloat(dataValue);

      return null;
    }

    // Extract numeric value from text
    extractNumericValue(text) {
      const match = text.match(/[\d,]+\.?\d*/);
      if (match) {
        return parseFloat(match[0].replace(/,/g, ""));
      }
      return null;
    }

    // Classify error message type
    classifyErrorMessage(element) {
      const text = element.textContent.toLowerCase();
      const classes = element.className.toLowerCase();

      if (text.includes("limit") || text.includes("quota")) return "limit";
      if (text.includes("error") || classes.includes("error")) return "error";
      if (text.includes("warning") || classes.includes("warning"))
        return "warning";
      if (text.includes("info") || classes.includes("info")) return "info";

      return "unknown";
    }

    // Get empty analysis object
    getEmptyAnalysis() {
      return {
        startButtons: [],
        timers: [],
        ads: [],
        progressBars: [],
        completionIndicators: [],
        balanceInfo: [],
        errorMessages: [],
        pageType: "unknown",
      };
    }

    // Sleep utility
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============= CLEANUP =============

    cleanup() {
      // Clear intervals
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }

      this.isInitialized = false;
      this.isProcessing = false;

      errorManager.logInfo("Earn Handler", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const earnHandler = new EarnHandler();

  // ============= EXPORTS =============

  exports.EarnHandler = EarnHandler;
  exports.earnHandler = earnHandler;

  // Main API
  exports.initialize = () => earnHandler.initialize();
  exports.handleEarnPage = () => earnHandler.handleEarnPage();
  exports.cleanup = () => earnHandler.cleanup();

  // Advanced API
  exports.analyzePage = () => earnHandler.analyzePage();
  exports.shouldHandleEarn = () => earnHandler.shouldHandleEarn();
  exports.isOnEarnPage = () => earnHandler.isOnEarnPage();

  // Statistics
  exports.getCurrentCycle = () => earnHandler.currentCycle;
  exports.incrementCycle = () => earnHandler.incrementCycle();
})(exports);
