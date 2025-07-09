/**
 * UI Module - User Interface Management
 * Handles counter display, modals, settings, and all user interface elements
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  const data = AteexModules.data;

  // Validate dependencies before use
  if (!core) {
    throw new Error("Core module not loaded - missing dependency");
  }
  if (!data) {
    throw new Error("Data module not loaded - missing dependency");
  }
  const { log, logInfo, logError, logSuccess, logWarning, logDebug } = core;

  // ============= UI CONSTANTS =============

  // Settings menu configuration - simplified
  const SETTINGS_MENU = {
    "view-stats": {
      icon: "📊",
      label: "View Stats",
      description: "View current statistics",
    },
    "reset-stats": {
      icon: "🔄",
      label: "Reset Stats",
      description: "Reset cycles and coins to zero",
      danger: true,
    },
    "clear-creds": {
      icon: "🔐",
      label: "Clear Credentials",
      description: "Clear saved login credentials",
      danger: true,
    },
  };

  // Shared button styles
  const BUTTON_STYLES = {
    primary: `
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            opacity: 0.9;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `,
    secondary: `
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            background: rgba(255,255,255,0.2);
            color: white;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            opacity: 0.8;
            transition: all 0.2s ease;
        `,
    danger: `
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
        `,
  };

  // ============= UNIFIED MODAL SYSTEM =============

  function showModal(title, content, actions = []) {
    const modal = document.createElement("div");
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            border-radius: 15px;
            padding: 25px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.2);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

    // Title
    const titleElement = document.createElement("h2");
    titleElement.textContent = title;
    titleElement.style.cssText = `
            margin: 0 0 20px 0;
            text-align: center;
            font-size: 18px;
            font-weight: 600;
        `;

    // Content
    const contentElement = document.createElement("div");
    if (typeof content === "string") {
      contentElement.innerHTML = content;
    } else {
      contentElement.appendChild(content);
    }
    contentElement.style.marginBottom = "20px";

    // Actions
    const actionsContainer = document.createElement("div");
    actionsContainer.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        `;

    actions.forEach(action => {
      const button = document.createElement("button");
      button.textContent = action.label;
      button.style.cssText = action.danger
        ? BUTTON_STYLES.secondary + BUTTON_STYLES.danger
        : BUTTON_STYLES.primary;
      button.style.minWidth = "100px";

      button.onmouseover = () => (button.style.opacity = "1");
      button.onmouseout = () =>
        (button.style.opacity = action.danger ? "0.8" : "0.9");

      button.onclick = () => {
        if (action.callback) {
          action.callback();
        }
        document.body.removeChild(modal);
      };

      actionsContainer.appendChild(button);
    });

    modalContent.appendChild(titleElement);
    modalContent.appendChild(contentElement);
    modalContent.appendChild(actionsContainer);
    modal.appendChild(modalContent);

    // Close on escape or background click
    modal.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        document.body.removeChild(modal);
      }
    });

    modal.onclick = e => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };

    document.body.appendChild(modal);
    modal.focus();

    return modal;
  }

  // ============= TARGET COINS CONFIGURATION =============

  function showTargetConfigPopup() {
    const currentTarget = data.getTargetCoins();

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
                            Current: ${core.state.totalCoins} coins
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

        data.setTargetCoins(target);
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

  // ============= SIMPLE STATS VIEW =============

  function showSimpleStats() {
    const currentStats = {
      cycles: core.state.totalCycles,
      coins: core.state.totalCoins,
      target: data.getTargetCoins(),
      runtime: core.state.autoStatsEnabled
        ? Date.now() - (core.state.autoStatsStartTime || core.state.startTime)
        : 0,
    };

    const hours = Math.floor(currentStats.runtime / 3600000);
    const minutes = Math.floor((currentStats.runtime % 3600000) / 60000);
    const coinsPerHour =
      currentStats.runtime > 0
        ? Math.round((currentStats.coins * 3600000) / currentStats.runtime)
        : 0;

    showModal(
      "📊 Current Stats",
      `
        <div style="text-align: center; font-size: 14px;">
          <div style="margin-bottom: 10px;">
            <span style="color: #4CAF50;">Cycles:</span> ${currentStats.cycles}
          </div>
          <div style="margin-bottom: 10px;">
            <span style="color: #FFD700;">Coins:</span> ${currentStats.coins} / ${currentStats.target}
          </div>
          <div style="margin-bottom: 10px;">
            <span style="color: #2196F3;">Runtime:</span> ${hours}h ${minutes}m
          </div>
          <div style="margin-bottom: 10px;">
            <span style="color: #FF9800;">Rate:</span> ${coinsPerHour} coins/hour
          </div>
        </div>
      `,
      [{ label: "Close", callback: null }]
    );
  }

  // ============= SETTINGS MANAGER =============

  const SettingsManager = {
    handle: function (action) {
      const setting = SETTINGS_MENU[action];
      if (!setting) return;

      switch (action) {
        case "view-stats":
          this.showStats();
          break;
        case "reset-stats":
          this.resetStats();
          break;
        case "clear-creds":
          this.clearCredentials();
          break;
      }
    },

    showStats: function () {
      showSimpleStats();
    },

    resetStats: function () {
      showModal(
        "🔄 Reset Stats",
        `
                    <div style="text-align: center; margin-bottom: 15px;">
                        <div style="font-size: 14px; margin-bottom: 10px;">
                            Are you sure you want to reset all statistics?
                        </div>
                        <div style="font-size: 12px; opacity: 0.8; color: #ffd700;">
                            Current: ${core.state.totalCycles} cycles, ${core.state.totalCoins} coins
                        </div>
                        <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">
                            This will reset cycles and coins to zero but keep target and history.
                        </div>
                    </div>
                `,
        [
          { label: "Cancel", callback: null },
          {
            label: "Reset Stats",
            danger: true,
            callback: () => {
              core.state.totalCycles = 0;
              core.state.totalCoins = 0;

              // Reset both start times to current time for accurate runtime calculation
              const now = Date.now();
              core.state.startTime = now;
              core.state.autoStatsStartTime = now;
              core.state.lastCycleTime = 0;

              localStorage.removeItem("ateex_stats");
              updateCounter();
              data.syncAllData();
              logSuccess("📊 Stats reset to zero - runtime restarted");
            },
          },
        ]
      );
    },

    clearCredentials: function () {
      showModal(
        "🔐 Clear Credentials",
        `
          <div style="text-align: center;">
            <div style="font-size: 14px; margin-bottom: 10px;">
              Clear saved login credentials?
            </div>
            <div style="font-size: 12px; opacity: 0.7;">
              You will need to enter username and password again.
            </div>
          </div>
        `,
        [
          { label: "Cancel", callback: null },
          {
            label: "Clear Credentials",
            danger: true,
            callback: () => {
              if (AteexModules.credentials) {
                AteexModules.credentials.clearCredentials();
                logSuccess("🔐 Credentials cleared");
              }
            },
          },
        ]
      );
    },
  };

  // ============= COUNTER UI =============

  function createCounterUI() {
    if (document.getElementById("ateex-counter") || window.ateexCounterCreated)
      return;

    if (window.top !== window.self) return;

    // Only create UI if auto stats is enabled
    if (!core.state.autoStatsEnabled) {
      core.logWithSpamControl(
        "⏳ Counter UI creation waiting - auto stats not enabled yet",
        "DEBUG",
        "counter_ui_waiting"
      );
      return;
    }

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
            <div id="target-progress" style="margin-top: 3px; font-size: 11px; opacity: 0.9;">Target: 0/${data.getTargetCoins()} (0%)</div>
            <div id="runtime">Runtime: 0m 0s</div>
            <div id="avg-time">Avg/cycle: --</div>
            <div id="coins-per-hour">Rate: 0 coins/h</div>
            <div id="eta-target" style="margin-top: 5px; font-size: 11px;">ETA Target: --</div>
            <div id="next-clear" style="margin-top: 3px; font-size: 10px; opacity: 0.8;">Next clear: --</div>
            <div id="best-server" style="margin-top: 3px; font-size: 10px; opacity: 0.8;">Server: --</div>
            <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
                <div style="display: flex; gap: 8px;">
                    <button id="set-target-btn" style="${
                      BUTTON_STYLES.primary
                    }">
                        🎯 Set Target
                    </button>
                    <button id="settings-btn" style="${
                      BUTTON_STYLES.secondary
                    }">
                        ⚙️ Settings
                    </button>
                </div>
            </div>
        `;

    document.body.appendChild(counterDiv);

    // Add event listeners for buttons
    const setTargetBtn = document.getElementById("set-target-btn");
    if (setTargetBtn) {
      setTargetBtn.onclick = async () => {
        const newTarget = await showTargetConfigPopup();
        if (newTarget) {
          // Force sync all data after target change
          data.syncAllData();
          logSuccess(`🎯 Target updated to ${newTarget} coins!`);
          updateCounter();
        }
      };
    }

    // Settings dropdown functionality
    const settingsBtn = document.getElementById("settings-btn");
    if (settingsBtn) {
      settingsBtn.onclick = () => showSettingsDropdown(settingsBtn);
    }

    // Add CSS for button hover effects
    const style = document.createElement("style");
    style.textContent = `
            #set-target-btn:hover, #settings-btn:hover {
                opacity: 1 !important;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }

            #ateex-settings-dropdown {
                animation: fadeIn 0.2s ease-out;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
    document.head.appendChild(style);

    window.ateexCounterCreated = true;
    log("Counter UI created");

    // Update counter immediately after creation to show current data
    updateCounter();
  }

  // Settings dropdown functionality
  function showSettingsDropdown(button) {
    // Remove existing dropdown if any
    const existingDropdown = document.getElementById("ateex-settings-dropdown");
    if (existingDropdown) {
      existingDropdown.remove();
      return;
    }

    const dropdown = document.createElement("div");
    dropdown.id = "ateex-settings-dropdown";
    dropdown.style.cssText = `
            position: absolute;
            top: ${button.offsetTop + button.offsetHeight + 5}px;
            left: ${button.offsetLeft}px;
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 10001;
            min-width: 200px;
            backdrop-filter: blur(10px);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

    // Create menu items
    Object.entries(SETTINGS_MENU).forEach(([key, setting]) => {
      const item = document.createElement("div");
      item.style.cssText = `
                padding: 12px 16px;
                color: white;
                cursor: pointer;
                font-size: 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                transition: background-color 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            `;

      if (setting.danger) {
        item.style.color = "#ff6b6b";
      }

      item.innerHTML = `
                <span style="font-size: 14px;">${setting.icon}</span>
                <div>
                    <div style="font-weight: 500;">${setting.label}</div>
                    <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${setting.description}</div>
                </div>
            `;

      item.onmouseover = () => {
        item.style.backgroundColor = setting.danger
          ? "rgba(255,107,107,0.2)"
          : "rgba(255,255,255,0.1)";
      };

      item.onmouseout = () => {
        item.style.backgroundColor = "transparent";
      };

      item.onclick = () => {
        SettingsManager.handle(key);
        dropdown.remove();
      };

      dropdown.appendChild(item);
    });

    // Position relative to counter
    const counter = document.getElementById("ateex-counter");
    if (counter) {
      counter.appendChild(dropdown);
    } else {
      document.body.appendChild(dropdown);
    }

    // Close dropdown when clicking outside
    setTimeout(() => {
      document.addEventListener("click", function closeDropdown(e) {
        if (!dropdown.contains(e.target) && e.target !== button) {
          dropdown.remove();
          document.removeEventListener("click", closeDropdown);
        }
      });
    }, 100);
  }

  function updateCounter() {
    if (window.top !== window.self) return;

    const counter = document.getElementById("ateex-counter");
    if (!counter) return;

    const state = core.state;
    const now = Date.now();

    // Calculate runtime from when auto stats actually started
    const runtimeStartTime = state.autoStatsStartTime || state.startTime;
    const runtime = state.autoStatsEnabled ? now - runtimeStartTime : 0;
    const runtimeMinutes = Math.floor(runtime / 60000);
    const runtimeSeconds = Math.floor((runtime % 60000) / 1000);

    const avgCycleTime =
      state.totalCycles > 0 ? runtime / state.totalCycles : 0;
    const coinsPerHour =
      runtime > 0 ? Math.round((state.totalCoins * 3600000) / runtime) : 0;

    // Use dynamic target coins
    const targetCoins = data.getTargetCoins();
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

    // Update server info
    if (
      !window.lastServerUpdate ||
      Date.now() - window.lastServerUpdate > 15000
    ) {
      try {
        if (AteexModules.recaptcha && AteexModules.recaptcha.getBestServer) {
          const bestServer = AteexModules.recaptcha.getBestServer();
          if (bestServer) {
            const serverName = bestServer
              .replace("https://", "")
              .replace(".pythonanywhere.com", "");
            const stats = data.getServerStats();
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
        } else {
          document.getElementById(
            "best-server"
          ).textContent = `🌐 Server: checking...`;
        }
      } catch (e) {
        document.getElementById(
          "best-server"
        ).textContent = `🌐 Server: checking...`;
      }
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

  // ============= EXPORTS =============

  exports.createCounterUI = createCounterUI;
  exports.updateCounter = updateCounter;
  exports.showModal = showModal;
  exports.showTargetConfigPopup = showTargetConfigPopup;
  exports.showSettingsDropdown = showSettingsDropdown;
  exports.SettingsManager = SettingsManager;
  exports.logout = logout;
})(exports);
