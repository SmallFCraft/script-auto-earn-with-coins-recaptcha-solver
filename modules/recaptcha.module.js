/**
 * ReCAPTCHA Module - Performance Optimized
 * Handles reCAPTCHA solving with minimal overhead
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  const data = AteexModules.data;
  const proxy = AteexModules.proxy;

  if (!core || !data || !proxy) {
    throw new Error("Missing dependencies");
  }

  const {
    log,
    logInfo,
    logError,
    logSuccess,
    logWarning,
    qSelector,
    isHidden,
  } = core;

  // ============= RECAPTCHA CONSTANTS =============
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

  // Optimized credentials check - reduced frequency
  let credentialsCheckAttempts = 0;
  let maxCredentialsAttempts = 5; // Reduced from 10 to 5
  let lastCredentialsCheck = 0;
  let credentialsCheckInterval = 5000; // Increased to 5 seconds

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
      // Silent error for performance
    }
  }

  // ============= OPTIMIZED CREDENTIALS CHECKING =============
  function checkCredentialsState() {
    if (window.top !== window.self) {
      let credentialsReady = false;

      // Quick local check first
      if (core.state.credentialsReady) {
        credentialsReady = true;
      }

      // Try parent check with minimal error handling
      if (!credentialsReady) {
        try {
          if (window.top.ateexGlobalState?.credentialsReady) {
            credentialsReady = true;
            core.state.credentialsReady = true;
          }
        } catch (e) {
          // Cross-origin blocked
        }
      }

      // Faster fallback - 5 attempts instead of 10
      if (
        !credentialsReady &&
        credentialsCheckAttempts >= maxCredentialsAttempts
      ) {
        core.logWithSpamControl(
          "Credentials check limit reached, proceeding",
          "WARNING",
          "credentials_fallback"
        );
        credentialsReady = true;
        core.state.credentialsReady = true;
      }

      // Faster time-based fallback - 15s instead of 30s
      if (!credentialsReady) {
        const timeSinceFirstCheck =
          Date.now() - (window.credentialsFirstCheck || Date.now());
        if (timeSinceFirstCheck > 15000) {
          core.logWithSpamControl(
            "Fast fallback: allowing reCAPTCHA after 15s",
            "WARNING",
            "credentials_time_fallback"
          );
          credentialsReady = true;
          core.state.credentialsReady = true;
        }
      }

      return credentialsReady;
    } else {
      return core.state.credentialsReady;
    }
  }

  // Simplified message listener
  function setupCredentialsMessageListener() {
    if (window.ateexCredentialsListenerSetup) {
      return;
    }
    window.ateexCredentialsListenerSetup = true;

    window.addEventListener("message", function (event) {
      if (event.data?.type === "ateex_credentials_ready") {
        const isReady =
          event.data.ready !== undefined ? event.data.ready : true;
        if (isReady) {
          core.state.credentialsReady = true;
          credentialsCheckAttempts = 0;
          if (!core.state.captchaInProgress && !core.state.captchaSolved) {
            setTimeout(() => initCaptchaSolver(), 1000);
          }
        }
      }
    });

    // Quick request to parent
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "ateex_request_credentials_state",
            timestamp: Date.now(),
          },
          "*"
        );
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // ============= SERVER MANAGEMENT =============
  function getBestServer(excludeServers = []) {
    try {
      const stats = data.getServerStats();
      let bestServer = null;
      let bestScore = -1;

      for (let i = 0; i < serversList.length; i++) {
        const server = serversList[i];
        const latency = latencyList[i];
        const serverStat = stats[server];

        if (excludeServers.includes(server)) {
          continue;
        }

        let score = 10000 - latency;

        if (serverStat?.totalRequests > 0) {
          const successRate =
            serverStat.successfulRequests / serverStat.totalRequests;
          score += successRate * 1000;
          if (serverStat.failures > 0) {
            score -= serverStat.failures * 1000;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestServer = server;
        }
      }

      return bestServer || serversList[0];
    } catch (e) {
      return serversList[0];
    }
  }

  // ============= OPTIMIZED AUDIO PROCESSING =============
  async function getTextFromAudio(URL) {
    const url = getBestServer();
    requestCount++;
    URL = URL.replace("recaptcha.net", "google.com");

    if (recaptchaLanguage.length < 1) {
      recaptchaLanguage = "en-US";
    }

    const requestStart = Date.now();

    try {
      let response;
      try {
        response = await proxy.makeProxyRequest({
          method: "POST",
          url: url,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          data:
            "input=" + encodeURIComponent(URL) + "&lang=" + recaptchaLanguage,
          timeout: 45000, // Reduced timeout
        });
      } catch (proxyError) {
        // Quick fallback to direct
        response = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: url,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data:
              "input=" + encodeURIComponent(URL) + "&lang=" + recaptchaLanguage,
            timeout: 45000,
            onload: resolve,
            onerror: reject,
            ontimeout: () => reject(new Error("Timeout")),
          });
        });
      }

      const responseTime = Date.now() - requestStart;

      if (response?.responseText) {
        const responseText = response.responseText;

        if (
          responseText == "0" ||
          responseText.includes("<") ||
          responseText.includes(">") ||
          responseText.length < 2 ||
          responseText.length > 50
        ) {
          data.updateServerStats(url, false, responseTime);
        } else if (
          qSelector(AUDIO_SOURCE)?.src &&
          audioUrl == qSelector(AUDIO_SOURCE).src &&
          qSelector(AUDIO_RESPONSE) &&
          !qSelector(AUDIO_RESPONSE).value &&
          qSelector(AUDIO_BUTTON).style.display == "none" &&
          qSelector(VERIFY_BUTTON)
        ) {
          qSelector(AUDIO_RESPONSE).value = responseText;
          qSelector(VERIFY_BUTTON).click();
          logSuccess("✅ reCAPTCHA solved successfully");
          data.updateServerStats(url, true, responseTime);
        } else {
          data.updateServerStats(url, false, responseTime);
        }
        waitingForAudioResponse = false;
      }
    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMsg = error?.message || "Unknown error";
      logError(`❌ reCAPTCHA solver error: ${errorMsg}`);
      data.updateServerStats(url, false, responseTime);
      waitingForAudioResponse = false;
    }
  }

  // ============= OPTIMIZED PING TESTING =============
  async function pingTest(url) {
    const start = Date.now();

    try {
      let response;
      try {
        response = await proxy.makeProxyRequest({
          method: "GET",
          url: url,
          timeout: 6000, // Reduced timeout
        });
      } catch (proxyError) {
        response = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: url,
            timeout: 6000,
            onload: resolve,
            onerror: reject,
            ontimeout: () => reject(new Error("Timeout")),
          });
        });
      }

      const responseTime = Date.now() - start;

      if (response?.responseText == "0") {
        for (let i = 0; i < serversList.length; i++) {
          if (url == serversList[i]) {
            latencyList[i] = responseTime;
          }
        }
        data.updateServerStats(url, true, responseTime);
        data.saveServerLatency(latencyList);
      } else {
        data.updateServerStats(url, false, responseTime);
      }
    } catch (error) {
      const responseTime = Date.now() - start;
      data.updateServerStats(url, false, responseTime);
    }
  }

  // ============= OPTIMIZED AUTOMATED QUERIES HANDLING =============
  async function handleAutomatedQueriesWithProxy() {
    try {
      const wasProxyEnabled = proxy.isProxyEnabled();
      if (!wasProxyEnabled) {
        proxy.enableProxyForAutomatedQueries();
      }

      if (proxy.isProxyEnabled()) {
        const proxyStats = proxy.getProxyStatsSummary();
        const recentlyUsedProxy = proxyStats.proxies
          .filter(p => p.lastUsed > 0)
          .sort((a, b) => b.lastUsed - a.lastUsed)[0];

        if (recentlyUsedProxy) {
          proxy.markProxyAsBlocked(recentlyUsedProxy.proxy);
        }

        await core.clearGoogleCookies(false);
        await core.sleep(1500); // Reduced wait time

        setTimeout(() => window.location.reload(), 800);
        return;
      }

      // Fallback
      await core.clearGoogleCookies(true);
    } catch (error) {
      logError("❌ Error in automated queries handler: " + error.message);
      await core.clearGoogleCookies(true);
    }
  }

  // ============= OPTIMIZED MAIN CAPTCHA SOLVER =============
  function initCaptchaSolver() {
    setupCredentialsMessageListener();

    const now = Date.now();

    if (!window.credentialsFirstCheck) {
      window.credentialsFirstCheck = now;
    }

    // Less frequent credential checks
    if (now - lastCredentialsCheck < credentialsCheckInterval) {
      return;
    }

    lastCredentialsCheck = now;
    credentialsCheckAttempts++;

    const credentialsReady = checkCredentialsState();

    if (!credentialsReady) {
      // Minimal logging for credentials wait
      if (credentialsCheckAttempts <= 2 || credentialsCheckAttempts % 3 === 0) {
        core.logWithSpamControl(
          `reCAPTCHA waiting for credentials (${credentialsCheckAttempts}/${maxCredentialsAttempts})`,
          "WARNING",
          "recaptcha_credentials_wait"
        );
      }

      // Quick periodic check
      if (credentialsCheckAttempts === 2 && window.top !== window.self) {
        const periodicCheck = setInterval(() => {
          try {
            if (window.top.ateexGlobalState?.credentialsReady) {
              core.state.credentialsReady = true;
              credentialsCheckAttempts = 0;
              clearInterval(periodicCheck);
              setTimeout(() => initCaptchaSolver(), 500);
            }
          } catch (e) {
            // Continue waiting
          }
        }, 3000); // Check every 3 seconds

        setTimeout(() => clearInterval(periodicCheck), 30000); // Cleanup after 30s
      }

      // Faster retry with reduced backoff
      const waitTime = Math.min(
        credentialsCheckInterval + credentialsCheckAttempts * 300,
        3000
      );
      setTimeout(() => initCaptchaSolver(), waitTime);
      return;
    }

    credentialsCheckAttempts = 0;

    if (core.state.captchaSolved) {
      return;
    }

    // Quick cooldown check
    if (core.state.lastAutomatedQueriesTime) {
      const timeSinceLastError =
        Date.now() - core.state.lastAutomatedQueriesTime;
      if (timeSinceLastError < 45000) {
        // Reduced from 60s to 45s
        setTimeout(() => initCaptchaSolver(), 3000);
        return;
      }
    }

    if (core.state.captchaInProgress && captchaInterval) {
      return;
    }

    initRecaptchaVars();

    // Quick latency load
    const cachedLatency = data.loadServerLatency();
    if (cachedLatency?.length === serversList.length) {
      latencyList = cachedLatency;
    }

    core.state.captchaInProgress = true;

    // Simplified checkbox clicking
    if (qSelector(CHECK_BOX)) {
      try {
        const checkbox = qSelector(CHECK_BOX);
        checkbox.click();

        const checkboxContainer = checkbox.closest(".recaptcha-checkbox");
        if (checkboxContainer) {
          checkboxContainer.click();
        }
      } catch (e) {
        // Silent error
      }
    } else if (window.location.href.includes("bframe")) {
      if (!cachedLatency) {
        for (let i = 0; i < serversList.length; i++) {
          pingTest(serversList[i]);
        }
      }
    }

    if (captchaInterval) {
      clearInterval(captchaInterval);
    }

    // Optimized solver interval - reduced frequency
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

        // Check if solved
        if (
          qSelector(RECAPTCHA_STATUS) &&
          qSelector(RECAPTCHA_STATUS).innerText != recaptchaInitialStatus
        ) {
          solved = true;
          logSuccess("reCAPTCHA SOLVED successfully!");
          clearInterval(captchaInterval);

          core.state.captchaSolved = true;
          core.state.captchaInProgress = false;
          core.state.lastSolvedTime = Date.now();

          // Quick notification to parent
          try {
            const message = {
              type: "ateex_captcha_solved",
              solved: true,
              timestamp: Date.now(),
            };

            if (window.parent && window.parent !== window) {
              window.parent.postMessage(message, "*");
            }
            if (window.top && window.top !== window) {
              window.top.postMessage(message, "*");
            }

            // Quick custom event
            window.dispatchEvent(
              new CustomEvent("recaptchaSolved", {
                detail: { solved: true, timestamp: Date.now() },
              })
            );
          } catch (e) {
            // Silent error
          }
        }

        if (requestCount > MAX_ATTEMPTS) {
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
              qSelector(AUDIO_SOURCE)?.src?.length > 0 &&
              audioUrl == qSelector(AUDIO_SOURCE).src &&
              qSelector(RELOAD_BUTTON)) ||
            (qSelector(AUDIO_ERROR_MESSAGE)?.innerText?.length > 0 &&
              qSelector(RELOAD_BUTTON) &&
              !qSelector(RELOAD_BUTTON).disabled)
          ) {
            qSelector(RELOAD_BUTTON).click();
          } else if (
            !waitingForAudioResponse &&
            qSelector(RESPONSE_FIELD) &&
            !isHidden(qSelector(RESPONSE_FIELD)) &&
            !qSelector(AUDIO_RESPONSE).value &&
            qSelector(AUDIO_SOURCE)?.src?.length > 0 &&
            audioUrl != qSelector(AUDIO_SOURCE).src &&
            requestCount <= MAX_ATTEMPTS
          ) {
            waitingForAudioResponse = true;
            audioUrl = qSelector(AUDIO_SOURCE).src;
            getTextFromAudio(audioUrl);
          }
        }

        // Handle automated queries
        if (qSelector(DOSCAPTCHA)?.innerText?.length > 0) {
          logWarning("🚫 Automated Queries - using enhanced recovery");
          core.state.captchaInProgress = false;
          clearInterval(captchaInterval);
          core.state.lastAutomatedQueriesTime = Date.now();
          await handleAutomatedQueriesWithProxy();
        }
      } catch (err) {
        logError("Solver error: " + err.message);
        core.state.captchaInProgress = false;
        clearInterval(captchaInterval);
      }
    }, 6000); // Increased interval from 5s to 6s for better performance
  }

  // ============= EXPORTS =============
  exports.initCaptchaSolver = initCaptchaSolver;
  exports.getBestServer = getBestServer;
  exports.getTextFromAudio = getTextFromAudio;
  exports.pingTest = pingTest;
  exports.initRecaptchaVars = initRecaptchaVars;
  exports.handleAutomatedQueriesWithProxy = handleAutomatedQueriesWithProxy;
  exports.checkCredentialsState = checkCredentialsState;
  exports.setupCredentialsMessageListener = setupCredentialsMessageListener;
  exports.serversList = serversList;
  exports.latencyList = latencyList;
})(exports);
