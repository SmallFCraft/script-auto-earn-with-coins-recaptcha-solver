/**
 * Workflow Module - Performance Optimized
 * Handles page-specific logic with minimal overhead
 */

(function (exports) {
  "use strict";

  // Get dependencies with validation
  const core = AteexModules.core;
  const credentials = AteexModules.credentials;
  const data = AteexModules.data;
  const ui = AteexModules.ui;
  const recaptcha = AteexModules.recaptcha;
  const proxy = AteexModules.proxy;

  // Quick validation
  if (!core || !credentials || !data || !ui || !recaptcha || !proxy) {
    throw new Error("Missing dependencies");
  }

  const { log, logInfo, logError, logSuccess, logWarning, qSelector, sleep } =
    core;

  // ============= WORKFLOW STATE =============
  let CONFIG = null;

  // ============= OPTIMIZED PAGE HANDLERS =============

  // Handle earn page - simplified
  async function handleEarnPage() {
    if (window.scriptStopped || !core.state.autoStatsEnabled) {
      return;
    }

    try {
      await sleep(4000); // Reduced from 5s to 4s

      // Quick find Clickcoin
      const clickcoinRow = Array.from(document.querySelectorAll("tr")).find(
        row => row.querySelector("td")?.textContent?.trim() === "Clickcoin"
      );

      if (clickcoinRow) {
        const startLink = clickcoinRow.querySelector(
          'a[href*="/earn/clickcoin"]'
        );
        if (startLink) {
          startLink.setAttribute("target", "_blank");
          startLink.setAttribute("rel", "noopener noreferrer");
          startLink.click();

          await sleep(6000); // Reduced from 7s to 6s
          data.incrementCycle();
          ui.logout();
          await sleep(1500); // Reduced from 2s to 1.5s
          await data.clearBrowserData();
        } else {
          const startButton = clickcoinRow.querySelector("button");
          if (startButton) {
            startButton.click();
            await sleep(6000);
            data.incrementCycle();
            ui.logout();
            await sleep(1500);
            await data.clearBrowserData();
          }
        }
      }
    } catch (error) {
      logError("Error in handleEarnPage: " + error.message);
    }
  }

  // Handle login page - optimized
  async function handleLoginPage() {
    if (window.scriptStopped || !core.state.autoStatsEnabled) {
      return;
    }

    try {
      // Prevent duplicate handlers - simplified check
      if (window.ateexLoginHandlerActive) {
        return;
      }
      window.ateexLoginHandlerActive = true;

      // Simplified message handler
      const handleCaptchaMessage = function (event) {
        if (!event.data || typeof event.data !== "object") return;

        if (event.data.type === "ateex_captcha_solved" && event.data.solved) {
          logSuccess("✅ reCAPTCHA solved - submitting form");
          core.state.captchaSolved = true;
          core.state.captchaInProgress = false;
          core.state.lastSolvedTime = event.data.timestamp;

          // Quick form submission
          setTimeout(async () => {
            await attemptFormSubmission();
          }, 800); // Reduced delay
        }

        // Quick credentials response
        if (event.data.type === "ateex_request_credentials_state") {
          try {
            if (event.source) {
              event.source.postMessage(
                {
                  type: "ateex_credentials_ready",
                  ready: core.state.credentialsReady,
                  timestamp: Date.now(),
                },
                "*"
              );
            }
          } catch (e) {
            // Silent error
          }
        }
      };

      window.addEventListener("message", handleCaptchaMessage);

      // Quick custom event listener
      window.addEventListener("recaptchaSolved", function () {
        core.state.captchaSolved = true;
        core.state.captchaInProgress = false;
        setTimeout(async () => await attemptFormSubmission(), 800);
      });

      // STEP 1: Quick credential check
      if (!CONFIG?.email || !CONFIG?.password) {
        CONFIG = await credentials.getCredentials();
        if (!CONFIG) {
          return;
        }
      }

      core.state.credentialsReady = true;
      logSuccess("Credentials ready");

      // Quick notification to iframes
      const message = {
        type: "ateex_credentials_ready",
        timestamp: Date.now(),
      };
      const frames = document.querySelectorAll("iframe");
      frames.forEach(frame => {
        try {
          frame.contentWindow.postMessage(message, "*");
        } catch (e) {
          // Ignore errors
        }
      });

      // STEP 2: Reduced wait time
      const waitTime = Math.random() * 3000 + 3000; // Reduced to 3-6s from 5-10s
      await sleep(waitTime);

      // STEP 3: Quick credential validation
      if (!CONFIG?.email || !CONFIG?.password) {
        return;
      }

      if (
        !credentials.isValidUsernameOrEmail(CONFIG.email) ||
        !credentials.isValidPassword(CONFIG.password)
      ) {
        credentials.clearCredentials();
        return;
      }

      // STEP 4: Quick form filling
      const emailInput =
        qSelector('input[name="email"]') ||
        qSelector('input[type="email"]') ||
        qSelector('input[placeholder*="email" i]');

      const passwordInput =
        qSelector('input[name="password"]') ||
        qSelector('input[type="password"]') ||
        qSelector('input[placeholder*="password" i]');

      if (emailInput) {
        emailInput.value = CONFIG.email;
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        emailInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (passwordInput) {
        passwordInput.value = CONFIG.password;
        passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
        passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // STEP 5: Quick reCAPTCHA handling
      if (core.state.captchaSolved) {
        await attemptFormSubmission();
      } else {
        const recaptchaElement =
          qSelector(".g-recaptcha") ||
          qSelector("#recaptcha-element") ||
          qSelector("[data-sitekey]") ||
          qSelector('iframe[src*="recaptcha"]');

        if (recaptchaElement) {
          core.state.captchaInProgress = true;

          // Reduced wait time for reCAPTCHA
          let captchaWaitTime = 0;
          const maxCaptchaWait = 60000; // Reduced from 90s to 60s

          while (
            !core.state.captchaSolved &&
            captchaWaitTime < maxCaptchaWait
          ) {
            await sleep(2000);
            captchaWaitTime += 2000;

            if (core.state.captchaSolved) {
              break;
            }

            // Less frequent logging
            if (captchaWaitTime % 20000 === 0) {
              logInfo(`⏳ Waiting for reCAPTCHA... ${captchaWaitTime / 1000}s`);
            }
          }

          if (core.state.captchaSolved) {
            logSuccess("✅ reCAPTCHA solved - proceeding");
            await sleep(1500); // Reduced wait
            await attemptFormSubmission();
          } else {
            logWarning("⚠️ reCAPTCHA timeout - attempting anyway");
            await attemptFormSubmission();
          }
        } else {
          await attemptFormSubmission();
        }
      }

      // Simplified fallback detection
      setupQuickCaptchaFallback();
    } catch (error) {
      logError("Error in handleLoginPage: " + error.message);
    }
  }

  // Quick fallback detection
  function setupQuickCaptchaFallback() {
    let checkCount = 0;
    const maxChecks = 15; // Reduced from 30 to 15

    const fallbackInterval = setInterval(() => {
      checkCount++;

      try {
        const hasToken =
          document.querySelector('textarea[name="g-recaptcha-response"]')?.value
            ?.length > 0;
        const hasSuccessIndicator =
          document.querySelector(".recaptcha-checkbox-checked") !== null;

        if (hasToken || hasSuccessIndicator) {
          logSuccess("🎉 Fallback: reCAPTCHA solved!");
          core.state.captchaSolved = true;
          core.state.captchaInProgress = false;
          clearInterval(fallbackInterval);

          if (!window.ateexFormSubmitted) {
            setTimeout(async () => await attemptFormSubmission(), 800);
          }
          return;
        }

        if (checkCount >= maxChecks) {
          clearInterval(fallbackInterval);
        }
      } catch (e) {
        // Silent error
      }
    }, 8000); // Reduced from 10s to 8s

    // Quick cleanup
    setTimeout(() => clearInterval(fallbackInterval), maxChecks * 8000);
  }

  // Optimized form submission
  async function attemptFormSubmission() {
    if (window.ateexFormSubmitted) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 2; // Reduced from 3 to 2

    while (!window.ateexFormSubmitted && attempts < maxAttempts) {
      attempts++;

      try {
        // Quick form submission
        const loginForm =
          qSelector('form[action*="login"]') || qSelector("form");
        if (loginForm) {
          const emailField = loginForm.querySelector(
            'input[name="email"], input[type="email"]'
          );
          const passwordField = loginForm.querySelector(
            'input[name="password"], input[type="password"]'
          );

          if (emailField?.value && passwordField?.value) {
            window.ateexFormSubmitted = true;
            loginForm.submit();
            logSuccess("✅ Form submitted");
            setTimeout(credentials.monitorLoginResult, 1000);
            return;
          }
        }

        // Quick button click
        const signInButtons = [
          qSelector('button[type="submit"]'),
          qSelector('input[type="submit"]'),
          qSelector('button[class*="login"]'),
          qSelector('button[id*="login"]'),
        ].filter(btn => btn && !btn.disabled && btn.offsetParent !== null);

        if (signInButtons.length > 0) {
          const button = signInButtons[0];
          window.ateexFormSubmitted = true;
          button.click();
          logSuccess("✅ Button clicked");
          setTimeout(credentials.monitorLoginResult, 1000);
          return;
        }

        // Quick Enter key
        const passwordField = qSelector('input[type="password"]');
        if (passwordField && attempts >= 2) {
          passwordField.focus();
          const enterEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            bubbles: true,
          });
          passwordField.dispatchEvent(enterEvent);
          window.ateexFormSubmitted = true;
          logSuccess("✅ Enter key sent");
          setTimeout(credentials.monitorLoginResult, 1000);
          return;
        }

        if (attempts < maxAttempts) {
          await sleep(1500); // Reduced wait between attempts
        }
      } catch (error) {
        logError(`❌ Submission attempt ${attempts} error: ${error.message}`);
        if (attempts < maxAttempts) {
          await sleep(1500);
        }
      }
    }

    if (!window.ateexFormSubmitted) {
      window.ateexFormSubmitted = false;
      setTimeout(() => window.location.reload(), 3000); // Quick reload on failure
    }
  }

  // Handle home page - simplified
  async function handleHomePage() {
    if (window.scriptStopped || !core.state.autoStatsEnabled) {
      return;
    }

    try {
      const waitTime = Math.random() * 1500 + 1500; // Reduced to 1.5-3s from 2-4s
      await sleep(waitTime);
      window.location.href = "https://dash.ateex.cloud/earn";
    } catch (error) {
      logError("Error in handleHomePage: " + error.message);
    }
  }

  // Handle logout page - simplified
  async function handleLogoutPage() {
    await data.clearBrowserData();
    setTimeout(() => {
      window.location.href = "https://dash.ateex.cloud/login";
    }, 800); // Reduced from 1s to 0.8s
  }

  // Handle popup/ads pages - simplified
  function handlePopupPage() {
    setTimeout(() => {
      window.close();
    }, Math.random() * 3000 + 6000); // Reduced to 6-9s from 8-13s
  }

  // ============= OPTIMIZED WORKFLOW ORCHESTRATOR =============

  async function start() {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;

    // Quick reCAPTCHA iframe handling
    if (currentUrl.includes("recaptcha")) {
      // Minimal message listener
      let lastCredentialsMessage = 0;
      window.addEventListener("message", function (event) {
        if (event.data?.type === "ateex_credentials_ready") {
          const now = Date.now();
          if (now - lastCredentialsMessage > 30000) {
            // Reduced frequency
            lastCredentialsMessage = now;
          }
          core.state.credentialsReady = true;
        }
      });

      recaptcha.initCaptchaSolver();
      return;
    }

    // Quick UI initialization for main pages
    if (window.top === window.self) {
      const autoStatsWasEnabled = core.checkAutoStatsState();

      // Quick credential check
      const existingCreds = credentials.loadCredentials();
      if (existingCreds?.email && existingCreds?.password) {
        CONFIG = existingCreds;
        core.state.credentialsReady = true;

        // Quick iframe notification
        setTimeout(() => {
          const message = {
            type: "ateex_credentials_ready",
            timestamp: Date.now(),
          };
          const frames = document.querySelectorAll("iframe");
          frames.forEach(frame => {
            try {
              frame.contentWindow.postMessage(message, "*");
            } catch (e) {
              // Ignore errors
            }
          });
        }, 800); // Reduced delay

        // Quick iframe monitoring
        setInterval(() => {
          if (core.state.credentialsReady) {
            const frames = document.querySelectorAll("iframe");
            if (frames.length > 0) {
              const message = {
                type: "ateex_credentials_ready",
                timestamp: Date.now(),
              };
              frames.forEach(frame => {
                try {
                  frame.contentWindow.postMessage(message, "*");
                } catch (e) {
                  // Ignore errors
                }
              });
            }
          }
        }, 8000); // Reduced from 5s to 8s for less overhead
      }

      data.loadSavedStats();

      if (core.state.autoStatsEnabled) {
        ui.createCounterUI();
        ui.updateCounter();
      } else {
        // Quick credential setup for new users
        setTimeout(async () => {
          try {
            const newCredentials = await credentials.getCredentials();
            if (newCredentials) {
              CONFIG = newCredentials;
              core.state.credentialsReady = true;

              const message = {
                type: "ateex_credentials_ready",
                timestamp: Date.now(),
              };
              const frames = document.querySelectorAll("iframe");
              frames.forEach(frame => {
                try {
                  frame.contentWindow.postMessage(message, "*");
                } catch (e) {
                  // Ignore errors
                }
              });

              ui.createCounterUI();
              ui.updateCounter();
            }
          } catch (e) {
            logError("Error during credential setup: " + e.message);
          }
        }, 1500); // Reduced delay
      }

      // Less frequent UI updates
      setInterval(ui.updateCounter, 3000); // Increased from 2s to 3s
    }

    // Quick page routing
    if (
      currentUrl.includes("clickcoin") ||
      currentUrl.includes("ads") ||
      currentUrl.includes("popup") ||
      currentPath.includes("/earn/clickcoin")
    ) {
      handlePopupPage();
    } else if (currentPath.includes("/earn")) {
      handleEarnPage();
    } else if (currentPath.includes("/login")) {
      handleLoginPage();
    } else if (currentPath.includes("/logout")) {
      handleLogoutPage();
    } else if (currentPath.includes("/home") || currentPath === "/") {
      handleHomePage();
    }
  }

  // ============= EXPORTS =============
  exports.start = start;
  exports.handleEarnPage = handleEarnPage;
  exports.handleLoginPage = handleLoginPage;
  exports.handleHomePage = handleHomePage;
  exports.handleLogoutPage = handleLogoutPage;
  exports.handlePopupPage = handlePopupPage;
  exports.CONFIG = CONFIG;
})(exports);
