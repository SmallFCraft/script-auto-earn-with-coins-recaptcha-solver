/**
 * UI Management Module
 * Part of Ateex Auto v3.0 Modular Edition
 * Handles UI components, counter, settings menu, popups and modals
 */

// Load dependencies
const utils = ateexGlobalState.modulesLoaded.utils;
const data = ateexGlobalState.modulesLoaded.data;

const {
  logInfo,
  logError,
  logSuccess,
  logWarning,
  logDebug,
  createElement,
  addStyles,
  formatDuration,
  formatNumber,
  calculateRate,
  calculateETA,
} = utils;

const { getStatsummary, getTargetProgress, saveTarget, getHistory } = data;

// ============= UI CONSTANTS & STYLES =============

/**
 * Button styles configuration
 */
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

/**
 * Settings menu configuration
 */
const SETTINGS_MENU = {
  "view-history": {
    icon: "📊",
    label: "View History",
    description: "View stats history and analytics",
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
  "export-data": {
    icon: "📤",
    label: "Export Data",
    description: "Export all data to JSON file",
  },
  "clear-all": {
    icon: "🗑️",
    label: "Clear All Data",
    description: "Reset everything to initial state",
    danger: true,
  },
};

// ============= MAIN COUNTER UI =============

/**
 * Create main counter UI
 */
function createCounterUI() {
  if (document.getElementById("ateex-counter") || window.ateexCounterCreated) {
    return;
  }

  if (window.top !== window.self) return;

  // Only create UI if auto stats is enabled
  if (!ateexGlobalState.autoStatsEnabled) {
    logDebug("⏳ Counter UI creation waiting - auto stats not enabled yet");
    return;
  }

  const counterDiv = createElement("div", {
    id: "ateex-counter",
    style: {
      position: "fixed",
      top: "10px",
      right: "10px",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      padding: "15px",
      borderRadius: "10px",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontSize: "12px",
      zIndex: "10000",
      boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
      minWidth: "200px",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.2)",
    },
  });

  // Get target for display
  const targetProgress = getTargetProgress();
  const targetCoins = targetProgress ? targetProgress.target : 1000;

  counterDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">🚀 Ateex Auto Stats</div>
    <div id="cycles-count">Cycles: 0</div>
    <div id="coins-count">Coins: 0 💰</div>
    <div id="target-progress" style="margin-top: 3px; font-size: 11px; opacity: 0.9;">Target: 0/${targetCoins} (0%)</div>
    <div id="runtime">Runtime: 0m 0s</div>
    <div id="avg-time">Avg/cycle: --</div>
    <div id="coins-per-hour">Rate: 0 coins/h</div>
    <div id="eta-target" style="margin-top: 5px; font-size: 11px;">ETA Target: --</div>
    <div id="next-clear" style="margin-top: 3px; font-size: 10px; opacity: 0.8;">Next clear: --</div>
    <div id="best-server" style="margin-top: 3px; font-size: 10px; opacity: 0.8;">Server: --</div>
    <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
      <div style="display: flex; gap: 8px;">
        <button id="set-target-btn" style="${BUTTON_STYLES.primary}">
          🎯 Set Target
        </button>
        <button id="settings-btn" style="${BUTTON_STYLES.secondary}">
          ⚙️ Settings
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(counterDiv);

  // Add event listeners
  setupCounterEventListeners();

  // Add CSS animations
  addCounterStyles();

  window.ateexCounterCreated = true;
  logInfo("Counter UI created");

  // Update counter immediately
  updateCounter();
}

/**
 * Setup event listeners for counter buttons
 */
function setupCounterEventListeners() {
  const setTargetBtn = document.getElementById("set-target-btn");
  if (setTargetBtn) {
    setTargetBtn.onclick = async () => {
      const newTarget = await showTargetConfigPopup();
      if (newTarget) {
        logSuccess(`🎯 Target updated to ${formatNumber(newTarget)} coins!`);
        updateCounter(); // Refresh display
      }
    };
  }

  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) {
    settingsBtn.onclick = () => showSettingsDropdown(settingsBtn);
  }
}

/**
 * Add CSS styles for counter animations
 */
function addCounterStyles() {
  const css = `
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

    .ateex-modal {
      animation: modalFadeIn 0.3s ease-out;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
  `;

  addStyles(css);
}

/**
 * Update counter display
 */
