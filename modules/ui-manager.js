// ============= UI MANAGER MODULE =============
// This module handles all UI components, counter, modals, and user interactions

(function() {
  "use strict";

  const context = window.ateexContext;
  const utils = context.utils;
  
  context.log("Loading UI Manager Module...", "INFO");

  // ============= UI STATE =============

  let uiState = {
    counterCreated: false,
    counterVisible: true,
    currentModal: null,
    updateInterval: null,
    lastUpdate: 0
  };

  // ============= BUTTON STYLES =============

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

  // ============= MODAL SYSTEM =============

  // Create unified modal
  function createModal(title, content, actions = []) {
    // Close existing modal if any
    if (uiState.currentModal) {
      closeModal();
    }

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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
        closeModal();
      };

      actionsContainer.appendChild(button);
    });

    modalContent.appendChild(titleElement);
    modalContent.appendChild(contentElement);
    modalContent.appendChild(actionsContainer);
    modal.appendChild(modalContent);

    // Event handlers
    modal.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeModal();
      }
    });

    modal.onclick = e => {
      if (e.target === modal) {
        closeModal();
      }
    };

    document.body.appendChild(modal);
    modal.focus();

    uiState.currentModal = modal;
    return modal;
  }

  // Close current modal
  function closeModal() {
    if (uiState.currentModal) {
      document.body.removeChild(uiState.currentModal);
      uiState.currentModal = null;
    }
  }

  // ============= COUNTER UI =============

  // Create counter UI
  function createCounterUI() {
    if (uiState.counterCreated || window.ateexCounterCreated) {
      context.logDebug("Counter UI already created");
      return;
    }

    if (window.top !== window.self) {
      context.logDebug("Not in main window, skipping counter creation");
      return;
    }

    const counter = document.createElement("div");
    counter.id = "ateex-counter";
    counter.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 12px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      min-width: 200px;
      cursor: move;
      user-select: none;
    `;

    counter.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div style="font-weight: bold; font-size: 14px;">🚀 Ateex Auto</div>
        <div style="display: flex; gap: 5px;">
          <button id="ateex-settings" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
          ">⚙️</button>
          <button id="ateex-toggle" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
          ">−</button>
        </div>
      </div>
      <div id="ateex-content">
        <div id="ateex-stats" style="margin-bottom: 8px;">
          <div>📊 Cycles: <span id="cycles-count">0</span></div>
          <div>💰 Coins: <span id="coins-count">0</span></div>
          <div>🎯 Target: <span id="target-count">1000</span></div>
          <div>⏱️ Runtime: <span id="runtime-display">0s</span></div>
          <div>📈 Rate: <span id="rate-display">0/h</span></div>
          <div>⏳ ETA: <span id="eta-display">Calculating...</span></div>
        </div>
        <div style="display: flex; gap: 5px; margin-top: 10px;">
          <button id="ateex-target" style="${BUTTON_STYLES.primary}">🎯 Target</button>
          <button id="ateex-history" style="${BUTTON_STYLES.secondary}">📊 History</button>
        </div>
      </div>
    `;

    document.body.appendChild(counter);

    // Make draggable
    makeDraggable(counter);

    // Add event listeners
    setupCounterEventListeners();

    uiState.counterCreated = true;
    window.ateexCounterCreated = true;

    context.logSuccess("Counter UI created successfully");

    // Start update interval
    startCounterUpdates();
  }

  // Make element draggable
  function makeDraggable(element) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    element.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    function dragStart(e) {
      if (e.target.tagName === 'BUTTON') return;
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target === element) {
        isDragging = true;
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
    }

    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }
  }

  // Setup counter event listeners
  function setupCounterEventListeners() {
    const settingsBtn = document.getElementById("ateex-settings");
    const toggleBtn = document.getElementById("ateex-toggle");
    const targetBtn = document.getElementById("ateex-target");
    const historyBtn = document.getElementById("ateex-history");

    if (settingsBtn) {
      settingsBtn.onclick = showSettingsMenu;
    }

    if (toggleBtn) {
      toggleBtn.onclick = toggleCounter;
    }

    if (targetBtn) {
      targetBtn.onclick = showTargetModal;
    }

    if (historyBtn) {
      historyBtn.onclick = showHistoryModal;
    }
  }

  // Toggle counter visibility
  function toggleCounter() {
    const content = document.getElementById("ateex-content");
    const toggleBtn = document.getElementById("ateex-toggle");
    
    if (content && toggleBtn) {
      uiState.counterVisible = !uiState.counterVisible;
      content.style.display = uiState.counterVisible ? "block" : "none";
      toggleBtn.textContent = uiState.counterVisible ? "−" : "+";
    }
  }

  // Update counter display
  function updateCounter() {
    if (!uiState.counterCreated) return;

    const state = context.state;
    const stats = context.stats ? context.stats.getMetrics() : null;
    const eta = context.stats ? context.stats.calculateETA() : null;

    // Update basic stats
    const cyclesElement = document.getElementById("cycles-count");
    const coinsElement = document.getElementById("coins-count");
    const targetElement = document.getElementById("target-count");
    const runtimeElement = document.getElementById("runtime-display");
    const rateElement = document.getElementById("rate-display");
    const etaElement = document.getElementById("eta-display");

    if (cyclesElement) cyclesElement.textContent = utils.formatNumber(state.totalCycles);
    if (coinsElement) coinsElement.textContent = utils.formatNumber(state.totalCoins);
    if (targetElement) targetElement.textContent = utils.formatNumber(context.stats ? context.stats.getTargetCoins() : 1000);
    
    if (stats) {
      if (runtimeElement) runtimeElement.textContent = stats.runtimeFormatted;
      if (rateElement) rateElement.textContent = `${stats.coinsPerHour}/h`;
    }
    
    if (eta && etaElement) {
      etaElement.textContent = eta.message || "Calculating...";
    }

    uiState.lastUpdate = Date.now();
  }

  // Start counter update interval
  function startCounterUpdates() {
    if (uiState.updateInterval) {
      clearInterval(uiState.updateInterval);
    }

    uiState.updateInterval = setInterval(updateCounter, 1000);
    context.logDebug("Counter update interval started");
  }

  // Stop counter updates
  function stopCounterUpdates() {
    if (uiState.updateInterval) {
      clearInterval(uiState.updateInterval);
      uiState.updateInterval = null;
      context.logDebug("Counter update interval stopped");
    }
  }

  // ============= SETTINGS MENU =============

  // Show settings dropdown
  function showSettingsMenu() {
    const settingsMenu = [
      {
        icon: "📊",
        label: "View History",
        action: showHistoryModal
      },
      {
        icon: "🎯",
        label: "Set Target",
        action: showTargetModal
      },
      {
        icon: "🔄",
        label: "Reset Stats",
        action: showResetStatsModal,
        danger: true
      },
      {
        icon: "🔐",
        label: "Clear Credentials",
        action: showClearCredentialsModal,
        danger: true
      },
      {
        icon: "📤",
        label: "Export Data",
        action: exportAllData
      }
    ];

    const dropdown = document.createElement("div");
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      right: 0;
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      min-width: 180px;
      z-index: 10001;
      margin-top: 5px;
    `;

    settingsMenu.forEach(item => {
      const menuItem = document.createElement("div");
      menuItem.style.cssText = `
        padding: 10px 15px;
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: 12px;
        color: ${item.danger ? '#ff6b6b' : 'white'};
        border-bottom: 1px solid rgba(255,255,255,0.1);
      `;
      menuItem.innerHTML = `${item.icon} ${item.label}`;

      menuItem.onmouseover = () => {
        menuItem.style.backgroundColor = item.danger
          ? "rgba(255,107,107,0.2)"
          : "rgba(255,255,255,0.1)";
      };

      menuItem.onmouseout = () => {
        menuItem.style.backgroundColor = "transparent";
      };

      menuItem.onclick = () => {
        item.action();
        dropdown.remove();
      };

      dropdown.appendChild(menuItem);
    });

    // Position relative to counter
    const counter = document.getElementById("ateex-counter");
    if (counter) {
      counter.style.position = "relative";
      counter.appendChild(dropdown);
    }

    // Close dropdown when clicking outside
    setTimeout(() => {
      document.addEventListener("click", function closeDropdown(e) {
        if (!dropdown.contains(e.target)) {
          dropdown.remove();
          document.removeEventListener("click", closeDropdown);
        }
      });
    }, 100);
  }

  // ============= MODAL DIALOGS =============

  // Show target coins modal
  function showTargetModal() {
    const currentTarget = context.stats ? context.stats.getTargetCoins() : 1000;
    
    const content = `
      <div style="text-align: center;">
        <p style="margin-bottom: 20px;">Set your coin earning goal. ETA will be calculated based on this target.</p>
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
            background: rgba(255,255,255,0.9);
            color: #333;
          ">
          <div style="margin-top: 5px; font-size: 11px; opacity: 0.8;">
            Current: ${context.state.totalCoins} coins
          </div>
        </div>
      </div>
    `;

    createModal("🎯 Set Target Coins", content, [
      { label: "Cancel" },
      {
        label: "Save Target",
        callback: () => {
          const input = document.getElementById("target-coins-input");
          const target = parseInt(input.value);
          
          if (target && target > 0 && target <= 100000) {
            if (context.stats) {
              context.stats.setTargetCoins(target);
              updateCounter();
            }
          }
        }
      }
    ]);

    // Focus input
    setTimeout(() => {
      const input = document.getElementById("target-coins-input");
      if (input) input.focus();
    }, 100);
  }

  // Show history modal
  function showHistoryModal() {
    const history = context.stats ? context.stats.getHistory() : [];
    
    let historyHtml = "";
    if (history.length === 0) {
      historyHtml = "<div style='text-align: center; opacity: 0.7;'>No history data available yet.</div>";
    } else {
      const recentHistory = history.slice(-10).reverse();
      historyHtml = recentHistory.map(entry => {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleTimeString();
        const dateStr = date.toLocaleDateString();
        const runtimeHours = Math.floor(entry.runtime / 3600000);
        const runtimeMinutes = Math.floor((entry.runtime % 3600000) / 60000);

        return `
          <div style="
            margin-bottom: 10px;
            padding: 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 5px;
            font-size: 11px;
          ">
            <div style="font-weight: bold;">${dateStr} ${timeStr}</div>
            <div>Cycles: ${entry.totalCycles} | Coins: ${entry.totalCoins}/${entry.targetCoins}</div>
            <div>Runtime: ${runtimeHours}h ${runtimeMinutes}m | Rate: ${entry.coinsPerHour}/h</div>
          </div>
        `;
      }).join("");
    }

    createModal("📊 Stats History", historyHtml, [
      { label: "Close" }
    ]);
  }

  // Show reset stats modal
  function showResetStatsModal() {
    const content = `
      <div style="text-align: center;">
        <div style="font-size: 14px; margin-bottom: 10px;">
          Are you sure you want to reset all statistics?
        </div>
        <div style="font-size: 12px; opacity: 0.8; color: #ffd700;">
          Current: ${context.state.totalCycles} cycles, ${context.state.totalCoins} coins
        </div>
        <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">
          This will reset cycles and coins to zero but keep target and history.
        </div>
      </div>
    `;

    createModal("🔄 Reset Stats", content, [
      { label: "Cancel" },
      {
        label: "Reset Stats",
        danger: true,
        callback: () => {
          if (context.stats) {
            context.stats.resetStats();
            updateCounter();
          }
        }
      }
    ]);
  }

  // Show clear credentials modal
  function showClearCredentialsModal() {
    const content = `
      <div style="text-align: center;">
        <div style="font-size: 14px; margin-bottom: 10px;">
          Clear saved login credentials?
        </div>
        <div style="font-size: 12px; opacity: 0.7;">
          You will need to enter username and password again.
        </div>
      </div>
    `;

    createModal("🔐 Clear Credentials", content, [
      { label: "Cancel" },
      {
        label: "Clear Credentials",
        danger: true,
        callback: () => {
          if (context.credentials) {
            context.credentials.clear();
          }
        }
      }
    ]);
  }

  // Export all data
  function exportAllData() {
    try {
      const data = {
        stats: context.stats ? context.stats.getMetrics() : {},
        history: context.stats ? context.stats.getHistory() : [],
        exportDate: new Date().toISOString(),
        version: context.config.version
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ateex-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      context.logSuccess("📤 Data exported successfully");
    } catch (e) {
      context.logError("Export failed", e);
    }
  }

  // ============= EVENT LISTENERS =============

  // Listen for events from other modules
  context.on('cycleCompleted', updateCounter);
  context.on('targetCoinsChanged', updateCounter);
  context.on('statsReset', updateCounter);
  context.on('autoStatsEnabled', () => {
    if (!uiState.counterCreated) {
      createCounterUI();
    }
  });

  // ============= EXPORT TO SHARED CONTEXT =============

  // Add UI functions to context
  context.ui = {
    createCounter: createCounterUI,
    updateCounter: updateCounter,
    toggleCounter: toggleCounter,
    createModal: createModal,
    closeModal: closeModal,
    showSettings: showSettingsMenu,
    showTarget: showTargetModal,
    showHistory: showHistoryModal,
    startUpdates: startCounterUpdates,
    stopUpdates: stopCounterUpdates,
    getState: () => ({ ...uiState })
  };

  // Add to global scope for backward compatibility
  Object.assign(window, {
    createCounterUI,
    updateCounter,
    showTargetConfigPopup: showTargetModal,
    showStatsHistoryPopup: showHistoryModal
  });

  // Mark module as loaded
  context.state.modulesLoaded['ui-manager'] = true;
  context.modules['ui-manager'] = context.ui;

  context.log("UI Manager Module loaded successfully!", "SUCCESS");

})();
