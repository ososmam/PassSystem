import React, { useState, useEffect, useContext } from "react";

import { apiClient } from "../apiClient";
import Button from "@mui/material/Button";
import { RtlContext } from "./RtlContext";

export function useGateConfig() {
  const [gateConfig, setGateConfig] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const gates = await apiClient.getGates(); // Returns list of objects

        // Map list to expected object format for backward compatibility
        /* Expected:
            gate_1: { enabled: bool, text: { en: "Gate 1", ar: "بوابة 1" } }
        */
        const config = {
          gate_1: { enabled: false, text: { en: "Gate 1", ar: "بوابة 1" } },
          gate_3: { enabled: false, text: { en: "Gate 3", ar: "بوابة 3" } },
          gate_4: { enabled: false, text: { en: "Gate 4", ar: "بوابة 4" } },
          gate_5: { enabled: false, text: { en: "Gate 5", ar: "بوابة 5" } }
        };

        const GATE_NAMES = {
          1: { en: "Gate 1", ar: "1 بوابة" },
          3: { en: "Gate 3", ar: "3 بوابة" },
          4: { en: "Gate 4", ar: "4 بوابة" },
          5: { en: "Gate 5", ar: "5 بوابة" }
        };

        if (Array.isArray(gates)) {
          gates.forEach(gate => {
            const key = `gate_${gate.id}`; // keys are lower case in state
            if (config[key]) {
              // Use API 'enabled' or 'Enabled' property, default to false if missing
              config[key].enabled = (gate.enabled !== undefined ? gate.enabled : (gate.Enabled !== undefined ? gate.Enabled : false));

              // Use API provided names if available
              const nameEn = gate.name || gate.Name;
              const nameAr = gate.nameAr || gate.NameAr;

              if (nameEn || nameAr) {
                config[key].text = {
                  en: nameEn || config[key].text.en,
                  ar: nameAr || config[key].text.ar
                };
              }
            }
          });
          setGateConfig(config);
        }
      } catch (error) {
        console.error("Failed to fetch gate config:", error);
        setGateConfig({
          gate_1: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
          gate_3: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
          gate_4: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
          gate_5: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
        });
      }
    };
    fetchConfig();
  }, []);

  return gateConfig;
}

function GateButtons({ setSelectedGate }) {
  const { isRtl } = useContext(RtlContext);
  const gateConfig = useGateConfig();

  if (!gateConfig) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Button
        disabled={!gateConfig.gate_1.enabled}
        variant="contained"
        sx={{ mt: 3, mb: 1.5 }}
        fullWidth
        onClick={() => setSelectedGate(1)}
      >
        {gateConfig.gate_1.text[isRtl ? "ar" : "en"]}
      </Button>
      <Button
        disabled={!gateConfig.gate_3.enabled}
        variant="contained"
        sx={{ mt: 1.5, mb: 2 }}
        fullWidth
        onClick={() => setSelectedGate(3)}
      >
        {gateConfig.gate_3.text[isRtl ? "ar" : "en"]}
      </Button>
      <Button
        disabled={!gateConfig.gate_4.enabled}
        variant="contained"
        sx={{ mt: 1.5, mb: 2 }}
        fullWidth
        onClick={() => setSelectedGate(4)}
      >
        {gateConfig.gate_4.text[isRtl ? "ar" : "en"]}
      </Button>
      <Button
        disabled={!gateConfig.gate_5.enabled}
        variant="contained"
        sx={{ mt: 1.5, mb: 2 }}
        fullWidth
        onClick={() => setSelectedGate(5)}
      >
        {gateConfig.gate_5.text[isRtl ? "ar" : "en"]}
      </Button>
    </>
  );
}

export { GateButtons };