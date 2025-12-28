// Gate Configuration
// This file contains all gate-related settings and can be easily maintained

export const GATE_CONFIG = {
  // Firebase Remote Config settings
  remoteConfig: {
    key: "gate_configuration",
    fallbackConfig: {
      gates: [
        {
          id: "main_gate",
          name: {
            en: "Main Gate",
            ar: "البوابة الرئيسية"
          },
          location: "Building A",
          active: true,
          priority: 1
        },
        {
          id: "side_gate",
          name: {
            en: "Side Gate",
            ar: "البوابة الجانبية"
          },
          location: "Building B",
          active: true,
          priority: 2
        }
      ]
    },
    cacheExpiration: 3600000, // 1 hour in milliseconds
  },

  // Gate display settings
  display: {
    showInactiveGates: false,
    sortBy: "priority", // "priority", "name", "location"
    sortOrder: "asc", // "asc", "desc"
    maxGatesPerRow: 3,
    buttonStyle: {
      minHeight: "48px",
      borderRadius: "8px",
      margin: "4px",
    }
  },

  // Validation settings
  validation: {
    requireGateSelection: true,
    allowMultipleGates: false,
    validateGateAccess: true,
  },

  // Default gate settings
  defaults: {
    selectedGateIndex: 0,
    fallbackGateName: {
      en: "Default Gate",
      ar: "البوابة الافتراضية"
    }
  }
};

// Helper functions for gate configuration
export const getRemoteConfigKey = () => GATE_CONFIG.remoteConfig.key;
export const getFallbackConfig = () => GATE_CONFIG.remoteConfig.fallbackConfig;
export const getCacheExpiration = () => GATE_CONFIG.remoteConfig.cacheExpiration;
export const shouldShowInactiveGates = () => GATE_CONFIG.display.showInactiveGates;
export const getMaxGatesPerRow = () => GATE_CONFIG.display.maxGatesPerRow;
export const getDefaultGateIndex = () => GATE_CONFIG.defaults.selectedGateIndex;

// Function to filter and sort gates
export const processGates = (gates, language = 'en') => {
  if (!gates || !Array.isArray(gates)) {
    return getFallbackConfig().gates;
  }

  let processedGates = gates;

  // Filter inactive gates if needed
  if (!shouldShowInactiveGates()) {
    processedGates = processedGates.filter(gate => gate.active !== false);
  }

  // Sort gates
  const { sortBy, sortOrder } = GATE_CONFIG.display;
  processedGates.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'priority':
        aValue = a.priority || 999;
        bValue = b.priority || 999;
        break;
      case 'name':
        aValue = (a.name?.[language] || a.name?.en || a.id).toLowerCase();
        bValue = (b.name?.[language] || b.name?.en || b.id).toLowerCase();
        break;
      case 'location':
        aValue = (a.location || '').toLowerCase();
        bValue = (b.location || '').toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'desc') {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
    return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
  });

  return processedGates;
};

// Function to get gate name by language
export const getGateName = (gate, language = 'en') => {
  if (!gate) {
    return GATE_CONFIG.defaults.fallbackGateName[language] || GATE_CONFIG.defaults.fallbackGateName.en;
  }
  
  if (typeof gate === 'string') {
    return gate;
  }
  
  return gate.name?.[language] || gate.name?.en || gate.id || 'Unknown Gate';
};

// Function to validate gate selection
export const validateGateSelection = (selectedGate, availableGates) => {
  if (!GATE_CONFIG.validation.requireGateSelection) {
    return true;
  }
  
  if (!selectedGate) {
    return false;
  }
  
  if (!availableGates || availableGates.length === 0) {
    return false;
  }
  
  // Check if selected gate exists in available gates
  return availableGates.some(gate => 
    gate.id === selectedGate || 
    gate === selectedGate ||
    (gate.name && Object.values(gate.name).includes(selectedGate))
  );
};

// Function to get gate by ID
export const getGateById = (gates, gateId) => {
  if (!gates || !Array.isArray(gates)) {
    return null;
  }
  
  return gates.find(gate => gate.id === gateId);
};

export default GATE_CONFIG;