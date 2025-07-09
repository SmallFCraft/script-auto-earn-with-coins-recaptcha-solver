/**
 * Constants Configuration - Centralized configuration
 * All constants, URLs, and configuration values
 */

(function (exports) {
  "use strict";

  // ============= GITHUB CONFIGURATION =============

  exports.GITHUB_CONFIG = {
    BASE_URL:
      "https://raw.githubusercontent.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/",
    FALLBACK_URLS: [
      "https://cdn.jsdelivr.net/gh/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver@main/",
      "https://gitcdn.xyz/repo/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/",
    ],
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    TIMEOUT: 30000, // 30 seconds
  };

  // ============= ATEEX CLOUD CONFIGURATION =============

  exports.ATEEX_CONFIG = {
    BASE_URL: "https://dash.ateex.cloud",
    PAGES: {
      LOGIN: "/login",
      HOME: "/dashboard",
      EARN: "/earn",
      LOGOUT: "/logout",
    },
    SELECTORS: {
      EMAIL_INPUT: 'input[name="email"], input[type="email"]',
      PASSWORD_INPUT: 'input[name="password"], input[type="password"]',
      SUBMIT_BUTTON: 'button[type="submit"], input[type="submit"]',
      RECAPTCHA: '.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]',
    },
  };

  // ============= RECAPTCHA CONFIGURATION =============

  exports.RECAPTCHA_CONFIG = {
    SERVERS: [
      "https://engageub.pythonanywhere.com",
      "https://engageub1.pythonanywhere.com",
    ],
    TIMEOUT: 60000, // 60 seconds
    MAX_RETRIES: 3,
    COOLDOWN_DURATION: 60000, // 1 minute
    RATE_LIMIT: {
      MAX_REQUESTS: 10,
      WINDOW_MS: 300000, // 5 minutes
    },
  };

  // ============= SECURITY CONFIGURATION =============

  exports.SECURITY_CONFIG = {
    ENCRYPTION: {
      ALGORITHM: "AES-GCM",
      KEY_LENGTH: 256,
      IV_LENGTH: 12,
      SALT_LENGTH: 16,
      ITERATIONS: 100000,
    },
    VALIDATION: {
      EMAIL_MAX_LENGTH: 254,
      PASSWORD_MIN_LENGTH: 6,
      PASSWORD_MAX_LENGTH: 128,
      USERNAME_MIN_LENGTH: 3,
      USERNAME_MAX_LENGTH: 20,
      INPUT_MAX_LENGTH: 1000,
    },
    RATE_LIMITS: {
      LOGIN_ATTEMPTS: { max: 5, window: 300000 }, // 5 per 5 min
      FORM_SUBMISSION: { max: 5, window: 300000 },
      HOME_PAGE_ACTION: { max: 3, window: 60000 },
      EARN_PAGE_ACTION: { max: 5, window: 60000 },
      POPUP_ACTION: { max: 10, window: 60000 },
    },
    ALLOWED_ORIGINS: [
      "https://dash.ateex.cloud",
      "https://www.google.com",
      "https://www.recaptcha.net",
    ],
  };

  // ============= STORAGE CONFIGURATION =============

  exports.STORAGE_CONFIG = {
    PREFIXES: {
      MODULE_CACHE: "ateex_module_",
      SECURE_DATA: "ateex_secure_",
      STATS: "ateex_stats_",
      SETTINGS: "ateex_settings_",
    },
    KEYS: {
      CREDENTIALS: "credentials",
      CREDENTIALS_EXPIRY: "credentials_expiry",
      AUTO_STATS_ENABLED: "auto_stats_enabled",
      STATS_HISTORY: "stats_history",
      TARGET_COINS: "target_coins",
      SERVER_LATENCY: "server_latency",
    },
    EXPIRY: {
      CREDENTIALS: 24 * 60 * 60 * 1000, // 24 hours
      MODULE_CACHE: 24 * 60 * 60 * 1000, // 24 hours
      SERVER_LATENCY: 60 * 60 * 1000, // 1 hour
    },
  };

  // ============= UI CONFIGURATION =============

  exports.UI_CONFIG = {
    COUNTER: {
      POSITION: "top-right",
      UPDATE_INTERVAL: 2000, // 2 seconds
      AUTO_HIDE_DELAY: 5000, // 5 seconds for notifications
    },
    MODAL: {
      Z_INDEX: 999999,
      BACKDROP_OPACITY: 0.8,
      ANIMATION_DURATION: 300,
    },
    COLORS: {
      PRIMARY: "#2196F3",
      SUCCESS: "#4CAF50",
      WARNING: "#FF9800",
      ERROR: "#F44336",
      INFO: "#00BCD4",
    },
    SIZES: {
      SMALL: { width: "300px", height: "auto" },
      MEDIUM: { width: "500px", height: "auto" },
      LARGE: { width: "800px", height: "600px" },
    },
  };

  // ============= DATA CONFIGURATION =============

  exports.DATA_CONFIG = {
    STATS: {
      MAX_HISTORY_ENTRIES: 20,
      UPDATE_INTERVAL: 10000, // 10 seconds
      SAVE_INTERVAL: 30000, // 30 seconds
    },
    TARGETS: {
      DEFAULT_COINS: 1000,
      MIN_COINS: 1,
      MAX_COINS: 1000000,
    },
    EXPORT: {
      FORMATS: ["json", "csv"],
      MAX_ENTRIES: 100,
    },
  };

  // ============= WORKFLOW CONFIGURATION =============

  exports.WORKFLOW_CONFIG = {
    TIMINGS: {
      PAGE_LOAD_WAIT: 2000, // 2 seconds
      ACTION_DELAY_MIN: 1000, // 1 second
      ACTION_DELAY_MAX: 3000, // 3 seconds
      NAVIGATION_WAIT: 3000, // 3 seconds
      POPUP_CLOSE_DELAY: 8000, // 8 seconds
      LOGOUT_WAIT: 2000, // 2 seconds
    },
    RETRIES: {
      MAX_ATTEMPTS: 3,
      DELAY_BETWEEN_ATTEMPTS: 2000, // 2 seconds
      EXPONENTIAL_BACKOFF: true,
    },
    MONITORING: {
      PAGE_CHECK_INTERVAL: 30000, // 30 seconds
      HEALTH_CHECK_INTERVAL: 60000, // 1 minute
      ERROR_THRESHOLD: 5, // Max errors before stopping
    },
  };

  // ============= LOGGING CONFIGURATION =============

  exports.LOGGING_CONFIG = {
    LEVELS: {
      DEBUG: 0,
      INFO: 1,
      WARNING: 2,
      ERROR: 3,
      SUCCESS: 4,
    },
    COLORS: {
      DEBUG: "#9E9E9E",
      INFO: "#2196F3",
      WARNING: "#FF9800",
      ERROR: "#F44336",
      SUCCESS: "#4CAF50",
    },
    SPAM_PREVENTION: {
      DUPLICATE_THRESHOLD: 5, // Max 5 same messages
      TIME_WINDOW: 60000, // In 1 minute
      COOLDOWN: 300000, // 5 minute cooldown
    },
    PREFIXES: {
      DEBUG: "🔍",
      INFO: "ℹ️",
      WARNING: "⚠️",
      ERROR: "❌",
      SUCCESS: "✅",
    },
  };

  // ============= ERROR CONFIGURATION =============

  exports.ERROR_CONFIG = {
    PATTERNS: {
      LOGIN_ERRORS: [
        "invalid credentials",
        "incorrect password",
        "user not found",
        "authentication failed",
        "login failed",
      ],
      NETWORK_ERRORS: [
        "network error",
        "connection failed",
        "timeout",
        "fetch failed",
        "cors error",
      ],
      CAPTCHA_ERRORS: [
        "captcha failed",
        "recaptcha error",
        "verification failed",
        "captcha timeout",
      ],
    },
    RECOVERY: {
      MAX_RETRIES: 3,
      RETRY_DELAY: 5000, // 5 seconds
      FALLBACK_ACTIONS: {
        RELOAD_PAGE: true,
        CLEAR_CACHE: true,
        RESET_STATE: true,
      },
    },
  };

  // ============= MESSAGE TYPES =============

  exports.MESSAGE_TYPES = {
    CAPTCHA_SOLVED: "ateex_captcha_solved",
    CREDENTIALS_READY: "ateex_credentials_ready",
    RELOAD_REQUIRED: "ateex_reload_required",
    ERROR_OCCURRED: "ateex_error_occurred",
    STATUS_UPDATE: "ateex_status_update",
  };

  // ============= PERFORMANCE CONFIGURATION =============

  exports.PERFORMANCE_CONFIG = {
    DEBOUNCE_DELAYS: {
      UI_UPDATE: 100, // 100ms
      STATS_SAVE: 1000, // 1 second
      ERROR_HANDLER: 500, // 500ms
    },
    THROTTLE_LIMITS: {
      DOM_QUERIES: 50, // 50ms
      EVENT_HANDLERS: 100, // 100ms
      API_CALLS: 1000, // 1 second
    },
    MEMORY: {
      MAX_LOG_ENTRIES: 1000,
      CLEANUP_INTERVAL: 300000, // 5 minutes
      GC_THRESHOLD: 10000000, // 10MB
    },
  };
})(typeof exports !== "undefined" ? exports : (window.AteexConstants = {}));
