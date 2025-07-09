/**
 * ReCAPTCHA Module - reCAPTCHA solver with AI integration
 * Handles reCAPTCHA solving, server management, and audio processing
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  const data = AteexModules.data;
  const proxy = AteexModules.proxy;

  // Validate dependencies before use
  if (!core) {
    throw new Error("Core module not loaded - missing dependency");
  }
  if (!data) {
    throw new Error("Data module not loaded - missing dependency");
  }
  if (!proxy) {
    throw new Error("Proxy module not loaded - missing dependency");
  }
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
    } catch (err) {
      logError("Error initializing recaptcha vars: " + err.message);
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
          continue;
        }

        // Skip servers with too many consecutive failures (but allow if no other options)
        if (serverStat && serverStat.failures >= 3) {
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

        if (score > bestScore) {
          bestScore = score;
          bestServer = server;
        }
      }

      // If no server found (all excluded), use fallback
      if (!bestServer && availableServers.length === 0) {
        logWarning("No available servers, using fallback to first server");
        return serversList[0];
      }

      // If best server has too many failures, try next best
      if (bestServer) {
        const bestServerStat = stats[bestServer];
        if (bestServerStat && bestServerStat.failures >= 5) {
          logWarning(
            `Best server ${bestServer} has too many failures (${bestServerStat.failures}), trying fallback`
          );

          // Sort by score and try next best
          availableServers.sort((a, b) => b.score - a.score);
          for (const serverInfo of availableServers) {
            if (serverInfo.server !== bestServer && serverInfo.failures < 5) {
              logInfo(`Fallback to server: ${serverInfo.server}`);
              return serverInfo.server;
            }
          }
        }
      }

      return bestServer || serversList[0];
    } catch (e) {
      logError("Error selecting best server: " + e.message);
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
      logWarning("Recaptcha Language is not recognized");
      recaptchaLanguage = "en-US";
    }

    logInfo(
      `🔄 Solving reCAPTCHA with audio using server: ${url} (with proxy)`
    );

    const requestStart = Date.now();

    try {
      // Use proxy.makeProxyRequest thay vì GM_xmlhttpRequest trực tiếp
      const response = await proxy.makeProxyRequest({
        method: "POST",
        url: url,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: "input=" + encodeURIComponent(URL) + "&lang=" + recaptchaLanguage,
        timeout: 60000,
      });

      const responseTime = Date.now() - requestStart;

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
            core.logWithSpamControl(
              "Invalid Response. Retrying..",
              "WARNING",
              "invalid_response"
            );
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
            logSuccess("✅ reCAPTCHA solved successfully with proxy!");
            data.updateServerStats(url, true, responseTime);
          } else {
            core.logWithSpamControl(
              "Could not locate text input box",
              "WARNING",
              "input_box_error"
            );
            data.updateServerStats(url, false, responseTime);
          }
          waitingForAudioResponse = false;
        }
      } catch (err) {
        logError("Exception handling response. Retrying..: " + err.message);
        data.updateServerStats(url, false, responseTime);
        waitingForAudioResponse = false;
      }
    } catch (error) {
      const responseTime = Date.now() - requestStart;

      // Better error formatting
      const errorMsg =
        error && error.message
          ? error.message
          : error && error.toString
          ? error.toString()
          : typeof error === "string"
          ? error
          : "Unknown error";

      logError(
        `❌ reCAPTCHA solver error from ${url} (with proxy): ${errorMsg}`
      );
      data.updateServerStats(url, false, responseTime);
      waitingForAudioResponse = false;
    }
  }

  // ============= SERVER PING TESTING =============

  async function pingTest(url) {
    var start = new Date().getTime();

    try {
      // Use proxy.makeProxyRequest cho ping test cũng
      const response = await proxy.makeProxyRequest({
        method: "GET",
        url: url,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: "",
        timeout: 8000,
      });

      var end = new Date().getTime();
      var milliseconds = end - start;

      if (response && response.responseText && response.responseText == "0") {
        // Update latency list
        for (let i = 0; i < serversList.length; i++) {
          if (url == serversList[i]) {
            latencyList[i] = milliseconds;
          }
        }

        // Update server stats
        data.updateServerStats(url, true, milliseconds);
        logSuccess(`🌐 Ping success: ${url} (${milliseconds}ms) with proxy`);
      } else {
        core.logWithSpamControl(
          `Server ${url} ping failed: invalid response`,
          "WARNING",
          "ping_failed"
        );
        data.updateServerStats(url, false, milliseconds);
      }

      // Save latency cache after all pings complete
      data.saveServerLatency(latencyList);
    } catch (error) {
      var end = new Date().getTime();
      var milliseconds = end - start;

      // Better error formatting
      const errorMsg =
        error && error.message
          ? error.message
          : error && error.toString
          ? error.toString()
          : typeof error === "string"
          ? error
          : "Unknown error";

      logError(`❌ Ping test error for ${url} (with proxy): ${errorMsg}`);
      data.updateServerStats(url, false, milliseconds);
    }
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
        }
      } catch (e) {
        // Cross-origin access might be blocked, use message passing
        core.logWithSpamControl(
          "Cannot access parent window directly, checking via message...",
          "WARNING",
          "parent_access_blocked"
        );
      }
    }

    if (!credentialsReady) {
      core.logWithSpamControl(
        "reCAPTCHA blocked: Credentials not ready yet. Waiting...",
        "WARNING",
        "recaptcha_blocked"
      );

      // Wait and retry every 2 seconds until credentials are ready
      setTimeout(() => {
        initCaptchaSolver();
      }, 2000);
      return;
    }

    // Check if captcha already solved
    if (core.state.captchaSolved) {
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
        core.logWithSpamControl(
          `Cooldown active, waiting ${remainingTime}s before retry`,
          "WARNING",
          "captcha_cooldown"
        );

        setTimeout(() => {
          initCaptchaSolver();
        }, 5000); // Check again after 5 seconds
        return;
      }
    }

    // Check if solver already running
    if (core.state.captchaInProgress && captchaInterval) {
      core.logWithSpamControl(
        "reCAPTCHA solver already in progress, skipping",
        "INFO",
        "solver_in_progress"
      );
      return;
    }

    // Initialize variables safely
    initRecaptchaVars();

    // Load cached server latency
    const cachedLatency = data.loadServerLatency();
    if (cachedLatency && cachedLatency.length === serversList.length) {
      latencyList = cachedLatency;
      logInfo("Using cached server latency data");
    }

    // Mark as in progress
    core.state.captchaInProgress = true;

    // Handle iframe reCAPTCHA
    if (qSelector(CHECK_BOX)) {
      qSelector(CHECK_BOX).click();
    } else if (window.location.href.includes("bframe")) {
      // Only ping if we don't have cached data or it's expired
      if (!cachedLatency) {
        logInfo("Pinging servers to determine best latency...");
        for (let i = 0; i < serversList.length; i++) {
          pingTest(serversList[i]);
        }
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

          // Notify parent window if in iframe (enhanced messaging)
          try {
            const message = {
              type: "ateex_captcha_solved",
              solved: true,
              timestamp: Date.now(),
            };

            // Send to parent window
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(message, "*");
              logInfo("📤 Sent captcha solved message to parent window");
            }

            // Also send to top window (in case of nested iframes)
            if (window.top && window.top !== window) {
              window.top.postMessage(message, "*");
              logInfo("📤 Sent captcha solved message to top window");
            }

            // Send to all frames
            const frames = document.querySelectorAll("iframe");
            frames.forEach(frame => {
              try {
                frame.contentWindow.postMessage(message, "*");
              } catch (e) {
                // Ignore cross-origin errors
              }
            });
          } catch (e) {
            logWarning("Error sending captcha solved message: " + e.message);
          }

          // Trigger custom event to notify login page
          try {
            window.dispatchEvent(
              new CustomEvent("recaptchaSolved", {
                detail: { solved: true, timestamp: Date.now() },
              })
            );

            // Also trigger on parent/top windows
            if (window.parent && window.parent !== window) {
              window.parent.dispatchEvent(
                new CustomEvent("recaptchaSolved", {
                  detail: { solved: true, timestamp: Date.now() },
                })
              );
            }

            logInfo("📡 Triggered custom recaptchaSolved events");
          } catch (e) {
            logWarning("Error triggering custom events: " + e.message);
          }
        }

        if (requestCount > MAX_ATTEMPTS) {
          logWarning("Attempted Max Retries. Stopping the solver");
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
          logWarning(
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
        logError(
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
