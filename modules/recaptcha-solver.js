/**
 * reCAPTCHA Solver Module
 * Part of Ateex Auto v3.0 Modular Edition
 * Handles AI-powered reCAPTCHA solving with multi-server support
 */

// Load dependencies
const utils = ateexGlobalState.modulesLoaded.utils;
const credentials = ateexGlobalState.modulesLoaded.credentials;

const {
  logInfo,
  logError,
  logSuccess,
  logWarning,
  logDebug,
  logWithSpamControl,
  qSelector,
  sleep,
  retryWithBackoff,
} = utils;

// ============= RECAPTCHA CONSTANTS =============

// reCAPTCHA Solver State
let solved = false;
let checkBoxClicked = false;
let waitingForAudioResponse = false;
let captchaInterval = null;
let requestCount = 0;
let recaptchaLanguage = "en-US";
let recaptchaInitialStatus = "";
let audioUrl = "";

// reCAPTCHA Selectors
const RECAPTCHA_SELECTORS = {
  CHECK_BOX: ".recaptcha-checkbox-border",
  AUDIO_BUTTON: "#recaptcha-audio-button",
  AUDIO_SOURCE: "#audio-source",
  IMAGE_SELECT: "#rc-imageselect",
  RESPONSE_FIELD: ".rc-audiochallenge-response-field",
  AUDIO_ERROR_MESSAGE: ".rc-audiochallenge-error-message",
  AUDIO_RESPONSE: "#audio-response",
  RELOAD_BUTTON: "#recaptcha-reload-button",
  RECAPTCHA_STATUS: "#recaptcha-accessible-status",
  DOSCAPTCHA: ".rc-doscaptcha-body",
  VERIFY_BUTTON: "#recaptcha-verify-button",
};

const MAX_ATTEMPTS = 5;

// Server Lists for reCAPTCHA Solving
const serversList = [
  "https://engageub.pythonanywhere.com",
  "https://engageub1.pythonanywhere.com",
];

// Server performance tracking
let latencyList = [];
let serverStats = {};
let cachedLatency = null;

// ============= SERVER MANAGEMENT =============

/**
 * Update server statistics
 */
function updateServerStats(server, success, responseTime) {
  if (!serverStats[server]) {
    serverStats[server] = {
      requests: 0,
      successes: 0,
      failures: 0,
      avgResponseTime: 0,
      lastUsed: 0,
    };
  }

  const stats = serverStats[server];
  stats.requests++;
  stats.lastUsed = Date.now();

  if (success) {
    stats.successes++;
    stats.failures = 0; // Reset consecutive failures
  } else {
    stats.failures++;
  }

  // Update average response time
  stats.avgResponseTime =
    (stats.avgResponseTime * (stats.requests - 1) + responseTime) /
    stats.requests;

  logDebug(
    `Server ${server} stats: ${stats.successes}/${
      stats.requests
    } success, ${Math.round(stats.avgResponseTime)}ms avg`
  );
}

/**
 * Get server statistics
 */
function getServerStats() {
  return serverStats;
}

/**
 * Get best server based on performance
 */
function getBestServer(excludeServers = []) {
  try {
    const stats = getServerStats();
    let bestServer = null;
    let bestScore = -1;
    let availableServers = [];

    for (let i = 0; i < serversList.length; i++) {
      const server = serversList[i];
      const latency = latencyList[i] || 1000;
      const serverStat = stats[server];

      // Skip excluded servers
      if (excludeServers.includes(server)) {
        logDebug(`Skipping excluded server: ${server}`);
        continue;
      }

      // Calculate server score (higher is better)
      let score = 100; // Base score

      if (serverStat) {
        // Success rate factor (0-50 points)
        const successRate =
          serverStat.requests > 0
            ? serverStat.successes / serverStat.requests
            : 0;
        score += successRate * 50;

        // Response time factor (0-30 points, lower time = higher score)
        const responseTimeFactor = Math.max(
          0,
          30 - serverStat.avgResponseTime / 100
        );
        score += responseTimeFactor;

        // Penalty for consecutive failures
        score -= serverStat.failures * 10;

        // Bonus for recent usage
        const timeSinceLastUse = Date.now() - serverStat.lastUsed;
        if (timeSinceLastUse < 300000) {
          // 5 minutes
          score += 10;
        }
      }

      // Latency factor (0-20 points)
      const latencyFactor = Math.max(0, 20 - latency / 50);
      score += latencyFactor;

      availableServers.push({
        server: server,
        score: score,
        latency: latency,
        failures: serverStat ? serverStat.failures : 0,
      });

      if (score > bestScore) {
        bestScore = score;
        bestServer = server;
      }
    }

    // Fallback to first server if no good option
    if (!bestServer && serversList.length > 0) {
      bestServer = serversList[0];
      logWarning("No optimal server found, using fallback");
    }

    logDebug(
      `Best server selected: ${bestServer} (score: ${Math.round(bestScore)})`
    );
    return bestServer;
  } catch (error) {
    logError(`Error selecting best server: ${error.message}`);
    return serversList[0]; // Fallback
  }
}

