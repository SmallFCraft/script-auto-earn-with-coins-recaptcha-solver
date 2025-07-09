/**
 * Utils Module - Core utilities and logging system
 * Part of Ateex Auto v3.0 Modular Edition
 */

// ============= LOGGING SYSTEM =============

/**
 * Spam prevention for logging
 */
const logSpamTracker = new Map();

/**
 * Enhanced logging with spam control
 */
function logWithSpamControl(message, level = "INFO", spamKey = null, cooldown = 30000) {
  if (spamKey) {
    const now = Date.now();
    const lastLog = logSpamTracker.get(spamKey);
    
    if (lastLog && (now - lastLog) < cooldown) {
      return; // Skip spam message
    }
    
    logSpamTracker.set(spamKey, now);
  }
  
  log(message, level);
}

/**
 * Specialized logging functions
 */
function logSuccess(message) {
  log(message, "SUCCESS");
}

function logError(message) {
  log(message, "ERROR");
}

function logWarning(message) {
  log(message, "WARN");
}

function logInfo(message) {
  log(message, "INFO");
}

function logDebug(message) {
  log(message, "DEBUG");
}

// ============= UTILITY FUNCTIONS =============

/**
 * Sleep function with promise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe querySelector
 */
function qSelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (e) {
    logError(`Invalid selector: ${selector} - ${e.message}`);
    return null;
  }
}

/**
 * Safe querySelectorAll
 */
function qSelectorAll(selector) {
  try {
    return document.querySelectorAll(selector);
  } catch (e) {
    logError(`Invalid selector: ${selector} - ${e.message}`);
    return [];
  }
}

/**
 * Wait for element to appear
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = qSelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = qSelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Random delay between min and max milliseconds
 */
function randomDelay(min = 1000, max = 3000) {
  const delay = Math.random() * (max - min) + min;
  return sleep(delay);
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      logWarning(`Retry ${i + 1}/${maxRetries} failed, waiting ${delay}ms: ${error.message}`);
      await sleep(delay);
    }
  }
}

/**
 * Safe JSON parse
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    logError(`JSON parse error: ${e.message}`);
    return defaultValue;
  }
}

/**
 * Safe JSON stringify
 */
function safeJsonStringify(obj, defaultValue = "{}") {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    logError(`JSON stringify error: ${e.message}`);
    return defaultValue;
  }
}

/**
 * Generate random string
 */
function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format time duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Calculate rate per hour
 */
function calculateRate(count, startTime) {
  const elapsed = Date.now() - startTime;
  const hours = elapsed / (1000 * 60 * 60);
  return hours > 0 ? Math.round(count / hours) : 0;
}

/**
 * Calculate ETA (Estimated Time of Arrival)
 */
function calculateETA(current, target, rate) {
  if (rate <= 0 || current >= target) {
    return "N/A";
  }
  
  const remaining = target - current;
  const hoursRemaining = remaining / rate;
  const msRemaining = hoursRemaining * 60 * 60 * 1000;
  
  return formatDuration(msRemaining);
}

/**
 * Check if current page matches pattern
 */
function isPageMatch(pattern) {
  const currentPath = window.location.pathname;
  const currentUrl = window.location.href;
  
  if (typeof pattern === 'string') {
    return currentPath.includes(pattern) || currentUrl.includes(pattern);
  }
  
  if (pattern instanceof RegExp) {
    return pattern.test(currentPath) || pattern.test(currentUrl);
  }
  
  return false;
}

/**
 * Detect error pages
 */
function detectErrorPage() {
  const title = document.title.toLowerCase();
  const body = document.body ? document.body.innerText.toLowerCase() : '';
  
  const errorIndicators = [
    '502 bad gateway',
    '500 internal server error',
    '419 page expired',
    'error',
    'something went wrong',
    'page not found',
    'access denied'
  ];
  
  return errorIndicators.some(indicator => 
    title.includes(indicator) || body.includes(indicator)
  );
}

/**
 * Clear browser data (cookies, localStorage, etc.)
 */
async function clearBrowserData() {
  try {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    logInfo("Browser data cleared successfully");
  } catch (error) {
    logError(`Error clearing browser data: ${error.message}`);
  }
}

/**
 * Clear Google cookies specifically
 */
async function clearGoogleCookies(reload = false) {
  try {
    // Clear Google-related cookies
    const googleDomains = ['.google.com', '.recaptcha.net', '.gstatic.com'];
    
    // Note: In Tampermonkey, we can't directly clear cookies
    // This is a placeholder for the functionality
    logInfo("Google cookies clearing requested");
    
    if (reload) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error) {
    logError(`Error clearing Google cookies: ${error.message}`);
  }
}

/**
 * Create DOM element with attributes
 */
function createElement(tag, attributes = {}, textContent = '') {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  if (textContent) {
    element.textContent = textContent;
  }
  
  return element;
}

/**
 * Add CSS styles to page
 */
function addStyles(css) {
  const style = createElement('style', { type: 'text/css' });
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

// ============= MODULE EXPORTS =============

// Export all utility functions
module.exports = {
  // Logging functions
  logWithSpamControl,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logDebug,
  logSpamTracker,
  
  // Core utilities
  sleep,
  qSelector,
  qSelectorAll,
  waitForElement,
  randomDelay,
  retryWithBackoff,
  
  // Data utilities
  safeJsonParse,
  safeJsonStringify,
  generateRandomString,
  
  // Formatting utilities
  formatDuration,
  formatNumber,
  calculateRate,
  calculateETA,
  
  // Page utilities
  isPageMatch,
  detectErrorPage,
  
  // Browser utilities
  clearBrowserData,
  clearGoogleCookies,
  
  // DOM utilities
  createElement,
  addStyles
};
