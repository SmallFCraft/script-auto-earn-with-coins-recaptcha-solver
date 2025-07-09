/**
 * ReCAPTCHA Module - reCAPTCHA solver with AI integration
 * Handles reCAPTCHA solving, server management, and audio processing
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const core = AteexModules.core;
  const data = AteexModules.data;
  const {
    log,
    logInfo,
    logError,
    logSuccess,
    logWarning,
    logDebug,
    qSelector,
    isHidden,
  } = core;

  // ============= RECAPTCHA CONSTANTS =============

  // reCAPTCHA Selectors
  const CHECK_BOX = ".recaptcha-checkbox-border";
  const AUDIO_BUTTON = "#recaptcha-audio-button";
  const AUDIO_SOURCE = "#audio-source";
  const IMAGE_SELECT = "#rc-imageselect";
  const RESPONSE_FIELD = ".rc-audiochallenge-response-field";
  const AUDIO_ERROR_MESSAGE = ".rc-audiochallenge-error-message";
  const AUDIO_RESPONSE = "#audio-response";
  const RELOAD_BUTTON = "#recaptcha-reload-button";
  const RECAPTCHA_STATUS = "#recaptcha-accessible-status";
  const DOSCAPTCHA = ".rc-doscaptcha-body";
  const VERIFY_BUTTON = "#recaptcha-verify-button";
  const MAX_ATTEMPTS = 5;

  // Server Lists for reCAPTCHA Solving
  const serversList = [
    "https://engageub.pythonanywhere.com",
    "https://engageub1.pythonanywhere.com",
  ];

  let latencyList = Array(serversList.length).fill(10000);

  // ============= RECAPTCHA STATE =============

  let solved = false;
  let checkBoxClicked = false;
  let waitingForAudioResponse = false;
  let captchaInterval = null;
  let requestCount = 0;
  let recaptchaLanguage = "en-US";
  let recaptchaInitialStatus = "";
  let audioUrl = "";

  // ============= RECAPTCHA INITIALIZATION =============

  function initRecaptchaVars() {
    try {
      const htmlLang = qSelector("html");
      if (htmlLang) {
        recaptchaLanguage = htmlLang.getAttribute("lang") || "en-US";
      }

      const statusElement = qSelector(RECAPTCHA_STATUS);
      if (statusElement) {
        recaptchaInitialStatus = statusElement.innerText || "";
      }

      log("Recaptcha Language is " + recaptchaLanguage);
    } catch (err) {
      log("Error initializing recaptcha vars: " + err.message);
    }
  }

  // ============= SERVER MANAGEMENT =============

  // Get best server based on latency and stats with fallback
  function getBestServer(excludeServers = []) {
    try {
      const stats = data.getServerStats();
      let bestServer = null;
      let bestScore = -1;
      let availableServers = [];

      for (let i = 0; i < serversList.length; i++) {
        const server = serversList[i];
        const latency = latencyList[i];
        const serverStat = stats[server];

        // Skip excluded servers
        if (excludeServers.includes(server)) {
          log(`Skipping excluded server: ${server}`);
          continue;
        }

        // Skip servers with too many consecutive failures (but allow if no other options)
        if (serverStat && serverStat.failures >= 3) {
          log(
            `Server ${server} has ${serverStat.failures} consecutive failures`
          );
          // Don't skip completely, just lower priority
        }

        // Calculate score (lower latency = higher score, success rate bonus)
        let score = 10000 - latency; // Base score from latency

        if (serverStat && serverStat.totalRequests > 0) {
          const successRate =
            serverStat.successfulRequests / serverStat.totalRequests;
          score += successRate * 1000; // Bonus for success rate

          // Heavy penalty for recent failures
          if (serverStat.failures > 0) {
            score -= serverStat.failures * 1000;
          }

          // Extra penalty for servers with many failures
          if (serverStat.failures >= 3) {
            score -= 5000;
          }
        }

        availableServers.push({
          server,
          score,
          latency,
          failures: serverStat?.failures || 0,
        });

        log(
          `Server ${server}: latency=${latency}ms, failures=${
            serverStat?.failures || 0
          }, score=${Math.round(score)}`
        );

        if (score > bestScore) {
          bestScore = score;
          bestServer = server;
        }
      }

      // If no server found (all excluded), use fallback
      if (!bestServer && availableServers.length === 0) {
        log("No available servers, using fallback to first server");
        return serversList[0];
      }

      // If best server has too many failures, try next best
      if (bestServer) {
        const bestServerStat = stats[bestServer];
        if (bestServerStat && bestServerStat.failures >= 5) {
          log(
            `Best server ${bestServer} has too many failures (${bestServerStat.failures}), trying fallback`
          );

          // Sort by score and try next best
          availableServers.sort((a, b) => b.score - a.score);
          for (const serverInfo of availableServers) {
            if (serverInfo.server !== bestServer && serverInfo.failures < 5) {
              log(`Fallback to server: ${serverInfo.server}`);
              return serverInfo.server;
            }
          }
        }
      }

      log(
        `Best server selected: ${bestServer} (score: ${Math.round(bestScore)})`
      );
      return bestServer || serversList[0];
    } catch (e) {
      log("Error selecting best server: " + e.message);
      return serversList[0]; // Fallback to first server
    }
  }

  // ============= AUDIO PROCESSING =============

  async function getTextFromAudio(URL) {
    // Use enhanced server selection
    var url = getBestServer();

    requestCount = requestCount + 1;
    URL = URL.replace("recaptcha.net", "google.com");

    if (recaptchaLanguage.length < 1) {
      log("Recaptcha Language is not recognized");
      recaptchaLanguage = "en-US";
    }

    log(
      `Solving reCAPTCHA with audio using server: ${url} (Language: ${recaptchaLanguage})`
    );

    const requestStart = Date.now();

    GM_xmlhttpRequest({
      method: "POST",
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "input=" + encodeURIComponent(URL) + "&lang=" + recaptchaLanguage,
      timeout: 60000,
      onload: function (response) {
        const responseTime = Date.now() - requestStart;
        log(
          `Response from ${url} (${responseTime}ms): ${response.responseText}`
        );

        try {
          if (response && response.responseText) {
            var responseText = response.responseText;
            // Validate Response for error messages or html elements
            if (
              responseText == "0" ||
              responseText.includes("<") ||
              responseText.includes(">") ||
              responseText.length < 2 ||
              responseText.length > 50
            ) {
              // Invalid Response, Reload the captcha
              log("Invalid Response. Retrying..");
              data.updateServerStats(url, false, responseTime);
            } else if (
              qSelector(AUDIO_SOURCE) &&
              qSelector(AUDIO_SOURCE).src &&
              audioUrl == qSelector(AUDIO_SOURCE).src &&
              qSelector(AUDIO_RESPONSE) &&
              !qSelector(AUDIO_RESPONSE).value &&
              qSelector(AUDIO_BUTTON).style.display == "none" &&
              qSelector(VERIFY_BUTTON)
            ) {
              qSelector(AUDIO_RESPONSE).value = responseText;
              qSelector(VERIFY_BUTTON).click();
              logSuccess("reCAPTCHA solved successfully!");
              data.updateServerStats(url, true, responseTime);
            } else {
              log("Could not locate text input box");
              data.updateServerStats(url, false, responseTime);
            }
            waitingForAudioResponse = false;
          }
        } catch (err) {
          log("Exception handling response. Retrying..: " + err.message);
          data.updateServerStats(url, false, responseTime);
          waitingForAudioResponse = false;
        }
      },
      onerror: function (e) {
        const responseTime = Date.now() - requestStart;
        log(`reCAPTCHA solver error from ${url}: ${e}`);
        data.updateServerStats(url, false, responseTime);
        waitingForAudioResponse = false;
      },
      ontimeout: function () {
        log(`Response Timed out from ${url}. Retrying..`);
        data.updateServerStats(url, false, 60000); // Use timeout value
        waitingForAudioResponse = false;
      },
    });
  }

  // ============= SERVER PING TESTING =============

  async function pingTest(url) {
    var start = new Date().getTime();
    log(`Pinging server: ${url}`);

    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "",
      timeout: 8000,
      onload: function (response) {
        var end = new Date().getTime();
        var milliseconds = end - start;

        if (response && response.responseText && response.responseText == "0") {
          // Update latency list
          for (let i = 0; i < serversList.length; i++) {
            if (url == serversList[i]) {
              latencyList[i] = milliseconds;
              log(`Server ${url} ping: ${milliseconds}ms (success)`);
            }
          }

          // Update server stats
          data.updateServerStats(url, true, milliseconds);
        } else {
          log(`Server ${url} ping failed: invalid response`);
          data.updateServerStats(url, false, milliseconds);
        }

        // Save latency cache after all pings complete
        data.saveServerLatency(latencyList);
      },
      onerror: function (e) {
        var end = new Date().getTime();
        var milliseconds = end - start;
        log(`Ping test error for ${url}: ${e}`);
        data.updateServerStats(url, false, milliseconds);
      },
      ontimeout: function () {
        log(`Ping Test Response Timed out for ${url}`);
        data.updateServerStats(url, false, 8000); // Use timeout value
      },
    });
  }

  // ============= MAIN CAPTCHA SOLVER =============

  function initCaptchaSolver() {
    // CRITICAL: Check if credentials are ready before allowing reCAPTCHA
    // For iframe context, check both local state and parent window
    let credentialsReady = core.state.credentialsReady;

    // If in iframe, also check parent window's credentials state
    if (window.top !== window.self) {
      try {
        if (
          window.top.ateexGlobalState &&
          window.top.ateexGlobalState.credentialsReady
        ) {
          credentialsReady = true;
          // Sync the flag to local state
          core.state.credentialsReady = true;
          log("Credentials ready flag synced from parent window");
        }
      } catch (e) {
        // Cross-origin access might be blocked, use message passing
        core.logWithSpamControl(
          "Cannot access parent window directly, checking via message...",
          "DEBUG",
          "parent_access_blocked"
        );
      }
    }

    if (!credentialsReady) {
      core.logWithSpamControl(
        "reCAPTCHA blocked: Credentials not ready yet. Waiting...",
        "DEBUG",
        "recaptcha_blocked"
      );

      // Wait and retry every 2 seconds until credentials are ready
      setTimeout(() => {
        initCaptchaSolver();
      }, 2000);
      return;
    }

    log("Credentials ready - proceeding with reCAPTCHA solver");

    // Check if captcha already solved
    if (core.state.captchaSolved) {
      log("reCAPTCHA already solved, skipping solver initialization");
      return;
    }

    // Check cooldown period after automated queries
    if (core.state.lastAutomatedQueriesTime) {
      const timeSinceLastError =
        Date.now() - core.state.lastAutomatedQueriesTime;
      const cooldownPeriod = 60000; // 60 seconds cooldown

      if (timeSinceLastError < cooldownPeriod) {
        const remainingTime = Math.ceil(
          (cooldownPeriod - timeSinceLastError) / 1000
        );
        log(`Cooldown active, waiting ${remainingTime}s before retry`);

        setTimeout(() => {
          initCaptchaSolver();
        }, 5000); // Check again after 5 seconds
        return;
      }
    }

    // Check if solver already running
    if (core.state.captchaInProgress && captchaInterval) {
      log("reCAPTCHA solver already in progress, skipping");
      return;
    }

    // Initialize variables safely
    initRecaptchaVars();

    // Load cached server latency
    const cachedLatency = data.loadServerLatency();
    if (cachedLatency && cachedLatency.length === serversList.length) {
      latencyList = cachedLatency;
      log("Using cached server latency data");
    } else {
      log("No valid cached latency, will ping servers");
    }

    // Mark as in progress
    core.state.captchaInProgress = true;

    // Handle iframe reCAPTCHA
    if (qSelector(CHECK_BOX)) {
      qSelector(CHECK_BOX).click();
    } else if (window.location.href.includes("bframe")) {
      // Only ping if we don't have cached data or it's expired
      if (!cachedLatency) {
        log("Pinging servers to determine best latency...");
        for (let i = 0; i < serversList.length; i++) {
          pingTest(serversList[i]);
        }
      } else {
        log("Using cached latency, skipping ping tests");
      }
    }

    // Clear old interval if exists
    if (captchaInterval) {
      clearInterval(captchaInterval);
    }

    // Solve the captcha using audio
    captchaInterval = setInterval(async function () {
      try {
        if (
          !checkBoxClicked &&
          qSelector(CHECK_BOX) &&
          !isHidden(qSelector(CHECK_BOX))
        ) {
          qSelector(CHECK_BOX).click();
          checkBoxClicked = true;
        }

        // Check if the captcha is solved
        if (
          qSelector(RECAPTCHA_STATUS) &&
          qSelector(RECAPTCHA_STATUS).innerText != recaptchaInitialStatus
        ) {
          solved = true;
          logSuccess("reCAPTCHA SOLVED successfully!");
          clearInterval(captchaInterval);

          // Update global state
          core.state.captchaSolved = true;
          core.state.captchaInProgress = false;
          core.state.lastSolvedTime = Date.now();

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
              log("Notified parent window about captcha solution");
            }
          } catch (e) {
            log("Could not notify parent window: " + e.message);
          }

          // Trigger custom event to notify login page
          window.dispatchEvent(
            new CustomEvent("recaptchaSolved", {
              detail: { solved: true },
            })
          );
        }

        if (requestCount > MAX_ATTEMPTS) {
          log("Attempted Max Retries. Stopping the solver");
          solved = true;
          core.state.captchaInProgress = false;
          clearInterval(captchaInterval);
        }

        if (!solved) {
          if (
            qSelector(AUDIO_BUTTON) &&
            !isHidden(qSelector(AUDIO_BUTTON)) &&
            qSelector(IMAGE_SELECT)
          ) {
            qSelector(AUDIO_BUTTON).click();
          }

          if (
            (!waitingForAudioResponse &&
              qSelector(AUDIO_SOURCE) &&
              qSelector(AUDIO_SOURCE).src &&
              qSelector(AUDIO_SOURCE).src.length > 0 &&
              audioUrl == qSelector(AUDIO_SOURCE).src &&
              qSelector(RELOAD_BUTTON)) ||
            (qSelector(AUDIO_ERROR_MESSAGE) &&
              qSelector(AUDIO_ERROR_MESSAGE).innerText.length > 0 &&
              qSelector(RELOAD_BUTTON) &&
              !qSelector(RELOAD_BUTTON).disabled)
          ) {
            qSelector(RELOAD_BUTTON).click();
          } else if (
            !waitingForAudioResponse &&
            qSelector(RESPONSE_FIELD) &&
            !isHidden(qSelector(RESPONSE_FIELD)) &&
            !qSelector(AUDIO_RESPONSE).value &&
            qSelector(AUDIO_SOURCE) &&
            qSelector(AUDIO_SOURCE).src &&
            qSelector(AUDIO_SOURCE).src.length > 0 &&
            audioUrl != qSelector(AUDIO_SOURCE).src &&
            requestCount <= MAX_ATTEMPTS
          ) {
            waitingForAudioResponse = true;
            audioUrl = qSelector(AUDIO_SOURCE).src;
            getTextFromAudio(audioUrl);
          } else {
            // Waiting
          }
        }

        // Stop solving when Automated queries message is shown
        if (
          qSelector(DOSCAPTCHA) &&
          qSelector(DOSCAPTCHA).innerText.length > 0
        ) {
          log(
            "Automated Queries Detected - clearing storage and implementing cooldown"
          );

          // Clear Google cookies and reload to reset limits
          await core.clearGoogleCookies(true);

          core.state.captchaInProgress = false;
          clearInterval(captchaInterval);

          // Set cooldown period to avoid immediate retry
          core.state.lastAutomatedQueriesTime = Date.now();

          // No need for setTimeout since we'll reload the page
        }
      } catch (err) {
        log(
          "An error occurred while solving. Stopping the solver: " + err.message
        );
        core.state.captchaInProgress = false;
        clearInterval(captchaInterval);
      }
    }, 5000); // Keep original 5-second interval
  }

  // ============= EXPORTS =============

  exports.initCaptchaSolver = initCaptchaSolver;
  exports.getBestServer = getBestServer;
  exports.getTextFromAudio = getTextFromAudio;
  exports.pingTest = pingTest;
  exports.initRecaptchaVars = initRecaptchaVars;
  exports.serversList = serversList;
  exports.latencyList = latencyList;
})(exports);
