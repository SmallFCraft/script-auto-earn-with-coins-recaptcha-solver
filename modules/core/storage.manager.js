/**
 * Storage Manager - Storage abstraction and utilities
 * Provides unified interface for localStorage, sessionStorage, and memory storage
 */

(function (exports) {
  "use strict";

  // Get constants
  const constants = AteexModules.constants;
  const { STORAGE_CONFIG } = constants;

  // ============= STORAGE BACKENDS =============

  // LocalStorage backend
  const localStorageBackend = {
    get: key => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn("localStorage get failed:", e.message);
        return null;
      }
    },

    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn("localStorage set failed:", e.message);
        return false;
      }
    },

    remove: key => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        console.warn("localStorage remove failed:", e.message);
        return false;
      }
    },

    clear: () => {
      try {
        localStorage.clear();
        return true;
      } catch (e) {
        console.warn("localStorage clear failed:", e.message);
        return false;
      }
    },

    keys: () => {
      try {
        return Object.keys(localStorage);
      } catch (e) {
        console.warn("localStorage keys failed:", e.message);
        return [];
      }
    },
  };

  // SessionStorage backend
  const sessionStorageBackend = {
    get: key => {
      try {
        return sessionStorage.getItem(key);
      } catch (e) {
        console.warn("sessionStorage get failed:", e.message);
        return null;
      }
    },

    set: (key, value) => {
      try {
        sessionStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn("sessionStorage set failed:", e.message);
        return false;
      }
    },

    remove: key => {
      try {
        sessionStorage.removeItem(key);
        return true;
      } catch (e) {
        console.warn("sessionStorage remove failed:", e.message);
        return false;
      }
    },

    clear: () => {
      try {
        sessionStorage.clear();
        return true;
      } catch (e) {
        console.warn("sessionStorage clear failed:", e.message);
        return false;
      }
    },

    keys: () => {
      try {
        return Object.keys(sessionStorage);
      } catch (e) {
        console.warn("sessionStorage keys failed:", e.message);
        return [];
      }
    },
  };

  // Memory storage backend (fallback)
  const memoryStorage = new Map();
  const memoryStorageBackend = {
    get: key => memoryStorage.get(key) || null,
    set: (key, value) => {
      memoryStorage.set(key, value);
      return true;
    },
    remove: key => memoryStorage.delete(key),
    clear: () => {
      memoryStorage.clear();
      return true;
    },
    keys: () => Array.from(memoryStorage.keys()),
  };

  // ============= STORAGE MANAGER CLASS =============

  class StorageManager {
    constructor(backend = "localStorage") {
      this.setBackend(backend);
    }

    setBackend(backend) {
      switch (backend) {
        case "localStorage":
          this.backend = localStorageBackend;
          this.backendName = "localStorage";
          break;
        case "sessionStorage":
          this.backend = sessionStorageBackend;
          this.backendName = "sessionStorage";
          break;
        case "memory":
          this.backend = memoryStorageBackend;
          this.backendName = "memory";
          break;
        default:
          // Try localStorage first, fallback to memory
          if (this.isStorageAvailable("localStorage")) {
            this.backend = localStorageBackend;
            this.backendName = "localStorage";
          } else {
            this.backend = memoryStorageBackend;
            this.backendName = "memory";
            console.warn("localStorage not available, using memory storage");
          }
      }
    }

    isStorageAvailable(type) {
      try {
        const storage = window[type];
        const test = "__storage_test__";
        storage.setItem(test, test);
        storage.removeItem(test);
        return true;
      } catch (e) {
        return false;
      }
    }

    // ============= BASIC OPERATIONS =============

    get(key, defaultValue = null) {
      try {
        const value = this.backend.get(key);
        return value !== null ? value : defaultValue;
      } catch (e) {
        console.warn(`Storage get failed for key '${key}':`, e.message);
        return defaultValue;
      }
    }

    set(key, value) {
      try {
        const stringValue =
          typeof value === "string" ? value : JSON.stringify(value);
        return this.backend.set(key, stringValue);
      } catch (e) {
        console.warn(`Storage set failed for key '${key}':`, e.message);
        return false;
      }
    }

    remove(key) {
      try {
        return this.backend.remove(key);
      } catch (e) {
        console.warn(`Storage remove failed for key '${key}':`, e.message);
        return false;
      }
    }

    clear() {
      try {
        return this.backend.clear();
      } catch (e) {
        console.warn("Storage clear failed:", e.message);
        return false;
      }
    }

    keys() {
      try {
        return this.backend.keys();
      } catch (e) {
        console.warn("Storage keys failed:", e.message);
        return [];
      }
    }

    // ============= JSON OPERATIONS =============

    getJSON(key, defaultValue = null) {
      try {
        const value = this.get(key);
        if (value === null) return defaultValue;

        return JSON.parse(value);
      } catch (e) {
        console.warn(`JSON parse failed for key '${key}':`, e.message);
        return defaultValue;
      }
    }

    setJSON(key, value) {
      try {
        const jsonString = JSON.stringify(value);
        return this.set(key, jsonString);
      } catch (e) {
        console.warn(`JSON stringify failed for key '${key}':`, e.message);
        return false;
      }
    }

    // ============= PREFIXED OPERATIONS =============

    getWithPrefix(prefix, key, defaultValue = null) {
      return this.get(`${prefix}${key}`, defaultValue);
    }

    setWithPrefix(prefix, key, value) {
      return this.set(`${prefix}${key}`, value);
    }

    removeWithPrefix(prefix, key) {
      return this.remove(`${prefix}${key}`);
    }

    getJSONWithPrefix(prefix, key, defaultValue = null) {
      return this.getJSON(`${prefix}${key}`, defaultValue);
    }

    setJSONWithPrefix(prefix, key, value) {
      return this.setJSON(`${prefix}${key}`, value);
    }

    // ============= EXPIRING STORAGE =============

    setWithExpiry(key, value, expiryMs) {
      const expiryTime = Date.now() + expiryMs;
      const data = {
        value: value,
        expiry: expiryTime,
      };
      return this.setJSON(key, data);
    }

    getWithExpiry(key, defaultValue = null) {
      try {
        const data = this.getJSON(key);
        if (
          !data ||
          typeof data !== "object" ||
          !data.hasOwnProperty("expiry")
        ) {
          return defaultValue;
        }

        if (Date.now() > data.expiry) {
          this.remove(key);
          return defaultValue;
        }

        return data.value !== undefined ? data.value : defaultValue;
      } catch (e) {
        console.warn(
          `Expiring storage get failed for key '${key}':`,
          e.message
        );
        return defaultValue;
      }
    }

    // ============= CACHE OPERATIONS =============

    setCache(key, value, expiryMs = STORAGE_CONFIG.EXPIRY.MODULE_CACHE) {
      return this.setWithExpiry(
        `${STORAGE_CONFIG.PREFIXES.MODULE_CACHE}${key}`,
        value,
        expiryMs
      );
    }

    getCache(key, defaultValue = null) {
      return this.getWithExpiry(
        `${STORAGE_CONFIG.PREFIXES.MODULE_CACHE}${key}`,
        defaultValue
      );
    }

    removeCache(key) {
      return this.remove(`${STORAGE_CONFIG.PREFIXES.MODULE_CACHE}${key}`);
    }

    clearCache() {
      const prefix = STORAGE_CONFIG.PREFIXES.MODULE_CACHE;
      const keys = this.keys().filter(key => key.startsWith(prefix));
      keys.forEach(key => this.remove(key));
      return true;
    }

    // ============= BULK OPERATIONS =============

    getMultiple(keys, defaultValue = null) {
      const result = {};
      keys.forEach(key => {
        result[key] = this.get(key, defaultValue);
      });
      return result;
    }

    setMultiple(data) {
      let success = true;
      Object.entries(data).forEach(([key, value]) => {
        if (!this.set(key, value)) {
          success = false;
        }
      });
      return success;
    }

    removeMultiple(keys) {
      let success = true;
      keys.forEach(key => {
        if (!this.remove(key)) {
          success = false;
        }
      });
      return success;
    }

    // ============= PATTERN OPERATIONS =============

    findByPattern(pattern) {
      const regex = new RegExp(pattern);
      return this.keys().filter(key => regex.test(key));
    }

    removeByPattern(pattern) {
      const keys = this.findByPattern(pattern);
      return this.removeMultiple(keys);
    }

    // ============= ATEEX-SPECIFIC OPERATIONS =============

    // Secure data operations
    getSecureData(key, defaultValue = null) {
      return this.getWithPrefix(
        STORAGE_CONFIG.PREFIXES.SECURE_DATA,
        key,
        defaultValue
      );
    }

    setSecureData(key, value) {
      return this.setWithPrefix(
        STORAGE_CONFIG.PREFIXES.SECURE_DATA,
        key,
        value
      );
    }

    removeSecureData(key) {
      return this.removeWithPrefix(STORAGE_CONFIG.PREFIXES.SECURE_DATA, key);
    }

    // Stats operations
    getStats(key, defaultValue = null) {
      return this.getJSONWithPrefix(
        STORAGE_CONFIG.PREFIXES.STATS,
        key,
        defaultValue
      );
    }

    setStats(key, value) {
      return this.setJSONWithPrefix(STORAGE_CONFIG.PREFIXES.STATS, key, value);
    }

    removeStats(key) {
      return this.removeWithPrefix(STORAGE_CONFIG.PREFIXES.STATS, key);
    }

    // Settings operations
    getSettings(key, defaultValue = null) {
      return this.getJSONWithPrefix(
        STORAGE_CONFIG.PREFIXES.SETTINGS,
        key,
        defaultValue
      );
    }

    setSettings(key, value) {
      return this.setJSONWithPrefix(
        STORAGE_CONFIG.PREFIXES.SETTINGS,
        key,
        value
      );
    }

    removeSettings(key) {
      return this.removeWithPrefix(STORAGE_CONFIG.PREFIXES.SETTINGS, key);
    }

    // ============= MAINTENANCE OPERATIONS =============

    getStorageInfo() {
      const keys = this.keys();
      let totalSize = 0;

      keys.forEach(key => {
        const value = this.get(key, "");
        totalSize += key.length + value.length;
      });

      return {
        backend: this.backendName,
        keyCount: keys.length,
        totalSize: totalSize,
        estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      };
    }

    cleanupExpired() {
      const keys = this.keys();
      let cleaned = 0;

      keys.forEach(key => {
        try {
          const data = this.getJSON(key);
          if (
            data &&
            typeof data === "object" &&
            data.hasOwnProperty("expiry")
          ) {
            if (Date.now() > data.expiry) {
              this.remove(key);
              cleaned++;
            }
          }
        } catch (e) {
          // Ignore JSON parse errors for non-expiring data
        }
      });

      return cleaned;
    }

    clearAteexData() {
      const prefixes = Object.values(STORAGE_CONFIG.PREFIXES);
      let cleared = 0;

      prefixes.forEach(prefix => {
        const keys = this.keys().filter(key => key.startsWith(prefix));
        keys.forEach(key => {
          if (this.remove(key)) {
            cleared++;
          }
        });
      });

      return cleared;
    }
  }

  // ============= SINGLETON INSTANCES =============

  // Default storage manager using localStorage
  const defaultStorage = new StorageManager("localStorage");

  // Session storage manager
  const sessionStorage = new StorageManager("sessionStorage");

  // Memory storage manager (for sensitive data)
  const memoryStorage = new StorageManager("memory");

  // ============= EXPORTS =============

  exports.StorageManager = StorageManager;
  exports.storage = defaultStorage;
  exports.sessionStorage = sessionStorage;
  exports.memoryStorage = memoryStorage;

  // Convenience functions using default storage
  exports.get = (key, defaultValue) => defaultStorage.get(key, defaultValue);
  exports.set = (key, value) => defaultStorage.set(key, value);
  exports.remove = key => defaultStorage.remove(key);
  exports.getJSON = (key, defaultValue) =>
    defaultStorage.getJSON(key, defaultValue);
  exports.setJSON = (key, value) => defaultStorage.setJSON(key, value);
  exports.setCache = (key, value, expiry) =>
    defaultStorage.setCache(key, value, expiry);
  exports.getCache = (key, defaultValue) =>
    defaultStorage.getCache(key, defaultValue);
  exports.clearCache = () => defaultStorage.clearCache();
})(exports);
