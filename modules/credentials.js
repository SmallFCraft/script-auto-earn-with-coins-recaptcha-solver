/**
 * Credentials Management Module
 * Part of Ateex Auto v3.0 Modular Edition
 * Handles secure credential storage, encryption, and authentication
 */

// Load utils module
const utils = ateexGlobalState.modulesLoaded.utils;
const { logInfo, logError, logSuccess, logWarning, logDebug, safeJsonParse, safeJsonStringify, createElement, sleep } = utils;

// ============= ENCRYPTION UTILITIES =============

/**
 * Simple encryption for credentials (Base64 + XOR)
 * Note: This is basic obfuscation, not cryptographically secure
 */
function encryptCredentials(data, key = "ateex_secure_key_2024") {
  try {
    const jsonStr = safeJsonStringify(data);
    let encrypted = "";
    
    for (let i = 0; i < jsonStr.length; i++) {
      const charCode = jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      encrypted += String.fromCharCode(charCode);
    }
    
    return btoa(encrypted);
  } catch (error) {
    logError(`Encryption error: ${error.message}`);
    return null;
  }
}

/**
 * Decrypt credentials
 */
function decryptCredentials(encryptedData, key = "ateex_secure_key_2024") {
  try {
    const encrypted = atob(encryptedData);
    let decrypted = "";
    
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    return safeJsonParse(decrypted);
  } catch (error) {
    logError(`Decryption error: ${error.message}`);
    return null;
  }
}

// ============= CREDENTIAL STORAGE =============

/**
 * Save credentials securely
 */
function saveCredentials(email, password) {
  try {
    const credentials = {
      email: email.trim(),
      password: password,
      timestamp: Date.now(),
      version: ateexGlobalState.version
    };
    
    const encrypted = encryptCredentials(credentials);
    if (encrypted) {
      localStorage.setItem("ateex_secure_creds", encrypted);
      logSuccess("Credentials saved securely");
      return true;
    }
    
    return false;
  } catch (error) {
    logError(`Error saving credentials: ${error.message}`);
    return false;
  }
}

/**
 * Load credentials from storage
 */
function loadCredentials() {
  try {
    const encrypted = localStorage.getItem("ateex_secure_creds");
    if (!encrypted) {
      return null;
    }
    
    const credentials = decryptCredentials(encrypted);
    if (credentials && credentials.email && credentials.password) {
      logDebug("Credentials loaded successfully");
      return credentials;
    }
    
    logWarning("Invalid credentials found, clearing...");
    clearCredentials();
    return null;
  } catch (error) {
    logError(`Error loading credentials: ${error.message}`);
    return null;
  }
}

/**
 * Clear stored credentials
 */
function clearCredentials() {
  try {
    localStorage.removeItem("ateex_secure_creds");
    logInfo("Credentials cleared");
    return true;
  } catch (error) {
    logError(`Error clearing credentials: ${error.message}`);
    return false;
  }
}

/**
 * Validate credentials format
 */
function validateCredentials(email, password) {
  if (!email || !password) {
    return { valid: false, message: "Email and password are required" };
  }
  
  email = email.trim();
  
  if (email.length < 3) {
    return { valid: false, message: "Email/username must be at least 3 characters" };
  }
  
  if (password.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters" };
  }
  
  // Check if it's email format or username
  const isEmail = email.includes("@");
  if (isEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: "Invalid email format" };
    }
  }
  
  return { valid: true, message: "Credentials are valid" };
}

// ============= CREDENTIAL UI =============

/**
 * Create credential input form
 */
