import React, { useState, useEffect, useContext } from "react";

import { remoteConfig } from "./firebaseApp";
import {
    fetchAndActivate,
    getString,
  } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-remote-config.js";

import { Button } from "@mui/material";


import { RtlContext } from "./RtlContext";


export function useGateConfig() {
  const [gateConfig, setGateConfig] = useState(null);

  useEffect(() => {
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour

    fetchAndActivate(remoteConfig)
      .then(() => {
        const configString = getString(remoteConfig, "gate_configuration");
        try {
          const config = JSON.parse(configString);
          setGateConfig(config);
        } catch (error) {
          console.error("Error parsing JSON:", error);
          setGateConfig({
            gate_1: { enabled: false, text: { en: "Error", ar: "خطأ" } },
            gate_3: { enabled: false, text: { en: "Error", ar: "خطأ" } },
            gate_4: { enabled: false, text: { en: "Error", ar: "خطأ" } },
            gate_5: { enabled: false, text: { en: "Error", ar: "خطأ" } }
          });
        }
      })
      .catch((error) => {
        console.error("Remote Config fetch failed:", error);
        setGateConfig({
          gate_1: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
          gate_3: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
          gate_4: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
          gate_5: { enabled: false, text: { en: "Unavailable", ar: "غير متوفر" } },
        });
      });
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