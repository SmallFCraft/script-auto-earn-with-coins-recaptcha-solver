/**
 * Error Module - Error Page Detection and Redirect Handling
 * Handles error page detection, script stopping, and automatic redirects
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const core = AteexModules.core;
  const { log, logInfo, logError, logSuccess, logWarning } = core;

  // ============= ERROR DETECTION CONSTANTS =============

  // Global flag to stop all script activities
  let scriptStopped = false;
  let allIntervals = [];
  let allTimeouts = [];

  // Override setInterval to track all intervals
  const originalSetInterval = window.setInterval;
  window.setInterval = function (callback, delay, ...args) {
    if (scriptStopped) {
      logDebug("Interval blocked - script stopped");
      return null;
    }
    const intervalId = originalSetInterval.call(
      this,
      function () {
        if (scriptStopped) {
          clearInterval(intervalId);
          return;
        }
        callback.apply(this, arguments);
      },
      delay,
      ...args
    );
    allIntervals.push(intervalId);
    return intervalId;
  };

  // Override setTimeout to track all timeouts
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function (callback, delay, ...args) {
    if (scriptStopped) {
      logDebug("Timeout blocked - script stopped");
      return null;
    }
    const timeoutId = originalSetTimeout.call(
      this,
      function () {
        if (scriptStopped) {
          return;
        }
        callback.apply(this, arguments);
      },
      delay,
      ...args
    );
    allTimeouts.push(timeoutId);
    return timeoutId;
  };

  // ============= ERROR PAGE DETECTION =============

  function detectErrorPage() {
    try {
      // Check for common error indicators in page content
      const pageText = document.body
        ? document.body.textContent.toLowerCase()
        : "";
      const pageTitle = document.title.toLowerCase();
      const currentUrl = window.location.href;

      // Common error patterns
      const errorPatterns = [
        // HTTP status codes
        /502\s*bad\s*gateway/i,
        /500\s*internal\s*server\s*error/i,
        /503\s*service\s*unavailable/i,
        /504\s*gateway\s*timeout/i,
        /419\s*page\s*expired/i,
        /429\s*too\s*many\s*requests/i,
        /403\s*forbidden/i,
        /404\s*not\s*found/i,

        // Error messages
        /server\s*error/i,
        /internal\s*error/i,
        /service\s*unavailable/i,
        /temporarily\s*unavailable/i,
        /maintenance\s*mode/i,
        /under\s*maintenance/i,
        /page\s*expired/i,
        /session\s*expired/i,
        /csrf\s*token\s*mismatch/i,
        /connection\s*timed\s*out/i,
        /gateway\s*timeout/i,
        /bad\s*gateway/i,

        // Laravel specific errors
        /whoops.*something.*went.*wrong/i,
        /laravel.*error/i,
        /illuminate.*error/i,

        // Generic error indicators
        /something.*went.*wrong/i,
        /an\s*error\s*occurred/i,
        /error\s*\d{3}/i,
        /http\s*error/i,

        // Additional common errors
        /database.*error/i,
        /connection.*failed/i,
        /request.*timeout/i,
        /access.*denied/i,
        /permission.*denied/i,
        /unauthorized/i,
        /forbidden.*access/i,
        /resource.*not.*found/i,
        /page.*not.*available/i,
        /site.*temporarily.*down/i,
        /we.*are.*sorry/i,
        /oops.*error/i,
        /fatal.*error/i,
      ];

      // Check if current page matches error patterns
      const hasErrorInContent = errorPatterns.some(
        pattern => pattern.test(pageText) || pattern.test(pageTitle)
      );

      // Check for error status codes in URL or meta tags
      const hasErrorInUrl = /\/error\/\d{3}|\/\d{3}\.html/i.test(currentUrl);

      // Check for specific error page indicators
      const errorSelectors = [
        ".error-page",
        ".error-container",
        ".http-error",
        ".server-error",
        ".maintenance-page",
        '[class*="error"]',
        '[id*="error"]',
      ];

      const hasErrorElement = errorSelectors.some(selector => {
        const element = document.querySelector(selector);
        return element && element.offsetParent !== null; // Visible element
      });

      // Check for empty or minimal content (possible error page)
      const hasMinimalContent =
        document.body &&
        document.body.textContent.trim().length < 100 &&
        !currentUrl.includes("/login") &&
        !currentUrl.includes("/logout") &&
        !currentUrl.includes("/recaptcha") &&
        !currentUrl.includes("/ads") &&
        !currentUrl.includes("/popup");

      // Additional checks to avoid false positives
      const isLoadingPage =
        pageText.includes("loading") || pageText.includes("please wait");
      const isValidPage =
        currentUrl.includes("/earn") ||
        currentUrl.includes("/home") ||
        currentUrl.includes("/dashboard") ||
        currentUrl.includes("/profile");

      // Don't trigger on loading pages or known valid pages that might be loading
      if (isLoadingPage && isValidPage) {
        return false;
      }

      return (
        hasErrorInContent ||
        hasErrorInUrl ||
        hasErrorElement ||
        hasMinimalContent
      );
    } catch (e) {
      logError("Error detecting error page: " + e.message);
      return false;
    }
  }

  // ============= SCRIPT STOPPING SYSTEM =============

  function stopAllScriptActivities() {
    if (scriptStopped) return; // Already stopped

    scriptStopped = true;
    logWarning("🛑 STOPPING ALL SCRIPT ACTIVITIES");

    try {
      // Clear all tracked intervals
      allIntervals.forEach(intervalId => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      });
      logInfo(`✅ Cleared ${allIntervals.length} intervals`);

      // Clear all tracked timeouts
      allTimeouts.forEach(timeoutId => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
      logInfo(`✅ Cleared ${allTimeouts.length} timeouts`);

      // Stop any ongoing requests
      if (core.state) {
        core.state.isRunning = false;
        core.state.shouldStop = true;
      }

      // Remove event listeners to prevent further actions
      const buttons = document.querySelectorAll("#ateex-counter button");
      buttons.forEach(button => {
        button.disabled = true;
        button.style.opacity = "0.5";
        button.style.cursor = "not-allowed";
      });

      // Update counter to show stopped state
      const counter = document.getElementById("ateex-counter");
      if (counter) {
        const statusDiv =
          counter.querySelector('[id*="status"]') ||
          counter.querySelector("div");
        if (statusDiv) {
          statusDiv.innerHTML = "🛑 SCRIPT STOPPED - Error page detected";
          statusDiv.style.color = "#ff6b6b";
          statusDiv.style.fontWeight = "bold";
        }
      }

      logSuccess("🛑 All script activities stopped successfully");

      // Final data sync before complete shutdown (use original setTimeout)
      originalSetTimeout(() => {
        try {
          // Save current state one last time
          if (core.state) {
            localStorage.setItem(
              "ateex_stats",
              JSON.stringify({
                totalCycles: core.state.totalCycles,
                totalCoins: core.state.totalCoins,
                startTime: core.state.startTime,
                lastSync: Date.now(),
                stoppedDueToError: true,
              })
            );
            logInfo("💾 Final data sync completed before shutdown");
          }
        } catch (e) {
          logError("Error in final sync: " + e.message);
        }
      }, 100);
    } catch (e) {
      logError("Error stopping script activities: " + e.message);
    }
  }

  // ============= ERROR PAGE HANDLING =============

  function handleErrorPage() {
    const currentUrl = window.location.href;
    const baseUrl = "https://dash.ateex.cloud/";

    // Get reference to original setTimeout (before override)
    const originalTimeout = originalSetTimeout;

    // Don't redirect if already on base URL
    if (currentUrl === baseUrl || currentUrl === baseUrl.slice(0, -1)) {
      return;
    }

    // Don't redirect if in iframe (reCAPTCHA)
    if (window.top !== window.self) {
      return;
    }

    logWarning(`Error page detected: ${currentUrl}`);
    logInfo("🛑 STOPPING ALL SCRIPT ACTIVITIES - Error page detected");
    logInfo("Redirecting to base URL in 3 seconds...");

    // STOP ALL SCRIPT ACTIVITIES IMMEDIATELY
    stopAllScriptActivities();

    // Show user notification
    if (document.body) {
      const notification = document.createElement("div");
      notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                z-index: 99999;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                max-width: 300px;
                word-wrap: break-word;
            `;

      notification.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">🛑 Error Page Detected</div>
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 3px;">Current: ${window.location.pathname}</div>
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 3px;">🛑 All script activities stopped</div>
                <div style="font-size: 12px; opacity: 0.9;">Redirecting to home page in 3 seconds...</div>
            `;

      document.body.appendChild(notification);

      // Remove notification after redirect (use original setTimeout)
      originalTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 4000);
    }

    // Redirect after 3 seconds (use original setTimeout to bypass blocking)
    originalTimeout(() => {
      try {
        logInfo(`Redirecting from error page: ${currentUrl} → ${baseUrl}`);
        window.location.href = baseUrl;
      } catch (e) {
        // Fallback redirect method if location.href fails
        logError("Primary redirect failed, trying fallback: " + e.message);
        try {
          window.location.replace(baseUrl);
        } catch (e2) {
          // Last resort - force page reload to base URL
          logError("Fallback redirect failed, forcing reload: " + e2.message);
          window.location = baseUrl;
        }
      }
    }, 3000);

    // Backup redirect in case the first one fails
    originalTimeout(() => {
      if (
        window.location.href !== baseUrl &&
        !window.location.href.startsWith(baseUrl)
      ) {
        logWarning(
          "Backup redirect triggered - primary redirect may have failed"
        );
        window.location.href = baseUrl;
      }
    }, 6000);
  }

  // ============= ERROR PAGE DETECTION INITIALIZATION =============

  // Check for error page on load and periodically
  function initErrorPageDetection() {
    // Get references to original functions
    const originalTimeout = originalSetTimeout;
    const originalInterval = originalSetInterval;

    // Check immediately (use original setTimeout to ensure it runs)
    originalTimeout(() => {
      if (detectErrorPage()) {
        handleErrorPage();
      }
    }, 2000); // Wait 2 seconds for page to fully load

    // Check periodically for dynamic errors (use original setInterval)
    originalInterval(() => {
      // Don't check if script is already stopped and redirecting
      if (scriptStopped) {
        return;
      }
      if (detectErrorPage()) {
        handleErrorPage();
      }
    }, 10000); // Check every 10 seconds
  }

  // ============= INITIALIZATION =============

  function initialize() {
    logInfo("[Error Module] Initializing error detection...");

    // Initialize error page detection for all pages
    initErrorPageDetection();

    // Set global reference for other modules
    window.scriptStopped = scriptStopped;

    logSuccess("[Error Module] Error detection initialized");
  }

  // ============= EXPORTS =============

  exports.detectErrorPage = detectErrorPage;
  exports.handleErrorPage = handleErrorPage;
  exports.stopAllScriptActivities = stopAllScriptActivities;
  exports.initErrorPageDetection = initErrorPageDetection;
  exports.initialize = initialize;
  exports.scriptStopped = () => scriptStopped;
})(exports);