function createCredentialForm() {
  return new Promise((resolve, reject) => {
    // Check if form already exists
    if (document.getElementById("ateex-credential-form")) {
      logWarning("Credential form already exists");
      resolve(null);
      return;
    }
    
    // Create overlay
    const overlay = createElement("div", {
      id: "ateex-credential-overlay",
      style: {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: "999999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    });
    
    // Create form container
    const formContainer = createElement("div", {
      id: "ateex-credential-form",
      style: {
        backgroundColor: "#fff",
        padding: "30px",
        borderRadius: "10px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        maxWidth: "400px",
        width: "90%",
        fontFamily: "Arial, sans-serif"
      }
    });
    
    // Form HTML
    formContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #333; margin: 0 0 10px 0;">🔐 Ateex Auto Login</h2>
        <p style="color: #666; margin: 0; font-size: 14px;">Enter your credentials to enable auto-earning</p>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">Email/Username:</label>
        <input type="text" id="ateex-email" placeholder="Enter email or username" 
               style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px; box-sizing: border-box;">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">Password:</label>
        <input type="password" id="ateex-password" placeholder="Enter password"
               style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px; box-sizing: border-box;">
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; color: #333; cursor: pointer;">
          <input type="checkbox" id="ateex-remember" checked style="margin-right: 8px;">
          <span style="font-size: 14px;">Remember me (encrypted storage)</span>
        </label>
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button id="ateex-save-btn" style="flex: 1; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold;">
          Save & Continue
        </button>
        <button id="ateex-cancel-btn" style="flex: 1; padding: 12px; background: #f44336; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold;">
          Cancel
        </button>
      </div>
      
      <div id="ateex-form-message" style="margin-top: 15px; padding: 10px; border-radius: 5px; display: none;"></div>
    `;
    
    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);
    
    // Focus on email field
    setTimeout(() => {
      const emailField = document.getElementById("ateex-email");
      if (emailField) emailField.focus();
    }, 100);
    
    // Show message function
    function showMessage(message, type = "info") {
      const messageDiv = document.getElementById("ateex-form-message");
      if (messageDiv) {
        messageDiv.style.display = "block";
        messageDiv.textContent = message;
        
        switch (type) {
          case "error":
            messageDiv.style.backgroundColor = "#ffebee";
            messageDiv.style.color = "#c62828";
            messageDiv.style.border = "1px solid #e57373";
            break;
          case "success":
            messageDiv.style.backgroundColor = "#e8f5e8";
            messageDiv.style.color = "#2e7d32";
            messageDiv.style.border = "1px solid #81c784";
            break;
          default:
            messageDiv.style.backgroundColor = "#e3f2fd";
            messageDiv.style.color = "#1565c0";
            messageDiv.style.border = "1px solid #64b5f6";
        }
      }
    }
    
    // Handle save button
    document.getElementById("ateex-save-btn").addEventListener("click", async () => {
      const email = document.getElementById("ateex-email").value.trim();
      const password = document.getElementById("ateex-password").value;
      const remember = document.getElementById("ateex-remember").checked;
      
      const validation = validateCredentials(email, password);
      if (!validation.valid) {
        showMessage(validation.message, "error");
        return;
      }
      
      if (remember) {
        const saved = saveCredentials(email, password);
        if (!saved) {
          showMessage("Failed to save credentials", "error");
          return;
        }
      }
      
      showMessage("Credentials saved! Auto Stats starting...", "success");
      
      // Enable auto stats
      ateexGlobalState.autoStatsEnabled = true;
      ateexGlobalState.setupCompleted = true;
      ateexGlobalState.credentialsReady = true;
      ateexGlobalState.autoStatsStartTime = Date.now();
      
      // Save auto stats state
      localStorage.setItem("ateex_auto_stats_enabled", "true");
      
      setTimeout(() => {
        overlay.remove();
        resolve({ email, password });
      }, 1500);
    });
    
    // Handle cancel button
    document.getElementById("ateex-cancel-btn").addEventListener("click", () => {
      overlay.remove();
      resolve(null);
    });
    
    // Handle Enter key
    formContainer.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("ateex-save-btn").click();
      }
    });
    
    // Handle Escape key
    document.addEventListener("keydown", function escapeHandler(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", escapeHandler);
        overlay.remove();
        resolve(null);
      }
    });
  });
}

/**
 * Get credentials (from storage or prompt user)
 */
async function getCredentials() {
  // Try to load existing credentials first
  const existing = loadCredentials();
  if (existing && existing.email && existing.password) {
    logInfo("Using existing credentials");
    return existing;
  }
  
  // Prompt user for new credentials
  logInfo("Prompting user for credentials");
  return await createCredentialForm();
}

/**
 * Check auto stats state
 */
function checkAutoStatsState() {
  try {
    const enabled = localStorage.getItem("ateex_auto_stats_enabled");
    const hasCredentials = !!loadCredentials();
    
    if (enabled === "true" && hasCredentials) {
      ateexGlobalState.autoStatsEnabled = true;
      ateexGlobalState.setupCompleted = true;
      ateexGlobalState.credentialsReady = true;
      
      if (!ateexGlobalState.autoStatsStartTime) {
        ateexGlobalState.autoStatsStartTime = Date.now();
      }
      
      logInfo("Auto stats state restored from storage");
      return true;
    }
    
    return false;
  } catch (error) {
    logError(`Error checking auto stats state: ${error.message}`);
    return false;
  }
}

// ============= MODULE EXPORTS =============

module.exports = {
  // Core functions
  saveCredentials,
  loadCredentials,
  clearCredentials,
  validateCredentials,
  getCredentials,
  
  // UI functions
  createCredentialForm,
  
  // State management
  checkAutoStatsState,
  
  // Encryption (for advanced use)
  encryptCredentials,
  decryptCredentials
};
