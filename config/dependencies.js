/**
 * Dependencies Configuration - Module dependency mapping
 * Defines load order and module relationships
 */

(function (exports) {
  "use strict";

  // ============= MODULE DEFINITIONS =============

  exports.MODULES = {
    // Config modules (no dependencies)
    constants: {
      url: "config/constants.js",
      dependencies: [],
      required: true,
      category: "config",
    },

    // Core utilities (minimal dependencies)
    domUtils: {
      url: "modules/core/dom.utils.js",
      dependencies: ["constants"],
      required: true,
      category: "core",
    },

    storageManager: {
      url: "modules/core/storage.manager.js",
      dependencies: ["constants"],
      required: true,
      category: "core",
    },

    errorManager: {
      url: "modules/core/error.manager.js",
      dependencies: ["constants", "storageManager"],
      required: true,
      category: "core",
    },

    coreModule: {
      url: "modules/core/core.module.js",
      dependencies: ["constants", "domUtils", "storageManager", "errorManager"],
      required: true,
      category: "core",
    },

    // Security modules
    encryptionUtils: {
      url: "modules/security/encryption.utils.js",
      dependencies: ["constants", "errorManager"],
      required: true,
      category: "security",
    },

    credentialsModule: {
      url: "modules/security/credentials.module.js",
      dependencies: [
        "constants",
        "coreModule",
        "encryptionUtils",
        "storageManager",
      ],
      required: true,
      category: "security",
    },

    // Data modules
    statsManager: {
      url: "modules/data/stats.manager.js",
      dependencies: ["constants", "coreModule", "storageManager"],
      required: true,
      category: "data",
    },

    dataModule: {
      url: "modules/data/data.module.js",
      dependencies: [
        "constants",
        "coreModule",
        "statsManager",
        "storageManager",
      ],
      required: true,
      category: "data",
    },

    // External integrations
    serverManager: {
      url: "modules/external/server.manager.js",
      dependencies: ["constants", "coreModule", "storageManager"],
      required: true,
      category: "external",
    },

    recaptchaModule: {
      url: "modules/external/recaptcha.module.js",
      dependencies: [
        "constants",
        "coreModule",
        "serverManager",
        "errorManager",
      ],
      required: true,
      category: "external",
    },

    // UI modules
    modalFactory: {
      url: "modules/ui/modal.factory.js",
      dependencies: ["constants", "domUtils"],
      required: true,
      category: "ui",
    },

    statsDisplay: {
      url: "modules/ui/stats.display.js",
      dependencies: ["constants", "domUtils", "modalFactory", "dataModule"],
      required: true,
      category: "ui",
    },

    uiModule: {
      url: "modules/ui/ui.module.js",
      dependencies: [
        "constants",
        "coreModule",
        "domUtils",
        "modalFactory",
        "statsDisplay",
        "dataModule",
      ],
      required: true,
      category: "ui",
    },

    // Page handlers
    navigationHandler: {
      url: "modules/handlers/navigation.handler.js",
      dependencies: ["constants", "coreModule", "domUtils"],
      required: true,
      category: "handlers",
    },

    loginHandler: {
      url: "modules/handlers/login.handler.js",
      dependencies: [
        "constants",
        "coreModule",
        "credentialsModule",
        "domUtils",
        "encryptionUtils",
      ],
      required: true,
      category: "handlers",
    },

    earnHandler: {
      url: "modules/handlers/earn.handler.js",
      dependencies: [
        "constants",
        "coreModule",
        "dataModule",
        "domUtils",
        "navigationHandler",
      ],
      required: true,
      category: "handlers",
    },

    // Main workflow (depends on everything)
    workflowModule: {
      url: "modules/workflow.module.js",
      dependencies: [
        "constants",
        "coreModule",
        "credentialsModule",
        "dataModule",
        "uiModule",
        "recaptchaModule",
        "loginHandler",
        "earnHandler",
        "navigationHandler",
      ],
      required: true,
      category: "workflow",
    },
  };

  // ============= DEPENDENCY VALIDATION =============

  exports.validateDependencies = function () {
    const modules = exports.MODULES;
    const errors = [];

    // Check for circular dependencies
    function checkCircular(moduleName, visited = new Set(), path = []) {
      if (visited.has(moduleName)) {
        if (path.includes(moduleName)) {
          errors.push(
            `Circular dependency detected: ${path.join(
              " -> "
            )} -> ${moduleName}`
          );
        }
        return;
      }

      visited.add(moduleName);
      path.push(moduleName);

      const module = modules[moduleName];
      if (module && module.dependencies) {
        module.dependencies.forEach(dep => {
          checkCircular(dep, visited, [...path]);
        });
      }

      path.pop();
    }

    // Check all modules for circular dependencies
    Object.keys(modules).forEach(moduleName => {
      checkCircular(moduleName);
    });

    // Check for missing dependencies
    Object.entries(modules).forEach(([moduleName, module]) => {
      module.dependencies.forEach(dep => {
        if (!modules[dep]) {
          errors.push(
            `Module '${moduleName}' depends on missing module '${dep}'`
          );
        }
      });
    });

    return errors;
  };

  // ============= LOAD ORDER CALCULATION =============

  exports.calculateLoadOrder = function () {
    const modules = exports.MODULES;
    const visited = new Set();
    const loadOrder = [];

    function visit(moduleName) {
      if (visited.has(moduleName)) {
        return;
      }

      const module = modules[moduleName];
      if (!module) {
        throw new Error(`Module not found: ${moduleName}`);
      }

      // Visit dependencies first
      module.dependencies.forEach(dep => {
        visit(dep);
      });

      visited.add(moduleName);
      loadOrder.push(moduleName);
    }

    // Visit all modules
    Object.keys(modules).forEach(moduleName => {
      visit(moduleName);
    });

    return loadOrder;
  };

  // ============= MODULE CATEGORIES =============

  exports.getModulesByCategory = function () {
    const modules = exports.MODULES;
    const categories = {};

    Object.entries(modules).forEach(([name, module]) => {
      const category = module.category || "other";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(name);
    });

    return categories;
  };

  // ============= CRITICAL MODULE DETECTION =============

  exports.getCriticalModules = function () {
    return Object.entries(exports.MODULES)
      .filter(([name, module]) => module.required)
      .map(([name]) => name);
  };

  // ============= MODULE METADATA =============

  exports.getModuleInfo = function (moduleName) {
    const module = exports.MODULES[moduleName];
    if (!module) {
      return null;
    }

    return {
      name: moduleName,
      url: module.url,
      dependencies: module.dependencies,
      category: module.category,
      required: module.required,
      dependents: Object.entries(exports.MODULES)
        .filter(([name, mod]) => mod.dependencies.includes(moduleName))
        .map(([name]) => name),
    };
  };

  // ============= FALLBACK CONFIGURATION =============

  exports.FALLBACK_CONFIG = {
    maxRetries: 3,
    retryDelay: 2000, // 2 seconds
    fallbackSources: [
      "https://cdn.jsdelivr.net/gh/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver@main/",
      "https://gitcdn.xyz/repo/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/main/",
    ],
    essentialModules: [
      "constants",
      "coreModule",
      "credentialsModule",
      "workflowModule",
    ],
  };

  // ============= DEVELOPMENT HELPERS =============

  exports.generateDependencyGraph = function () {
    const modules = exports.MODULES;
    const graph = {};

    Object.entries(modules).forEach(([name, module]) => {
      graph[name] = {
        dependencies: module.dependencies,
        category: module.category,
        required: module.required,
      };
    });

    return graph;
  };

  exports.findModulePath = function (fromModule, toModule) {
    const modules = exports.MODULES;
    const visited = new Set();
    const path = [];

    function findPath(current, target, currentPath) {
      if (current === target) {
        return [...currentPath, current];
      }

      if (visited.has(current)) {
        return null;
      }

      visited.add(current);

      const module = modules[current];
      if (!module) {
        return null;
      }

      for (const dep of module.dependencies) {
        const result = findPath(dep, target, [...currentPath, current]);
        if (result) {
          return result;
        }
      }

      return null;
    }

    return findPath(fromModule, toModule, []);
  };
})(typeof exports !== "undefined" ? exports : (window.AteexDependencies = {}));
