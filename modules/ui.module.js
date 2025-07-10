/**
 * UI Module - Performance Optimized
 * Handles UI elements with minimal DOM manipulation
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  const data = AteexModules.data;

  if (!core || !data) {
    throw new Error("Missing dependencies");
  }

  const { log, logInfo, logError, logSuccess, logWarning, qSelector } = core;

  // ============= OPTIMIZED UI STATE =============
  let uiElements = {
    container: null,
    statsDisplay: null,
    toggleButton: null,
    lastUpdateTime: 0,
  };

  const UI_UPDATE_THROTTLE = 3000; // Update at most every 3 seconds

  // ============= SIMPLIFIED UI CREATION =============

  function createCounterUI() {
    // Prevent duplicate UI
    if (uiElements.container && document.body.contains(uiElements.container)) {
      return;
    }

    try {
      // Quick cleanup of any existing UI
      const existing = document.querySelector("#ateex-counter");
      if (existing) {
        existing.remove();
      }

      // Create minimal container
      const container = document.createElement("div");
      container.id = "ateex-counter";
      container.style.cssText = `
        position: fixed; top: 10px; right: 10px; z-index: 999999;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; padding: 12px 16px; border-radius: 8px;
        font: bold 12px Arial; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        min-width: 200px; cursor: pointer; user-select: none;
        transition: all 0.2s ease;
      `;

      // Quick hover effects
      container.addEventListener("mouseenter", () => {
        container.style.transform = "scale(1.05)";
      });
      container.addEventListener("mouseleave", () => {
        container.style.transform = "scale(1)";
      });

      // Simple stats display
      const statsDisplay = document.createElement("div");
      statsDisplay.style.cssText = "line-height: 1.4;";

      // Quick toggle button
      const toggleButton = document.createElement("div");
      toggleButton.style.cssText = `
        margin-top: 8px; padding: 6px 10px; background: rgba(255,255,255,0.2);
        border-radius: 4px; text-align: center; cursor: pointer;
        font-size: 11px; transition: background 0.2s ease;
      `;
      toggleButton.textContent = "⏸️ Pause";

      toggleButton.addEventListener("click", e => {
        e.stopPropagation();
        toggleAutoStats();
      });

      container.appendChild(statsDisplay);
      container.appendChild(toggleButton);
      document.body.appendChild(container);

      // Store references
      uiElements.container = container;
      uiElements.statsDisplay = statsDisplay;
      uiElements.toggleButton = toggleButton;

      // Initial update
      updateCounter();

      logSuccess("UI created successfully");
    } catch (error) {
      logError("UI creation error: " + error.message);
    }
  }

  // ============= OPTIMIZED COUNTER UPDATE =============

  function updateCounter() {
    const now = Date.now();

    // Throttle updates for performance
    if (now - uiElements.lastUpdateTime < UI_UPDATE_THROTTLE) {
      return;
    }

    try {
      if (
        !uiElements.statsDisplay ||
        !document.body.contains(uiElements.container)
      ) {
        return;
      }

      const stats = data.getStats();

      // Quick calculations
      const runtime = data.formatRunTime(stats.totalRunTime);
      const sessionTime = data.formatRunTime(stats.sessionRunTime);

      // Simple display format
      const displayText = `
        🔄 Cycles: ${stats.totalCycles} | 💰 Coins: ${stats.totalCoins}<br>
        ⏱️ Runtime: ${runtime}<br>
        📈 Avg/Cycle: ${stats.avgCycleTime}s | Rate: ${stats.coinsPerHour}/h
      `;

      // Only update if content changed
      if (uiElements.statsDisplay.innerHTML !== displayText) {
        uiElements.statsDisplay.innerHTML = displayText;
      }

      // Update toggle button state
      const buttonText = core.state.autoStatsEnabled ? "⏸️ Pause" : "▶️ Resume";
      if (uiElements.toggleButton.textContent !== buttonText) {
        uiElements.toggleButton.textContent = buttonText;
        uiElements.toggleButton.style.background = core.state.autoStatsEnabled
          ? "rgba(255,0,0,0.3)"
          : "rgba(0,255,0,0.3)";
      }

      uiElements.lastUpdateTime = now;
    } catch (error) {
      logError("UI update error: " + error.message);
    }
  }

  // ============= SIMPLIFIED TOGGLE FUNCTIONALITY =============

  function toggleAutoStats() {
    try {
      if (core.state.autoStatsEnabled) {
        core.state.autoStatsEnabled = false;
        core.saveAutoStatsState();
        logWarning("Auto Stats paused by user");

        // Update button immediately
        if (uiElements.toggleButton) {
          uiElements.toggleButton.textContent = "▶️ Resume";
          uiElements.toggleButton.style.background = "rgba(0,255,0,0.3)";
        }

        // Stop the script
        window.scriptStopped = true;
      } else {
        core.state.autoStatsEnabled = true;
        core.saveAutoStatsState();
        logSuccess("Auto Stats resumed by user");

        // Update button immediately
        if (uiElements.toggleButton) {
          uiElements.toggleButton.textContent = "⏸️ Pause";
          uiElements.toggleButton.style.background = "rgba(255,0,0,0.3)";
        }

        // Resume the script
        window.scriptStopped = false;

        // Quick page reload to restart
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      logError("Toggle error: " + error.message);
    }
  }

  // ============= SIMPLIFIED LOGOUT FUNCTION =============

  function logout() {
    try {
      // Quick logout methods
      const logoutPaths = ["/logout", "/auth/logout", "/user/logout"];

      // Try URL-based logout first
      for (const path of logoutPaths) {
        try {
          window.location.href = "https://dash.ateex.cloud" + path;
          return;
        } catch (e) {
          continue;
        }
      }

      // Fallback: find logout elements
      const logoutSelectors = [
        'a[href*="logout"]',
        'button[onclick*="logout"]',
        ".logout-btn",
        "#logout",
        '[data-action="logout"]',
      ];

      for (const selector of logoutSelectors) {
        const element = qSelector(selector);
        if (element) {
          element.click();
          return;
        }
      }

      // Final fallback: clear data and go to login
      data.clearBrowserData().then(() => {
        window.location.href = "https://dash.ateex.cloud/login";
      });
    } catch (error) {
      logError("Logout error: " + error.message);
      // Emergency fallback
      window.location.href = "https://dash.ateex.cloud/logout";
    }
  }

  // ============= SIMPLE NOTIFICATIONS =============

  function showNotification(message, type = "info", duration = 3000) {
    try {
      // Quick notification without complex styling
      const notification = document.createElement("div");
      notification.style.cssText = `
        position: fixed; top: 80px; right: 10px; z-index: 999999;
        background: ${
          type === "success"
            ? "#4CAF50"
            : type === "error"
            ? "#f44336"
            : "#2196F3"
        };
        color: white; padding: 12px 16px; border-radius: 4px;
        font: 12px Arial; max-width: 300px; word-wrap: break-word;
        opacity: 0; transition: opacity 0.3s ease;
      `;
      notification.textContent = message;

      document.body.appendChild(notification);

      // Quick fade in
      setTimeout(() => {
        notification.style.opacity = "1";
      }, 10);

      // Auto remove
      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, duration);
    } catch (error) {
      // Fallback to console if DOM manipulation fails
      console.log(`Notification: ${message}`);
    }
  }

  // ============= CLEANUP ON PAGE UNLOAD =============

  window.addEventListener("beforeunload", () => {
    // Quick cleanup
    if (uiElements.container && document.body.contains(uiElements.container)) {
      try {
        document.body.removeChild(uiElements.container);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // ============= EXPORTS =============
  exports.createCounterUI = createCounterUI;
  exports.updateCounter = updateCounter;
  exports.toggleAutoStats = toggleAutoStats;
  exports.logout = logout;
  exports.showNotification = showNotification;
})(exports);
