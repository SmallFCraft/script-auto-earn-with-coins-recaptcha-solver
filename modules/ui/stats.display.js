/**
 * Stats Display Module - Statistics UI and visualization
 * Handles statistics display, charts, performance metrics, and data visualization
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const statsManager = AteexModules.statsManager;
  const modalFactory = AteexModules.modalFactory;
  const domUtils = AteexModules.domUtils;
  const errorManager = AteexModules.errorManager;

  const { UI_CONFIG, DATA_CONFIG, PERFORMANCE_CONFIG } = constants;

  // ============= STATS DISPLAY CLASS =============

  class StatsDisplay {
    constructor() {
      this.isInitialized = false;
      this.updateInterval = null;
      this.chartData = {};
      this.activeCharts = new Map();
    }

    // ============= INITIALIZATION =============

    initialize() {
      if (this.isInitialized) {
        return true;
      }

      // Initialize modal factory
      modalFactory.initialize();

      // Inject stats styles
      this.injectStatsStyles();

      // Set up periodic updates
      this.setupPeriodicUpdates();

      this.isInitialized = true;
      errorManager.logSuccess("Stats Display", "Initialized successfully");
      return true;
    }

    // Inject CSS styles for stats display
    injectStatsStyles() {
      const styles = `
        .ateex-stats-container {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.4;
        }

        .ateex-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .ateex-stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow: hidden;
        }

        .ateex-stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.3);
        }

        .ateex-stat-icon {
          font-size: 24px;
          margin-bottom: 8px;
          display: block;
        }

        .ateex-stat-value {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 4px;
          color: #fff;
        }

        .ateex-stat-label {
          font-size: 14px;
          opacity: 0.9;
          margin-bottom: 8px;
        }

        .ateex-stat-trend {
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ateex-stat-trend.positive {
          color: #4ade80;
        }

        .ateex-stat-trend.negative {
          color: #f87171;
        }

        .ateex-stat-trend.neutral {
          color: #fbbf24;
        }

        .ateex-progress-ring {
          width: 60px;
          height: 60px;
          position: absolute;
          top: 20px;
          right: 20px;
        }

        .ateex-progress-ring circle {
          fill: none;
          stroke-width: 4;
        }

        .ateex-progress-ring .background {
          stroke: rgba(255, 255, 255, 0.2);
        }

        .ateex-progress-ring .progress {
          stroke: #fff;
          stroke-linecap: round;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
          transition: stroke-dasharray 0.3s ease;
        }

        .ateex-chart-container {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }

        .ateex-chart-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ateex-chart-canvas {
          width: 100%;
          height: 200px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          position: relative;
        }

        .ateex-chart-bar {
          background: linear-gradient(135deg, ${UI_CONFIG.COLORS.PRIMARY} 0%, #764ba2 100%);
          border-radius: 4px 4px 0 0;
          transition: all 0.3s ease;
          position: relative;
        }

        .ateex-chart-bar:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .ateex-chart-line {
          stroke: ${UI_CONFIG.COLORS.PRIMARY};
          stroke-width: 3;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .ateex-chart-point {
          fill: ${UI_CONFIG.COLORS.PRIMARY};
          stroke: white;
          stroke-width: 2;
          cursor: pointer;
        }

        .ateex-chart-point:hover {
          r: 6;
          fill: #764ba2;
        }

        .ateex-chart-tooltip {
          position: absolute;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          pointer-events: none;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .ateex-chart-tooltip.visible {
          opacity: 1;
        }

        .ateex-stats-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
        }

        .ateex-export-btn {
          background: #10b981;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.2s;
        }

        .ateex-export-btn:hover {
          background: #059669;
        }

        .ateex-target-form {
          display: flex;
          align-items: center;
          gap: 12px;
          background: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .ateex-target-input {
          padding: 8px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          font-size: 14px;
          width: 120px;
        }

        .ateex-target-input:focus {
          outline: none;
          border-color: ${UI_CONFIG.COLORS.PRIMARY};
        }

        .ateex-history-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .ateex-history-table th,
        .ateex-history-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .ateex-history-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
        }

        .ateex-history-table tr:hover {
          background: #f9fafb;
        }

        .ateex-efficiency-indicator {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .ateex-efficiency-indicator.excellent {
          background: #dcfce7;
          color: #166534;
        }

        .ateex-efficiency-indicator.good {
          background: #fef3c7;
          color: #92400e;
        }

        .ateex-efficiency-indicator.poor {
          background: #fee2e2;
          color: #991b1b;
        }

        .ateex-stats-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .ateex-summary-item {
          text-align: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 4px solid ${UI_CONFIG.COLORS.PRIMARY};
        }

        .ateex-summary-value {
          font-size: 24px;
          font-weight: bold;
          color: ${UI_CONFIG.COLORS.PRIMARY};
          margin-bottom: 4px;
        }

        .ateex-summary-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `;

      domUtils.injectCSS(styles, "ateex-stats-styles");
    }

    // Set up periodic updates
    setupPeriodicUpdates() {
      // Update stats display every 5 seconds
      this.updateInterval = setInterval(() => {
        this.updateActiveDisplays();
      }, 5000);
    }

    // ============= MAIN STATS DISPLAY =============

    // Show comprehensive stats modal
    showStatsModal() {
      const statsContent = this.createStatsContent();

      const modal = modalFactory.createModal({
        title: "📊 Statistics Dashboard",
        content: statsContent,
        gradient: true,
        buttons: [
          {
            text: "📈 Show History",
            type: "secondary",
            onClick: () => this.showHistoryModal(),
            autoClose: false,
          },
          {
            text: "📥 Export Data",
            type: "success",
            onClick: () => this.exportStats(),
            autoClose: false,
          },
          {
            text: "Close",
            type: "primary",
          },
        ],
        closeOnBackdrop: true,
        closeOnEscape: true,
      });

      // Store reference for updates
      this.activeStatsModal = modal;

      return modal;
    }

    // Create comprehensive stats content
    createStatsContent() {
      const container = domUtils.createElement("div", {
        class: "ateex-stats-container",
      });

      // Get current stats
      const metrics = statsManager.getPerformanceMetrics();
      const displayStats = statsManager.getDisplayStats();

      // Summary section
      const summary = this.createStatsSummary(metrics);
      container.appendChild(summary);

      // Main stats grid
      const statsGrid = this.createStatsGrid(displayStats);
      container.appendChild(statsGrid);

      // Performance chart
      if (statsManager.getStatsHistory().length > 1) {
        const chart = this.createPerformanceChart();
        container.appendChild(chart);
      }

      // Target coins form
      const targetForm = this.createTargetForm();
      container.appendChild(targetForm);

      return container;
    }

    // Create stats summary
    createStatsSummary(metrics) {
      const summary = domUtils.createElement("div", {
        class: "ateex-stats-summary",
      });

      const summaryItems = [
        {
          value: metrics.basic.totalCycles,
          label: "Cycles",
          icon: "🔄",
        },
        {
          value: metrics.basic.totalCoins,
          label: "Coins",
          icon: "🪙",
        },
        {
          value: `${metrics.progress.percentage}%`,
          label: "Progress",
          icon: "📈",
        },
        {
          value: metrics.calculated.coinsPerHour,
          label: "Coins/Hour",
          icon: "⚡",
        },
      ];

      summaryItems.forEach(item => {
        const summaryItem = domUtils.createElement("div", {
          class: "ateex-summary-item",
        });

        summaryItem.innerHTML = `
          <div style="font-size: 20px; margin-bottom: 8px;">${item.icon}</div>
          <div class="ateex-summary-value">${item.value}</div>
          <div class="ateex-summary-label">${item.label}</div>
        `;

        summary.appendChild(summaryItem);
      });

      return summary;
    }

    // Create stats grid
    createStatsGrid(displayStats) {
      const grid = domUtils.createElement("div", {
        class: "ateex-stats-grid",
      });

      // Cycles card
      const cyclesCard = this.createStatCard({
        icon: "🔄",
        value: displayStats.cycles,
        label: "Total Cycles",
        trend: this.calculateTrend("cycles"),
      });
      grid.appendChild(cyclesCard);

      // Coins card with progress
      const coinsCard = this.createStatCard({
        icon: "🪙",
        value: displayStats.coins,
        label: "Total Coins",
        trend: this.calculateTrend("coins"),
        progress: displayStats.progress,
      });
      grid.appendChild(coinsCard);

      // Coins per hour card
      const rateCard = this.createStatCard({
        icon: "⚡",
        value: displayStats.coinsPerHour,
        label: "Coins per Hour",
        trend: this.calculateTrend("coinsPerHour"),
      });
      grid.appendChild(rateCard);

      // ETA card
      const etaCard = this.createStatCard({
        icon: "⏱️",
        value: this.formatETA(displayStats.eta),
        label: "Time to Target",
        trend: this.calculateETATrend(),
      });
      grid.appendChild(etaCard);

      return grid;
    }

    // Create individual stat card
    createStatCard(config) {
      const card = domUtils.createElement("div", {
        class: "ateex-stat-card",
      });

      let progressHTML = "";
      if (config.progress !== undefined) {
        progressHTML = this.createProgressRing(config.progress);
      }

      let trendHTML = "";
      if (config.trend) {
        trendHTML = `
          <div class="ateex-stat-trend ${config.trend.type}">
            ${config.trend.icon} ${config.trend.text}
          </div>
        `;
      }

      card.innerHTML = `
        <span class="ateex-stat-icon">${config.icon}</span>
        <div class="ateex-stat-value">${config.value}</div>
        <div class="ateex-stat-label">${config.label}</div>
        ${trendHTML}
        ${progressHTML}
      `;

      return card;
    }

    // Create progress ring SVG
    createProgressRing(percentage) {
      const radius = 26;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (percentage / 100) * circumference;

      return `
        <svg class="ateex-progress-ring" viewBox="0 0 60 60">
          <circle class="background" cx="30" cy="30" r="${radius}"></circle>
          <circle 
            class="progress" 
            cx="30" 
            cy="30" 
            r="${radius}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}">
          </circle>
        </svg>
      `;
    }

    // ============= PERFORMANCE CHART =============

    // Create performance chart
    createPerformanceChart() {
      const chartContainer = domUtils.createElement("div", {
        class: "ateex-chart-container",
      });

      const title = domUtils.createElement("div", {
        class: "ateex-chart-title",
      });
      title.innerHTML = "📊 Performance Over Time";
      chartContainer.appendChild(title);

      const canvas = this.createChartCanvas();
      chartContainer.appendChild(canvas);

      // Draw chart
      this.drawPerformanceChart(canvas);

      return chartContainer;
    }

    // Create chart canvas
    createChartCanvas() {
      const canvas = domUtils.createElement("div", {
        class: "ateex-chart-canvas",
      });

      // Add SVG for drawing
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("viewBox", "0 0 400 200");
      canvas.appendChild(svg);

      // Add tooltip
      const tooltip = domUtils.createElement("div", {
        class: "ateex-chart-tooltip",
      });
      canvas.appendChild(tooltip);

      return canvas;
    }

    // Draw performance chart
    drawPerformanceChart(canvas) {
      const svg = canvas.querySelector("svg");
      const tooltip = canvas.querySelector(".ateex-chart-tooltip");
      const history = statsManager.getStatsHistory();

      if (history.length < 2) return;

      // Chart dimensions
      const width = 380;
      const height = 180;
      const margin = { top: 20, right: 20, bottom: 40, left: 40 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      // Data preparation
      const data = history.slice(-10); // Last 10 points
      const maxCoins = Math.max(...data.map(d => d.totalCoins));
      const maxCycles = Math.max(...data.map(d => d.totalCycles));

      // Scales
      const xScale = i => margin.left + (i * chartWidth) / (data.length - 1);
      const yScale = (value, max) =>
        margin.top + chartHeight - (value / max) * chartHeight;

      // Draw grid lines
      this.drawGridLines(svg, margin, chartWidth, chartHeight);

      // Draw coins line
      this.drawLine(
        svg,
        data,
        xScale,
        d => yScale(d.totalCoins, maxCoins),
        "#667eea"
      );

      // Draw cycles line
      this.drawLine(
        svg,
        data,
        xScale,
        d => yScale(d.totalCycles, maxCycles),
        "#764ba2"
      );

      // Draw points with tooltips
      data.forEach((d, i) => {
        const x = xScale(i);
        const y = yScale(d.totalCoins, maxCoins);

        const point = this.createSVGElement("circle", {
          cx: x,
          cy: y,
          r: 4,
          class: "ateex-chart-point",
        });

        point.addEventListener("mouseenter", e => {
          tooltip.innerHTML = `
            <strong>Cycle ${d.totalCycles}</strong><br>
            Coins: ${d.totalCoins}<br>
            Rate: ${d.coinsPerHour}/hour<br>
            Time: ${new Date(d.timestamp).toLocaleTimeString()}
          `;
          tooltip.classList.add("visible");
          tooltip.style.left = `${e.offsetX + 10}px`;
          tooltip.style.top = `${e.offsetY - 10}px`;
        });

        point.addEventListener("mouseleave", () => {
          tooltip.classList.remove("visible");
        });

        svg.appendChild(point);
      });

      // Add labels
      this.addChartLabels(svg, margin, width, height);
    }

    // Draw grid lines
    drawGridLines(svg, margin, width, height) {
      // Horizontal lines
      for (let i = 0; i <= 4; i++) {
        const y = margin.top + (i * height) / 4;
        const line = this.createSVGElement("line", {
          x1: margin.left,
          y1: y,
          x2: margin.left + width,
          y2: y,
          stroke: "#e5e7eb",
          "stroke-width": 1,
        });
        svg.appendChild(line);
      }

      // Vertical lines
      for (let i = 0; i <= 5; i++) {
        const x = margin.left + (i * width) / 5;
        const line = this.createSVGElement("line", {
          x1: x,
          y1: margin.top,
          x2: x,
          y2: margin.top + height,
          stroke: "#e5e7eb",
          "stroke-width": 1,
        });
        svg.appendChild(line);
      }
    }

    // Draw line chart
    drawLine(svg, data, xScale, yScale, color) {
      let pathData = "";

      data.forEach((d, i) => {
        const x = xScale(i);
        const y = yScale(d);

        if (i === 0) {
          pathData += `M ${x} ${y}`;
        } else {
          pathData += ` L ${x} ${y}`;
        }
      });

      const path = this.createSVGElement("path", {
        d: pathData,
        stroke: color,
        "stroke-width": 3,
        fill: "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });

      svg.appendChild(path);
    }

    // Create SVG element
    createSVGElement(type, attributes) {
      const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        type
      );
      Object.keys(attributes).forEach(key => {
        element.setAttribute(key, attributes[key]);
      });
      return element;
    }

    // Add chart labels
    addChartLabels(svg, margin, width, height) {
      // Y-axis label
      const yLabel = this.createSVGElement("text", {
        x: 15,
        y: margin.top + height / 2,
        "text-anchor": "middle",
        transform: `rotate(-90, 15, ${margin.top + height / 2})`,
        "font-size": "12",
        fill: "#6b7280",
      });
      yLabel.textContent = "Count";
      svg.appendChild(yLabel);

      // X-axis label
      const xLabel = this.createSVGElement("text", {
        x: margin.left + width / 2,
        y: margin.top + height + 30,
        "text-anchor": "middle",
        "font-size": "12",
        fill: "#6b7280",
      });
      xLabel.textContent = "Time →";
      svg.appendChild(xLabel);
    }

    // ============= HISTORY MODAL =============

    // Show history modal
    showHistoryModal() {
      const historyContent = this.createHistoryContent();

      return modalFactory.createModal({
        title: "📜 Statistics History",
        content: historyContent,
        buttons: [
          {
            text: "🗑️ Clear History",
            type: "warning",
            onClick: () => this.clearHistory(),
            autoClose: false,
          },
          {
            text: "Close",
            type: "primary",
          },
        ],
        closeOnBackdrop: true,
        closeOnEscape: true,
      });
    }

    // Create history content
    createHistoryContent() {
      const container = domUtils.createElement("div", {
        class: "ateex-stats-container",
      });

      const history = statsManager.getStatsHistory();

      if (history.length === 0) {
        container.innerHTML =
          '<p style="text-align: center; color: #6b7280;">No history available yet.</p>';
        return container;
      }

      const table = this.createHistoryTable(history);
      container.appendChild(table);

      return container;
    }

    // Create history table
    createHistoryTable(history) {
      const table = domUtils.createElement("table", {
        class: "ateex-history-table",
      });

      // Header
      table.innerHTML = `
        <thead>
          <tr>
            <th>Time</th>
            <th>Cycles</th>
            <th>Coins</th>
            <th>Rate/Hr</th>
            <th>Efficiency</th>
            <th>Runtime</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector("tbody");

      // Rows
      history
        .slice()
        .reverse()
        .forEach(entry => {
          const row = domUtils.createElement("tr");

          const efficiency = this.getEfficiencyClass(entry.efficiency);
          const runtime = this.formatDuration(entry.runtime);

          row.innerHTML = `
          <td>${new Date(entry.timestamp).toLocaleString()}</td>
          <td>${entry.totalCycles}</td>
          <td>${entry.totalCoins}</td>
          <td>${entry.coinsPerHour}</td>
          <td>
            <span class="ateex-efficiency-indicator ${efficiency.class}">
              ${entry.efficiency}%
            </span>
          </td>
          <td>${runtime}</td>
        `;

          tbody.appendChild(row);
        });

      return table;
    }

    // ============= TARGET MANAGEMENT =============

    // Create target form
    createTargetForm() {
      const form = domUtils.createElement("div", {
        class: "ateex-target-form",
      });

      const currentTarget = statsManager.getTargetCoins();

      form.innerHTML = `
        <label for="target-input" style="font-weight: 500;">🎯 Target Coins:</label>
        <input 
          type="number" 
          id="target-input" 
          class="ateex-target-input"
          value="${currentTarget}"
          min="100"
          max="100000"
          step="100"
        >
        <button type="button" id="update-target-btn" class="ateex-btn ateex-btn-primary">
          Update Target
        </button>
      `;

      // Handle target update
      const updateBtn = form.querySelector("#update-target-btn");
      const targetInput = form.querySelector("#target-input");

      updateBtn.onclick = () => {
        const newTarget = parseInt(targetInput.value);
        if (newTarget && newTarget >= 100 && newTarget <= 100000) {
          const success = statsManager.setTargetCoins(newTarget);
          if (success) {
            this.updateActiveDisplays();
            this.showNotification("🎯 Target updated successfully!", "success");
          } else {
            this.showNotification("❌ Failed to update target", "error");
          }
        } else {
          this.showNotification(
            "⚠️ Please enter a valid target (100-100,000)",
            "warning"
          );
        }
      };

      return form;
    }

    // ============= UTILITY FUNCTIONS =============

    // Calculate trend for metrics
    calculateTrend(metric) {
      const history = statsManager.getStatsHistory();
      if (history.length < 2) return null;

      const recent = history.slice(-2);
      const change = recent[1][metric] - recent[0][metric];

      if (change > 0) {
        return {
          type: "positive",
          icon: "↗️",
          text: `+${change}`,
        };
      } else if (change < 0) {
        return {
          type: "negative",
          icon: "↘️",
          text: `${change}`,
        };
      } else {
        return {
          type: "neutral",
          icon: "→",
          text: "No change",
        };
      }
    }

    // Calculate ETA trend
    calculateETATrend() {
      const eta = statsManager.calculateETA();

      if (eta.completed) {
        return {
          type: "positive",
          icon: "🎉",
          text: "Target reached!",
        };
      } else if (eta.hoursRemaining < 1) {
        return {
          type: "positive",
          icon: "🔥",
          text: "Almost there!",
        };
      } else if (eta.hoursRemaining < 24) {
        return {
          type: "neutral",
          icon: "⏰",
          text: "Today",
        };
      } else {
        return {
          type: "negative",
          icon: "📅",
          text: "Long term",
        };
      }
    }

    // Format ETA
    formatETA(eta) {
      if (eta.completed) {
        return "Completed! 🎉";
      }

      if (eta.eta === Infinity) {
        return "Unknown";
      }

      return this.formatDuration(eta.eta);
    }

    // Format duration
    formatDuration(ms) {
      if (ms < 60000) {
        return `${Math.round(ms / 1000)}s`;
      } else if (ms < 3600000) {
        return `${Math.round(ms / 60000)}m`;
      } else if (ms < 86400000) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.round((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
      } else {
        const days = Math.floor(ms / 86400000);
        const hours = Math.round((ms % 86400000) / 3600000);
        return `${days}d ${hours}h`;
      }
    }

    // Get efficiency class
    getEfficiencyClass(efficiency) {
      if (efficiency >= 90) {
        return { class: "excellent", label: "Excellent" };
      } else if (efficiency >= 70) {
        return { class: "good", label: "Good" };
      } else {
        return { class: "poor", label: "Poor" };
      }
    }

    // Update active displays
    updateActiveDisplays() {
      if (
        this.activeStatsModal &&
        modalFactory.exists(this.activeStatsModal.modalId)
      ) {
        const newContent = this.createStatsContent();
        modalFactory.updateContent(this.activeStatsModal.modalId, newContent);
      }
    }

    // ============= EXPORT FUNCTIONALITY =============

    // Export stats
    exportStats() {
      try {
        const statsData = statsManager.exportStats();
        const blob = new Blob([statsData], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `ateex-stats-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification("📥 Stats exported successfully!", "success");
      } catch (error) {
        errorManager.handleError(error, {
          context: "export_stats",
          category: "ui",
        });
        this.showNotification("❌ Export failed", "error");
      }
    }

    // Clear history
    clearHistory() {
      modalFactory.createConfirmation({
        title: "Clear Statistics History",
        message:
          "Are you sure you want to clear all statistics history? This action cannot be undone.",
        dangerous: true,
        onConfirm: () => {
          statsManager.clearStatsHistory();
          this.updateActiveDisplays();
          this.showNotification("🗑️ History cleared successfully!", "success");
        },
      });
    }

    // Show notification
    showNotification(message, type = "info") {
      const icons = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "ℹ️",
      };

      modalFactory.createAlert({
        title: `${icons[type]} Notification`,
        message: message,
        buttonText: "OK",
      });
    }

    // ============= CLEANUP =============

    cleanup() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }

      this.activeStatsModal = null;
      this.activeCharts.clear();

      errorManager.logInfo("Stats Display", "Cleanup completed");
    }
  }

  // ============= SINGLETON INSTANCE =============

  const statsDisplay = new StatsDisplay();

  // ============= EXPORTS =============

  exports.StatsDisplay = StatsDisplay;
  exports.statsDisplay = statsDisplay;

  // Main API
  exports.initialize = () => statsDisplay.initialize();
  exports.showStatsModal = () => statsDisplay.showStatsModal();
  exports.showHistoryModal = () => statsDisplay.showHistoryModal();
  exports.exportStats = () => statsDisplay.exportStats();
  exports.cleanup = () => statsDisplay.cleanup();

  // Utility functions
  exports.formatDuration = ms => statsDisplay.formatDuration(ms);
  exports.formatETA = eta => statsDisplay.formatETA(eta);
  exports.updateActiveDisplays = () => statsDisplay.updateActiveDisplays();
})(exports);
