// QR Code Configuration
// This file contains all QR-related settings and can be easily maintained

export const QR_CONFIG = {
  // QR Code appearance settings
  appearance: {
    size: 240,
    fgColor: "#00000",
    bgColor: "#ffffff",
    level: "M", // Error correction level: L, M, Q, H
  },

  // Pass validity settings
  validity: {
    defaultDurationHours: 24,
    maxDurationHours: 72,
    minDurationHours: 1,
  },

  // Display settings for generated pass
  display: {
    logoSize: {
      width: 45,
      height: "auto"
    },
    showElements: {
      logo: true,
      title: true,
      qrCode: true,
      userInfo: true,
      visitorInfo: true,
      gateInfo: true,
      validityInfo: true,
    },
    layout: {
      padding: 2,
      spacing: 1,
      textAlign: "center",
    }
  },

  // Information fields to display on the pass
  infoFields: {
    user: {
      name: true,
      building: true,
      apartment: true,
    },
    visitor: {
      name: true,
    },
    gate: {
      name: true,
      location: false, // Can be enabled to show gate location
    },
    validity: {
      endDate: true,
      startDate: false,
    }
  },

  // Export/Share settings
  export: {
    defaultFileName: "pass",
    imageFormat: "png",
    imageQuality: 1,
    scale: 2, // For high-resolution export
  },

  // API settings
  api: {
    endpoint: "https://gh.darmasr2.com/api/Visitor/AddVisitor",
    headers: {
      "X-Internal": "web_APP",
      "Content-Type": "application/json",
    },
    timeout: 30000, // 30 seconds
  },

  // Analytics settings
  analytics: {
    trackGeneration: true,
    trackDownload: true,
    trackShare: true,
    eventNames: {
      generation: "Qr_Generated",
      download: "Qr_Downloaded",
      share: "Qr_Shared",
    }
  }
};

// Helper functions for QR configuration
export const getQRSize = () => QR_CONFIG.appearance.size;
export const getValidityHours = () => QR_CONFIG.validity.defaultDurationHours;
export const getAPIEndpoint = () => QR_CONFIG.api.endpoint;
export const shouldShowElement = (element) => QR_CONFIG.display.showElements[element] || false;
export const getInfoField = (category, field) => QR_CONFIG.infoFields[category]?.[field] || false;

// Function to get formatted info fields for display in grid format
export const getDisplayFields = (lang, userData, visitorName, gateName) => {
  const fields = [];
  
  // Add inviter name in grid format
  if (getInfoField('user', 'name')) {
    fields.push(`${lang.inviter}\t\t${userData.name}`);
  }
  
  // Add visitor name in grid format
  if (getInfoField('visitor', 'name') && visitorName && visitorName.trim()) {
    fields.push(`${lang.visitorName}\t\t${visitorName}`);
  }
  
  // Add building and apartment on same line
  const locationParts = [];
  if (getInfoField('user', 'apartment') && userData.flat) {
    locationParts.push(`${lang.apartment} ${userData.flat}`);
  }
  if (getInfoField('user', 'building') && userData.building) {
    locationParts.push(`${lang.building} ${userData.building}`);
  }
  
  if (locationParts.length > 0) {
    fields.push(`${lang.unit}\t\t${locationParts.join(' ')}`);
  }
  
  return fields.join('\n');
};

// Function to get formatted validity info
export const getValidityDisplay = (lang, endDate, gateName, isRtl = false) => {
  const parts = [];
  
  // Add gate name first
  if (getInfoField('gate', 'name') && gateName) {
    parts.push(gateName);
  }
  
  // Add date last, formatted in Arabic if RTL
  if (getInfoField('validity', 'endDate')) {
    const dateObj = endDate instanceof Date ? endDate : new Date(endDate);
    
    if (isRtl) {
      // Format date in Arabic
      const arabicDate = dateObj.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
      parts.push(arabicDate);
    } else {
      // Format date in English
      const englishDate = dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
      parts.push(englishDate);
    }
  }
  
  return parts.join(' • ');
};

export default QR_CONFIG;