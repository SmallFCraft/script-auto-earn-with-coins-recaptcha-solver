/**
 * Modal Factory Module - Advanced modal creation and management
 * Handles creation of various modal types with enhanced UX and accessibility
 */

(function (exports) {
  "use strict";

  // Get dependencies
  const constants = AteexModules.constants;
  const domUtils = AteexModules.domUtils;
  const errorManager = AteexModules.errorManager;

  const { UI_CONFIG, MODAL_CONFIG } = constants;

  // ============= MODAL FACTORY CLASS =============

  class ModalFactory {
    constructor() {
      this.activeModals = new Map();
      this.zIndexCounter = UI_CONFIG.MODAL.Z_INDEX;
      this.isInitialized = false;
    }

    // ============= INITIALIZATION =============

    initialize() {
      if (this.isInitialized) {
        return true;
      }

      // Add global modal styles
      this.injectModalStyles();

      // Set up keyboard event listeners
      this.setupKeyboardHandlers();

      this.isInitialized = true;
      errorManager.logSuccess("Modal Factory", "Initialized successfully");
      return true;
    }

    // Inject CSS styles for modals
    injectModalStyles() {
      const styles = `
        .ateex-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          z-index: ${UI_CONFIG.MODAL.Z_INDEX};
        }

        .ateex-modal-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          max-width: 90vw;
          max-height: 90vh;
          overflow: hidden;
          animation: modalFadeIn 0.3s ease-out;
          position: relative;
        }

        .ateex-modal-gradient {
          background: linear-gradient(135deg, ${
            UI_CONFIG.COLORS.PRIMARY
          } 0%, #764ba2 100%);
          color: white;
        }

        .ateex-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ateex-modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ateex-modal-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 24px;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .ateex-modal-close:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .ateex-modal-body {
          padding: 24px;
          overflow-y: auto;
          max-height: 60vh;
        }

        .ateex-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #eee;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          background: #f8f9fa;
        }

        .ateex-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .ateex-btn-primary {
          background: ${UI_CONFIG.COLORS.PRIMARY};
          color: white;
        }

        .ateex-btn-primary:hover {
          background: ${UI_CONFIG.COLORS.PRIMARY_DARK || "#5a67d8"};
        }

        .ateex-btn-secondary {
          background: #6c757d;
          color: white;
        }

        .ateex-btn-secondary:hover {
          background: #5a6268;
        }

        .ateex-btn-success {
          background: #28a745;
          color: white;
        }

        .ateex-btn-success:hover {
          background: #218838;
        }

        .ateex-btn-warning {
          background: #ffc107;
          color: #212529;
        }

        .ateex-btn-warning:hover {
          background: #e0a800;
        }

        .ateex-btn-danger {
          background: #dc3545;
          color: white;
        }

        .ateex-btn-danger:hover {
          background: #c82333;
        }

        .ateex-form-group {
          margin-bottom: 16px;
        }

        .ateex-form-label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #333;
        }

        .ateex-form-input {
          width: 100%;
          padding: 10px;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .ateex-form-input:focus {
          outline: none;
          border-color: ${UI_CONFIG.COLORS.PRIMARY};
        }

        .ateex-form-input.error {
          border-color: #dc3545;
        }

        .ateex-error-message {
          color: #dc3545;
          font-size: 12px;
          margin-top: 4px;
        }

        .ateex-progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          margin: 16px 0;
        }

        .ateex-progress-fill {
          height: 100%;
          background: ${UI_CONFIG.COLORS.PRIMARY};
          transition: width 0.3s ease;
        }

        @keyframes modalFadeIn {
          from { 
            opacity: 0; 
            transform: scale(0.9) translateY(-20px); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
        }

        @keyframes modalFadeOut {
          from { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
          to { 
            opacity: 0; 
            transform: scale(0.9) translateY(-20px); 
          }
        }

        .ateex-modal-container.closing {
          animation: modalFadeOut 0.2s ease-in forwards;
        }

        .ateex-modal-overlay.closing {
          animation: overlayFadeOut 0.2s ease-in forwards;
        }

        @keyframes overlayFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;

      domUtils.injectCSS(styles, "ateex-modal-styles");
    }

    // Set up global keyboard handlers
    setupKeyboardHandlers() {
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && this.activeModals.size > 0) {
          const topModal = this.getTopModal();
          if (topModal && topModal.config.closeOnEscape !== false) {
            this.close(topModal.id);
          }
        }
      });
    }

    // ============= MODAL CREATION =============

    // Create a basic modal
    createModal(config = {}) {
      const modalId = this.generateModalId();
      const modal = this.buildModal(modalId, config);

      // Store modal reference
      this.activeModals.set(modalId, {
        id: modalId,
        element: modal.overlay,
        config: config,
        zIndex: this.zIndexCounter++,
      });

      // Add to DOM
      document.body.appendChild(modal.overlay);

      // Set focus management
      this.setupFocusManagement(modal);

      // Handle backdrop clicks
      if (config.closeOnBackdrop !== false) {
        modal.overlay.addEventListener("click", event => {
          if (event.target === modal.overlay) {
            this.close(modalId);
          }
        });
      }

      errorManager.logInfo("Modal", `Created modal: ${modalId}`);
      return { modalId, ...modal };
    }

    // Build modal DOM structure
    buildModal(modalId, config) {
      const overlay = domUtils.createElement(
        "div",
        {
          class: "ateex-modal-overlay",
          "data-modal-id": modalId,
        },
        {
          zIndex: this.zIndexCounter,
        }
      );

      const container = domUtils.createElement("div", {
        class: `ateex-modal-container ${
          config.gradient ? "ateex-modal-gradient" : ""
        }`,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": `modal-title-${modalId}`,
      });

      // Header
      let header = null;
      if (config.title || config.showClose !== false) {
        header = this.createModalHeader(modalId, config);
        container.appendChild(header);
      }

      // Body
      const body = domUtils.createElement("div", {
        class: "ateex-modal-body",
      });

      if (config.content) {
        if (typeof config.content === "string") {
          body.innerHTML = config.content;
        } else {
          body.appendChild(config.content);
        }
      }

      container.appendChild(body);

      // Footer
      if (config.buttons && config.buttons.length > 0) {
        const footer = this.createModalFooter(modalId, config.buttons);
        container.appendChild(footer);
      }

      overlay.appendChild(container);

      return {
        overlay,
        container,
        header,
        body,
        modalId,
      };
    }

    // Create modal header
    createModalHeader(modalId, config) {
      const header = domUtils.createElement("div", {
        class: "ateex-modal-header",
      });

      if (config.title) {
        const title = domUtils.createElement("h2", {
          class: "ateex-modal-title",
          id: `modal-title-${modalId}`,
        });

        if (config.icon) {
          title.innerHTML = `${config.icon} <span>${config.title}</span>`;
        } else {
          title.textContent = config.title;
        }

        header.appendChild(title);
      }

      if (config.showClose !== false) {
        const closeBtn = domUtils.createElement("button", {
          class: "ateex-modal-close",
          type: "button",
          "aria-label": "Close modal",
        });
        closeBtn.innerHTML = "×";
        closeBtn.onclick = () => this.close(modalId);
        header.appendChild(closeBtn);
      }

      return header;
    }

    // Create modal footer with buttons
    createModalFooter(modalId, buttons) {
      const footer = domUtils.createElement("div", {
        class: "ateex-modal-footer",
      });

      buttons.forEach(buttonConfig => {
        const button = this.createButton(buttonConfig, modalId);
        footer.appendChild(button);
      });

      return footer;
    }

    // Create button element
    createButton(config, modalId) {
      const button = domUtils.createElement("button", {
        class: `ateex-btn ateex-btn-${config.type || "secondary"}`,
        type: "button",
      });

      if (config.icon) {
        button.innerHTML = `${config.icon} <span>${config.text}</span>`;
      } else {
        button.textContent = config.text;
      }

      if (config.onClick) {
        button.onclick = event => {
          const result = config.onClick(event, modalId);
          if (result !== false && config.autoClose !== false) {
            this.close(modalId);
          }
        };
      }

      if (config.disabled) {
        button.disabled = true;
      }

      return button;
    }

    // ============= SPECIALIZED MODAL TYPES =============

    // Create confirmation dialog
    createConfirmation(config) {
      const confirmConfig = {
        title: config.title || "Confirm Action",
        icon: config.icon || "⚠️",
        content: config.message || "Are you sure you want to continue?",
        buttons: [
          {
            text: config.cancelText || "Cancel",
            type: "secondary",
            onClick: () => config.onCancel && config.onCancel(),
          },
          {
            text: config.confirmText || "Confirm",
            type: config.dangerous ? "danger" : "primary",
            onClick: () => config.onConfirm && config.onConfirm(),
          },
        ],
        closeOnBackdrop: config.closeOnBackdrop,
        closeOnEscape: config.closeOnEscape,
      };

      return this.createModal(confirmConfig);
    }

    // Create alert dialog
    createAlert(config) {
      const alertConfig = {
        title: config.title || "Alert",
        icon: config.icon || "ℹ️",
        content: config.message || "Alert message",
        buttons: [
          {
            text: config.buttonText || "OK",
            type: "primary",
            onClick: () => config.onOk && config.onOk(),
          },
        ],
        closeOnBackdrop: config.closeOnBackdrop,
        closeOnEscape: config.closeOnEscape,
      };

      return this.createModal(alertConfig);
    }

    // Create loading modal
    createLoading(config = {}) {
      const loadingContent = domUtils.createElement("div", {
        style: "text-align: center; padding: 20px;",
      });

      loadingContent.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">${
          config.spinner || "⏳"
        }</div>
        <div style="font-size: 16px; margin-bottom: 8px;">${
          config.message || "Loading..."
        }</div>
        ${
          config.progress !== undefined
            ? `
          <div class="ateex-progress-bar">
            <div class="ateex-progress-fill" style="width: ${config.progress}%"></div>
          </div>
          <div style="font-size: 12px; color: #666;">${config.progress}%</div>
        `
            : ""
        }
      `;

      const loadingConfig = {
        content: loadingContent,
        showClose: false,
        closeOnBackdrop: false,
        closeOnEscape: false,
        gradient: true,
        ...config,
      };

      return this.createModal(loadingConfig);
    }

    // Create form modal
    createForm(config) {
      const form = domUtils.createElement("form");

      config.fields.forEach(field => {
        const group = this.createFormGroup(field);
        form.appendChild(group);
      });

      const formConfig = {
        title: config.title || "Form",
        icon: config.icon,
        content: form,
        buttons: [
          {
            text: config.cancelText || "Cancel",
            type: "secondary",
            onClick: () => config.onCancel && config.onCancel(),
          },
          {
            text: config.submitText || "Submit",
            type: "primary",
            onClick: (event, modalId) => {
              event.preventDefault();
              const formData = this.getFormData(form);
              const validation = this.validateForm(form, config.fields);

              if (validation.isValid) {
                const result = config.onSubmit && config.onSubmit(formData);
                return result;
              } else {
                this.showFormErrors(form, validation.errors);
                return false;
              }
            },
          },
        ],
        closeOnBackdrop: config.closeOnBackdrop,
        closeOnEscape: config.closeOnEscape,
      };

      return this.createModal(formConfig);
    }

    // Create form group
    createFormGroup(field) {
      const group = domUtils.createElement("div", {
        class: "ateex-form-group",
      });

      if (field.label) {
        const label = domUtils.createElement("label", {
          class: "ateex-form-label",
          for: field.name,
        });
        label.textContent = field.label;
        group.appendChild(label);
      }

      let input;
      if (field.type === "select") {
        input = domUtils.createElement("select", {
          class: "ateex-form-input",
          name: field.name,
          id: field.name,
        });

        field.options.forEach(option => {
          const optionEl = domUtils.createElement("option", {
            value: option.value,
          });
          optionEl.textContent = option.label;
          if (option.selected) optionEl.selected = true;
          input.appendChild(optionEl);
        });
      } else if (field.type === "textarea") {
        input = domUtils.createElement("textarea", {
          class: "ateex-form-input",
          name: field.name,
          id: field.name,
          placeholder: field.placeholder || "",
          rows: field.rows || 3,
        });
      } else {
        input = domUtils.createElement("input", {
          class: "ateex-form-input",
          type: field.type || "text",
          name: field.name,
          id: field.name,
          placeholder: field.placeholder || "",
        });
      }

      if (field.value) {
        input.value = field.value;
      }

      if (field.required) {
        input.required = true;
      }

      group.appendChild(input);

      return group;
    }

    // ============= MODAL MANAGEMENT =============

    // Close modal
    close(modalId) {
      const modal = this.activeModals.get(modalId);
      if (!modal) return false;

      // Add closing animation
      modal.element.classList.add("closing");
      modal.element
        .querySelector(".ateex-modal-container")
        .classList.add("closing");

      // Remove after animation
      setTimeout(() => {
        if (modal.element.parentNode) {
          modal.element.parentNode.removeChild(modal.element);
        }
        this.activeModals.delete(modalId);

        errorManager.logInfo("Modal", `Closed modal: ${modalId}`);
      }, 200);

      return true;
    }

    // Close all modals
    closeAll() {
      const modalIds = Array.from(this.activeModals.keys());
      modalIds.forEach(id => this.close(id));
    }

    // Update modal content
    updateContent(modalId, content) {
      const modal = this.activeModals.get(modalId);
      if (!modal) return false;

      const body = modal.element.querySelector(".ateex-modal-body");
      if (body) {
        if (typeof content === "string") {
          body.innerHTML = content;
        } else {
          body.innerHTML = "";
          body.appendChild(content);
        }
        return true;
      }

      return false;
    }

    // Update loading progress
    updateProgress(modalId, progress, message) {
      const modal = this.activeModals.get(modalId);
      if (!modal) return false;

      const progressBar = modal.element.querySelector(".ateex-progress-fill");
      const messageEl = modal.element.querySelector(".ateex-modal-body div");

      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }

      if (message && messageEl) {
        messageEl.textContent = message;
      }

      return true;
    }

    // ============= UTILITY METHODS =============

    // Generate unique modal ID
    generateModalId() {
      return `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get top modal (highest z-index)
    getTopModal() {
      let topModal = null;
      let highestZIndex = -1;

      for (const modal of this.activeModals.values()) {
        if (modal.zIndex > highestZIndex) {
          highestZIndex = modal.zIndex;
          topModal = modal;
        }
      }

      return topModal;
    }

    // Set up focus management
    setupFocusManagement(modal) {
      const focusableElements = modal.container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    // Get form data
    getFormData(form) {
      const formData = {};
      const inputs = form.querySelectorAll("input, select, textarea");

      inputs.forEach(input => {
        if (input.type === "checkbox") {
          formData[input.name] = input.checked;
        } else if (input.type === "radio") {
          if (input.checked) {
            formData[input.name] = input.value;
          }
        } else {
          formData[input.name] = input.value;
        }
      });

      return formData;
    }

    // Validate form
    validateForm(form, fields) {
      const errors = {};
      let isValid = true;

      fields.forEach(field => {
        const input = form.querySelector(`[name="${field.name}"]`);
        if (!input) return;

        // Clear previous errors
        input.classList.remove("error");
        const existingError = input.parentNode.querySelector(
          ".ateex-error-message"
        );
        if (existingError) {
          existingError.remove();
        }

        // Required validation
        if (field.required && !input.value.trim()) {
          errors[field.name] = "This field is required";
          isValid = false;
        }

        // Custom validation
        if (field.validate && input.value) {
          const customError = field.validate(input.value);
          if (customError) {
            errors[field.name] = customError;
            isValid = false;
          }
        }
      });

      return { isValid, errors };
    }

    // Show form errors
    showFormErrors(form, errors) {
      Object.keys(errors).forEach(fieldName => {
        const input = form.querySelector(`[name="${fieldName}"]`);
        if (input) {
          input.classList.add("error");

          const errorDiv = domUtils.createElement("div", {
            class: "ateex-error-message",
          });
          errorDiv.textContent = errors[fieldName];

          input.parentNode.appendChild(errorDiv);
        }
      });
    }

    // Get active modals count
    getActiveCount() {
      return this.activeModals.size;
    }

    // Check if modal exists
    exists(modalId) {
      return this.activeModals.has(modalId);
    }
  }

  // ============= SINGLETON INSTANCE =============

  const modalFactory = new ModalFactory();

  // ============= EXPORTS =============

  exports.ModalFactory = ModalFactory;
  exports.modalFactory = modalFactory;

  // Main API
  exports.initialize = () => modalFactory.initialize();
  exports.createModal = config => modalFactory.createModal(config);
  exports.close = modalId => modalFactory.close(modalId);
  exports.closeAll = () => modalFactory.closeAll();

  // Specialized modals
  exports.createConfirmation = config =>
    modalFactory.createConfirmation(config);
  exports.createAlert = config => modalFactory.createAlert(config);
  exports.createLoading = config => modalFactory.createLoading(config);
  exports.createForm = config => modalFactory.createForm(config);

  // Management
  exports.updateContent = (modalId, content) =>
    modalFactory.updateContent(modalId, content);
  exports.updateProgress = (modalId, progress, message) =>
    modalFactory.updateProgress(modalId, progress, message);
  exports.getActiveCount = () => modalFactory.getActiveCount();
  exports.exists = modalId => modalFactory.exists(modalId);
})(exports);
