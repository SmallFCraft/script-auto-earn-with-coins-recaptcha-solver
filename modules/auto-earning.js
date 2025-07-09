/**
 * Auto Earning Module
 * Part of Ateex Auto v3.0 Modular Edition
 * Handles auto-earning workflow, page navigation, and form automation
 */

// Load dependencies
const utils = ateexGlobalState.modulesLoaded.utils;
const credentials = ateexGlobalState.modulesLoaded.credentials;
const data = ateexGlobalState.modulesLoaded.data;
const ui = ateexGlobalState.modulesLoaded.ui;
const recaptcha = ateexGlobalState.modulesLoaded.recaptcha;

const {
  logInfo,
  logError,
  logSuccess,
  logWarning,
  logDebug,
  logWithSpamControl,
  qSelector,
  qSelectorAll,
  sleep,
  randomDelay,
  isPageMatch,
  detectErrorPage,
  clearBrowserData,
} = utils;

const { loadCredentials, checkAutoStatsState } = credentials;
const { updateStats, saveStats, getStatsummary } = data;
const { updateCounter } = ui;
const { waitForCaptchaSolution, setupMessageListeners } = recaptcha;

// ============= GLOBAL STATE =============

let scriptStopped = false;
let CONFIG = null;

// ============= ERROR HANDLING =============

/**
 * Handle error pages and redirect
 */
function handleErrorPage() {
  const currentUrl = window.location.href;
  const baseUrl = "https://dash.ateex.cloud/";

  // Don't redirect if already on base URL or in iframe
  if (
    currentUrl === baseUrl ||
    currentUrl === baseUrl.slice(0, -1) ||
    window.top !== window.self
  ) {
    return;
  }

  logWarning(`Error page detected: ${currentUrl}`);

  // Stop all script activities
  scriptStopped = true;

  // Show notification
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
    color: white;
    padding: 20px;
    border-radius: 10px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    z-index: 99999;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    text-align: center;
    min-width: 300px;
  `;

  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">🛑 Error Page Detected</div>
    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 3px;">Current: ${window.location.pathname}</div>
    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 3px;">🛑 All script activities stopped</div>
    <div style="font-size: 12px; opacity: 0.9;">Redirecting to home page in 3 seconds...</div>
  `;

  document.body.appendChild(notification);

  // Update counter to show stopped state
  const counter = document.getElementById("ateex-counter");
  if (counter) {
    const statusDiv =
      counter.querySelector('[id*="status"]') || counter.querySelector("div");
    if (statusDiv) {
      statusDiv.innerHTML = "🛑 SCRIPT STOPPED - Error page detected";
      statusDiv.style.color = "#ff6b6b";
      statusDiv.style.fontWeight = "bold";
    }
  }

  // Redirect after 3 seconds
  setTimeout(() => {
    try {
      logInfo(`Redirecting from error page: ${currentUrl} → ${baseUrl}`);
      window.location.href = baseUrl;
    } catch (error) {
      logError(`Redirect failed: ${error.message}`);
      window.location.replace(baseUrl);
    }
  }, 3000);
}

/**
 * Logout function
 */
function logout() {
  try {
    logInfo("Performing logout...");
    window.location.href = "https://dash.ateex.cloud/logout";
  } catch (error) {
    logError(`Logout failed: ${error.message}`);
    // Fallback: clear data and go to login
    clearBrowserData();
    setTimeout(() => {
      window.location.href = "https://dash.ateex.cloud/login";
    }, 1000);
  }
}

/**
 * Increment cycle counter and update stats
 */
function incrementCycle() {
  if (window.top !== window.self || scriptStopped) return;

  // Update stats using data module
  updateStats(1, 15); // 1 cycle, 15 coins

  const stats = getStatsummary();
  logSuccess(`Cycle ${stats.cycles} completed! Total coins: ${stats.coins}`);

  // Update UI
  updateCounter();

  // Preventive actions every 10 cycles
  if (stats.cycles % 10 === 0) {
    logInfo("Preventive Google cookies clearing (every 10 cycles)");
    utils.clearGoogleCookies(false);
  }

  // Check if target reached
  const targetProgress = data.getTargetProgress();
  if (targetProgress && targetProgress.completed) {
    logSuccess(`🎉 Target of ${targetProgress.target} coins reached!`);
    data.saveSessionToHistory();
  }
}

