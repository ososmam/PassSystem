import { apiClient } from "../apiClient";

export const authService = {
  // Login using API
  async login(phone, password) {
    try {
      const response = await apiClient.login(phone, password);
      if (response.success && response.token) {
        localStorage.setItem("authToken", response.token);
        return true;
      }
      throw new Error(response.message || "Login failed");
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  async logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
  },

  // Check device limit is now handled by registerDevice API
  async checkDeviceLimit(userId, currentDeviceId) {
    try {
      // Platform defaults to "Web" or can be detected
      const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "iOS" : /Android/.test(navigator.userAgent) ? "Android" : "Web";
      await apiClient.registerDevice(userId, currentDeviceId, platform);
      return true;
    } catch (error) {
      console.error("Device check error:", error);
      return false;
    }
  },

  async verifyUser(phone) {
    try {
      const property = await apiClient.getPropertyByPhone(phone);
      if (property && property.verifiedAccount) {
        return property;
      }
      return null;
    } catch (error) {
      console.error("Verify user error:", error);
      return null;
    }
  },

  // Mock deprecated methods to prevent crashes if called
  initializeRecaptcha(containerId) {
    console.warn("Recaptcha is deprecated in API mode");
    return true;
  },

  onAuthStateChanged(callback) {
    // Mock auth state change based on local storage
    const token = localStorage.getItem("authToken");
    if (token) {
      // We don't have the full user object here immediately, but we can simulate a user presence
      callback({ uid: "api-user" });
    } else {
      callback(null);
    }
    // Return unsubscribe function
    return () => { };
  }
};