const AUTH_API_BASE_URL = process.env.REACT_APP_AUTH_API_BASE_URL || "https://auth.darmasr2.com";
const DATA_API_BASE_URL = process.env.REACT_APP_DATA_API_BASE_URL || "https://www.darmasr2.com";

const getAuthHeaders = () => {
    const token = localStorage.getItem("authToken");
    return token ? { "Authorization": `Bearer ${token}` } : {};
};

const getDataHeaders = () => {
    const token = localStorage.getItem("authToken");
    const headers = { "X-API-Version": "1.3.0", "accept-language": "ar", "Content-Type": "application/json", "x-internal": "web_APP" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
};

export const apiClient = {
    // Auth Service
    login: async (phoneNumber, password) => {
        const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber, password }),
        });
        return response.json();
    },

    verifyToken: async (token) => {
        const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/verify-token`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        return response.ok;
    },

    // Property Service
    searchProperty: async (query) => {
        // Defaulting to phone search for now, could detect type later
        const response = await fetch(`${DATA_API_BASE_URL}/api/Property/search?phone=${query}`, {
            method: "GET",
            headers: { ...getDataHeaders(), "Content-Type": "application/json" }
        });
        if (!response.ok) throw new Error("Failed to search property");
        const results = await response.json();

        // Handle SearchResponse structure: { success, host, hostId }
        if (results && results.success && results.host) {
            return {
                ...results.host,
                hostId: results.hostId // Add hostId from response
            };
        }

        // Fallback for other response formats
        return results && results.Title ? results : (results.Host || results.host || results[0]);
    },

    getPropertyByPhone: async (phone, token = null) => {
        const headers = { ...getDataHeaders(), "Content-Type": "application/json" };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${DATA_API_BASE_URL}/api/Property/search?phone=${phone}`, {
            method: "GET",
            headers: headers
        });
        if (!response.ok) return null;
        const results = await response.json();

        // Handle SearchResponse structure: { success, host, hostId }
        if (results && results.success && results.host) {
            return {
                ...results.host,
                hostId: results.hostId // Add hostId from response
            };
        }

        // Fallback for other response formats
        return results && results.Title ? results : (results.Host || results.host || results[0]);
    },

    registerDevice: async (hostId, deviceId, platform = "Web", token = null) => {
        const headers = { ...getDataHeaders(), "Content-Type": "application/json" };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${DATA_API_BASE_URL}/api/Property/register-device`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ hostId, deviceId, platform }),
        });
        if (!response.ok) {
            let errorMessage = "Failed to register device";
            try {
                const error = await response.json();
                errorMessage = error.message || errorMessage;
            } catch (e) {
                // Response was not JSON (e.g. 401/500 plain text or empty)
                const text = await response.text();
                errorMessage = text || `Request failed with status ${response.status}`;
            }
            throw new Error(errorMessage);
        }
        return response.json();
    },

    // Registration Service
    getSasToken: async () => {
        // SAS Token comes from ConfigController which allows anonymous access?
        // Checking Controller: ConfigController likely protected by same middleware.
        // So use DataHeaders.
        const response = await fetch(`${DATA_API_BASE_URL}/api/Config/sas-token`, {
            method: "GET",
            headers: { ...getDataHeaders(), "Content-Type": "application/json" }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.token;
    },

    registerUser: async (phoneNumber, password, email) => {
        const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber, password, email })
        });
        const data = await response.json();
        return { success: response.ok && data.success, data: data, error: data.message };
    },

    registerProperty: async (payload) => {
        // Register calls PropertyController.Register. Likely protected if middleware covers all.
        // Use DataHeaders.
        const response = await fetch(`${DATA_API_BASE_URL}/api/Property/register`, {
            method: "POST",
            headers: { ...getDataHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Property registration failed");
        }
        return response.json();
    },

    removeDevice: async (hostId, deviceId) => {
        const response = await fetch(`${DATA_API_BASE_URL}/api/Property/remove-device`, {
            method: "POST",
            headers: { ...getDataHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ hostId, deviceId })
        });
        return response.ok;
    },

    // Config Service
    getGates: async () => {
        const response = await fetch(`${DATA_API_BASE_URL}/api/Config/gates`, {
            method: "GET",
            headers: { ...getDataHeaders(), "Content-Type": "application/json" }
        });
        if (!response.ok) throw new Error("Failed to fetch gates");
        return response.json();
    },

    getVersion: async () => {
        const response = await fetch(`${DATA_API_BASE_URL}/api/Config/version`, {
            method: "GET",
            headers: { ...getDataHeaders(), "Content-Type": "application/json" }
        });
        if (!response.ok) return null;
        return response.json();
    },

    // Visitor Service (QR)
    generateQRCode: async (hostId, gateId, name) => {
        const response = await fetch(`${DATA_API_BASE_URL}/api/Visitor/AddVisitor`, {
            method: "POST",
            headers: { ...getDataHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ HostId: hostId, gateId, Name: name })
        });

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || errorText);
            } catch (e) {
                throw new Error(errorText || "Failed to generate QR code");
            }
        }
        return response.json();
    }
};
