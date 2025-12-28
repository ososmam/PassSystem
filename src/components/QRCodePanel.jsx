import React, { useContext, useState, useRef, useEffect, useCallback, useMemo } from "react";
import QRCode from "react-qr-code";
import Button from "@mui/material/Button";
import {
  Box,
  Typography,
  Container,
  styled,
  Paper,
  CssBaseline,
  TextField,
} from "@mui/material";
import { ShareRounded, DownloadingRounded } from "@mui/icons-material";
import axios from "axios";
import en from "../../src/locales/en.json";
import ar from "../../src/locales/ar.json";
import { firestore, analytics } from "./firebaseApp";
import * as html2canvas from "html2canvas";
import {
  getDoc,
  doc,
} from "firebase/firestore";

import { useValue } from "./ContextProvider";
import { RtlContext } from "./RtlContext";

import { toBlob } from "html-to-image";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GateButtons, useGateConfig } from "./GateButtons";
import { logEvent } from "firebase/analytics";
import { 
  QR_CONFIG, 
  getQRSize, 
  getValidityHours, 
  getAPIEndpoint, 
  shouldShowElement, 
  getDisplayFields, 
  getValidityDisplay 
} from "../config/qrConfig";

function QRCodePanel() {
  const [qrCodeComponent, setQRCodeComponent] = useState(null);
  const { state } = useValue();
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();
  const gateConfig = useGateConfig();

  const navigate = useNavigate();

  const [passMessage, setPassMessage] = useState("");
  const [hiddenEndDate, setHiddenEndDate] = useState("");
  const [hiddenData, setHiddenData] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");

  const lang = useMemo(() => isRtl ? ar : en, [isRtl]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + getValidityHours() * 60 * 60 * 1000)
  );
  const pageRef = useRef();

  const [selectedGate, setSelectedGate] = useState(0); // State for selected gate (1 or 3)
  const [visitorName, setVisitorName] = useState(""); // State for visitor name
  const [showNameInput, setShowNameInput] = useState(false); // State to show name input
  const [isSubmitting, setIsSubmitting] = useState(false); // State to prevent double submission
  const visitorNameRef = useRef(null);
  
  const formatDate = useCallback((string, bool) => {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    };
    return new Date(string).toLocaleDateString(
      bool ? (isRtl ? "ar-EG" : "en") : [],
      options
    );
  }, [isRtl]);
  
  const captureQRCodeImage = useCallback(async () => {
    const canvas = await html2canvas(pageRef.current, { scale: 2 });
    const image = canvas.toDataURL("image/png");
    setQrImageUrl(image); // Store the generated image URL
  }, []);

  const getGateName = useCallback((gateNumber) => {
    if (!gateConfig) return "";
    
    const language = isRtl ? 'ar' : 'en';
    switch (gateNumber) {
      case 1:
        return gateConfig.gate_1?.text?.[language] || "";
      case 3:
        return gateConfig.gate_3?.text?.[language] || "";
      case 4:
        return gateConfig.gate_4?.text?.[language] || "";
      case 5:
        return gateConfig.gate_5?.text?.[language] || "";
      default:
        return "";
    }
  }, [gateConfig, isRtl]);

  const getSharedToken = useCallback(async () => {
    try {
      const [tokenDoc, apiVersionDoc] = await Promise.all([
        getDoc(doc(firestore, "common", "sharedToken")),
        getDoc(doc(firestore, "api_config", "version_settings"))
      ]);
  
      if (!tokenDoc.exists()) {
        console.error("No shared token found.");
        return null;
      }
  
      let requiredVersion = "1.0"; // default fallback
      if (apiVersionDoc.exists()) {
        requiredVersion = apiVersionDoc.data().required_version;
        console.log("Required API Version:", requiredVersion);
      } else {
        console.warn("No API version config found, using default");
      }
  
      return {
        token: tokenDoc.data().token,
        version: requiredVersion
      };
  
    } catch (error) {
      console.error("Error fetching config:", error);
      return null;
    }
  }, []);
 
   const GenerateQRCode = useCallback(async (nameToUse = visitorName) => {
    // Prevent further POST requests
    dispatch({ type: "START_LOADING" });
    const result = await getSharedToken();
    if (!result) {
      dispatch({ type: "END_LOADING" });
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.failed,
        },
      });
      return;
    }
    const { token, version } = result;
    const json = JSON.stringify({
      hostId: state.currentUser.firebaseDocumentId,
      gateId: selectedGate,
      name: nameToUse
    });

    try {
      const response = await axios.post(
        getAPIEndpoint(),
        json,
        {
          headers: {
            ...QR_CONFIG.api.headers,
            "Accept-Language": isRtl ? "ar" : "en",
            Authorization: "Bearer " + token,
            "X-API-Version": version,
          },
          timeout: QR_CONFIG.api.timeout,
        }
      );

      if (response.status === 200) {
        const cardNo = response.data["cardNo"];
        console.error("response:", response.data);

        if (response.data["gatesResult"][0]["success"]) {

          if (QR_CONFIG.analytics.trackGeneration) {
            logEvent(analytics, QR_CONFIG.analytics.eventNames.generation, {
              user_id: state.currentUser.id,
              gate: selectedGate,
              name: visitorName,
            });
          }
          if (!qrCodeComponent) {
            setQRCodeComponent(
              <QRCode 
                size={getQRSize()} 
                fgColor={QR_CONFIG.appearance.fgColor} 
                bgColor={QR_CONFIG.appearance.bgColor}
                level={QR_CONFIG.appearance.level}
                value={cardNo.toString()} 
              />
            );
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);

            setEndDate(tomorrow);
          }
        } else {
          dispatch({ type: "END_LOADING" });
          setSelectedGate(0);
          dispatch({
            type: "UPDATE_ALERT",
            payload: {
              open: true,
              severity: "error",
              title: lang.error,
              message: lang.failedGenerate,
            },
          });
          return;
        }

        captureQRCodeImage();
        // Set hidden data and visibility logic

        setPassMessage(lang.passMessage);
        setHiddenEndDate(
          getValidityDisplay(lang, endDate, getGateName(selectedGate), isRtl)
        );
        // Note: setHiddenData is handled by useEffect when visitorName changes

        document.getElementById("qrCode").style.visibility = "visible";
        document.getElementById("qr-download").style.visibility = "visible";
        document.getElementById("Message").style.visibility = "visible";
        dispatch({ type: "END_LOADING" });
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "success",
            title: lang.success,
            message: lang.genrateCompleted,
          },
        });
      }
    } catch (error) {
      // Handle 400 status with specific message
      dispatch({ type: "END_LOADING" });

      if (
        error.response &&
        error.response.status === 400 &&
        error.response.data === "Visitor creation limit reached for today."
      ) {
        navigate("/home");
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "error",
            title: lang.error,
            message: lang.maxPassReached,
          },
        });
      } else {
        navigate("/home");
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "error",
            title: lang.error,
            message: lang.failedGenerate,
          },
        });
      }
    }
  }, [selectedGate, state.currentUser.firebaseDocumentId, state.currentUser.building, state.currentUser.flat, state.currentUser.name, isRtl, lang, dispatch, navigate, getGateName, endDate, captureQRCodeImage, formatDate, getSharedToken, qrCodeComponent]);

  useEffect(() => {
    if (selectedGate === 0) return;
    else {
      setShowNameInput(true);
    }
  }, [selectedGate]);

  const handleVisitorNameBlur = useCallback(() => {
    if (visitorNameRef.current) {
      setVisitorName(visitorNameRef.current.value);
    }
  }, []);

  const handleVisitorNameSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    const currentValue = visitorNameRef.current?.value || visitorName;
    if (!currentValue.trim()) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.visitorNameRequired,
        },
      });
      setIsSubmitting(false);
      return;
    }
    
    setVisitorName(currentValue);
    setShowNameInput(false);
    
    try {
      // Pass the current value directly to GenerateQRCode to avoid timing issues
      await GenerateQRCode(currentValue);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, visitorName, dispatch, lang.error, lang.visitorNameRequired, GenerateQRCode]);

  useEffect(() => {
    setPassMessage(lang.passMessage);
    setHiddenData(
      getDisplayFields(lang, state.currentUser, visitorName, getGateName(selectedGate))
    );
  }, [lang, state.currentUser, visitorName, getGateName, selectedGate]);

  const handleDownload = useCallback(async (element, imageFileName) => {
    const textElements = element.querySelectorAll(
      "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
    );
    const originalColors = [];
    const originalBackgrounds = [];
    const originalBorders = [];
    const originalBackground = element.style.backgroundColor;
    const originalHeight = element.style.height;
    const originalMinHeight = element.style.minHeight;

    // Find the main container
    const container = element.querySelector('div > div[style*="display: flex"]') || element.querySelector('div[style*="display: flex"]') || element.firstElementChild;
    
    if (!container) {
      console.error("Container not found for export");
      return;
    }

    // Save original container styles
    const originalJustifyContent = container.style.justifyContent;
    const originalFlexDirection = container.style.flexDirection;
    const originalContainerHeight = container.style.height;

    textElements.forEach((el, index) => {
      originalColors[index] = el.style.color; // Save original color
      originalBackgrounds[index] = el.style.backgroundColor; // Save original background
      originalBorders[index] = el.style.border; // Save original border
      
      el.style.color = "black"; // Set to black for download
      
      // Apply light mode styling to rounded box elements
      if (el.id === 'hiddenData') {
        el.style.backgroundColor = "#f5f5f5";
        el.style.border = "1px solid #e0e0e0";
      }
    });
    
    // Set export dimensions and styles
    element.style.backgroundColor = "white";
    element.style.fontFamily = "Tajawal, sans-serif";
    element.style.height = "100vh";
    element.style.minHeight = "100vh";
    element.style.alignItems = "center";
    
    // Apply space-between layout to container
    container.style.height = "100%";
    
    container.style.justifyContent = "space-between";
    container.style.flexDirection = "column";
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        height: window.innerHeight * 0.85,
        windowHeight: window.innerHeight * 0.85
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = imageFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Restore original styles
      const restoredTextElements = element.querySelectorAll(
        "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
      );
      restoredTextElements.forEach((el, index) => {
        if (originalColors[index]) el.style.color = originalColors[index];
        if (originalBackgrounds[index]) el.style.backgroundColor = originalBackgrounds[index];
        if (originalBorders[index]) el.style.border = originalBorders[index];
      });
      element.style.backgroundColor = originalBackground;
      element.style.height = originalHeight;
      element.style.minHeight = originalMinHeight;
      container.style.justifyContent = originalJustifyContent;
      container.style.flexDirection = originalFlexDirection;
      container.style.height = originalContainerHeight;

    } catch (error) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.failed,
        },
      });

      // Restore original styles on error
      const restoredTextElements = element.querySelectorAll(
        "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
      );
      restoredTextElements.forEach((el, index) => {
        if (originalColors[index]) el.style.color = originalColors[index];
        if (originalBackgrounds[index]) el.style.backgroundColor = originalBackgrounds[index];
        if (originalBorders[index]) el.style.border = originalBorders[index];
      });
      element.style.backgroundColor = originalBackground;
      element.style.height = originalHeight;
      element.style.minHeight = originalMinHeight;
      container.style.justifyContent = originalJustifyContent;
      container.style.flexDirection = originalFlexDirection;
      container.style.height = originalContainerHeight;
    }
  }, [lang, dispatch]);

  const handleShare = useCallback(async (element) => {
    const textElements = element.querySelectorAll(
      "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
    );

    const originalColors = [];
    const originalBackgrounds = [];
    const originalBorders = [];
    const originalBackground = element.style.backgroundColor;
    const originalHeight = element.style.height;
    const originalMinHeight = element.style.minHeight;

    // Find the main container
    const container = element.querySelector('div > div[style*="display: flex"]') || element.querySelector('div[style*="display: flex"]') || element.firstElementChild;
    
    if (!container) {
      console.error("Container not found for export");
      return;
    }

    // Save original container styles
    const originalJustifyContent = container.style.justifyContent;
    const originalFlexDirection = container.style.flexDirection;
    const originalContainerHeight = container.style.height;

    // Save original colors and set text color to black
    textElements.forEach((el, index) => {
      originalColors[index] = el.style.color;
      originalBackgrounds[index] = el.style.backgroundColor;
      originalBorders[index] = el.style.border;
      
      el.style.color = "black"; // Set to black for download
      
      // Apply light mode styling to rounded box elements
      if (el.id === 'hiddenData') {
        el.style.backgroundColor = "#f5f5f5";
        el.style.border = "1px solid #e0e0e0";
      }
    });
    
    // Set export dimensions and styles
    element.style.backgroundColor = "white";
    element.style.fontFamily = "Tajawal, sans-serif";
    element.style.height = "75vh";
    element.style.minHeight = "75vh";
  
    element.style.alignItems = "center";

    // Apply space-between layout to container
    container.style.height = "100%";
    container.style.justifyContent = "space-between";
    container.style.flexDirection = "column";

    let newFile;
    try {
      // Convert the element to a Blob image using toBlob function with 90% height
      newFile = await toBlob(element, {
        height: window.innerHeight * 0.85,
        windowHeight: window.innerHeight * 0.85
      });
    } catch (error) {
      console.error("Error generating the blob:", error);
      
      // Restore original styles on error
      const restoredTextElements = element.querySelectorAll(
        "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
      );
      restoredTextElements.forEach((el, index) => {
        if (originalColors[index]) el.style.color = originalColors[index];
        if (originalBackgrounds[index]) el.style.backgroundColor = originalBackgrounds[index];
        if (originalBorders[index]) el.style.border = originalBorders[index];
      });
      element.style.backgroundColor = originalBackground;
      element.style.height = originalHeight;
      element.style.minHeight = originalMinHeight;
      container.style.justifyContent = originalJustifyContent;
      container.style.flexDirection = originalFlexDirection;
      container.style.height = originalContainerHeight;
      return;
    }

    // Create the share data with both image and text
    const data = {
      files: [
        new File([newFile], "pass.jpg", {
          type: newFile.type,
        }),
      ],
      title: lang.darMisr,
      text: `${lang.passMessage}\n${getGateName(
        selectedGate
      )}\n${hiddenData}\n${hiddenEndDate}`,
    };

    // Share the content using the Web Share API
    try {
      if (navigator.canShare && navigator.canShare(data)) {
        await navigator.share(data);
      } else {
        // Fallback for browsers that don't support sharing files
        await navigator.share({
          title: lang.darMisr,
          text: data.text,
          url: qrImageUrl, // Share the image URL if available
        });
      }
    } catch (err) {
      console.error("Error sharing:", err);
      // Fallback copy to clipboard
      try {
        await navigator.clipboard.writeText(data.text);
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "info",
            title: lang.info,
            message: lang.copiedToClipboard,
          },
        });
      } catch (clipboardErr) {
        console.error("Copy to clipboard failed:", clipboardErr);
      }
    } finally {
      // Restore original styles
      const restoredTextElements = element.querySelectorAll(
        "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
      );
      restoredTextElements.forEach((el, index) => {
        if (originalColors[index]) el.style.color = originalColors[index];
        if (originalBackgrounds[index]) el.style.backgroundColor = originalBackgrounds[index];
        if (originalBorders[index]) el.style.border = originalBorders[index];
      });
      element.style.backgroundColor = originalBackground;
      element.style.height = originalHeight;
      element.style.minHeight = originalMinHeight;
      container.style.justifyContent = originalJustifyContent;
      container.style.flexDirection = originalFlexDirection;
      container.style.height = originalContainerHeight;
      
    }
  }, [qrImageUrl, lang, dispatch, getGateName, hiddenData, hiddenEndDate, selectedGate]);
  
  const Panel = useMemo(() => styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    textAlign: "center",
  })), []);

  const containerVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }), []);

  const logoVariants = useMemo(() => ({
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.5, delay: 0.2 },
    },
  }), []);
  
  const buttonVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.6 } },
  }), []);
  return (
    <Container component="main" maxWidth="xs">
      {selectedGate === 0 && (
        <>
          <div id="gateSelection">
            <CssBaseline />
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                m:1.5
              }}
              component={motion.div} // Animate the container
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Panel
                sx={{ width: "100%" }}
                component={motion.div} // Animate the panel
                variants={containerVariants}
              >
                <motion.img
                  src={require("../images/logo192.png")}
                  width={70}
                  height={"auto"}
                  alt=""
                  variants={logoVariants} // Animate the logo
                  initial="hidden"
                  animate="visible"
                />
                <motion.div
                  variants={buttonVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <br />
                  <Typography variant="h5">{lang.selectGate}</Typography>

                  <GateButtons setSelectedGate={setSelectedGate} />
                </motion.div>
              </Panel>
            </Box>
          </div>
        </>
      )}
      {showNameInput && (
        <>
          <div id="visitorNameInput">
            <CssBaseline />
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                m: 1.5
              }}
              component={motion.div}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Panel
                sx={{ width: "100%" }}
                component={motion.div}
                variants={containerVariants}
              >
                <motion.img
                  src={require("../images/logo192.png")}
                  width={70}
                  height={"auto"}
                  alt=""
                  variants={logoVariants}
                  initial="hidden"
                  animate="visible"
                />
                <motion.div
                  variants={buttonVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <br />
                  <Typography variant="h5">{lang.enterVisitorName}</Typography>
                  <br />
                  <form onSubmit={handleVisitorNameSubmit}>
                    <TextField
                        fullWidth
                        label={lang.visitorName}
                        inputRef={visitorNameRef}
                        defaultValue={visitorName}
                        onBlur={handleVisitorNameBlur}
                        variant="outlined"
                        sx={{ mt: 2, mb: 2 }}
                        required
                      />
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={isSubmitting}
                      sx={{ mt: 1, mb: 2 }}
                    >
                      {isSubmitting ? lang.loading || 'Loading...' : lang.genrate}
                    </Button>
                  </form>
                </motion.div>
              </Panel>
            </Box>
          </div>
        </>
      )}
      <div id="qrCode" ref={pageRef} style={{ visibility: "hidden" }}>
        <Box
          sx={{
            padding: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
          component={motion.div} // Animate the container
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.img
            src={require("../images/logo192.png")}
            width={50}
            height="auto"
            alt=""
            variants={logoVariants} // Animate the logo
            initial="hidden"
            animate="visible"
          />
          <Typography variant="h4">{lang.darMisr}</Typography>
          <br />
          {qrCodeComponent}
          <br />
          <Typography 
            variant="body2" 
            id="hiddenData"
            sx={{
              whiteSpace: 'pre',
              lineHeight: 1.8,
              fontWeight: 500,
              color: 'text.primary',
              mb: 2,
              px: 2,
              py: 1.5,
              fontFamily: 'monospace',
              textAlign: 'left',
              display: 'block',
              backgroundColor: 'background.paper',
              borderRadius: '12px',
              border: (theme) => `1px solid ${theme.palette.divider}`,
              direction: 'ltr'
            }}
          >
            {hiddenData}
          </Typography>
          <Typography 
            variant="body2" 
            id="hiddenEndDate"
            sx={{ 
              whiteSpace: 'pre-line', 
              lineHeight: 1.6,
              fontWeight: 400,
              color: 'text.secondary',
              fontStyle: 'italic',
              px: 1,
              direction: 'ltr',
              textAlign: 'center'
            }}
          >
            {hiddenEndDate}
          </Typography>
        </Box>
      </div>

      <Box
        sx={{
          padding: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
        component={motion.div} // Animate the container
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div id="Message" style={{ visibility: "hidden" }}>
          <Typography id="passMessage" variant="body">
            {passMessage}
          </Typography>
        </div>
      </Box>
      <div id="qr-download" style={{ visibility: "hidden" }}>
        <Box
          sx={{
            padding: 1,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            textAlign: "center",
            justifyContent: "center",
            gap: 2,
          }}
          component={motion.div} // Animate the container
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Button
            variant="contained"
            onClick={() => handleDownload(pageRef.current, "pass.png")}
          >
            <DownloadingRounded />
          </Button>

          {qrImageUrl && (
            <>
              <Button
                variant="contained"
                onClick={() => handleShare(pageRef.current)}
              >
                <ShareRounded />
              </Button>
            </>
          )}
        </Box>
      </div>
    </Container>
  );
}

export default QRCodePanel;
