// ==UserScript==
// @name         Ateex Cloud Auto Script with reCAPTCHA Solver
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Auto script for Ateex Cloud with integrated reCAPTCHA solver
// @author       phmyhu_1710
// @match        https://dash.ateex.cloud/*
// @match        *://*/recaptcha/*
// @connect      engageub.pythonanywhere.com
// @connect      engageub1.pythonanywhere.com
// @grant        GM_xmlhttpRequest
// @run-at       document-ready
// ==/UserScript==

(function () {
  "use strict";

  // Global flag để tránh multiple instances
  if (window.ateexAutoRunning) {
    console.log("[Ateex Auto] Script already running, skipping...");
    return;
  }
  window.ateexAutoRunning = true;

  // Global state để đồng bộ giữa iframe và main page
  if (!window.ateexGlobalState) {
    window.ateexGlobalState = {
      captchaSolved: false,
      captchaInProgress: false,
      lastSolvedTime: 0,
      // Counter stats
      totalCycles: 0,
      totalCoins: 0,
      startTime: Date.now(),
      lastCycleTime: 0,
    };
  }

  // Cấu hình thông tin đăng nhập
  const CONFIG = {
    email: "huytqd@gmail.com", // Thay bằng email của bạn
    password: "0123321123", // Thay bằng password của bạn
  };

  // Utility functions
  function log(message) {
    console.log(`[Ateex Auto] ${message}`);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Counter và UI functions
  function createCounterUI() {
    // Tránh tạo multiple UI - kiểm tra cả window level
    if (document.getElementById("ateex-counter") || window.ateexCounterCreated)
      return;

    // Chỉ tạo counter trên main window, không phải iframe
    if (window.top !== window.self) return;

    const counterDiv = document.createElement("div");
    counterDiv.id = "ateex-counter";
    counterDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 10px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      min-width: 200px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
    `;

    counterDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">🚀 Ateex Auto Stats</div>
      <div id="cycles-count">Cycles: 0</div>
      <div id="coins-count">Coins: 0 💰</div>
      <div id="runtime">Runtime: 0m 0s</div>
      <div id="avg-time">Avg/cycle: --</div>
      <div id="coins-per-hour">Rate: 0 coins/h</div>
      <div id="eta-1000" style="margin-top: 5px; font-size: 11px;">ETA 1000: --</div>
    `;

    document.body.appendChild(counterDiv);
    window.ateexCounterCreated = true;
    log("Counter UI created");
  }

  function updateCounter() {
    // Chỉ update counter trên main window
    if (window.top !== window.self) return;

    const counter = document.getElementById("ateex-counter");
    if (!counter) return;

    const state = window.ateexGlobalState;
    const now = Date.now();
    const runtime = now - state.startTime;
    const runtimeMinutes = Math.floor(runtime / 60000);
    const runtimeSeconds = Math.floor((runtime % 60000) / 1000);

    const avgCycleTime =
      state.totalCycles > 0 ? runtime / state.totalCycles : 0;
    const coinsPerHour =
      runtime > 0 ? Math.round((state.totalCoins * 3600000) / runtime) : 0;

    // ETA for 1000 coins
    const coinsNeeded = 1000 - state.totalCoins;
    const cyclesNeeded = Math.ceil(coinsNeeded / 15);
    const etaMs = cyclesNeeded * avgCycleTime;
    const etaMinutes = Math.floor(etaMs / 60000);
    const etaHours = Math.floor(etaMinutes / 60);

    document.getElementById(
      "cycles-count"
    ).textContent = `Cycles: ${state.totalCycles}`;
    document.getElementById(
      "coins-count"
    ).textContent = `Coins: ${state.totalCoins} 💰`;
    document.getElementById(
      "runtime"
    ).textContent = `Runtime: ${runtimeMinutes}m ${runtimeSeconds}s`;
    document.getElementById("avg-time").textContent = `Avg/cycle: ${Math.round(
      avgCycleTime / 1000
    )}s`;
    document.getElementById(
      "coins-per-hour"
    ).textContent = `Rate: ${coinsPerHour} coins/h`;

    if (state.totalCoins >= 1000) {
      document.getElementById("eta-1000").textContent = `🎉 Goal reached!`;
    } else if (avgCycleTime > 0) {
      document.getElementById(
        "eta-1000"
      ).textContent = `ETA 1000: ${etaHours}h ${etaMinutes % 60}m`;
    }
  }

  function incrementCycle() {
    // Chỉ increment từ main window
    if (window.top !== window.self) return;

    window.ateexGlobalState.totalCycles++;
    window.ateexGlobalState.totalCoins += 15;
    window.ateexGlobalState.lastCycleTime = Date.now();

    log(
      `Cycle ${window.ateexGlobalState.totalCycles} completed! Total coins: ${window.ateexGlobalState.totalCoins}`
    );
    updateCounter();

    // Save to localStorage để persist qua sessions
    try {
      localStorage.setItem(
        "ateex_stats",
        JSON.stringify({
          totalCycles: window.ateexGlobalState.totalCycles,
          totalCoins: window.ateexGlobalState.totalCoins,
          startTime: window.ateexGlobalState.startTime,
        })
      );
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  function loadSavedStats() {
    try {
      const saved = localStorage.getItem("ateex_stats");
      if (saved) {
        const stats = JSON.parse(saved);
        window.ateexGlobalState.totalCycles = stats.totalCycles || 0;
        window.ateexGlobalState.totalCoins = stats.totalCoins || 0;
        window.ateexGlobalState.startTime = stats.startTime || Date.now();
        log(
          `Loaded saved stats: ${stats.totalCycles} cycles, ${stats.totalCoins} coins`
        );
      }
    } catch (e) {
      log("Could not load saved stats: " + e.message);
    }
  }

  function clearBrowserData() {
    // Backup stats trước khi clear
    const savedStats = localStorage.getItem("ateex_stats");

    // Xóa localStorage
    localStorage.clear();
    // Xóa sessionStorage
    sessionStorage.clear();

    // Restore stats
    if (savedStats) {
      localStorage.setItem("ateex_stats", savedStats);
    }
    // Xóa cookies (cải thiện từ script tham khảo)
    document.cookie.split(";").forEach(c => {
      const name = c.split("=")[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });

    // Xóa IndexedDB nếu có
    if (window.indexedDB && indexedDB.databases) {
      indexedDB.databases().then(dbs => {
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      });
    }

    log("Browser data cleared");
  }

  function logout() {
    // Tìm form logout (giống như script tham khảo)
    const logoutForm = document.querySelector('form[action*="/logout"]');
    if (logoutForm) {
      log("Logout form found, submitting...");
      logoutForm.submit();
      return;
    }

    // Fallback: tìm và click nút logout
    const logoutButton =
      document.querySelector('a[href*="logout"]') ||
      document.querySelector('button[onclick*="logout"]') ||
      document.querySelector(".logout");

    if (logoutButton) {
      logoutButton.click();
      log("Logout button clicked");
    } else {
      // Nếu không tìm thấy, chuyển thẳng đến URL logout
      log("No logout form/button found, redirecting to logout URL");
      window.location.href = "https://dash.ateex.cloud/logout";
    }
  }

  // ============= TÍCH HỢP RECAPTCHA SOLVER =============
  var solved = false;
  var checkBoxClicked = false;
  var waitingForAudioResponse = false;
  var captchaInterval = null;

  // Node Selectors cho reCAPTCHA
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

  var requestCount = 0;
  var recaptchaLanguage = "en-US";
  var audioUrl = "";
  var recaptchaInitialStatus = "";
  var serversList = [
    "https://engageub.pythonanywhere.com",
    "https://engageub1.pythonanywhere.com",
  ];
  var latencyList = Array(serversList.length).fill(10000);

  // Helper function
  function qSelector(selector) {
    return document.querySelector(selector);
  }

  // Khởi tạo language và status an toàn
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

  function isHidden(el) {
    return el.offsetParent === null;
  }

  async function getTextFromAudio(URL) {
    var minLatency = 100000;
    var url = "";

    // Selecting the last/latest server by default if latencies are equal
    for (let k = 0; k < latencyList.length; k++) {
      if (latencyList[k] <= minLatency) {
        minLatency = latencyList[k];
        url = serversList[k];
      }
    }

    requestCount = requestCount + 1;
    URL = URL.replace("recaptcha.net", "google.com");

    if (recaptchaLanguage.length < 1) {
      log("Recaptcha Language is not recognized");
      recaptchaLanguage = "en-US";
    }

    log("Solving reCAPTCHA with audio... Language: " + recaptchaLanguage);

    GM_xmlhttpRequest({
      method: "POST",
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "input=" + encodeURIComponent(URL) + "&lang=" + recaptchaLanguage,
      timeout: 60000,
      onload: function (response) {
        log("Response:: " + response.responseText);
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
              log("reCAPTCHA solved successfully!");
            } else {
              log("Could not locate text input box");
            }
            waitingForAudioResponse = false;
          }
        } catch (err) {
          log("Exception handling response. Retrying..: " + err.message);
          waitingForAudioResponse = false;
        }
      },
      onerror: function (e) {
        log("reCAPTCHA solver error: " + e);
        waitingForAudioResponse = false;
      },
      ontimeout: function () {
        log("Response Timed out. Retrying..");
        waitingForAudioResponse = false;
      },
    });
  }

  async function pingTest(url) {
    var start = new Date().getTime();
    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "",
      timeout: 8000,
      onload: function (response) {
        if (response && response.responseText && response.responseText == "0") {
          var end = new Date().getTime();
          var milliseconds = end - start;
          // For large values use Hashmap
          for (let i = 0; i < serversList.length; i++) {
            if (url == serversList[i]) {
              latencyList[i] = milliseconds;
            }
          }
        }
      },
      onerror: function (e) {
        log("Ping test error: " + e);
      },
      ontimeout: function () {
        log("Ping Test Response Timed out for " + url);
      },
    });
  }

  function initCaptchaSolver() {
    // Kiểm tra nếu captcha đã được giải
    if (window.ateexGlobalState.captchaSolved) {
      log("reCAPTCHA already solved, skipping solver initialization");
      return;
    }

    // Kiểm tra nếu solver đang chạy
    if (window.ateexGlobalState.captchaInProgress && captchaInterval) {
      log("reCAPTCHA solver already in progress, skipping");
      return;
    }

    // Khởi tạo variables an toàn
    initRecaptchaVars();

    // Mark as in progress
    window.ateexGlobalState.captchaInProgress = true;

    // Xử lý iframe reCAPTCHA theo script gốc
    if (qSelector(CHECK_BOX)) {
      qSelector(CHECK_BOX).click();
    } else if (window.location.href.includes("bframe")) {
      for (let i = 0; i < serversList.length; i++) {
        pingTest(serversList[i]);
      }
    }

    // Clear interval cũ nếu có
    if (captchaInterval) {
      clearInterval(captchaInterval);
    }

    // Solve the captcha using audio - theo script gốc
    captchaInterval = setInterval(function () {
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
          log("reCAPTCHA SOLVED successfully!");
          clearInterval(captchaInterval);

          // Update global state
          window.ateexGlobalState.captchaSolved = true;
          window.ateexGlobalState.captchaInProgress = false;
          window.ateexGlobalState.lastSolvedTime = Date.now();

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

          // Trigger custom event để notify login page
          window.dispatchEvent(
            new CustomEvent("recaptchaSolved", {
              detail: { solved: true },
            })
          );
        }

        if (requestCount > MAX_ATTEMPTS) {
          log("Attempted Max Retries. Stopping the solver");
          solved = true;
          window.ateexGlobalState.captchaInProgress = false;
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
          log("Automated Queries Detected");
          window.ateexGlobalState.captchaInProgress = false;
          clearInterval(captchaInterval);
        }
      } catch (err) {
        log(
          "An error occurred while solving. Stopping the solver: " + err.message
        );
        window.ateexGlobalState.captchaInProgress = false;
        clearInterval(captchaInterval);
      }
    }, 5000); // Giữ nguyên 5 giây như script gốc
  }
  // ============= KẾT THÚC RECAPTCHA SOLVER =============

  // Xử lý trang /earn
  async function handleEarnPage() {
    log("On earn page");

    try {
      // Đợi 5 giây
      log("Waiting 5 seconds before clicking Clickcoin Start button...");
      await sleep(5000);

      // Tìm hàng Clickcoin chính xác theo HTML structure
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
        // Tìm link Start trong hàng Clickcoin
        const startLink = clickcoinRow.querySelector(
          'a[href*="/earn/clickcoin"]'
        );
        if (startLink) {
          log("Found Clickcoin Start link, clicking...");

          // Đảm bảo link mở trong tab mới
          startLink.setAttribute("target", "_blank");
          startLink.setAttribute("rel", "noopener noreferrer");

          // Click link
          startLink.click();
          log("Clickcoin Start link clicked");

          // Đợi 7 giây cho popup ads load và hoàn thành
          log("Waiting 7 seconds for popup ads to load and complete...");
          await sleep(7000);

          // Increment cycle counter
          incrementCycle();

          // Thực hiện logout
          log("Performing logout...");
          logout();

          // Đợi logout hoàn tất trước khi xóa dữ liệu
          await sleep(2000);

          // Xóa dữ liệu browser
          clearBrowserData();
        } else {
          log("Clickcoin Start link not found");
          // Fallback: tìm button trong row
          const startButton = clickcoinRow.querySelector("button");
          if (startButton) {
            log("Found Clickcoin Start button, clicking...");
            startButton.click();
            log("Waiting 7 seconds for popup ads to load and complete...");
            await sleep(7000); // Đợi 7 giây cho popup và ads
            incrementCycle();
            logout();
            await sleep(2000);
            clearBrowserData();
          } else {
            log("No Start button found in Clickcoin row");
          }
        }
      } else {
        log("Clickcoin row not found");
        // Debug: log all rows
        const allRows = document.querySelectorAll("tr");
        log(`Found ${allRows.length} rows in table`);
        allRows.forEach((row, index) => {
          const firstTd = row.querySelector("td");
          if (firstTd) {
            log(`Row ${index}: ${firstTd.textContent.trim()}`);
          }
        });
      }
    } catch (error) {
      log("Error in handleEarnPage: " + error.message);
    }
  }

  // Xử lý trang login
  async function handleLoginPage() {
    log("On login page");

    try {
      // Listen for messages from iframe
      window.addEventListener("message", function (event) {
        if (event.data && event.data.type === "ateex_captcha_solved") {
          log("Received captcha solved message from iframe");
          window.ateexGlobalState.captchaSolved = true;
          window.ateexGlobalState.captchaInProgress = false;
          window.ateexGlobalState.lastSolvedTime = event.data.timestamp;
          solved = true;
        }
      });

      // Đợi 5-10 giây như yêu cầu
      const waitTime = Math.random() * 5000 + 5000; // 5-10 giây
      log(
        `Waiting ${Math.round(waitTime / 1000)} seconds before auto-filling...`
      );
      await sleep(waitTime);

      // Điền email/username
      const emailInput = qSelector('input[name="email"]');
      if (emailInput) {
        emailInput.value = CONFIG.email;
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        log("Email filled");
      } else {
        log("Email input not found");
      }

      // Điền password
      const passwordInput = qSelector('input[name="password"]');
      if (passwordInput) {
        passwordInput.value = CONFIG.password;
        passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
        log("Password filled");
      } else {
        log("Password input not found");
      }

      // Kiểm tra nếu captcha đã được giải trong iframe
      if (window.ateexGlobalState.captchaSolved) {
        log("reCAPTCHA already solved in iframe, proceeding with login");
        solved = true;
      } else {
        // Khởi tạo captcha solver sau khi điền thông tin
        const recaptchaElement =
          qSelector(".g-recaptcha") || qSelector("#recaptcha-element");
        if (recaptchaElement) {
          log("Found reCAPTCHA element, waiting for iframe to solve...");
          window.ateexGlobalState.captchaInProgress = true;

          // Đợi reCAPTCHA được giải (tăng lên 60 giây)
          let captchaWaitTime = 0;
          const maxCaptchaWait = 60000;

          log("Waiting for reCAPTCHA to be solved...");
          while (
            !solved &&
            !window.ateexGlobalState.captchaSolved &&
            captchaWaitTime < maxCaptchaWait
          ) {
            await sleep(1000);
            captchaWaitTime += 1000;

            // Kiểm tra global state
            if (window.ateexGlobalState.captchaSolved) {
              solved = true;
              log("reCAPTCHA solved by iframe!");
              break;
            }

            // Log progress every 10 seconds
            if (captchaWaitTime % 10000 === 0) {
              log(
                `Still waiting for reCAPTCHA... ${
                  captchaWaitTime / 1000
                }s elapsed`
              );
            }
          }

          if (solved || window.ateexGlobalState.captchaSolved) {
            log("reCAPTCHA solved successfully, proceeding with login");
            // Đợi thêm 2 giây trước khi submit
            await sleep(2000);
          } else {
            log(
              "reCAPTCHA not solved within timeout period, attempting login anyway"
            );
          }
        } else {
          log("No reCAPTCHA found, proceeding with login");
        }
      }

      // Submit form
      const loginForm = qSelector('form[action*="login"]');
      if (loginForm) {
        log("Submitting login form");
        loginForm.submit();
      } else {
        const signInButton = qSelector('button[type="submit"]');
        if (signInButton) {
          log("Clicking sign in button");
          signInButton.click();
        } else {
          log("No login form or submit button found");
        }
      }
    } catch (error) {
      log("Error in handleLoginPage: " + error.message);
    }
  }

  // Xử lý trang home
  async function handleHomePage() {
    log("On home page");

    try {
      // Đợi 2-4 giây như yêu cầu
      const waitTime = Math.random() * 2000 + 2000; // 2-4 giây
      log(
        `Waiting ${Math.round(
          waitTime / 1000
        )} seconds before redirecting to earn page...`
      );
      await sleep(waitTime);

      // Chuyển đến trang earn
      log("Redirecting to earn page");
      window.location.href = "https://dash.ateex.cloud/earn";
    } catch (error) {
      log("Error in handleHomePage: " + error.message);
    }
  }

  // Hàm chính
  function main() {
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;

    log(`Current path: ${currentPath}`);
    log(`Current URL: ${currentUrl}`);

    // Xử lý reCAPTCHA iframe riêng biệt - KHÔNG tạo UI
    if (currentUrl.includes("recaptcha")) {
      log("Detected reCAPTCHA iframe, initializing solver");
      initCaptchaSolver();
      return; // Chỉ xử lý captcha, không làm gì khác
    }

    // Chỉ tạo counter UI cho main pages (không phải iframe)
    if (window.top === window.self) {
      loadSavedStats();
      createCounterUI();

      // Update counter mỗi 5 giây
      setInterval(updateCounter, 5000);
    }

    // Xử lý popup ads pages (tự động đóng)
    if (
      currentUrl.includes("clickcoin") ||
      currentUrl.includes("ads") ||
      currentUrl.includes("popup") ||
      currentPath.includes("/earn/clickcoin")
    ) {
      log("Detected ads/popup page, will auto-close");
      setTimeout(() => {
        log("Auto-closing ads page");
        window.close();
      }, Math.random() * 5000 + 8000); // 8-13 giây
      return;
    }

    // Xử lý các trang chính
    if (currentPath.includes("/earn")) {
      handleEarnPage();
    } else if (currentPath.includes("/login")) {
      handleLoginPage();
    } else if (currentPath.includes("/logout")) {
      // Xử lý trang logout - xóa dữ liệu và chuyển đến login
      log("On logout page, clearing data and redirecting to login");
      clearBrowserData();
      setTimeout(() => {
        window.location.href = "https://dash.ateex.cloud/login";
      }, 1000);
    } else if (currentPath.includes("/home") || currentPath === "/") {
      handleHomePage();
    } else {
      log("Unknown page, no action taken");
    }
  }

  // Cleanup function
  function cleanup() {
    if (captchaInterval) {
      clearInterval(captchaInterval);
    }

    // Remove counter UI
    const counter = document.getElementById("ateex-counter");
    if (counter) {
      counter.remove();
    }

    window.ateexAutoRunning = false;
    window.ateexCounterCreated = false;
  }

  // Cleanup khi trang unload
  window.addEventListener("beforeunload", cleanup);

  // Chạy script sau khi trang load xong
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