function updateCounter() {
  if (window.top !== window.self) return;

  const counter = document.getElementById("ateex-counter");
  if (!counter) return;

  const stats = getStatsummary();
  const targetProgress = getTargetProgress();

  // Update cycles and coins
  const cyclesEl = document.getElementById("cycles-count");
  if (cyclesEl) cyclesEl.textContent = `Cycles: ${stats.cycles}`;

  const coinsEl = document.getElementById("coins-count");
  if (coinsEl) coinsEl.textContent = `Coins: ${stats.coins} 💰`;

  // Update target progress
  const targetEl = document.getElementById("target-progress");
  if (targetEl && targetProgress) {
    targetEl.textContent = `Target: ${stats.coins}/${formatNumber(
      targetProgress.target
    )} (${Math.round(targetProgress.progress)}%)`;
  }

  // Update runtime
  const runtimeEl = document.getElementById("runtime");
  if (runtimeEl) runtimeEl.textContent = `Runtime: ${stats.runtimeFormatted}`;

  // Update average cycle time
  const avgTimeEl = document.getElementById("avg-time");
  if (avgTimeEl) {
    const avgTime = stats.cycles > 0 ? stats.runtime / stats.cycles : 0;
    const avgDisplay =
      avgTime > 0 ? `${Math.round(avgTime / 1000)}s` : "calculating...";
    avgTimeEl.textContent = `Avg/cycle: ${avgDisplay}`;
  }

  // Update coins per hour
  const rateEl = document.getElementById("coins-per-hour");
  if (rateEl) rateEl.textContent = `Rate: ${stats.coinRate} coins/h`;

  // Update ETA
  const etaEl = document.getElementById("eta-target");
  if (etaEl && targetProgress) {
    etaEl.textContent = `ETA Target: ${targetProgress.eta}`;
  }

  logDebug("Counter UI updated");
}

// ============= SETTINGS DROPDOWN =============

/**
 * Show settings dropdown menu
 */
function showSettingsDropdown(button) {
  // Remove existing dropdown
  const existing = document.getElementById("ateex-settings-dropdown");
  if (existing) {
    existing.remove();
    return;
  }

  const dropdown = createElement("div", {
    id: "ateex-settings-dropdown",
    style: {
      position: "absolute",
      top: `${button.offsetTop + button.offsetHeight + 5}px`,
      left: `${button.offsetLeft}px`,
      background: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "8px",
      boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
      zIndex: "10001",
      minWidth: "200px",
      backdropFilter: "blur(10px)",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
  });

  // Create menu items
  Object.entries(SETTINGS_MENU).forEach(([key, setting]) => {
    const item = createElement("div", {
      style: {
        padding: "12px 16px",
        color: setting.danger ? "#ff6b6b" : "white",
        cursor: "pointer",
        fontSize: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        transition: "background-color 0.2s ease",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      },
    });

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
      handleSettingsAction(key);
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

  // Close on outside click
  setTimeout(() => {
    document.addEventListener("click", function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== button) {
        dropdown.remove();
        document.removeEventListener("click", closeDropdown);
      }
    });
  }, 100);
}

// ============= MODAL SYSTEM =============

/**
 * Create unified modal
 */
function createModal(title, content, actions = []) {
  const modal = createElement("div", {
    className: "ateex-modal",
    style: {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: "99999",
      backdropFilter: "blur(5px)",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
  });

  const modalContent = createElement("div", {
    style: {
      background: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
      color: "white",
      borderRadius: "15px",
      padding: "25px",
      maxWidth: "500px",
      maxHeight: "80vh",
      overflowY: "auto",
      boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.2)",
    },
  });

  // Title
  const titleEl = createElement(
    "h2",
    {
      style: {
        margin: "0 0 20px 0",
        textAlign: "center",
        fontSize: "18px",
      },
    },
    title
  );

  // Content
  const contentEl = createElement("div", {
    style: { marginBottom: "20px" },
  });
  contentEl.innerHTML = content;

  // Actions
  const actionsEl = createElement("div", {
    style: {
      display: "flex",
      gap: "10px",
      justifyContent: "center",
    },
  });

  actions.forEach(action => {
    const button = createElement(
      "button",
      {
        style: action.danger
          ? BUTTON_STYLES.secondary + BUTTON_STYLES.danger
          : BUTTON_STYLES.primary,
      },
      action.label
    );

    button.onclick = () => {
      if (action.callback) action.callback();
      document.body.removeChild(modal);
    };

    actionsEl.appendChild(button);
  });

  modalContent.appendChild(titleEl);
  modalContent.appendChild(contentEl);
  modalContent.appendChild(actionsEl);
  modal.appendChild(modalContent);

  return modal;
}

// ============= POPUPS & DIALOGS =============

/**
 * Show target configuration popup
 */
function showTargetConfigPopup() {
  return new Promise(resolve => {
    const targetProgress = getTargetProgress();
    const currentTarget = targetProgress ? targetProgress.target : 1000;

    const modal = createModal(
      "🎯 Set Target Coins",
      `
        <div style="text-align: center;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Target Coins:</label>
            <input type="number" id="target-coins-input" value="${currentTarget}"
                   min="1" max="100000"
                   style="width: 200px; padding: 10px; border: 2px solid #ddd; border-radius: 5px;
                          font-size: 14px; text-align: center; background: #f8f9fa;">
          </div>
          <div id="target-error" style="color: #ff6b6b; font-size: 12px; margin-top: 10px; display: none;"></div>
        </div>
      `,
      [
        { label: "Cancel", callback: () => resolve(null) },
        {
          label: "Save Target",
          callback: () => {
            const input = document.getElementById("target-coins-input");
            const target = parseInt(input.value);

            if (!target || target < 1) {
              showError("Please enter a valid target (minimum 1 coin)");
              return;
            }

            if (target > 100000) {
              showError("Target too high (maximum 100,000 coins)");
              return;
            }

            saveTarget(target);
            resolve(target);
          },
        },
      ]
    );

    document.body.appendChild(modal);

    // Focus input
    setTimeout(() => {
      const input = document.getElementById("target-coins-input");
      if (input) input.focus();
    }, 100);

    function showError(message) {
      const errorDiv = document.getElementById("target-error");
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        setTimeout(() => (errorDiv.style.display = "none"), 5000);
      }
    }
  });
}

