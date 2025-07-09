/**
 * DOM Utils Module - Enhanced DOM manipulation utilities
 * Provides consistent, reusable DOM operations with error handling and security
 */

(function (exports) {
  "use strict";

  // Get constants
  const constants = AteexModules.constants;
  const { ATEEX_CONFIG, SECURITY_CONFIG, PERFORMANCE_CONFIG } = constants;

  // ============= ELEMENT SELECTION =============

  // Enhanced querySelector with error handling and caching
  function qSelector(selector, context = document) {
    try {
      if (!selector || typeof selector !== "string") {
        console.warn("Invalid selector provided to qSelector:", selector);
        return null;
      }

      return context.querySelector(selector);
    } catch (e) {
      console.error(`Invalid selector: ${selector}`, e);
      return null;
    }
  }

  // Enhanced querySelectorAll with error handling
  function qSelectorAll(selector, context = document) {
    try {
      if (!selector || typeof selector !== "string") {
        console.warn("Invalid selector provided to qSelectorAll:", selector);
        return [];
      }

      return Array.from(context.querySelectorAll(selector));
    } catch (e) {
      console.error(`Invalid selector: ${selector}`, e);
      return [];
    }
  }

  // Find element with multiple selectors (returns first match)
  function qSelectorMultiple(selectors, context = document) {
    if (!Array.isArray(selectors)) {
      return qSelector(selectors, context);
    }

    for (const selector of selectors) {
      const element = qSelector(selector, context);
      if (element) {
        return element;
      }
    }

    return null;
  }

  // Find element by text content
  function findElementByText(texts, tagName = "*", context = document) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

    const elements = qSelectorAll(tagName, context);

    for (const element of elements) {
      const textContent = element.textContent.trim().toLowerCase();
      for (const text of texts) {
        if (textContent.includes(text.toLowerCase())) {
          return element;
        }
      }
    }

    return null;
  }

  // Find elements by partial text content
  function findElementsByText(texts, tagName = "*", context = document) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

    const elements = qSelectorAll(tagName, context);
    const matches = [];

    for (const element of elements) {
      const textContent = element.textContent.trim().toLowerCase();
      for (const text of texts) {
        if (textContent.includes(text.toLowerCase())) {
          matches.push(element);
          break;
        }
      }
    }

    return matches;
  }

  // ============= ELEMENT CREATION =============

  // Create element with attributes and styles
  function createElement(tagName, attributes = {}, styles = {}) {
    try {
      const element = document.createElement(tagName);

      // Set attributes
      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          element.setAttribute(key, value);
        }
      });

      // Set styles
      Object.entries(styles).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          element.style[key] = value;
        }
      });

      return element;
    } catch (e) {
      console.error(`Failed to create element ${tagName}:`, e);
      return null;
    }
  }

  // Create button with common styles
  function createButton(text, onClick, styles = {}) {
    const defaultStyles = {
      padding: "8px 16px",
      border: "none",
      borderRadius: "4px",
      background: constants.UI_CONFIG.COLORS.PRIMARY,
      color: "white",
      cursor: "pointer",
      fontSize: "14px",
      fontFamily: "inherit",
    };

    const button = createElement(
      "button",
      {
        type: "button",
      },
      { ...defaultStyles, ...styles }
    );

    if (text) {
      button.textContent = text;
    }

    if (onClick && typeof onClick === "function") {
      button.addEventListener("click", onClick);
    }

    return button;
  }

  // Create input with common styles
  function createInput(type = "text", placeholder = "", styles = {}) {
    const defaultStyles = {
      padding: "8px 12px",
      border: "1px solid #ddd",
      borderRadius: "4px",
      fontSize: "14px",
      fontFamily: "inherit",
      width: "100%",
      boxSizing: "border-box",
    };

    return createElement(
      "input",
      {
        type: type,
        placeholder: placeholder,
      },
      { ...defaultStyles, ...styles }
    );
  }

  // ============= ELEMENT VISIBILITY =============

  // Check if element is visible
  function isVisible(element) {
    if (!element) return false;

    try {
      const style = window.getComputedStyle(element);
      return (
        element.offsetParent !== null &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    } catch (e) {
      return false;
    }
  }

  // Check if element is hidden
  function isHidden(element) {
    return !isVisible(element);
  }

  // Wait for element to become visible
  function waitForVisible(selector, timeout = 10000, context = document) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const element = qSelector(selector, context);

        if (element && isVisible(element)) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(
            new Error(`Element ${selector} not visible within ${timeout}ms`)
          );
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  // Wait for element to exist
  function waitForElement(selector, timeout = 10000, context = document) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const element = qSelector(selector, context);

        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(
            new Error(`Element ${selector} not found within ${timeout}ms`)
          );
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  // ============= EVENT HANDLING =============

  // Trigger event on element
  function triggerEvent(element, eventType, options = {}) {
    if (!element) {
      console.warn("Cannot trigger event on null element");
      return false;
    }

    try {
      const event = new Event(eventType, {
        bubbles: true,
        cancelable: true,
        ...options,
      });

      element.dispatchEvent(event);
      return true;
    } catch (e) {
      console.error(`Failed to trigger event ${eventType}:`, e);
      return false;
    }
  }

  // Trigger mouse event
  function triggerMouseEvent(element, eventType, options = {}) {
    if (!element) {
      console.warn("Cannot trigger mouse event on null element");
      return false;
    }

    try {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        ...options,
      });

      element.dispatchEvent(event);
      return true;
    } catch (e) {
      console.error(`Failed to trigger mouse event ${eventType}:`, e);
      return false;
    }
  }

  // Trigger keyboard event
  function triggerKeyboardEvent(element, eventType, keyCode, options = {}) {
    if (!element) {
      console.warn("Cannot trigger keyboard event on null element");
      return false;
    }

    try {
      const event = new KeyboardEvent(eventType, {
        bubbles: true,
        cancelable: true,
        keyCode: keyCode,
        which: keyCode,
        ...options,
      });

      element.dispatchEvent(event);
      return true;
    } catch (e) {
      console.error(`Failed to trigger keyboard event ${eventType}:`, e);
      return false;
    }
  }

  // ============= FORM UTILITIES =============

  // Get form elements (inputs, buttons, etc.)
  function getFormElements(formSelector) {
    const form = qSelector(formSelector);
    if (!form) {
      return null;
    }

    return {
      form: form,
      emailInputs: qSelectorAll(ATEEX_CONFIG.SELECTORS.EMAIL_INPUT, form),
      passwordInputs: qSelectorAll(ATEEX_CONFIG.SELECTORS.PASSWORD_INPUT, form),
      submitButtons: qSelectorAll(ATEEX_CONFIG.SELECTORS.SUBMIT_BUTTON, form),
      allInputs: qSelectorAll("input, select, textarea", form),
    };
  }

  // Fill form field with value
  function fillFormField(element, value) {
    if (!element) {
      return false;
    }

    try {
      // Set value
      element.value = value;

      // Trigger events to notify frameworks
      triggerEvent(element, "input");
      triggerEvent(element, "change");
      triggerEvent(element, "blur");

      return true;
    } catch (e) {
      console.error("Failed to fill form field:", e);
      return false;
    }
  }

  // ============= RECAPTCHA UTILITIES =============

  // Get reCAPTCHA elements
  function getRecaptchaElements() {
    return {
      containers: qSelectorAll(".g-recaptcha, [data-sitekey], .recaptcha"),
      responses: qSelectorAll(
        'textarea[name="g-recaptcha-response"], textarea[id*="recaptcha-response"]'
      ),
      checkboxes: qSelectorAll(".recaptcha-checkbox, .rc-anchor-checkbox"),
      frames: qSelectorAll('iframe[src*="recaptcha"]'),
      success: qSelectorAll(
        '.recaptcha-checkbox-checked, [aria-checked="true"], .rc-anchor-checkbox-checked'
      ),
    };
  }

  // Check if reCAPTCHA is solved
  function isRecaptchaSolved() {
    const elements = getRecaptchaElements();

    // Check for response tokens
    const hasToken = elements.responses.some(
      el => el.value && el.value.length > 0
    );

    // Check for success indicators
    const hasSuccessIndicator = elements.success.length > 0;

    return hasToken || hasSuccessIndicator;
  }

  // ============= CROSS-FRAME COMMUNICATION =============

  // Send message to all frames
  function sendMessageToAllFrames(message, targetOrigin = "*") {
    try {
      // Send to parent if in iframe
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, targetOrigin);
      }

      // Send to top window
      if (window.top && window.top !== window) {
        window.top.postMessage(message, targetOrigin);
      }

      // Send to all child frames
      const frames = qSelectorAll("iframe");
      frames.forEach(frame => {
        try {
          frame.contentWindow.postMessage(message, targetOrigin);
        } catch (e) {
          // Ignore cross-origin errors
        }
      });

      return true;
    } catch (e) {
      console.error("Failed to send message to frames:", e);
      return false;
    }
  }

  // Setup message listener with validation
  function setupMessageListener(callback, validateOrigin = true) {
    const handler = event => {
      if (validateOrigin) {
        const allowedOrigins = SECURITY_CONFIG.ALLOWED_ORIGINS;
        const isAllowed = allowedOrigins.some(
          origin =>
            event.origin === origin || event.origin.endsWith(".google.com")
        );

        if (!isAllowed) {
          console.warn("Message from untrusted origin:", event.origin);
          return;
        }
      }

      callback(event);
    };

    window.addEventListener("message", handler);
    return handler;
  }

  // ============= ANIMATION UTILITIES =============

  // Fade in element
  function fadeIn(element, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise(resolve => {
      element.style.opacity = "0";
      element.style.display = "block";

      const start = performance.now();

      function animate(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);

        element.style.opacity = progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(animate);
    });
  }

  // Fade out element
  function fadeOut(element, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise(resolve => {
      const start = performance.now();
      const startOpacity = parseFloat(element.style.opacity) || 1;

      function animate(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);

        element.style.opacity = startOpacity * (1 - progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          element.style.display = "none";
          resolve();
        }
      }

      requestAnimationFrame(animate);
    });
  }

  // ============= PERFORMANCE UTILITIES =============

  // Debounce function for DOM operations
  function debounce(
    func,
    delay = PERFORMANCE_CONFIG.DEBOUNCE_DELAYS.DOM_QUERIES
  ) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Throttle function for frequent DOM operations
  function throttle(
    func,
    limit = PERFORMANCE_CONFIG.THROTTLE_LIMITS.DOM_QUERIES
  ) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // ============= SANITIZATION =============

  // Sanitize HTML content
  function sanitizeHTML(html) {
    const temp = document.createElement("div");
    temp.textContent = html;
    return temp.innerHTML;
  }

  // Sanitize attributes
  function sanitizeAttribute(value) {
    if (typeof value !== "string") return value;

    return value
      .replace(/[<>'"]/g, "") // Remove potential XSS chars
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+=/gi, ""); // Remove event handlers
  }

  // ============= VIEWPORT UTILITIES =============

  // Check if element is in viewport
  function isInViewport(element) {
    if (!element) return false;

    try {
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
          (window.innerWidth || document.documentElement.clientWidth)
      );
    } catch (e) {
      return false;
    }
  }

  // Scroll element into view
  function scrollIntoView(element, behavior = "smooth") {
    if (!element) return;

    try {
      element.scrollIntoView({
        behavior: behavior,
        block: "center",
        inline: "center",
      });
    } catch (e) {
      // Fallback for older browsers
      element.scrollIntoView();
    }
  }

  // ============= EXPORTS =============

  // Element selection
  exports.qSelector = qSelector;
  exports.qSelectorAll = qSelectorAll;
  exports.qSelectorMultiple = qSelectorMultiple;
  exports.findElementByText = findElementByText;
  exports.findElementsByText = findElementsByText;

  // Element creation
  exports.createElement = createElement;
  exports.createButton = createButton;
  exports.createInput = createInput;

  // Visibility
  exports.isVisible = isVisible;
  exports.isHidden = isHidden;
  exports.waitForVisible = waitForVisible;
  exports.waitForElement = waitForElement;

  // Events
  exports.triggerEvent = triggerEvent;
  exports.triggerMouseEvent = triggerMouseEvent;
  exports.triggerKeyboardEvent = triggerKeyboardEvent;

  // Forms
  exports.getFormElements = getFormElements;
  exports.fillFormField = fillFormField;

  // reCAPTCHA
  exports.getRecaptchaElements = getRecaptchaElements;
  exports.isRecaptchaSolved = isRecaptchaSolved;

  // Cross-frame communication
  exports.sendMessageToAllFrames = sendMessageToAllFrames;
  exports.setupMessageListener = setupMessageListener;

  // Animation
  exports.fadeIn = fadeIn;
  exports.fadeOut = fadeOut;

  // Performance
  exports.debounce = debounce;
  exports.throttle = throttle;

  // Sanitization
  exports.sanitizeHTML = sanitizeHTML;
  exports.sanitizeAttribute = sanitizeAttribute;

  // Viewport
  exports.isInViewport = isInViewport;
  exports.scrollIntoView = scrollIntoView;
})(exports);