// ============= PAGE HANDLERS =============

/**
 * Handle earn page - main earning logic
 */
async function handleEarnPage() {
  if (scriptStopped) {
    logWarning("🛑 Earn page handler stopped - script stopped");
    return;
  }

  if (!ateexGlobalState.autoStatsEnabled) {
    logWithSpamControl(
      "⏳ Earn page handler waiting - auto stats not enabled yet",
      "DEBUG",
      "earn_page_waiting"
    );
    return;
  }

  logInfo("Processing earn page...");

  try {
    // Wait for page to load
    await sleep(2000);

    // Look for Clickcoin row in the table
    const rows = qSelectorAll("tr");
    let clickcoinRow = null;

    for (const row of rows) {
      const firstTd = row.querySelector("td");
      if (
        firstTd &&
        firstTd.textContent.trim().toLowerCase().includes("clickcoin")
      ) {
        clickcoinRow = row;
        break;
      }
    }

    if (clickcoinRow) {
      logInfo("Found Clickcoin row");

      // Find the Start link in the row
      const startLink = clickcoinRow.querySelector('a[href*="clickcoin"]');

      if (startLink) {
        logInfo("Found Clickcoin Start link, clicking...");

        // Ensure link opens in new tab
        startLink.setAttribute("target", "_blank");
        startLink.setAttribute("rel", "noopener noreferrer");

        // Click link
        startLink.click();
        logInfo("Clickcoin Start link clicked");

        // Wait for popup ads to load and complete
        logInfo("Waiting 7 seconds for popup ads to load and complete...");
        await sleep(7000);

        // Increment cycle counter
        incrementCycle();

        // Perform logout
        logInfo("Performing logout...");
        logout();

        // Wait for logout to complete
        await sleep(2000);
      } else {
        logWarning("Start link not found in Clickcoin row");
      }
    } else {
      logWarning("Clickcoin row not found");

      // Debug: log all rows
      logDebug(`Found ${rows.length} rows in table`);
      rows.forEach((row, index) => {
        const firstTd = row.querySelector("td");
        if (firstTd) {
          logDebug(`Row ${index}: ${firstTd.textContent.trim()}`);
        }
      });
    }
  } catch (error) {
    logError(`Error in handleEarnPage: ${error.message}`);
  }
}

/**
 * Handle login page - auto login with credentials
 */
async function handleLoginPage() {
  if (scriptStopped) {
    logWarning("🛑 Login page handler stopped - script stopped");
    return;
  }

  if (!ateexGlobalState.autoStatsEnabled) {
    logWithSpamControl(
      "⏳ Login page handler waiting - auto stats not enabled yet",
      "DEBUG",
      "login_page_waiting"
    );
    return;
  }

  logInfo("Processing login page...");

  try {
    // Setup message listeners for reCAPTCHA
    setupMessageListeners();

    // Wait for page to load
    await sleep(2000);

    // Get credentials
    if (!CONFIG) {
      CONFIG = loadCredentials();
      if (!CONFIG) {
        logError("No credentials available for auto-login");
        return;
      }
    }

    logInfo("Starting auto-login process...");

    // STEP 1: Find and fill username/email field
    const usernameField =
      qSelector('input[name="email"]') ||
      qSelector('input[type="email"]') ||
      qSelector('input[placeholder*="email"]') ||
      qSelector('input[placeholder*="username"]');

    if (usernameField) {
      logInfo("Filling username/email field...");
      usernameField.value = CONFIG.email;
      usernameField.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(500);
    } else {
      logError("Username/email field not found");
      return;
    }

    // STEP 2: Find and fill password field
    const passwordField =
      qSelector('input[name="password"]') ||
      qSelector('input[type="password"]');

    if (passwordField) {
      logInfo("Filling password field...");
      passwordField.value = CONFIG.password;
      passwordField.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(500);
    } else {
      logError("Password field not found");
      return;
    }

    logInfo("Form filling completed");

    // STEP 3: Handle reCAPTCHA
    logInfo("Handling reCAPTCHA...");

    // Check if captcha was already solved
    if (ateexGlobalState.captchaSolved) {
      logInfo("reCAPTCHA already solved, proceeding with login");
    } else {
      // Look for reCAPTCHA element
      const recaptchaElement =
        qSelector(".g-recaptcha") ||
        qSelector("#recaptcha-element") ||
        qSelector("[data-sitekey]") ||
        qSelector('iframe[src*="recaptcha"]');

      if (recaptchaElement) {
        logInfo("Found reCAPTCHA element, waiting for solution...");
        ateexGlobalState.captchaInProgress = true;

        // Wait for reCAPTCHA to be solved
        const captchaSolved = await waitForCaptchaSolution(60000);

        if (captchaSolved) {
          logSuccess("reCAPTCHA solved successfully, proceeding with login");
          await sleep(2000);
        } else {
          logWarning(
            "reCAPTCHA not solved within timeout, attempting login anyway"
          );
        }
      } else {
        logInfo("No reCAPTCHA found on page, proceeding with login");
      }
    }

    // STEP 4: Submit form
    logInfo("Submitting login form...");

    const submitButton =
      qSelector('button[type="submit"]') ||
      qSelector('input[type="submit"]') ||
      qSelector('button:contains("Login")') ||
      qSelector('button:contains("Sign in")');

    if (submitButton) {
      submitButton.click();
      logInfo("Login form submitted");
    } else {
      // Try form submission
      const form = qSelector("form");
      if (form) {
        form.submit();
        logInfo("Form submitted directly");
      } else {
        logError("No submit button or form found");
        return;
      }
    }

    // STEP 5: Monitor login result
    logInfo("Monitoring login result...");
    await sleep(3000);

    // Check if redirected to dashboard/home (successful login)
    const currentUrl = window.location.href;
    if (currentUrl.includes("/home") || currentUrl.includes("/dashboard")) {
      logSuccess("Login successful! Redirected to dashboard");
    } else if (currentUrl.includes("/login")) {
      logWarning("Still on login page - login may have failed");
    }

    logInfo("Login process completed");
  } catch (error) {
    logError(`Error in handleLoginPage: ${error.message}`);
  }
}

