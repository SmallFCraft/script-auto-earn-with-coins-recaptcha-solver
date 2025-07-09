/**
 * UI Module - Enhanced User Interface Management
 * Orchestrates counter display, modals, settings, and all user interface elements
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const coreModule = AteexModules.coreModule;
  const statsManager = AteexModules.statsManager;
  const dataModule = AteexModules.dataModule;
  const modalFactory = AteexModules.modalFactory;
  const statsDisplay = AteexModules.statsDisplay;
  const credentialsModule = AteexModules.credentialsModule;
  const errorManager = AteexModules.errorManager;
  const domUtils = AteexModules.domUtils;

  const { UI_CONFIG, DATA_CONFIG, SETTINGS_CONFIG } = constants;

  // ============= UI MANAGER CLASS =============

  class UIManager {
    constructor() {
      this.isInitialized = false;
      this.counterElement = null;
      this.updateInterval = null;
      this.notifications = new Map();
      this.settingsDropdown = null;
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
    }

    // ============= INITIALIZATION =============

    async initialize() {
      if (this.isInitialized) {
        return true;
      }

      try {
        // Initialize dependencies
        await modalFactory.initialize();
        await statsDisplay.initialize();

        // Inject UI styles
        this.injectUIStyles();

        // Set up event listeners
        this.setupEventListeners();

        // Set up periodic updates
        this.setupPeriodicUpdates();

        this.isInitialized = true;
        errorManager.logSuccess("UI Manager", "Initialized successfully");
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "ui_manager_init",
          category: "ui",
        });
        return false;
      }
    }

    // Inject CSS styles for UI components
    injectUIStyles() {
      const styles = `
        .ateex-counter {
          position: fixed;
          top: 10px;
          right: 10px;
          background: linear-gradient(135deg, ${
            UI_CONFIG.COLORS.PRIMARY
          } 0%, #764ba2 100%);
          color: white;
          padding: 16px;
          border-radius: 12px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 12px;
          z-index: ${UI_CONFIG.COUNTER.Z_INDEX};
          box-shadow: 0 6px 20px rgba(0,0,0,0.25);
          min-width: 220px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          cursor: move;
          user-select: none;
          transition: all 0.3s ease;
        }

        .ateex-counter:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .ateex-counter.dragging {
          transform: rotate(5deg);
          z-index: ${UI_CONFIG.COUNTER.Z_INDEX + 1};
        }

        .ateex-counter-header {
          font-weight: bold;
          margin-bottom: 10px;
          font-size: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          padding-bottom: 8px;
        }

        .ateex-counter-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ateex-counter-controls {
          display: flex;
          gap: 6px;
        }

        .ateex-counter-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
        }

        .ateex-counter-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.05);
        }

        .ateex-counter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          padding: 2px 0;
        }

        .ateex-counter-label {
          font-weight: 500;
          opacity: 0.9;
        }

        .ateex-counter-value {
          font-weight: bold;
          text-align: right;
        }

        .ateex-progress-bar {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
          overflow: hidden;
          margin: 8px 0;
        }

        .ateex-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
          border-radius: 3px;
          transition: width 0.5s ease;
          position: relative;
        }

        .ateex-progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .ateex-status-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
          animation: pulse 2s infinite;
        }

        .ateex-status-indicator.active {
          background: #22c55e;
        }

        .ateex-status-indicator.paused {
          background: #f59e0b;
        }

        .ateex-status-indicator.error {
          background: #ef4444;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .ateex-settings-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border: 1px solid #e5e7eb;
          min-width: 200px;
          z-index: ${UI_CONFIG.COUNTER.Z_INDEX + 1};
          font-size: 13px;
          color: #374151;
          margin-top: 8px;
          animation: dropdownFadeIn 0.2s ease-out;
        }

        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ateex-settings-item {
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid #f3f4f6;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ateex-settings-item:last-child {
          border-bottom: none;
        }

        .ateex-settings-item:hover {
          background: #f9fafb;
        }

        .ateex-settings-item.danger:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        .ateex-settings-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
        }

        .ateex-settings-content {
          flex: 1;
        }

        .ateex-settings-label {
          font-weight: 500;
          margin-bottom: 2px;
        }

        .ateex-settings-description {
          font-size: 11px;
          opacity: 0.7;
          line-height: 1.3;
        }

        .ateex-notification {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          color: #374151;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border-left: 4px solid;
          font-size: 14px;
          z-index: ${UI_CONFIG.NOTIFICATION.Z_INDEX};
          max-width: 400px;
          animation: notificationSlideIn 0.3s ease-out;
        }

        .ateex-notification.success {
          border-left-color: #22c55e;
          background: #f0fdf4;
        }

        .ateex-notification.error {
          border-left-color: #ef4444;
          background: #fef2f2;
        }

        .ateex-notification.warning {
          border-left-color: #f59e0b;
          background: #fffbeb;
        }

        .ateex-notification.info {
          border-left-color: #3b82f6;
          background: #eff6ff;
        }

        @keyframes notificationSlideIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .ateex-notification.removing {
          animation: notificationSlideOut 0.3s ease-in forwards;
        }

        @keyframes notificationSlideOut {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
        }

        .ateex-counter-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.2);
        }

        .ateex-action-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: rgba(255,255,255,0.2);
          color: white;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.2s;
          text-align: center;
        }

        .ateex-action-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-1px);
        }

        .ateex-action-btn.primary {
          background: rgba(255,255,255,0.9);
          color: ${UI_CONFIG.COLORS.PRIMARY};
          font-weight: 600;
        }

        .ateex-action-btn.primary:hover {
          background: white;
        }
      `;

      domUtils.injectCSS(styles, "ateex-ui-styles");
    }

    // Set up event listeners
    setupEventListeners() {
      // Listen for stats updates
      if (coreModule.on) {
        coreModule.on("statsUpdated", () => {
          this.updateCounter();
        });

        coreModule.on("targetReached", () => {
          this.showNotification(
            "🎉 Target reached! Congratulations!",
            "success",
            10000
          );
        });

        coreModule.on("autoStatsEnabled", () => {
          this.ensureCounterExists();
        });

        coreModule.on("autoStatsDisabled", () => {
          this.hideCounter();
        });
      }

      // Global click handler for closing dropdowns
      document.addEventListener("click", e => {
        if (
          this.settingsDropdown &&
          !this.settingsDropdown.contains(e.target)
        ) {
          this.closeSettingsDropdown();
        }
      });

      // Global key handlers
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          this.closeSettingsDropdown();
        }
      });
    }

    // Set up periodic updates
    setupPeriodicUpdates() {
      // Update counter every 2 seconds
      this.updateInterval = setInterval(() => {
        this.updateCounter();
      }, 2000);
    }

    // ============= COUNTER MANAGEMENT =============

    // Create or ensure counter exists
    ensureCounterExists() {
      if (this.counterElement || window.top !== window.self) {
        return;
      }

      // Only create if auto stats is enabled
      if (!statsManager.isAutoStatsActive()) {
        errorManager.logDebug(
          "UI",
          "Counter creation waiting - auto stats not enabled"
        );
        return;
      }

      this.createCounter();
    }

    // Create the main counter UI
    createCounter() {
      if (this.counterElement) {
        return;
      }

      const counter = domUtils.createElement("div", {
        id: "ateex-counter",
        class: "ateex-counter",
      });

      // Make it draggable
      this.makeDraggable(counter);

      // Build counter content
      counter.innerHTML = this.buildCounterHTML();

      // Add event listeners
      this.attachCounterEvents(counter);

      // Add to page
      document.body.appendChild(counter);
      this.counterElement = counter;

      // Initial update
      this.updateCounter();

      errorManager.logSuccess("UI", "Counter created successfully");
    }

    // Build counter HTML structure
    buildCounterHTML() {
      return `
        <div class="ateex-counter-header">
          <div class="ateex-counter-title">
            <span class="ateex-status-indicator active"></span>
            <span>🚀 Ateex Auto v4.0</span>
          </div>
          <div class="ateex-counter-controls">
            <button class="ateex-counter-btn" data-action="minimize" title="Minimize">−</button>
            <button class="ateex-counter-btn" data-action="settings" title="Settings">⚙️</button>
          </div>
        </div>
        
        <div class="ateex-counter-content">
          <div class="ateex-counter-row">
            <span class="ateex-counter-label">🔄 Cycles:</span>
            <span class="ateex-counter-value" id="cycles-count">0</span>
          </div>
          
          <div class="ateex-counter-row">
            <span class="ateex-counter-label">🪙 Coins:</span>
            <span class="ateex-counter-value" id="coins-count">0</span>
          </div>
          
          <div class="ateex-progress-bar">
            <div class="ateex-progress-fill" id="progress-fill" style="width: 0%"></div>
          </div>
          <div class="ateex-counter-row" style="font-size: 10px; opacity: 0.8;">
            <span id="target-progress">Target: 0/1000 (0%)</span>
          </div>
          
          <div class="ateex-counter-row">
            <span class="ateex-counter-label">⏱️ Runtime:</span>
            <span class="ateex-counter-value" id="runtime">0m</span>
          </div>
          
          <div class="ateex-counter-row">
            <span class="ateex-counter-label">⚡ Rate:</span>
            <span class="ateex-counter-value" id="coins-per-hour">0/h</span>
          </div>
          
          <div class="ateex-counter-row">
            <span class="ateex-counter-label">📊 Avg/cycle:</span>
            <span class="ateex-counter-value" id="avg-time">--</span>
          </div>
        </div>
        
        <div class="ateex-counter-actions">
          <button class="ateex-action-btn" data-action="stats">📊 Stats</button>
          <button class="ateex-action-btn primary" data-action="target">🎯 Target</button>
        </div>
      `;
    }

    // Attach counter event listeners
    attachCounterEvents(counter) {
      // Action buttons
      counter.addEventListener("click", e => {
        const action = e.target.dataset.action;
        if (action) {
          this.handleCounterAction(action, e.target);
        }
      });

      // Prevent dragging when clicking buttons
      counter.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("mousedown", e => {
          e.stopPropagation();
        });
      });
    }

    // Handle counter actions
    handleCounterAction(action, target) {
      switch (action) {
        case "minimize":
          this.toggleCounterMinimize();
          break;
        case "settings":
          this.toggleSettingsDropdown(target);
          break;
        case "stats":
          this.showStatsModal();
          break;
        case "target":
          this.showTargetModal();
          break;
      }
    }

    // Make counter draggable
    makeDraggable(element) {
      let isDragging = false;
      let startX, startY, startLeft, startTop;

      element.addEventListener("mousedown", e => {
        // Don't start drag if clicking on buttons
        if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
          return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = element.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        element.classList.add("dragging");
        document.body.style.userSelect = "none";
      });

      document.addEventListener("mousemove", e => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newLeft = Math.max(
          0,
          Math.min(window.innerWidth - element.offsetWidth, startLeft + deltaX)
        );
        const newTop = Math.max(
          0,
          Math.min(window.innerHeight - element.offsetHeight, startTop + deltaY)
        );

        element.style.left = newLeft + "px";
        element.style.top = newTop + "px";
        element.style.right = "auto";
      });

      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          element.classList.remove("dragging");
          document.body.style.userSelect = "";
        }
      });
    }

    // Update counter display
    updateCounter() {
      if (!this.counterElement) return;

      try {
        const displayStats = statsManager.getDisplayStats();
        const metrics = statsManager.getPerformanceMetrics();

        // Update values
        const elements = {
          cyclesCount: this.counterElement.querySelector("#cycles-count"),
          coinsCount: this.counterElement.querySelector("#coins-count"),
          targetProgress: this.counterElement.querySelector("#target-progress"),
          progressFill: this.counterElement.querySelector("#progress-fill"),
          runtime: this.counterElement.querySelector("#runtime"),
          coinsPerHour: this.counterElement.querySelector("#coins-per-hour"),
          avgTime: this.counterElement.querySelector("#avg-time"),
        };

        if (elements.cyclesCount) {
          elements.cyclesCount.textContent =
            displayStats.cycles.toLocaleString();
        }

        if (elements.coinsCount) {
          elements.coinsCount.textContent = displayStats.coins.toLocaleString();
        }

        if (elements.targetProgress) {
          elements.targetProgress.textContent = `Target: ${displayStats.coins.toLocaleString()}/${displayStats.target.toLocaleString()} (${
            displayStats.progress
          }%)`;
        }

        if (elements.progressFill) {
          elements.progressFill.style.width = `${Math.min(
            100,
            displayStats.progress
          )}%`;
        }

        if (elements.runtime) {
          elements.runtime.textContent = displayStats.runtime;
        }

        if (elements.coinsPerHour) {
          elements.coinsPerHour.textContent = `${displayStats.coinsPerHour}/h`;
        }

        if (elements.avgTime) {
          elements.avgTime.textContent =
            metrics.calculated.avgCycleTime > 0
              ? this.formatDuration(metrics.calculated.avgCycleTime)
              : "--";
        }

        // Update status indicator
        this.updateStatusIndicator();
      } catch (error) {
        errorManager.handleError(error, {
          context: "update_counter",
          category: "ui",
        });
      }
    }

    // Update status indicator
    updateStatusIndicator() {
      const indicator = this.counterElement?.querySelector(
        ".ateex-status-indicator"
      );
      if (!indicator) return;

      const isActive = statsManager.isAutoStatsActive();
      const hasErrors = coreModule.getState("lastError");

      indicator.className = "ateex-status-indicator";

      if (hasErrors) {
        indicator.classList.add("error");
      } else if (isActive) {
        indicator.classList.add("active");
      } else {
        indicator.classList.add("paused");
      }
    }

    // Toggle counter minimize state
    toggleCounterMinimize() {
      const content = this.counterElement?.querySelector(
        ".ateex-counter-content"
      );
      const actions = this.counterElement?.querySelector(
        ".ateex-counter-actions"
      );
      const btn = this.counterElement?.querySelector(
        '[data-action="minimize"]'
      );

      if (content && actions && btn) {
        const isMinimized = content.style.display === "none";

        content.style.display = isMinimized ? "block" : "none";
        actions.style.display = isMinimized ? "flex" : "none";
        btn.textContent = isMinimized ? "−" : "+";
        btn.title = isMinimized ? "Minimize" : "Expand";
      }
    }

    // Hide counter
    hideCounter() {
      if (this.counterElement) {
        this.counterElement.remove();
        this.counterElement = null;
      }
    }

    // ============= SETTINGS DROPDOWN =============

    // Toggle settings dropdown
    toggleSettingsDropdown(targetElement) {
      if (this.settingsDropdown) {
        this.closeSettingsDropdown();
        return;
      }

      this.showSettingsDropdown(targetElement);
    }

    // Show settings dropdown
    showSettingsDropdown(targetElement) {
      const dropdown = domUtils.createElement("div", {
        class: "ateex-settings-dropdown",
      });

      const settings = this.getSettingsItems();

      settings.forEach(setting => {
        const item = domUtils.createElement("div", {
          class: `ateex-settings-item ${setting.danger ? "danger" : ""}`,
        });

        item.innerHTML = `
          <div class="ateex-settings-icon">${setting.icon}</div>
          <div class="ateex-settings-content">
            <div class="ateex-settings-label">${setting.label}</div>
            <div class="ateex-settings-description">${setting.description}</div>
          </div>
        `;

        item.addEventListener("click", () => {
          this.handleSettingsAction(setting.action);
          this.closeSettingsDropdown();
        });

        dropdown.appendChild(item);
      });

      // Position relative to target
      targetElement.parentElement.style.position = "relative";
      targetElement.parentElement.appendChild(dropdown);

      this.settingsDropdown = dropdown;
    }

    // Get settings items
    getSettingsItems() {
      return [
        {
          action: "view-stats",
          icon: "📊",
          label: "View Statistics",
          description: "Open detailed statistics dashboard",
        },
        {
          action: "view-history",
          icon: "📜",
          label: "View History",
          description: "Show statistics history and trends",
        },
        {
          action: "export-data",
          icon: "📥",
          label: "Export Data",
          description: "Download statistics as JSON file",
        },
        {
          action: "set-target",
          icon: "🎯",
          label: "Set Target",
          description: "Configure coin earning target",
        },
        {
          action: "reset-stats",
          icon: "🔄",
          label: "Reset Statistics",
          description: "Reset cycles and coins to zero",
          danger: true,
        },
        {
          action: "clear-credentials",
          icon: "🔐",
          label: "Clear Credentials",
          description: "Remove saved login credentials",
          danger: true,
        },
      ];
    }

    // Handle settings actions
    handleSettingsAction(action) {
      switch (action) {
        case "view-stats":
          this.showStatsModal();
          break;
        case "view-history":
          this.showHistoryModal();
          break;
        case "export-data":
          this.exportData();
          break;
        case "set-target":
          this.showTargetModal();
          break;
        case "reset-stats":
          this.showResetStatsConfirmation();
          break;
        case "clear-credentials":
          this.showClearCredentialsConfirmation();
          break;
      }
    }

    // Close settings dropdown
    closeSettingsDropdown() {
      if (this.settingsDropdown) {
        this.settingsDropdown.remove();
        this.settingsDropdown = null;
      }
    }

    // ============= MODAL INTERFACES =============

    // Show stats modal
    showStatsModal() {
      return statsDisplay.showStatsModal();
    }

    // Show history modal
    showHistoryModal() {
      return statsDisplay.showHistoryModal();
    }

    // Show target modal
    showTargetModal() {
      const currentTarget = statsManager.getTargetCoins();

      return modalFactory.createForm({
        title: "🎯 Set Target Coins",
        icon: "🎯",
        fields: [
          {
            name: "target",
            label: "Target Coins",
            type: "number",
            value: currentTarget,
            placeholder: "Enter target coins",
            required: true,
            validate: value => {
              const num = parseInt(value);
              if (num < DATA_CONFIG.TARGETS.MIN_COINS) {
                return `Minimum target is ${DATA_CONFIG.TARGETS.MIN_COINS} coins`;
              }
              if (num > DATA_CONFIG.TARGETS.MAX_COINS) {
                return `Maximum target is ${DATA_CONFIG.TARGETS.MAX_COINS} coins`;
              }
              return null;
            },
          },
        ],
        onSubmit: formData => {
          const newTarget = parseInt(formData.target);
          const success = statsManager.setTargetCoins(newTarget);

          if (success) {
            this.updateCounter();
            this.showNotification(
              `🎯 Target set to ${newTarget.toLocaleString()} coins!`,
              "success"
            );
            return true;
          } else {
            this.showNotification("❌ Failed to update target", "error");
            return false;
          }
        },
        onCancel: () => {
          this.showNotification("Target update cancelled", "info");
        },
      });
    }

    // Export data
    exportData() {
      return statsDisplay.exportStats();
    }

    // Show reset stats confirmation
    showResetStatsConfirmation() {
      const currentStats = statsManager.getDisplayStats();

      return modalFactory.createConfirmation({
        title: "🔄 Reset Statistics",
        message: `
          <p>Are you sure you want to reset all statistics?</p>
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 12px 0;">
            <strong>Current Stats:</strong><br>
            Cycles: ${currentStats.cycles.toLocaleString()}<br>
            Coins: ${currentStats.coins.toLocaleString()}<br>
            Runtime: ${currentStats.runtime}
          </div>
          <p style="color: #dc3545; font-size: 14px;">
            <strong>Warning:</strong> This will reset cycles and coins to zero. 
            Target and history will be preserved.
          </p>
        `,
        dangerous: true,
        confirmText: "Reset Statistics",
        onConfirm: () => {
          this.resetStats();
        },
        onCancel: () => {
          this.showNotification("Reset cancelled", "info");
        },
      });
    }

    // Show clear credentials confirmation
    showClearCredentialsConfirmation() {
      return modalFactory.createConfirmation({
        title: "🔐 Clear Credentials",
        message: `
          <p>Clear saved login credentials?</p>
          <p style="color: #6b7280; font-size: 14px;">
            You will need to enter your username and password again on the next login.
          </p>
        `,
        dangerous: true,
        confirmText: "Clear Credentials",
        onConfirm: () => {
          this.clearCredentials();
        },
        onCancel: () => {
          this.showNotification("Clear cancelled", "info");
        },
      });
    }

    // ============= ACTIONS =============

    // Reset statistics
    resetStats() {
      try {
        statsManager.resetStats();
        this.updateCounter();
        this.showNotification("📊 Statistics reset successfully!", "success");

        errorManager.logSuccess("UI", "Statistics reset by user");
      } catch (error) {
        errorManager.handleError(error, {
          context: "reset_stats",
          category: "ui",
        });
        this.showNotification("❌ Failed to reset statistics", "error");
      }
    }

    // Clear credentials
    clearCredentials() {
      try {
        credentialsModule.clearCredentials();
        this.showNotification(
          "🔐 Credentials cleared successfully!",
          "success"
        );

        errorManager.logSuccess("UI", "Credentials cleared by user");
      } catch (error) {
        errorManager.handleError(error, {
          context: "clear_credentials",
          category: "ui",
        });
        this.showNotification("❌ Failed to clear credentials", "error");
      }
    }

    // ============= NOTIFICATIONS =============

    // Show notification
    showNotification(message, type = "info", duration = 5000) {
      const notification = domUtils.createElement("div", {
        class: `ateex-notification ${type}`,
      });

      notification.textContent = message;

      // Add to page
      document.body.appendChild(notification);

      // Store reference
      const notificationId = Date.now().toString();
      this.notifications.set(notificationId, notification);

      // Auto-remove
      setTimeout(() => {
        this.removeNotification(notificationId);
      }, duration);

      return notificationId;
    }

    // Remove notification
    removeNotification(notificationId) {
      const notification = this.notifications.get(notificationId);
      if (notification) {
        notification.classList.add("removing");
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
          this.notifications.delete(notificationId);
        }, 300);
      }
    }

    // Clear all notifications
    clearAllNotifications() {
      Array.from(this.notifications.keys()).forEach(id => {
        this.removeNotification(id);
      });
    }

    // ============= UTILITY FUNCTIONS =============

    // Format duration
    formatDuration(ms) {
      if (ms < 60000) {
        return `${Math.round(ms / 1000)}s`;
      } else if (ms < 3600000) {
        return `${Math.round(ms / 60000)}m`;
      } else {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.round((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
      }
    }

    // Check if counter should be visible
    shouldShowCounter() {
      return window.top === window.self && statsManager.isAutoStatsActive();
    }

    // Get counter position
    getCounterPosition() {
      if (!this.counterElement) return null;

      const rect = this.counterElement.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    }

    // Save counter position
    saveCounterPosition() {
      const position = this.getCounterPosition();
      if (position) {
        localStorage.setItem(
          "ateex_counter_position",
          JSON.stringify(position)
        );
      }
    }

    // Restore counter position
    restoreCounterPosition() {
      try {
        const saved = localStorage.getItem("ateex_counter_position");
        if (saved && this.counterElement) {
          const position = JSON.parse(saved);
          this.counterElement.style.left = position.left + "px";
          this.counterElement.style.top = position.top + "px";
          this.counterElement.style.right = "auto";
        }
      } catch (error) {
        // Ignore restore errors
      }
    }

    // ============= CLEANUP =============

    cleanup() {
      // Clear intervals
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }

      // Save position
      this.saveCounterPosition();

      // Remove UI elements
      this.hideCounter();
      this.closeSettingsDropdown();
      this.clearAllNotifications();

      this.isInitialized = false;
      errorManager.logInfo("UI Manager", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const uiManager = new UIManager();

  // ============= EXPORTS =============

  exports.UIManager = UIManager;
  exports.uiManager = uiManager;

  // Main API
  exports.initialize = () => uiManager.initialize();
  exports.ensureCounterExists = () => uiManager.ensureCounterExists();
  exports.updateCounter = () => uiManager.updateCounter();
  exports.hideCounter = () => uiManager.hideCounter();

  // Modal interfaces
  exports.showStatsModal = () => uiManager.showStatsModal();
  exports.showHistoryModal = () => uiManager.showHistoryModal();
  exports.showTargetModal = () => uiManager.showTargetModal();

  // Notifications
  exports.showNotification = (message, type, duration) =>
    uiManager.showNotification(message, type, duration);
  exports.clearAllNotifications = () => uiManager.clearAllNotifications();

  // Actions
  exports.resetStats = () => uiManager.resetStats();
  exports.clearCredentials = () => uiManager.clearCredentials();
  exports.exportData = () => uiManager.exportData();

  // Utility
  exports.cleanup = () => uiManager.cleanup();

  // Legacy compatibility
  exports.createCounterUI = () => uiManager.ensureCounterExists();
  exports.showSimpleStats = () => uiManager.showStatsModal();
  exports.showTargetConfigPopup = () => uiManager.showTargetModal();
})(exports);