/**
 * Show stats history popup
 */
function showStatsHistoryPopup() {
  const history = getHistory();

  let historyHtml = "";
  if (history.sessions && history.sessions.length > 0) {
    historyHtml = history.sessions
      .slice(-10) // Show last 10 sessions
      .reverse()
      .map(entry => {
        const date = new Date(entry.startTime);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString();
        const runtime = entry.runtime || 0;
        const runtimeHours = Math.floor(runtime / (1000 * 60 * 60));
        const runtimeMinutes = Math.floor(
          (runtime % (1000 * 60 * 60)) / (1000 * 60)
        );
        const coinsPerHour =
          entry.coins && runtime > 0
            ? Math.round((entry.coins / runtime) * (1000 * 60 * 60))
            : 0;

        return `
          <div style="margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.1);
                      border-radius: 5px; font-size: 11px;">
            <div style="font-weight: bold;">${dateStr} ${timeStr}</div>
            <div>Cycles: ${entry.cycles} | Coins: ${entry.coins}</div>
            <div>Runtime: ${runtimeHours}h ${runtimeMinutes}m | Rate: ${coinsPerHour}/h</div>
          </div>
        `;
      })
      .join("");
  } else {
    historyHtml = `
      <div style="text-align: center; opacity: 0.7; font-style: italic;">
        No history data available yet.<br>
        Start earning to see your progress here!
      </div>
    `;
  }

  const modal = createModal(
    "📊 Stats History",
    `
      <div style="max-height: 400px; overflow-y: auto;">
        ${historyHtml}
      </div>
    `,
    [{ label: "Close", callback: null }]
  );

  document.body.appendChild(modal);
}

/**
 * Handle settings actions
 */
function handleSettingsAction(action) {
  const credentials = ateexGlobalState.modulesLoaded.credentials;

  switch (action) {
    case "view-history":
      showStatsHistoryPopup();
      break;

    case "reset-stats":
      const modal = createModal(
        "🔄 Reset Stats",
        `
          <div style="text-align: center; margin-bottom: 15px;">
            <div style="font-size: 14px; margin-bottom: 10px;">
              Are you sure you want to reset all statistics?
            </div>
            <div style="font-size: 12px; opacity: 0.8; color: #ffd700;">
              Current: ${ateexGlobalState.totalCycles} cycles, ${ateexGlobalState.totalCoins} coins
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
              data.resetStats();
              updateCounter();
              logSuccess("🔄 Stats reset successfully");
            },
          },
        ]
      );
      document.body.appendChild(modal);
      break;

    case "clear-creds":
      if (credentials) {
        credentials.clearCredentials();
        logSuccess("🔐 Credentials cleared");
      }
      break;

    case "export-data":
      data.exportData();
      break;

    case "clear-all":
      const clearModal = createModal(
        "🗑️ Clear All Data",
        `
          <div style="text-align: center;">
            <div style="font-size: 14px; margin-bottom: 10px; color: #ff6b6b;">
              ⚠️ WARNING: This will delete EVERYTHING!
            </div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 10px;">
              • All statistics and history<br>
              • Saved credentials<br>
              • Target settings<br>
              • All cached data
            </div>
            <div style="font-size: 12px; opacity: 0.7; color: #ffd700;">
              This action cannot be undone!
            </div>
          </div>
        `,
        [
          { label: "Cancel", callback: null },
          {
            label: "DELETE EVERYTHING",
            danger: true,
            callback: () => {
              data.clearAllData();
              if (credentials) credentials.clearCredentials();

              // Remove UI
              const counter = document.getElementById("ateex-counter");
              if (counter) counter.remove();
              window.ateexCounterCreated = false;

              logSuccess("🗑️ All data cleared - complete fresh start!");

              // Reload page after short delay
              setTimeout(() => window.location.reload(), 1000);
            },
          },
        ]
      );
      document.body.appendChild(clearModal);
      break;
  }
}

// ============= MODULE EXPORTS =============

module.exports = {
  // Main UI functions
  createCounterUI,
  updateCounter,

  // Settings and dropdowns
  showSettingsDropdown,
  handleSettingsAction,

  // Popups and dialogs
  showTargetConfigPopup,
  showStatsHistoryPopup,

  // Modal system
  createModal,

  // Styles and constants
  BUTTON_STYLES,
  SETTINGS_MENU,

  // Event handlers
  setupCounterEventListeners,
  addCounterStyles,
};