/**
 * Handle home page - redirect to earn page
 */
async function handleHomePage() {
  if (scriptStopped) {
    logWarning("🛑 Home page handler stopped - script stopped");
    return;
  }

  if (!ateexGlobalState.autoStatsEnabled) {
    logWithSpamControl(
      "⏳ Home page handler waiting - auto stats not enabled yet",
      "DEBUG",
      "home_page_waiting"
    );
    return;
  }

  logInfo("Processing home page...");

  try {
    // Wait 2-4 seconds before redirecting
    const waitTime = Math.random() * 2000 + 2000; // 2-4 seconds
    logInfo(
      `Waiting ${Math.round(
        waitTime / 1000
      )} seconds before redirecting to earn page...`
    );
    await sleep(waitTime);

    // Redirect to earn page
    logInfo("Redirecting to earn page");
    window.location.href = "https://dash.ateex.cloud/earn";
  } catch (error) {
    logError(`Error in handleHomePage: ${error.message}`);
  }
}

// ============= MAIN INITIALIZATION =============

/**
 * Initialize auto-earning module
 */
async function initialize() {
  try {
    logInfo("🚀 Initializing Auto-Earning Module...");

    const currentUrl = window.location.href;
    const currentPath = window.location.pathname;

    // Check for error pages first
    if (detectErrorPage()) {
      logWarning("Error page detected, handling...");
      handleErrorPage();
      return;
    }

    // Handle popup/ads pages (auto-close)
    if (
      currentUrl.includes("clickcoin") ||
      currentUrl.includes("ads") ||
      currentUrl.includes("popup") ||
      currentPath.includes("/earn/clickcoin")
    ) {
      logInfo("Detected ads/popup page, will auto-close");
      setTimeout(() => {
        logInfo("Auto-closing ads page");
        window.close();
      }, Math.random() * 5000 + 8000); // 8-13 seconds
      return;
    }

    // Setup for main pages
    if (window.top === window.self) {
      // Check auto stats state
      const autoStatsEnabled = checkAutoStatsState();
      logInfo(
        `🔍 Auto stats check result: ${
          autoStatsEnabled ? "ENABLED" : "DISABLED"
        }`
      );

      // Load existing credentials
      const existingCreds = loadCredentials();
      if (existingCreds && existingCreds.email && existingCreds.password) {
        CONFIG = existingCreds;
        ateexGlobalState.credentialsReady = true;
        logInfo("Existing credentials found and loaded");

        // Notify iframes that credentials are ready
        const message = {
          type: "ateex_credentials_ready",
          timestamp: Date.now(),
        };

        const frames = qSelectorAll("iframe");
        frames.forEach(frame => {
          try {
            frame.contentWindow.postMessage(message, "*");
          } catch (e) {
            // Ignore cross-origin errors
          }
        });
      }

      // Load saved stats and create UI
      data.loadSavedStats();

      // Create UI if auto stats enabled
      if (ateexGlobalState.autoStatsEnabled) {
        ui.createCounterUI();
        ui.updateCounter();
        logInfo("🚀 Auto Stats runtime active - UI created");
      } else {
        logInfo("⏳ Auto Stats waiting for setup - prompting for credentials");

        // Prompt for credentials if needed
        setTimeout(async () => {
          try {
            logInfo("🔐 Prompting user for credentials...");
            const newCredentials = await credentials.getCredentials();

            if (newCredentials) {
              CONFIG = newCredentials;
              ateexGlobalState.credentialsReady = true;
              logSuccess("✅ Credentials obtained - Auto Stats enabled");

              // Notify iframes
              const message = {
                type: "ateex_credentials_ready",
                timestamp: Date.now(),
              };

              const frames = qSelectorAll("iframe");
              frames.forEach(frame => {
                try {
                  frame.contentWindow.postMessage(message, "*");
                } catch (e) {
                  // Ignore cross-origin errors
                }
              });

              // Create UI now that setup is complete
              ui.createCounterUI();
              ui.updateCounter();
            } else {
              logWarning(
                "❌ User cancelled credential setup - Auto Stats remains disabled"
              );
            }
          } catch (error) {
            logError(`Error during credential setup: ${error.message}`);
          }
        }, 2000);
      }

      // Setup periodic counter updates
      setInterval(() => {
        if (!scriptStopped) {
          ui.updateCounter();
        }
      }, 2000);
    }

    // Route to appropriate page handler
    await routeToPageHandler();

    logSuccess("🎉 Auto-Earning Module initialized successfully!");
  } catch (error) {
    logError(`Failed to initialize Auto-Earning Module: ${error.message}`);
  }
}

