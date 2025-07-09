// ============= PAGE HANDLERS MODULE =============
// This module handles page-specific automation logic

(function() {
  "use strict";

  const context = window.ateexContext;
  const utils = context.utils;
  
  context.log("Loading Page Handlers Module...", "INFO");

  // ============= PAGE HANDLER STATE =============

  let pageState = {
    scriptStopped: false,
    currentPage: null,
    lastPageChange: 0,
    pageHandlers: new Map()
  };

  // ============= BROWSER DATA MANAGEMENT =============

  // Clear browser data
  async function clearBrowserData() {
    try {
      context.logInfo("🧹 Clearing browser data...");
      
      // Clear localStorage
      try {
        const keysToKeep = [
          utils.STORAGE_KEYS.CREDENTIALS,
          utils.STORAGE_KEYS.CREDENTIALS_EXPIRY,
          utils.STORAGE_KEYS.TARGET_COINS,
          utils.STORAGE_KEYS.STATS_HISTORY,
          utils.STORAGE_KEYS.AUTO_STATS_ENABLED,
          utils.STORAGE_KEYS.SETUP_COMPLETED,
          utils.STORAGE_KEYS.AUTO_STATS_START_TIME
        ];
        
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !keysToKeep.includes(key) && !key.startsWith('ateex_module_')) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            // Ignore individual removal errors
          }
        });
        
        context.logDebug(`Cleared ${keysToRemove.length} localStorage items`);
      } catch (e) {
        context.logWarning("Failed to clear localStorage: " + e.message);
      }

      // Clear sessionStorage
      try {
        sessionStorage.clear();
        context.logDebug("SessionStorage cleared");
      } catch (e) {
        context.logWarning("Failed to clear sessionStorage: " + e.message);
      }

      context.logSuccess("✅ Browser data cleared successfully");
    } catch (error) {
      context.logError("Error clearing browser data", error);
    }
  }

  // Clear Google cookies
  async function clearGoogleCookies(reload = false) {
    try {
      context.logInfo("🍪 Clearing Google cookies...");
      
      // Clear cookies related to Google/reCAPTCHA
      const cookiesToClear = [
        'NID', '1P_JAR', 'CONSENT', 'SOCS', 'AEC', 'DV',
        '__Secure-1PAPISID', '__Secure-1PSID', '__Secure-3PAPISID', '__Secure-3PSID',
        'APISID', 'HSID', 'SAPISID', 'SID', 'SIDCC', 'SSID'
      ];
      
      cookiesToClear.forEach(cookieName => {
        try {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.google.com;`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.recaptcha.net;`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        } catch (e) {
          // Ignore individual cookie clearing errors
        }
      });

      context.logSuccess("✅ Google cookies cleared");
      
      if (reload) {
        context.logInfo("🔄 Reloading page...");
        await utils.sleep(1000);
        window.location.reload();
      }
    } catch (error) {
      context.logError("Error clearing Google cookies", error);
    }
  }

  // ============= PAGE HANDLERS =============

  // Handle Earn Page
  async function handleEarnPage() {
    if (pageState.scriptStopped) {
      context.logWarning("🛑 Earn page handler stopped - script stopped");
      return;
    }

    // Check if auto stats is enabled
    if (!context.state.autoStatsEnabled) {
      context.logWithSpamControl(
        "⏳ Earn page handler waiting - auto stats not enabled yet",
        "DEBUG",
        "earn_page_waiting"
      );
      return;
    }

    context.logInfo("On earn page");

    try {
      // Wait 5 seconds
      context.logInfo("Waiting 5 seconds before clicking Clickcoin Start button...");
      await utils.sleep(5000);

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
        const startLink = clickcoinRow.querySelector('a[href*="clickcoin"]');
        
        if (startLink) {
          context.logInfo("Found Clickcoin Start link, clicking...");
          await utils.safeClick(startLink);
          
          context.logInfo("Waiting 7 seconds for popup ads to load and complete...");
          await utils.sleep(7000); // Wait 7 seconds for popup and ads
          
          // Increment cycle
          if (context.stats) {
            context.stats.incrementCycle();
          }
          
          // Logout
          logout();
          await utils.sleep(2000);
          
          // Clear browser data
          await clearBrowserData();
        } else {
          context.logWarning("Clickcoin Start link not found");
          // Fallback: find button in row
          const startButton = clickcoinRow.querySelector("button");
          if (startButton) {
            context.logInfo("Found Clickcoin Start button, clicking...");
            await utils.safeClick(startButton);
            
            context.logInfo("Waiting 7 seconds for popup ads to load and complete...");
            await utils.sleep(7000); // Wait 7 seconds for popup and ads
            
            if (context.stats) {
              context.stats.incrementCycle();
            }
            logout();
            await utils.sleep(2000);
            await clearBrowserData();
          } else {
            context.logWarning("No Start button found in Clickcoin row");
          }
        }
      } else {
        context.logWarning("Clickcoin row not found");
      }
    } catch (error) {
      context.logError("Error in handleEarnPage", error);
    }
  }

  // Handle Login Page
  async function handleLoginPage() {
    if (pageState.scriptStopped) {
      context.logWarning("🛑 Login page handler stopped - script stopped");
      return;
    }

    // Check if auto stats is enabled
    if (!context.state.autoStatsEnabled) {
      context.logWithSpamControl(
        "⏳ Login page handler waiting - auto stats not enabled yet",
        "DEBUG",
        "login_page_waiting"
      );
      return;
    }

    context.logInfo("On login page");

    try {
      // Get credentials
      const credentials = context.credentials ? await context.credentials.get() : null;
      
      if (!credentials) {
        context.logWarning("No credentials available for login");
        return;
      }

      // Wait for page to load
      await utils.sleep(2000);

      // Find login form elements
      const emailInput = await utils.waitForElement('input[name="email"], input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]', 10000);
      const passwordInput = await utils.waitForElement('input[name="password"], input[type="password"]', 10000);
      const loginButton = await utils.waitForElement('button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign in")', 10000);

      if (emailInput && passwordInput && loginButton) {
        context.logInfo("Filling login form...");
        
        // Fill credentials
        emailInput.value = credentials.email;
        passwordInput.value = credentials.password;
        
        // Trigger events
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        await utils.sleep(1000);

        // Check for reCAPTCHA
        const recaptchaElement = utils.qSelector('.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]');
        
        if (recaptchaElement) {
          context.logInfo("Found reCAPTCHA element, starting solver...");
          context.state.captchaInProgress = true;

          // Wait for reCAPTCHA to be solved (60 seconds timeout)
          let captchaWaitTime = 0;
          const maxCaptchaWait = 60000;

          context.logInfo("Waiting for reCAPTCHA to be solved...");
          while (
            !context.state.captchaSolved &&
            captchaWaitTime < maxCaptchaWait
          ) {
            await utils.sleep(1000);
            captchaWaitTime += 1000;

            // Check global state
            if (context.state.captchaSolved) {
              context.logSuccess("reCAPTCHA solved by iframe!");
              break;
            }

            // Log progress every 10 seconds
            if (captchaWaitTime % 10000 === 0) {
              context.logInfo(
                `Still waiting for reCAPTCHA... ${captchaWaitTime / 1000}s elapsed`
              );
            }
          }

          if (!context.state.captchaSolved) {
            context.logWarning("reCAPTCHA solving timeout, proceeding anyway...");
          }
        }

        // Click login button
        context.logInfo("Clicking login button...");
        await utils.safeClick(loginButton);
        
        // Wait for redirect
        await utils.sleep(3000);
        
        // Check if login was successful
        if (window.location.pathname.includes('/home') || window.location.pathname.includes('/earn')) {
          context.logSuccess("Login successful!");
        } else {
          context.logWarning("Login may have failed - still on login page");
        }
        
      } else {
        context.logError("Could not find login form elements");
      }
    } catch (error) {
      context.logError("Error in handleLoginPage", error);
    }
  }

  // Handle Home Page
  async function handleHomePage() {
    if (pageState.scriptStopped) {
      context.logWarning("🛑 Home page handler stopped - script stopped");
      return;
    }

    // Check if auto stats is enabled
    if (!context.state.autoStatsEnabled) {
      context.logWithSpamControl(
        "⏳ Home page handler waiting - auto stats not enabled yet",
        "DEBUG",
        "home_page_waiting"
      );
      return;
    }

    context.logInfo("On home page");

    try {
      // Wait 2-4 seconds as requested
      const waitTime = Math.random() * 2000 + 2000; // 2-4 seconds
      context.logInfo(
        `Waiting ${Math.round(waitTime / 1000)} seconds before redirecting to earn page...`
      );
      await utils.sleep(waitTime);

      // Redirect to earn page
      context.logInfo("Redirecting to earn page");
      window.location.href = utils.URLS.EARN;
    } catch (error) {
      context.logError("Error in handleHomePage", error);
    }
  }

  // ============= UTILITY FUNCTIONS =============

  // Logout function
  function logout() {
    const logoutForm = document.querySelector('form[action*="/logout"]');
    if (logoutForm) {
      context.logInfo("Logout form found, submitting...");
      logoutForm.submit();
      return;
    }

    const logoutButton =
      document.querySelector('a[href*="logout"]') ||
      document.querySelector('button[onclick*="logout"]') ||
      document.querySelector(".logout");

    if (logoutButton) {
      logoutButton.click();
      context.logInfo("Logout button clicked");
    } else {
      context.logInfo("No logout form/button found, redirecting to logout URL");
      window.location.href = utils.URLS.LOGOUT;
    }
  }

  // ============= PAGE ROUTING =============

  // Initialize page handlers
  function initializePageHandlers() {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;

    context.logInfo(`Current path: ${currentPath}`);
    context.logInfo(`Current URL: ${currentUrl}`);

    pageState.currentPage = currentPath;
    pageState.lastPageChange = Date.now();

    // Handle different pages
    if (currentPath.includes("/earn")) {
      setTimeout(() => handleEarnPage(), 1000);
    } else if (currentPath.includes("/login")) {
      setTimeout(() => handleLoginPage(), 1000);
    } else if (currentPath.includes("/logout")) {
      // Handle logout page - clear data and redirect to login
      context.logInfo("On logout page, clearing data and redirecting to login");
      clearBrowserData().then(() => {
        setTimeout(() => {
          window.location.href = utils.URLS.LOGIN;
        }, 1000);
      });
    } else if (currentPath.includes("/home") || currentPath === "/") {
      setTimeout(() => handleHomePage(), 1000);
    } else {
      context.logInfo("Unknown page, no action taken");
    }
  }

  // ============= EXPORT TO SHARED CONTEXT =============

  // Add page handler functions to context
  context.pageHandlers = {
    handleEarn: handleEarnPage,
    handleLogin: handleLoginPage,
    handleHome: handleHomePage,
    clearBrowserData: clearBrowserData,
    clearGoogleCookies: clearGoogleCookies,
    logout: logout,
    initialize: initializePageHandlers,
    getState: () => ({ ...pageState }),
    stop: () => { pageState.scriptStopped = true; },
    start: () => { pageState.scriptStopped = false; }
  };

  // Add to global scope for backward compatibility
  Object.assign(window, {
    handleEarnPage,
    handleLoginPage,
    handleHomePage,
    clearBrowserData,
    logout
  });

  // Mark module as loaded
  context.state.modulesLoaded['page-handlers'] = true;
  context.modules['page-handlers'] = context.pageHandlers;

  context.log("Page Handlers Module loaded successfully!", "SUCCESS");

})();