/**
 * Ping test for server latency
 */
function pingTest(url) {
  const start = Date.now();

  GM_xmlhttpRequest({
    method: "GET",
    url: url,
    timeout: 8000,
    onload: function (response) {
      const end = Date.now();
      const latency = end - start;

      const serverIndex = serversList.indexOf(url);
      if (serverIndex !== -1) {
        latencyList[serverIndex] = latency;
      }

      updateServerStats(url, response.status === 200, latency);
      logDebug(`Ping to ${url}: ${latency}ms`);
    },
    onerror: function (e) {
      const end = Date.now();
      const latency = end - start;
      logError(`Ping test error for ${url}: ${e}`);
      updateServerStats(url, false, latency);
    },
    ontimeout: function () {
      logWarning(`Ping test timeout for ${url}`);
      updateServerStats(url, false, 8000);
    },
  });
}

// ============= RECAPTCHA DETECTION & INITIALIZATION =============

/**
 * Initialize reCAPTCHA variables
 */
function initRecaptchaVars() {
  try {
    const htmlLang = qSelector("html");
    if (htmlLang) {
      recaptchaLanguage = htmlLang.getAttribute("lang") || "en-US";
    }

    const statusElement = qSelector(RECAPTCHA_SELECTORS.RECAPTCHA_STATUS);
    if (statusElement) {
      recaptchaInitialStatus = statusElement.innerText || "";
    }

    logDebug(`reCAPTCHA Language: ${recaptchaLanguage}`);
  } catch (error) {
    logError(`Error initializing reCAPTCHA vars: ${error.message}`);
  }
}

/**
 * Check if element is hidden
 */
function isHidden(element) {
  if (!element) return true;

  const style = window.getComputedStyle(element);
  return (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0" ||
    element.offsetParent === null
  );
}

/**
 * Clear Google cookies for reCAPTCHA reset
 */
async function clearGoogleCookies(reload = false) {
  try {
    logInfo("Clearing Google cookies for reCAPTCHA reset");

    // Note: In Tampermonkey, we can't directly clear cookies
    // This is a placeholder for the functionality

    if (reload) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error) {
    logError(`Error clearing Google cookies: ${error.message}`);
  }
}

// ============= AUDIO PROCESSING =============

/**
 * Get text from audio using AI solver
 */
async function getTextFromAudio(audioURL) {
  const url = getBestServer();
  requestCount++;

  // Normalize URL
  audioURL = audioURL.replace("recaptcha.net", "google.com");

  if (recaptchaLanguage.length < 1) {
    logWarning("reCAPTCHA Language not recognized, using en-US");
    recaptchaLanguage = "en-US";
  }

  logInfo(
    `Solving reCAPTCHA audio using server: ${url} (Language: ${recaptchaLanguage})`
  );

  const requestStart = Date.now();

  return new Promise(resolve => {
    GM_xmlhttpRequest({
      method: "POST",
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: `input=${encodeURIComponent(audioURL)}&lang=${recaptchaLanguage}`,
      timeout: 60000,

      onload: function (response) {
        const responseTime = Date.now() - requestStart;

        try {
          if (response && response.responseText) {
            const responseText = response.responseText;

            // Validate response
            if (
              responseText === "0" ||
              responseText.includes("<") ||
              responseText.includes(">") ||
              responseText.length < 2 ||
              responseText.length > 50
            ) {
              logWarning("Invalid response from solver, retrying...");
              updateServerStats(url, false, responseTime);
              resolve(false);
              return;
            }

            // Check if we can still input the response
            const audioSource = qSelector(RECAPTCHA_SELECTORS.AUDIO_SOURCE);
            const audioResponse = qSelector(RECAPTCHA_SELECTORS.AUDIO_RESPONSE);
            const verifyButton = qSelector(RECAPTCHA_SELECTORS.VERIFY_BUTTON);
            const audioButton = qSelector(RECAPTCHA_SELECTORS.AUDIO_BUTTON);

            if (
              audioSource &&
              audioURL === audioSource.src &&
              audioResponse &&
              !audioResponse.value &&
              audioButton &&
              audioButton.style.display === "none" &&
              verifyButton
            ) {
              audioResponse.value = responseText;
              verifyButton.click();

              logSuccess("reCAPTCHA response submitted successfully!");
              updateServerStats(url, true, responseTime);
              resolve(true);
            } else {
              logError("Could not locate text input box or page state changed");
              updateServerStats(url, false, responseTime);
              resolve(false);
            }
          }
        } catch (error) {
          logError(`Exception handling response: ${error.message}`);
          updateServerStats(url, false, responseTime);
          resolve(false);
        }

        waitingForAudioResponse = false;
      },

      onerror: function (error) {
        const responseTime = Date.now() - requestStart;
        logError(`reCAPTCHA solver error from ${url}: ${error}`);
        updateServerStats(url, false, responseTime);
        waitingForAudioResponse = false;
        resolve(false);
      },

      ontimeout: function () {
        logWarning(`Response timeout from ${url}`);
        updateServerStats(url, false, 60000);
        waitingForAudioResponse = false;
        resolve(false);
      },
    });
  });
}

