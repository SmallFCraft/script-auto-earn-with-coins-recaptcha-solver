/**
 * Encryption Utils Module - Advanced encryption and security functions
 * Provides AES-GCM encryption, input validation, and secure storage utilities
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const errorManager = AteexModules.errorManager;

  const { SECURITY_CONFIG, STORAGE_CONFIG, MESSAGE_TYPES } = constants;

  // ============= CRYPTO UTILITIES =============

  // Check crypto API availability
  function isCryptoAvailable() {
    return (
      typeof crypto !== "undefined" &&
      crypto.subtle &&
      typeof crypto.getRandomValues === "function"
    );
  }

  // Generate encryption key from password using PBKDF2
  async function deriveKey(
    password,
    salt,
    iterations = SECURITY_CONFIG.ENCRYPTION.ITERATIONS
  ) {
    if (!isCryptoAvailable()) {
      throw new Error("Web Crypto API not available");
    }

    try {
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(password);

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      return crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: iterations,
          hash: "SHA-256",
        },
        keyMaterial,
        {
          name: SECURITY_CONFIG.ENCRYPTION.ALGORITHM,
          length: SECURITY_CONFIG.ENCRYPTION.KEY_LENGTH,
        },
        false,
        ["encrypt", "decrypt"]
      );
    } catch (error) {
      errorManager.handleError(error, {
        context: "key_derivation",
        category: "security",
        severity: "high",
      });
      throw error;
    }
  }

  // Generate cryptographically secure random bytes
  function generateRandomBytes(length) {
    if (!isCryptoAvailable()) {
      throw new Error("Web Crypto API not available for random generation");
    }

    return crypto.getRandomValues(new Uint8Array(length));
  }

  // Encrypt data using AES-GCM
  async function encryptData(data, password = null) {
    if (!isCryptoAvailable()) {
      errorManager.logError("Encryption", "Web Crypto API not available");
      return null;
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));

      // Generate random salt and IV
      const salt = generateRandomBytes(SECURITY_CONFIG.ENCRYPTION.SALT_LENGTH);
      const iv = generateRandomBytes(SECURITY_CONFIG.ENCRYPTION.IV_LENGTH);

      // Use provided password or generate from domain
      const encryptionPassword = password || generateDomainKey();

      // Derive key
      const key = await deriveKey(encryptionPassword, salt);

      // Encrypt data
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: SECURITY_CONFIG.ENCRYPTION.ALGORITHM, iv: iv },
        key,
        dataBuffer
      );

      // Combine salt + iv + encrypted data + version marker
      const version = new Uint8Array([1]); // Version for future compatibility
      const result = new Uint8Array(
        version.length + salt.length + iv.length + encryptedBuffer.byteLength
      );

      let offset = 0;
      result.set(version, offset);
      offset += version.length;
      result.set(salt, offset);
      offset += salt.length;
      result.set(iv, offset);
      offset += iv.length;
      result.set(new Uint8Array(encryptedBuffer), offset);

      // Convert to base64 for storage
      return btoa(String.fromCharCode.apply(null, result));
    } catch (error) {
      errorManager.handleError(error, {
        context: "data_encryption",
        category: "security",
        severity: "high",
      });
      return null;
    }
  }

  // Decrypt data using AES-GCM
  async function decryptData(encryptedData, password = null) {
    if (!isCryptoAvailable()) {
      errorManager.logError("Decryption", "Web Crypto API not available");
      return null;
    }

    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData)
          .split("")
          .map(char => char.charCodeAt(0))
      );

      // Check version (for future compatibility)
      const version = combined[0];
      if (version !== 1) {
        throw new Error(`Unsupported encryption version: ${version}`);
      }

      // Extract salt, iv, and encrypted data
      let offset = 1; // Skip version byte
      const salt = combined.slice(
        offset,
        offset + SECURITY_CONFIG.ENCRYPTION.SALT_LENGTH
      );
      offset += SECURITY_CONFIG.ENCRYPTION.SALT_LENGTH;
      const iv = combined.slice(
        offset,
        offset + SECURITY_CONFIG.ENCRYPTION.IV_LENGTH
      );
      offset += SECURITY_CONFIG.ENCRYPTION.IV_LENGTH;
      const encrypted = combined.slice(offset);

      // Use provided password or generate from domain
      const decryptionPassword = password || generateDomainKey();

      // Derive key
      const key = await deriveKey(decryptionPassword, salt);

      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: SECURITY_CONFIG.ENCRYPTION.ALGORITHM, iv: iv },
        key,
        encrypted
      );

      // Convert back to string and parse JSON
      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decryptedBuffer);
      return JSON.parse(decryptedString);
    } catch (error) {
      errorManager.handleError(error, {
        context: "data_decryption",
        category: "security",
        severity: "medium",
      });
      return null;
    }
  }

  // Generate domain-specific encryption key
  function generateDomainKey() {
    const domain = window.location.hostname;
    const userAgent = navigator.userAgent;
    const timestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Daily rotation
    return `ateex_${domain}_${btoa(userAgent).slice(0, 16)}_${timestamp}`;
  }

  // ============= INPUT SANITIZATION =============

  // Sanitize HTML to prevent XSS
  function sanitizeHTML(html) {
    if (typeof html !== "string") return "";

    const temp = document.createElement("div");
    temp.textContent = html;
    return temp.innerHTML;
  }

  // Sanitize user input with configurable limits
  function sanitizeInput(
    input,
    maxLength = SECURITY_CONFIG.VALIDATION.INPUT_MAX_LENGTH
  ) {
    if (typeof input !== "string") return input;

    return input
      .trim()
      .replace(/[<>'"]/g, "") // Remove potential HTML/XSS chars
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+=/gi, "") // Remove event handlers
      .replace(/data:/gi, "") // Remove data: protocol
      .slice(0, maxLength); // Limit length
  }

  // Advanced XSS prevention
  function preventXSS(input) {
    if (typeof input !== "string") return input;

    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
    ];

    let sanitized = input;
    xssPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, "");
    });

    return sanitized;
  }

  // ============= INPUT VALIDATION =============

  // Validate email format with enhanced security checks
  function validateEmail(email) {
    if (!email || typeof email !== "string") return false;

    const sanitized = sanitizeInput(
      email,
      SECURITY_CONFIG.VALIDATION.EMAIL_MAX_LENGTH
    );
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    const isValid =
      emailRegex.test(sanitized) &&
      sanitized.length <= SECURITY_CONFIG.VALIDATION.EMAIL_MAX_LENGTH &&
      !sanitized.includes("..") && // No consecutive dots
      !sanitized.startsWith(".") && // No leading dot
      !sanitized.endsWith(".") && // No trailing dot
      !sanitized.includes("@.") && // No dot after @
      !sanitized.includes(".@"); // No dot before @

    if (!isValid) {
      errorManager.logWarning("Validation", "Invalid email format", {
        email: sanitized,
      });
    }

    return isValid;
  }

  // Validate username with security constraints
  function validateUsername(username) {
    if (!username || typeof username !== "string") return false;

    const sanitized = sanitizeInput(
      username,
      SECURITY_CONFIG.VALIDATION.USERNAME_MAX_LENGTH
    );
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;

    const isValid =
      usernameRegex.test(sanitized) &&
      sanitized.length >= SECURITY_CONFIG.VALIDATION.USERNAME_MIN_LENGTH &&
      sanitized.length <= SECURITY_CONFIG.VALIDATION.USERNAME_MAX_LENGTH &&
      !sanitized.includes("--") && // No consecutive dashes
      !sanitized.includes("__") && // No consecutive underscores
      !sanitized.startsWith("-") && // No leading dash
      !sanitized.startsWith("_") && // No leading underscore
      !sanitized.endsWith("-") && // No trailing dash
      !sanitized.endsWith("_"); // No trailing underscore

    if (!isValid) {
      errorManager.logWarning("Validation", "Invalid username format", {
        username: sanitized,
      });
    }

    return isValid;
  }

  // Validate password strength
  function validatePassword(password) {
    if (!password || typeof password !== "string") return false;

    const isValid =
      password.length >= SECURITY_CONFIG.VALIDATION.PASSWORD_MIN_LENGTH &&
      password.length <= SECURITY_CONFIG.VALIDATION.PASSWORD_MAX_LENGTH &&
      !/^\s+|\s+$/.test(password); // No leading/trailing whitespace

    if (!isValid) {
      errorManager.logWarning("Validation", "Invalid password format");
    }

    return isValid;
  }

  // Enhanced password strength checker
  function checkPasswordStrength(password) {
    if (!validatePassword(password)) {
      return {
        strength: "invalid",
        score: 0,
        suggestions: ["Password does not meet basic requirements"],
      };
    }

    let score = 0;
    const suggestions = [];

    // Length bonus
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    else suggestions.push("Add lowercase letters");

    if (/[A-Z]/.test(password)) score += 1;
    else suggestions.push("Add uppercase letters");

    if (/[0-9]/.test(password)) score += 1;
    else suggestions.push("Add numbers");

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else suggestions.push("Add special characters");

    // Determine strength
    let strength;
    if (score < 3) strength = "weak";
    else if (score < 5) strength = "medium";
    else if (score < 7) strength = "strong";
    else strength = "very-strong";

    return { strength, score, suggestions };
  }

  // ============= SECURE RANDOM GENERATION =============

  // Generate cryptographically secure random string
  function generateSecureRandom(length = 32, charset = null) {
    if (!isCryptoAvailable()) {
      // Fallback to Math.random (less secure)
      errorManager.logWarning(
        "Security",
        "Using Math.random fallback for random generation"
      );
      const chars =
        charset ||
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    const chars =
      charset ||
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const array = generateRandomBytes(length);

    return Array.from(array, byte => chars[byte % chars.length]).join("");
  }

  // Generate secure session token
  function generateSessionToken() {
    return generateSecureRandom(64);
  }

  // Generate secure ID
  function generateSecureId() {
    const timestamp = Date.now().toString(36);
    const random = generateSecureRandom(16);
    return `${timestamp}_${random}`;
  }

  // ============= MESSAGE VALIDATION =============

  // Validate postMessage origin
  function validateMessageOrigin(event, allowedOrigins = []) {
    if (!event || !event.origin) return false;

    const allowed = [...SECURITY_CONFIG.ALLOWED_ORIGINS, ...allowedOrigins];
    const isValid = allowed.some(
      origin => event.origin === origin || event.origin.endsWith(".google.com")
    );

    if (!isValid) {
      errorManager.logWarning("Security", "Message from untrusted origin", {
        origin: event.origin,
        allowed: allowed,
      });
    }

    return isValid;
  }

  // Validate and sanitize message data
  function validateMessageData(data) {
    if (!data || typeof data !== "object") return null;

    // Only allow specific message types
    const allowedTypes = Object.values(MESSAGE_TYPES);

    if (!allowedTypes.includes(data.type)) {
      errorManager.logWarning("Security", "Invalid message type", {
        type: data.type,
      });
      return null;
    }

    return {
      type: sanitizeInput(data.type),
      timestamp:
        data.timestamp && typeof data.timestamp === "number"
          ? data.timestamp
          : Date.now(),
      ...(data.solved !== undefined && { solved: Boolean(data.solved) }),
      ...(data.reason && { reason: sanitizeInput(data.reason) }),
      ...(data.error && { error: sanitizeInput(data.error) }),
      ...(data.context && { context: data.context }),
    };
  }

  // ============= RATE LIMITING =============

  const rateLimiters = new Map();

  // Implement rate limiting for actions
  function rateLimit(key, maxAttempts = 10, windowMs = 60000) {
    const now = Date.now();
    const limiter = rateLimiters.get(key) || {
      attempts: 0,
      resetTime: now + windowMs,
    };

    // Reset window if expired
    if (now >= limiter.resetTime) {
      limiter.attempts = 0;
      limiter.resetTime = now + windowMs;
    }

    limiter.attempts++;
    rateLimiters.set(key, limiter);

    if (limiter.attempts > maxAttempts) {
      const remainingTime = Math.ceil((limiter.resetTime - now) / 1000);
      errorManager.logWarning(
        "Rate Limit",
        `Rate limit exceeded for ${key}. Try again in ${remainingTime}s`
      );
      return false;
    }

    return true;
  }

  // Enhanced rate limiting with different strategies
  function advancedRateLimit(key, config = {}) {
    const {
      max = 5,
      window = 300000,
      strategy = "fixed",
    } = { ...SECURITY_CONFIG.RATE_LIMITS[key], ...config };

    const now = Date.now();
    const limiter = rateLimiters.get(key) || {
      attempts: 0,
      resetTime: now + window,
      lastAttempt: now,
    };

    if (strategy === "sliding") {
      // Sliding window rate limiting
      const timeSinceLastAttempt = now - limiter.lastAttempt;
      if (timeSinceLastAttempt > window) {
        limiter.attempts = 0;
      }
    } else {
      // Fixed window rate limiting
      if (now >= limiter.resetTime) {
        limiter.attempts = 0;
        limiter.resetTime = now + window;
      }
    }

    limiter.attempts++;
    limiter.lastAttempt = now;
    rateLimiters.set(key, limiter);

    const exceeded = limiter.attempts > max;
    if (exceeded) {
      const remainingTime = Math.ceil((limiter.resetTime - now) / 1000);
      errorManager.logWarning(
        "Rate Limit",
        `Advanced rate limit exceeded for ${key}`,
        {
          attempts: limiter.attempts,
          max: max,
          remainingTime: remainingTime,
        }
      );
    }

    return !exceeded;
  }

  // Clear rate limiter for specific key
  function clearRateLimit(key) {
    rateLimiters.delete(key);
    errorManager.logInfo("Rate Limit", `Cleared rate limiter for ${key}`);
  }

  // Get rate limit status
  function getRateLimitStatus(key) {
    const limiter = rateLimiters.get(key);
    if (!limiter) return null;

    const now = Date.now();
    return {
      attempts: limiter.attempts,
      resetTime: limiter.resetTime,
      remainingTime: Math.max(0, limiter.resetTime - now),
      isExceeded:
        limiter.attempts > (SECURITY_CONFIG.RATE_LIMITS[key]?.max || 5),
    };
  }

  // ============= SECURE STORAGE =============

  // Enhanced secure localStorage wrapper
  const secureStorage = {
    async setItem(key, value, password = null) {
      try {
        if (!rateLimit(`storage_set_${key}`, 50, 60000)) {
          return false;
        }

        const encrypted = await encryptData(value, password);
        if (encrypted) {
          const storageKey = `${STORAGE_CONFIG.PREFIXES.SECURE_DATA}${key}`;
          localStorage.setItem(storageKey, encrypted);
          errorManager.logInfo(
            "Secure Storage",
            `Stored encrypted data for key: ${key}`
          );
          return true;
        }
        return false;
      } catch (error) {
        errorManager.handleError(error, {
          context: "secure_storage_set",
          category: "storage",
          key: key,
        });
        return false;
      }
    },

    async getItem(key, password = null) {
      try {
        if (!rateLimit(`storage_get_${key}`, 100, 60000)) {
          return null;
        }

        const storageKey = `${STORAGE_CONFIG.PREFIXES.SECURE_DATA}${key}`;
        const encrypted = localStorage.getItem(storageKey);
        if (!encrypted) return null;

        const decrypted = await decryptData(encrypted, password);
        if (decrypted !== null) {
          errorManager.logInfo(
            "Secure Storage",
            `Retrieved encrypted data for key: ${key}`
          );
        }
        return decrypted;
      } catch (error) {
        errorManager.handleError(error, {
          context: "secure_storage_get",
          category: "storage",
          key: key,
        });
        return null;
      }
    },

    removeItem(key) {
      try {
        const storageKey = `${STORAGE_CONFIG.PREFIXES.SECURE_DATA}${key}`;
        localStorage.removeItem(storageKey);
        errorManager.logInfo(
          "Secure Storage",
          `Removed encrypted data for key: ${key}`
        );
        return true;
      } catch (error) {
        errorManager.handleError(error, {
          context: "secure_storage_remove",
          category: "storage",
          key: key,
        });
        return false;
      }
    },

    clear() {
      try {
        const prefix = STORAGE_CONFIG.PREFIXES.SECURE_DATA;
        let cleared = 0;

        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
            cleared++;
          }
        });

        errorManager.logInfo(
          "Secure Storage",
          `Cleared ${cleared} encrypted storage items`
        );
        return cleared;
      } catch (error) {
        errorManager.handleError(error, {
          context: "secure_storage_clear",
          category: "storage",
        });
        return 0;
      }
    },

    // Get all secure storage keys
    getKeys() {
      const prefix = STORAGE_CONFIG.PREFIXES.SECURE_DATA;
      return Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .map(key => key.substring(prefix.length));
    },
  };

  // ============= SECURITY MONITORING =============

  // Security event logger
  function logSecurityEvent(event, data = {}) {
    const securityEvent = {
      timestamp: Date.now(),
      event: event,
      data: data,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    errorManager.logWarning("Security Event", event, securityEvent);

    // Store security events for analysis
    try {
      const events = JSON.parse(
        localStorage.getItem("ateex_security_events") || "[]"
      );
      events.push(securityEvent);

      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }

      localStorage.setItem("ateex_security_events", JSON.stringify(events));
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Detect potential security threats
  function detectSecurityThreats() {
    const threats = [];

    // Check for suspicious extensions
    if (window.chrome && window.chrome.runtime) {
      threats.push("Chrome extension environment detected");
    }

    // Check for dev tools
    if (window.devtools && window.devtools.open) {
      threats.push("Developer tools detected");
    }

    // Check for automation tools
    if (window.webdriver || navigator.webdriver) {
      threats.push("Automation tool detected");
    }

    // Check for suspicious global variables
    const suspiciousGlobals = ["selenium", "webdriver", "driver", "phantom"];
    suspiciousGlobals.forEach(global => {
      if (window[global]) {
        threats.push(`Suspicious global variable detected: ${global}`);
      }
    });

    if (threats.length > 0) {
      logSecurityEvent("potential_threats_detected", { threats });
    }

    return threats;
  }

  // ============= EXPORTS =============

  // Encryption
  exports.encryptData = encryptData;
  exports.decryptData = decryptData;
  exports.generateDomainKey = generateDomainKey;
  exports.deriveKey = deriveKey;
  exports.isCryptoAvailable = isCryptoAvailable;

  // Input sanitization and validation
  exports.sanitizeHTML = sanitizeHTML;
  exports.sanitizeInput = sanitizeInput;
  exports.preventXSS = preventXSS;
  exports.validateEmail = validateEmail;
  exports.validateUsername = validateUsername;
  exports.validatePassword = validatePassword;
  exports.checkPasswordStrength = checkPasswordStrength;

  // Random generation
  exports.generateSecureRandom = generateSecureRandom;
  exports.generateSessionToken = generateSessionToken;
  exports.generateSecureId = generateSecureId;
  exports.generateRandomBytes = generateRandomBytes;

  // Message validation
  exports.validateMessageOrigin = validateMessageOrigin;
  exports.validateMessageData = validateMessageData;

  // Rate limiting
  exports.rateLimit = rateLimit;
  exports.advancedRateLimit = advancedRateLimit;
  exports.clearRateLimit = clearRateLimit;
  exports.getRateLimitStatus = getRateLimitStatus;

  // Secure storage
  exports.secureStorage = secureStorage;

  // Security monitoring
  exports.logSecurityEvent = logSecurityEvent;
  exports.detectSecurityThreats = detectSecurityThreats;
})(exports);
