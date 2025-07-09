// ============= reCAPTCHA SOLVER MODULE =============
// This module handles reCAPTCHA solving functionality with enhanced server management

(function () {
  "use strict";

  const context = window.ateexContext;
  const utils = context.utils;

  context.log("Loading reCAPTCHA Solver Module...", "INFO");

  // ============= SOLVER STATE =============

  let solverState = {
    solved: false,
    checkBoxClicked: false,
    waitingForAudioResponse: false,
    captchaInterval: null,
    requestCount: 0,
    recaptchaLanguage: utils.SERVER_CONFIG.DEFAULT_LANGUAGE,
    recaptchaInitialStatus: "",
    audioUrl: "",
    currentAttempt: 0,
    maxAttempts: utils.SERVER_CONFIG.MAX_ATTEMPTS,
    lastSolveTime: 0,
    serverLatencies: Array(utils.SERVER_CONFIG.RECAPTCHA_SERVERS.length).fill(
      10000
    ),
  };

  // ============= SERVER MANAGEMENT =============

  // Update server statistics
  function updateServerStats(serverUrl, success, responseTime) {
    try {
      const stats = getServerStats();

      if (!stats[serverUrl]) {
        stats[serverUrl] = {
          totalRequests: 0,
          successfulRequests: 0,
          totalResponseTime: 0,
          lastUsed: 0,
          failures: 0,
        };
      }

      const serverStat = stats[serverUrl];
      serverStat.totalRequests++;
      serverStat.lastUsed = Date.now();

      if (success) {
        serverStat.successfulRequests++;
        serverStat.totalResponseTime += responseTime;
        serverStat.failures = 0; // Reset failure count on success
      } else {
        serverStat.failures++;
      }

      // Throttled save to reduce localStorage overhead
      clearTimeout(window.serverStatsTimeout);
      window.serverStatsTimeout = setTimeout(() => {
        GM_setValue(utils.STORAGE_KEYS.SERVER_STATS, JSON.stringify(stats));
      }, 1000);

      // Only log stats occasionally to reduce overhead
      if (serverStat.totalRequests % 5 === 0) {
        const successRate = (
          (serverStat.successfulRequests / serverStat.totalRequests) *
          100
        ).toFixed(1);
        const avgResponseTime =
          serverStat.successfulRequests > 0
            ? Math.round(
                serverStat.totalResponseTime / serverStat.successfulRequests
              )
            : 0;

        context.logDebug(
          `Server ${serverUrl} stats: ${successRate}% success, ${avgResponseTime}ms avg, ${serverStat.failures} consecutive failures`
        );
      }
    } catch (e) {
      context.logError("Error updating server stats: " + e.message);
    }
  }

  // Get server statistics
  function getServerStats() {
    try {
      const saved = GM_getValue(utils.STORAGE_KEYS.SERVER_STATS);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      context.logError("Error loading server stats: " + e.message);
      return {};
    }
  }

  // Test server latency
  function testServerLatency(serverUrl, index) {
    return new Promise(resolve => {
      const startTime = Date.now();

      GM_xmlhttpRequest({
        method: "GET",
        url: serverUrl + "/test",
        timeout: 5000,
        onload: function () {
          const latency = Date.now() - startTime;
          solverState.serverLatencies[index] = latency;
          context.logDebug(`Server ${index + 1} latency: ${latency}ms`);
          resolve(latency);
        },
        onerror: function () {
          solverState.serverLatencies[index] = 10000;
          context.logWarning(`Server ${index + 1} failed latency test`);
          resolve(10000);
        },
        ontimeout: function () {
          solverState.serverLatencies[index] = 10000;
          context.logWarning(`Server ${index + 1} timeout`);
          resolve(10000);
        },
      });
    });
  }

  // Get best server based on latency
  async function getBestServer() {
    context.logDebug("Testing server latencies...");

    const latencyPromises = utils.SERVER_CONFIG.RECAPTCHA_SERVERS.map(
      (server, index) => testServerLatency(server, index)
    );

    await Promise.all(latencyPromises);

    const bestIndex = solverState.serverLatencies.indexOf(
      Math.min(...solverState.serverLatencies)
    );
    const bestServer = utils.SERVER_CONFIG.RECAPTCHA_SERVERS[bestIndex];

    context.logInfo(
      `Best server: ${bestServer} (${solverState.serverLatencies[bestIndex]}ms)`
    );
    return bestServer;
  }

  // ============= AUDIO CHALLENGE SOLVING =============

  // Solve audio challenge
  function solveAudioChallenge(audioUrl, callback) {
    getBestServer()
      .then(serverUrl => {
        solverState.requestCount++;
        const requestStart = Date.now();

        // Replace recaptcha.net with google.com like in original
        const processedUrl = audioUrl.replace("recaptcha.net", "google.com");

        if (solverState.recaptchaLanguage.length < 1) {
          context.logInfo("Recaptcha Language is not recognized");
          solverState.recaptchaLanguage = "en-US";
        }

        context.logInfo(
          `Solving reCAPTCHA with audio using server: ${serverUrl} (Language: ${solverState.recaptchaLanguage})`
        );

        GM_xmlhttpRequest({
          method: "POST",
          url: serverUrl, // Use server URL directly, not with /audio endpoint
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          data:
            "input=" +
            encodeURIComponent(processedUrl) +
            "&lang=" +
            solverState.recaptchaLanguage,
          timeout: 60000, // Use 60 seconds timeout like original
          onload: function (response) {
            const responseTime = Date.now() - requestStart;
            context.logInfo(
              `Response from ${serverUrl} (${responseTime}ms): ${response.responseText}`
            );

            try {
              if (response && response.responseText) {
                var responseText = response.responseText;
                // Validate Response for error messages or html elements (same as original)
                if (
                  responseText == "0" ||
                  responseText.includes("<") ||
                  responseText.includes(">") ||
                  responseText.length < 2 ||
                  responseText.length > 50
                ) {
                  // Invalid Response, Reload the captcha
                  context.logWarning("Invalid Response. Retrying..");
                  updateServerStats(serverUrl, false, responseTime);
                  callback(null);
                } else {
                  // Valid response - return the text directly
                  context.logSuccess(
                    `reCAPTCHA solved successfully: "${responseText}"`
                  );
                  updateServerStats(serverUrl, true, responseTime);
                  callback(responseText);
                }
              } else {
                context.logError("Empty response from server");
                updateServerStats(serverUrl, false, responseTime);
                callback(null);
              }
            } catch (err) {
              context.logError(
                "Exception handling response. Retrying..: " + err.message
              );
              updateServerStats(serverUrl, false, responseTime);
              callback(null);
            }
          },
          onerror: function (e) {
            const responseTime = Date.now() - requestStart;
            context.logError(`reCAPTCHA solver error from ${serverUrl}: ${e}`);
            updateServerStats(serverUrl, false, responseTime);
            callback(null);
          },
          ontimeout: function () {
            const responseTime = Date.now() - requestStart;
            context.logError(
              `Response Timed out from ${serverUrl}. Retrying..`
            );
            updateServerStats(serverUrl, false, responseTime);
            callback(null);
          },
        });
      })
      .catch(error => {
        context.logError(`Failed to get best server: ${error.message}`);
        callback(null);
      });
  }

  // ============= MAIN SOLVER LOGIC =============

  // Main reCAPTCHA solver function
  function solveRecaptcha() {
    if (solverState.solved) {
      return;
    }

    const checkbox = utils.qSelector(utils.RECAPTCHA_SELECTORS.CHECK_BOX);
    const audioButton = utils.qSelector(utils.RECAPTCHA_SELECTORS.AUDIO_BUTTON);
    const audioSource = utils.qSelector(utils.RECAPTCHA_SELECTORS.AUDIO_SOURCE);
    const imageSelect = utils.qSelector(utils.RECAPTCHA_SELECTORS.IMAGE_SELECT);
    const responseField = utils.qSelector(
      utils.RECAPTCHA_SELECTORS.RESPONSE_FIELD
    );
    const audioErrorMessage = utils.qSelector(
      utils.RECAPTCHA_SELECTORS.AUDIO_ERROR_MESSAGE
    );
    const verifyButton = utils.qSelector(
      utils.RECAPTCHA_SELECTORS.VERIFY_BUTTON
    );
    const reloadButton = utils.qSelector(
      utils.RECAPTCHA_SELECTORS.RELOAD_BUTTON
    );
    const recaptchaStatus = utils.qSelector(
      utils.RECAPTCHA_SELECTORS.RECAPTCHA_STATUS
    );
    const dosCaptcha = utils.qSelector(utils.RECAPTCHA_SELECTORS.DOSCAPTCHA);

    // Check for DoS protection
    if (dosCaptcha && !utils.isHidden(dosCaptcha)) {
      context.logWarning("DoS protection detected, waiting...");
      setTimeout(solveRecaptcha, 5000);
      return;
    }

    // Check if already solved
    if (recaptchaStatus && recaptchaStatus.innerText.includes("verified")) {
      context.logSuccess("reCAPTCHA already solved!");
      solverState.solved = true;
      context.state.captchaSolved = true;
      context.state.captchaInProgress = false;
      context.state.lastSolvedTime = Date.now();
      solverState.lastSolveTime = Date.now();

      // Emit solved event
      context.emit("recaptchaSolved", {
        solveTime: Date.now() - solverState.lastSolveTime,
        attempts: solverState.currentAttempt,
      });

      return;
    }

    // Click checkbox if not clicked
    if (checkbox && !solverState.checkBoxClicked && !utils.isHidden(checkbox)) {
      context.logInfo("Clicking reCAPTCHA checkbox...");
      utils
        .safeClick(checkbox)
        .then(() => {
          solverState.checkBoxClicked = true;
          context.state.captchaInProgress = true;
          setTimeout(solveRecaptcha, 2000);
        })
        .catch(error => {
          context.logError("Failed to click checkbox", error);
          setTimeout(solveRecaptcha, 1000);
        });
      return;
    }

    // Handle image challenge - switch to audio
    if (imageSelect && !utils.isHidden(imageSelect)) {
      if (audioButton && !utils.isHidden(audioButton)) {
        context.logInfo("Switching to audio challenge...");
        utils
          .safeClick(audioButton)
          .then(() => {
            setTimeout(solveRecaptcha, 2000);
          })
          .catch(error => {
            context.logError("Failed to click audio button", error);
            setTimeout(solveRecaptcha, 1000);
          });
        return;
      }
    }

    // Handle audio challenge
    if (responseField && !utils.isHidden(responseField)) {
      if (
        audioSource &&
        audioSource.src &&
        !solverState.waitingForAudioResponse
      ) {
        const currentAudioUrl = audioSource.src;

        if (currentAudioUrl !== solverState.audioUrl) {
          solverState.audioUrl = currentAudioUrl;
          solverState.waitingForAudioResponse = true;
          solverState.currentAttempt++;

          solveAudioChallenge(solverState.audioUrl, function (text) {
            solverState.waitingForAudioResponse = false;

            if (text) {
              responseField.value = text;

              // Trigger input events
              responseField.dispatchEvent(
                new Event("input", { bubbles: true })
              );
              responseField.dispatchEvent(
                new Event("change", { bubbles: true })
              );

              setTimeout(() => {
                if (verifyButton && !utils.isHidden(verifyButton)) {
                  context.logInfo("Clicking verify button...");
                  utils
                    .safeClick(verifyButton)
                    .then(() => {
                      setTimeout(() => {
                        solveRecaptcha();
                      }, 3000);
                    })
                    .catch(error => {
                      context.logError("Failed to click verify button", error);
                      setTimeout(solveRecaptcha, 1000);
                    });
                }
              }, 1000);
            } else {
              // Reload if solve failed and haven't exceeded max attempts
              if (solverState.currentAttempt < solverState.maxAttempts) {
                if (reloadButton && !utils.isHidden(reloadButton)) {
                  context.logWarning(
                    `Audio solve failed (attempt ${solverState.currentAttempt}/${solverState.maxAttempts}), reloading challenge...`
                  );
                  utils
                    .safeClick(reloadButton)
                    .then(() => {
                      setTimeout(solveRecaptcha, 2000);
                    })
                    .catch(error => {
                      context.logError("Failed to click reload button", error);
                      setTimeout(solveRecaptcha, 1000);
                    });
                } else {
                  setTimeout(solveRecaptcha, 2000);
                }
              } else {
                context.logError(
                  `Max attempts (${solverState.maxAttempts}) reached, giving up`
                );
                context.emit("recaptchaFailed", {
                  attempts: solverState.currentAttempt,
                  reason: "max_attempts_reached",
                });
                return;
              }
            }
          });

          return;
        }
      }

      // Check for error messages
      if (audioErrorMessage && !utils.isHidden(audioErrorMessage)) {
        context.logWarning("Audio error detected, reloading...");
        if (reloadButton && !utils.isHidden(reloadButton)) {
          utils
            .safeClick(reloadButton)
            .then(() => {
              setTimeout(solveRecaptcha, 2000);
            })
            .catch(error => {
              context.logError("Failed to click reload button", error);
              setTimeout(solveRecaptcha, 1000);
            });
          return;
        }
      }
    }

    // Continue checking
    if (!solverState.solved) {
      setTimeout(solveRecaptcha, 1000);
    }
  }

  // ============= SOLVER CONTROL =============

  // Start reCAPTCHA solver
  function startRecaptchaSolver() {
    if (solverState.captchaInterval) {
      clearInterval(solverState.captchaInterval);
    }

    // Reset state
    solverState.solved = false;
    solverState.checkBoxClicked = false;
    solverState.waitingForAudioResponse = false;
    solverState.audioUrl = "";
    solverState.requestCount = 0;
    solverState.currentAttempt = 0;
    solverState.lastSolveTime = Date.now();

    context.logInfo("Starting reCAPTCHA solver...");
    context.state.captchaInProgress = true;

    // Start solving
    setTimeout(solveRecaptcha, 2000);

    // Set up interval for continuous checking
    solverState.captchaInterval = setInterval(() => {
      if (!solverState.solved) {
        solveRecaptcha();
      } else {
        clearInterval(solverState.captchaInterval);
        solverState.captchaInterval = null;
      }
    }, 5000);
  }

  // Stop reCAPTCHA solver
  function stopRecaptchaSolver() {
    if (solverState.captchaInterval) {
      clearInterval(solverState.captchaInterval);
      solverState.captchaInterval = null;
    }

    context.state.captchaInProgress = false;
    context.logInfo("reCAPTCHA solver stopped");
  }

  // Reset solver state
  function resetSolver() {
    stopRecaptchaSolver();

    solverState.solved = false;
    solverState.checkBoxClicked = false;
    solverState.waitingForAudioResponse = false;
    solverState.audioUrl = "";
    solverState.requestCount = 0;
    solverState.currentAttempt = 0;

    context.logDebug("reCAPTCHA solver state reset");
  }

  // ============= AUTO-INITIALIZATION =============

  // Auto-initialize if on recaptcha page
  function initRecaptchaSolver() {
    if (window.location.href.includes("recaptcha")) {
      context.logInfo("reCAPTCHA page detected, starting solver...");
      startRecaptchaSolver();
    }
  }

  // ============= EXPORT TO SHARED CONTEXT =============

  // Add solver functions to context
  context.recaptchaSolver = {
    start: startRecaptchaSolver,
    stop: stopRecaptchaSolver,
    reset: resetSolver,
    solve: solveRecaptcha,
    getBestServer: getBestServer,
    getState: () => ({ ...solverState }),
    isActive: () => solverState.captchaInterval !== null,
    isSolved: () => solverState.solved,
  };

  // Add to global scope for backward compatibility
  Object.assign(window, {
    solveRecaptcha,
    startRecaptchaSolver,
    stopRecaptchaSolver,
    getBestServer,
  });

  // Mark module as loaded
  context.state.modulesLoaded["recaptcha-solver"] = true;
  context.modules["recaptcha-solver"] = context.recaptchaSolver;

  // Auto-initialize if on recaptcha page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRecaptchaSolver);
  } else {
    initRecaptchaSolver();
  }

  context.log("reCAPTCHA Solver Module loaded successfully!", "SUCCESS");
})();