// ============= MAIN SOLVER LOGIC =============

/**
 * Main reCAPTCHA solver initialization
 */
function initCaptchaSolver() {
  // Check if credentials are ready before allowing reCAPTCHA
  let credentialsReady = ateexGlobalState.credentialsReady;

  // For iframe context, also check parent window
  if (window.parent && window.parent !== window) {
    try {
      if (
        window.parent.ateexGlobalState &&
        window.parent.ateexGlobalState.credentialsReady
      ) {
        credentialsReady = true;
        ateexGlobalState.credentialsReady = true;
      }
    } catch (e) {
      // Cross-origin access might be blocked - use spam control
      logWithSpamControl(
        "Cannot access parent window state",
        "DEBUG",
        "parent_window_access",
        60000 // Only log once per minute
      );
    }
  }

  if (!credentialsReady) {
    logWithSpamControl(
      "reCAPTCHA blocked: Credentials not ready yet. Waiting...",
      "DEBUG",
      "recaptcha_blocked",
      30000 // Only log once per 30 seconds
    );

    // Wait and retry every 2 seconds until credentials are ready
    setTimeout(() => {
      initCaptchaSolver();
    }, 2000);
    return;
  }

  logInfo("Credentials ready - proceeding with reCAPTCHA solver");

  // Check if captcha already solved
  if (ateexGlobalState.captchaSolved) {
    logInfo("reCAPTCHA already solved, skipping solver initialization");
    return;
  }

  // Check for automated queries cooldown
  const now = Date.now();
  const lastAutomatedQueries = ateexGlobalState.lastAutomatedQueriesTime;
  const cooldownPeriod = 5 * 60 * 1000; // 5 minutes

  if (lastAutomatedQueries && now - lastAutomatedQueries < cooldownPeriod) {
    const remainingCooldown = cooldownPeriod - (now - lastAutomatedQueries);
    logWarning(
      `reCAPTCHA cooldown active. ${Math.round(
        remainingCooldown / 1000
      )}s remaining`
    );

    setTimeout(() => {
      initCaptchaSolver();
    }, remainingCooldown);
    return;
  }

  // Initialize reCAPTCHA variables
  initRecaptchaVars();

  // Mark as in progress
  ateexGlobalState.captchaInProgress = true;

  // Handle checkbox click
  const checkbox = qSelector(RECAPTCHA_SELECTORS.CHECK_BOX);
  if (checkbox) {
    checkbox.click();
    logDebug("Clicked reCAPTCHA checkbox");
  } else if (window.location.href.includes("bframe")) {
    // Ping servers for latency if not cached
    if (!cachedLatency) {
      logInfo("Pinging servers to determine best latency...");
      serversList.forEach(server => pingTest(server));
    } else {
      logDebug("Using cached latency, skipping ping tests");
    }
  }

  // Clear existing interval
  if (captchaInterval) {
    clearInterval(captchaInterval);
  }

  // Start main solver loop
  captchaInterval = setInterval(async () => {
    try {
      await solveCaptchaStep();
    } catch (error) {
      logError(`Error in captcha solver step: ${error.message}`);
    }
  }, 2000);

  logInfo("reCAPTCHA solver initialized and running");
}

/**
 * Single step of captcha solving process
 */