/**
 * Route to appropriate page handler based on current URL
 */
async function routeToPageHandler() {
  const currentPath = window.location.pathname;

  logInfo(`Routing to page handler for: ${currentPath}`);

  if (currentPath.includes("/earn")) {
    setTimeout(() => handleEarnPage(), 1000);
  } else if (currentPath.includes("/login")) {
    setTimeout(() => handleLoginPage(), 1000);
  } else if (currentPath.includes("/logout")) {
    logInfo("On logout page, clearing data and redirecting to login");
    await clearBrowserData();
    setTimeout(() => {
      window.location.href = "https://dash.ateex.cloud/login";
    }, 1000);
  } else if (currentPath.includes("/home") || currentPath === "/") {
    setTimeout(() => handleHomePage(), 1000);
  } else {
    logInfo("Unknown page, no specific handler");
  }
}

/**
 * Initialize auto stats runtime (called after setup)
 */
function initializeAutoStatsRuntime() {
  if (!ateexGlobalState.autoStatsEnabled) {
    logDebug("Auto stats not enabled, skipping runtime initialization");
    return;
  }

  logInfo("🚀 Initializing Auto Stats runtime...");

  // Create counter UI
  if (window.top === window.self) {
    ui.createCounterUI();
  }

  // Start page-specific handlers based on current page
  const currentPath = window.location.pathname;
  if (currentPath.includes("/earn")) {
    setTimeout(() => handleEarnPage(), 1000);
  } else if (currentPath.includes("/login")) {
    setTimeout(() => handleLoginPage(), 1000);
  } else if (currentPath.includes("/home") || currentPath === "/") {
    setTimeout(() => handleHomePage(), 1000);
  }

  logInfo("Auto Stats runtime initialized");
}

// ============= MODULE EXPORTS =============

module.exports = {
  // Main initialization
  initialize,
  initializeAutoStatsRuntime,
  routeToPageHandler,

  // Page handlers
  handleEarnPage,
  handleLoginPage,
  handleHomePage,

  // Utility functions
  handleErrorPage,
  logout,
  incrementCycle,

  // State management
  getScriptState: () => ({
    scriptStopped,
    CONFIG,
  }),

  setScriptStopped: stopped => {
    scriptStopped = stopped;
  },
};
