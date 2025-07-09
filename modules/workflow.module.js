/**
 * Workflow Module - Auto-earning workflow logic
 * Handles page-specific logic for login, home, earn pages and overall workflow
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const core = AteexModules.core;
  const credentials = AteexModules.credentials;
  const data = AteexModules.data;
  const ui = AteexModules.ui;
  const recaptcha = AteexModules.recaptcha;
  const { log, logInfo, logError, logSuccess, logWarning, qSelector, sleep } =
    core;

  // ============= WORKFLOW STATE =============

  let CONFIG = null;

  // ============= PAGE HANDLERS =============

  // Handle earn page
  async function handleEarnPage() {
    // Check if script should be stopped
    if (window.scriptStopped) {
      logInfo("🛑 Earn page handler stopped - script stopped");
      return;
    }

    // Check if auto stats is enabled
    if (!core.state.autoStatsEnabled) {
      core.logWithSpamControl(
        "⏳ Earn page waiting - auto stats not enabled",
        "WARNING",
        "earn_page_waiting"
      );
      return;
    }

    logInfo("📈 On earn page");

    try {
      // Wait 5 seconds
      await sleep(5000);

      // Find Clickcoin row accurately according to HTML structure
      const clickcoinRow = Array.from(document.querySelectorAll("tr")).find(
        row => {
          const tdElements = row.querySelectorAll("td");
          return (
            tdElements.length > 0 &&
            tdElements[0].textContent.trim() === "Clickcoin"
          );
        }
      );

      if (clickcoinRow) {
        // Find Start link in Clickcoin row
        const startLink = clickcoinRow.querySelector(
          'a[href*="/earn/clickcoin"]'
        );
        if (startLink) {
          logSuccess("Found Clickcoin Start link, clicking...");

          // Ensure link opens in new tab
          startLink.setAttribute("target", "_blank");
          startLink.setAttribute("rel", "noopener noreferrer");

          // Click link
          startLink.click();

          // Wait 7 seconds for popup ads to load and complete
          await sleep(7000);

          // Increment cycle counter
          data.incrementCycle();

          // Perform logout
          ui.logout();

          // Wait for logout to complete before clearing data
          await sleep(2000);

          // Clear browser data
          await data.clearBrowserData();
        } else {
          // Fallback: find button in row
          const startButton = clickcoinRow.querySelector("button");
          if (startButton) {
            logSuccess("Found Clickcoin Start button, clicking...");
            startButton.click();
            await sleep(7000); // Wait 7 seconds for popup and ads
            data.incrementCycle();
            ui.logout();
            await sleep(2000);
            await data.clearBrowserData();
          } else {
            logWarning("No Start button found in Clickcoin row");
          }
        }
      } else {
        logWarning("Clickcoin row not found");
        // Debug: log all rows
        const allRows = document.querySelectorAll("tr");
        logError(`Found ${allRows.length} rows in table, but no Clickcoin row`);
      }
    } catch (error) {
      logError("Error in handleEarnPage: " + error.message);
    }
  }

  // Handle login page
  async function handleLoginPage() {
    // Check if script should be stopped
    if (window.scriptStopped) {
      logInfo("🛑 Login page handler stopped - script stopped");
      return;
    }

    // Check if auto stats is enabled
    if (!core.state.autoStatsEnabled) {
      core.logWithSpamControl(
        "⏳ Login page waiting - auto stats not enabled",
        "WARNING",
        "login_page_waiting"
      );
      return;
    }

    logInfo("🔑 On login page");

    try {
      // Listen for messages from iframe
      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "ateex_captcha_solved") {
          logSuccess("Received captcha solved message from iframe");
          core.state.captchaSolved = true;
          core.state.captchaInProgress = false;
          core.state.lastSolvedTime = event.data.timestamp;
        }
      });

      // STEP 1: Ensure credentials are available FIRST
      if (!CONFIG || !CONFIG.email || !CONFIG.password) {
        logInfo("Getting credentials...");
        CONFIG = await credentials.getCredentials();

        if (!CONFIG) {
          logWarning("User cancelled credential input, stopping script");
          logWarning(
            "reCAPTCHA will remain blocked until credentials are provided"
          );
          return;
        }

        logSuccess("Credentials obtained successfully");
      }

      // CRITICAL: Mark credentials as ready to allow reCAPTCHA
      core.state.credentialsReady = true;
      logSuccess("Credentials ready - reCAPTCHA can now proceed");

      // Notify all iframes that credentials are ready
      try {
        const message = {
          type: "ateex_credentials_ready",
          timestamp: Date.now(),
        };

        // Send to all frames
        const frames = document.querySelectorAll("iframe");
        if (frames.length > 0) {
          frames.forEach(frame => {
            try {
              frame.contentWindow.postMessage(message, "*");
            } catch (e) {
              // Ignore cross-origin errors
            }
          });
        }
      } catch (e) {
        logError("Error sending credentials ready message: " + e.message);
      }

      // STEP 2: Wait before proceeding (5-10 seconds as requested)
      const waitTime = Math.random() * 5000 + 5000; // 5-10 seconds
      await sleep(waitTime);

      // STEP 3: Validate credentials (should be valid at this point)
      if (!CONFIG || !CONFIG.email || !CONFIG.password) {
        logWarning(
          "No valid credentials available - auto stats may not be enabled yet"
        );
        logInfo("⏳ Waiting for credentials setup to complete...");
        return; // Gracefully exit without blocking
      }

      if (!credentials.isValidUsernameOrEmail(CONFIG.email)) {
        logError("Invalid username/email format in credentials");
        credentials.clearCredentials();
        logWarning(
          "⚠️ Invalid credentials detected - clearing and waiting for new setup"
        );
        return; // Gracefully exit, let new flow handle re-setup
      }

      if (!credentials.isValidPassword(CONFIG.password)) {
        logError("Invalid password in credentials");
        credentials.clearCredentials();
        logWarning(
          "⚠️ Invalid password detected - clearing and waiting for new setup"
        );
        return; // Gracefully exit, let new flow handle re-setup
      }

      // STEP 4: Fill login form

      // Fill email/username
      const emailInput = qSelector('input[name="email"]');
      if (emailInput) {
        emailInput.value = CONFIG.email;
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        // Try alternative selectors
        const altEmailInput =
          qSelector('input[type="email"]') ||
          qSelector('input[placeholder*="email" i]') ||
          qSelector('input[id*="email" i]');
        if (altEmailInput) {
          altEmailInput.value = CONFIG.email;
          altEmailInput.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          logError("Could not find any email input field");
        }
      }

      // Fill password
      const passwordInput = qSelector('input[name="password"]');
      if (passwordInput) {
        passwordInput.value = CONFIG.password;
        passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        // Try alternative selectors
        const altPasswordInput =
          qSelector('input[type="password"]') ||
          qSelector('input[placeholder*="password" i]') ||
          qSelector('input[id*="password" i]');
        if (altPasswordInput) {
          altPasswordInput.value = CONFIG.password;
          altPasswordInput.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          logError("Could not find any password input field");
        }
      }

      // STEP 5: Handle reCAPTCHA (only after form is filled)
      // Check if captcha was already solved in iframe
      if (core.state.captchaSolved) {
        logSuccess("reCAPTCHA already solved, proceeding with login");
      } else {
        // Look for reCAPTCHA element
        const recaptchaElement =
          qSelector(".g-recaptcha") ||
          qSelector("#recaptcha-element") ||
          qSelector("[data-sitekey]") ||
          qSelector('iframe[src*="recaptcha"]');

        if (recaptchaElement) {
          logInfo("Found reCAPTCHA element, waiting for solver...");
          core.state.captchaInProgress = true;

          // Wait for reCAPTCHA to be solved (60 seconds timeout)
          let captchaWaitTime = 0;
          const maxCaptchaWait = 60000;

          while (
            !core.state.captchaSolved &&
            captchaWaitTime < maxCaptchaWait
          ) {
            await sleep(1000);
            captchaWaitTime += 1000;

            // Check global state
            if (core.state.captchaSolved) {
              logSuccess("reCAPTCHA solved by iframe!");
              break;
            }

            // Log progress every 20 seconds to reduce spam
            if (captchaWaitTime % 20000 === 0) {
              core.logWithSpamControl(
                `Still waiting for reCAPTCHA... ${
                  captchaWaitTime / 1000
                }s elapsed`,
                "INFO",
                "captcha_wait_progress"
              );
            }
          }

          if (core.state.captchaSolved) {
            logSuccess("reCAPTCHA solved successfully, proceeding with login");
            // Wait 2 seconds before submitting
            await sleep(2000);
          } else {
            logWarning(
              "reCAPTCHA not solved within timeout period, attempting login anyway"
            );
          }
        } else {
          logInfo("No reCAPTCHA found on page, proceeding with login");
        }
      }

      // STEP 6: Submit form and monitor result
      const loginForm = qSelector('form[action*="login"]') || qSelector("form");
      if (loginForm) {
        logInfo("Submitting login form");
        loginForm.submit();
        // Start monitoring for login result
        setTimeout(credentials.monitorLoginResult, 1000);
      } else {
        const signInButton =
          qSelector('button[type="submit"]') ||
          qSelector('input[type="submit"]') ||
          qSelector('button[class*="login"]') ||
          qSelector('button[id*="login"]');
        if (signInButton) {
          logInfo("Clicking sign in button");
          signInButton.click();
          // Start monitoring for login result
          setTimeout(credentials.monitorLoginResult, 1000);
        } else {
          logError("No login form or submit button found");
        }
      }

      logSuccess("Login process completed, monitoring result...");
    } catch (error) {
      logError("Error in handleLoginPage: " + error.message);
    }
  }

  // Handle home page
  async function handleHomePage() {
    // Check if script should be stopped
    if (window.scriptStopped) {
      logInfo("🛑 Home page handler stopped - script stopped");
      return;
    }

    // Check if auto stats is enabled
    if (!core.state.autoStatsEnabled) {
      core.logWithSpamControl(
        "⏳ Home page waiting - auto stats not enabled",
        "WARNING",
        "home_page_waiting"
      );
      return;
    }

    logInfo("🏠 On home page");

    try {
      // Wait 2-4 seconds as requested
      const waitTime = Math.random() * 2000 + 2000; // 2-4 seconds
      await sleep(waitTime);

      // Navigate to earn page
      logInfo("Redirecting to earn page");
      window.location.href = "https://dash.ateex.cloud/earn";
    } catch (error) {
      logError("Error in handleHomePage: " + error.message);
    }
  }

  // Handle logout page
  async function handleLogoutPage() {
    logInfo("🔓 On logout page, clearing data and redirecting to login");
    await data.clearBrowserData();
    setTimeout(() => {
      window.location.href = "https://dash.ateex.cloud/login";
    }, 1000);
  }

  // Handle popup/ads pages
  function handlePopupPage() {
    logInfo("📺 Detected ads/popup page, will auto-close");
    setTimeout(() => {
      logInfo("Auto-closing ads page");
      window.close();
    }, Math.random() * 5000 + 8000); // 8-13 seconds
  }

  // ============= MAIN WORKFLOW ORCHESTRATOR =============

  async function start() {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;

    // Handle reCAPTCHA iframe separately - NO UI creation
    if (currentUrl.includes("recaptcha")) {
      logInfo("🔄 Detected reCAPTCHA iframe");

      // Listen for credentials ready message from parent (with spam prevention)
      let lastCredentialsMessage = 0;
      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "ateex_credentials_ready") {
          const now = Date.now();
          // Only log once every 60 seconds to prevent spam
          if (now - lastCredentialsMessage > 60000) {
            core.logWithSpamControl(
              "Received credentials ready message from parent window",
              "INFO",
              "credentials_ready_message"
            );
            lastCredentialsMessage = now;
          }
          core.state.credentialsReady = true;
        }
      });

      recaptcha.initCaptchaSolver();
      return; // Only handle captcha, nothing else
    }

    // Initialize UI for main pages only (credentials will be handled per page)
    if (window.top === window.self) {
      // Check auto stats state first (backward compatibility + new flow)
      const autoStatsWasEnabled = core.checkAutoStatsState();

      // Check if credentials already exist and set flag
      const existingCreds = credentials.loadCredentials();
      if (existingCreds && existingCreds.email && existingCreds.password) {
        CONFIG = existingCreds;
        core.state.credentialsReady = true;
        logSuccess("Existing credentials found and loaded");

        // Notify iframes that credentials are ready
        setTimeout(() => {
          try {
            const message = {
              type: "ateex_credentials_ready",
              timestamp: Date.now(),
            };

            const frames = document.querySelectorAll("iframe");
            if (frames.length > 0) {
              frames.forEach(frame => {
                try {
                  frame.contentWindow.postMessage(message, "*");
                } catch (e) {
                  // Ignore cross-origin errors
                }
              });
            }
          } catch (e) {
            logError(
              "Error sending existing credentials message: " + e.message
            );
          }
        }, 1000); // Wait 1 second for iframes to load

        // Send message to new iframes when they appear (less frequent)
        let lastIframeCount = 0;
        setInterval(() => {
          if (core.state.credentialsReady) {
            const frames = document.querySelectorAll("iframe");
            // Only send if new iframes appeared
            if (frames.length > lastIframeCount) {
              try {
                const message = {
                  type: "ateex_credentials_ready",
                  timestamp: Date.now(),
                };

                frames.forEach(frame => {
                  try {
                    frame.contentWindow.postMessage(message, "*");
                  } catch (e) {
                    // Ignore cross-origin errors
                  }
                });
              } catch (e) {
                // Ignore errors
              }
            }
            lastIframeCount = frames.length;
          }
        }, 5000); // Check every 5 seconds instead of 3
      }

      // Load data first, then create UI with current data (only if auto stats enabled)
      data.loadSavedStats();

      // Only create UI and start operations if auto stats is enabled
      if (core.state.autoStatsEnabled) {
        ui.createCounterUI();
        // Force immediate update to show loaded data
        ui.updateCounter();
        logSuccess("🚀 Auto Stats runtime active - UI created");
      } else {
        // For new users, immediately prompt for credentials
        setTimeout(async () => {
          try {
            logInfo("🔐 Setting up credentials...");
            const newCredentials = await credentials.getCredentials();

            if (newCredentials) {
              CONFIG = newCredentials;
              core.state.credentialsReady = true;
              logSuccess("✅ Credentials obtained - Auto Stats enabled");

              // Notify iframes that credentials are ready
              const message = {
                type: "ateex_credentials_ready",
                timestamp: Date.now(),
              };

              const frames = document.querySelectorAll("iframe");
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
          } catch (e) {
            logError("Error during credential setup: " + e.message);
          }
        }, 2000); // Wait 2 seconds for page to fully load
      }

      // Update counter more frequently for better UX
      setInterval(ui.updateCounter, 2000); // Update every 2 seconds instead of 10
    }

    // Handle popup ads pages (auto-close)
    if (
      currentUrl.includes("clickcoin") ||
      currentUrl.includes("ads") ||
      currentUrl.includes("popup") ||
      currentPath.includes("/earn/clickcoin")
    ) {
      handlePopupPage();
      return;
    }

    // Handle main pages
    if (currentPath.includes("/earn")) {
      // Always try to handle earn page (it has its own guards)
      handleEarnPage();
    } else if (currentPath.includes("/login")) {
      // Always try to handle login page (it has its own guards)
      handleLoginPage();
    } else if (currentPath.includes("/logout")) {
      // Handle logout page - clear data and redirect to login
      handleLogoutPage();
    } else if (currentPath.includes("/home") || currentPath === "/") {
      // Always try to handle home page (it has its own guards)
      handleHomePage();
    }
    // Removed unknown page log to reduce spam
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
