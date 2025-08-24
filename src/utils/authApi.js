const API_BASE_URL = 'https://localhost:44323/api/auth';

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem('authToken');

// Helper function to make authenticated requests
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = getAuthToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
};

export const authApi = {
  // Login
  login: async (phoneNumber, password) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, password }),
    });
    return response;
  },

  // Register
  register: async (phoneNumber, password, email = null) => {
    const body = { phoneNumber, password };
    if (email) body.email = email;
    
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response;
  },

  // Send email verification
  sendEmailVerification: async () => {
    return makeAuthenticatedRequest(`${API_BASE_URL}/send-email-verification`, {
      method: 'POST',
    });
  },

  // Verify email
  verifyEmail: async (userId, token) => {
    const response = await fetch(`${API_BASE_URL}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    });
    return response;
  },

  // Forgot password
  forgotPassword: async (email) => {
    const response = await fetch(`${API_BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response;
  },

  // Reset password
  resetPassword: async (token, newPassword) => {
    const response = await fetch(`${API_BASE_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    return response;
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    return makeAuthenticatedRequest(`${API_BASE_URL}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Get user profile
  getProfile: async () => {
    return makeAuthenticatedRequest(`${API_BASE_URL}/profile`, {
      method: 'GET',
    });
  },
};