async function solveCaptchaStep() {
  // Check if solved
  const statusElement = qSelector(RECAPTCHA_SELECTORS.RECAPTCHA_STATUS);
  if (statusElement && statusElement.innerText !== recaptchaInitialStatus) {
    solved = true;
    logSuccess("reCAPTCHA SOLVED successfully!");
    clearInterval(captchaInterval);

    // Update global state
    ateexGlobalState.captchaSolved = true;
    ateexGlobalState.captchaInProgress = false;
    ateexGlobalState.lastSolvedTime = Date.now();

    // Notify parent window if in iframe
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "ateex_captcha_solved",
            solved: true,
            timestamp: Date.now(),
          },
          "*"
        );
        logDebug("Notified parent window about captcha solution");
      }
    } catch (e) {
      logDebug("Could not notify parent window");
    }

    // Trigger custom event
    window.dispatchEvent(
      new CustomEvent("recaptchaSolved", {
        detail: { solved: true },
      })
    );
    return;
  }

  // Check max attempts
  if (requestCount > MAX_ATTEMPTS) {
    logWarning("Attempted max retries. Stopping the solver");
    solved = true;
    ateexGlobalState.captchaInProgress = false;
    clearInterval(captchaInterval);
    return;
  }

  // Handle audio challenge
  if (!solved) {
    const audioButton = qSelector(RECAPTCHA_SELECTORS.AUDIO_BUTTON);
    const imageSelect = qSelector(RECAPTCHA_SELECTORS.IMAGE_SELECT);

    if (audioButton && !isHidden(audioButton) && imageSelect) {
      audioButton.click();
      logDebug("Clicked audio button");
    }

    // Process audio if available
    const audioSource = qSelector(RECAPTCHA_SELECTORS.AUDIO_SOURCE);
    if (audioSource && audioSource.src && !waitingForAudioResponse) {
      audioUrl = audioSource.src;
      waitingForAudioResponse = true;

      logInfo("Processing audio challenge...");
      await getTextFromAudio(audioUrl);
    }
  }

  // Check for automated queries detection
  const doscaptcha = qSelector(RECAPTCHA_SELECTORS.DOSCAPTCHA);
  if (doscaptcha && doscaptcha.innerText.length > 0) {
    logWarning("Automated Queries Detected - implementing cooldown");

    // Clear cookies and reload
    await clearGoogleCookies(true);

    ateexGlobalState.captchaInProgress = false;
    ateexGlobalState.lastAutomatedQueriesTime = Date.now();
    clearInterval(captchaInterval);
  }
}

/**
 * Wait for reCAPTCHA to be solved (for main pages)
 */
async function waitForCaptchaSolution(timeout = 60000) {
  logInfo("Waiting for reCAPTCHA to be solved...");

  let waitTime = 0;
  const checkInterval = 1000;

  while (!solved && !ateexGlobalState.captchaSolved && waitTime < timeout) {
    await sleep(checkInterval);
    waitTime += checkInterval;

    // Check global state
    if (ateexGlobalState.captchaSolved) {
      solved = true;
      logSuccess("reCAPTCHA solved by iframe!");
      break;
    }

    // Log progress every 10 seconds
    if (waitTime % 10000 === 0) {
      logInfo(`Still waiting for reCAPTCHA... ${waitTime / 1000}s elapsed`);
    }
  }

  if (solved || ateexGlobalState.captchaSolved) {
    logSuccess("reCAPTCHA solved successfully");
    return true;
  } else {
    logWarning("reCAPTCHA not solved within timeout period");
    return false;
  }
}

/**
 * Setup message listeners for iframe communication
 */
function setupMessageListeners() {
  // Listen for captcha solved messages
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "ateex_captcha_solved") {
      logInfo("Received captcha solved message from iframe");
      ateexGlobalState.captchaSolved = true;
      ateexGlobalState.captchaInProgress = false;
      ateexGlobalState.lastSolvedTime = event.data.timestamp;
      solved = true;
    }
  });

  // Listen for credentials ready messages (for iframe)
  if (window.parent && window.parent !== window) {
    let lastCredentialsMessage = 0;
    window.addEventListener("message", function (event) {
      if (event.data && event.data.type === "ateex_credentials_ready") {
        const now = Date.now();
        if (now - lastCredentialsMessage > 30000) {
          logInfo("Received credentials ready message from parent window");
          lastCredentialsMessage = now;
        }
        ateexGlobalState.credentialsReady = true;
      }
    });
  }
}

// ============= MODULE EXPORTS =============

module.exports = {
  // Main functions
  initCaptchaSolver,
  waitForCaptchaSolution,
  setupMessageListeners,
  solveCaptchaStep,

  // Server management
  getBestServer,
  getServerStats,
  updateServerStats,
  pingTest,

  // Audio processing
  getTextFromAudio,

  // Utilities
  initRecaptchaVars,
  isHidden,
  clearGoogleCookies,

  // Constants
  RECAPTCHA_SELECTORS,
  MAX_ATTEMPTS,

  // State management
  getSolverState: () => ({
    solved,
    checkBoxClicked,
    waitingForAudioResponse,
    requestCount,
    recaptchaLanguage,
    audioUrl,
  }),

  resetSolverState: () => {
    solved = false;
    checkBoxClicked = false;
    waitingForAudioResponse = false;
    requestCount = 0;
    audioUrl = "";
    if (captchaInterval) {
      clearInterval(captchaInterval);
      captchaInterval = null;
    }
  },
};
