import React, { useContext, useState, useRef, useEffect } from "react";
import QRCode from "react-qr-code";
import Button from "@mui/material/Button";
import {
  Box,
  Typography,
  Container,
  styled,
  Paper,
  CssBaseline,
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

function QRCodePanel() {
  const [qrCodeComponent, setQRCodeComponent] = useState(null);
  const { state } = useValue();
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();
  const gateConfig = useGateConfig();

  const navigate = useNavigate();

  const [passMessage, setPassMessage] = useState("");
  const [hiddenEndDate, setHiddenEndDate] = useState("");
  const [apiVersion, setApiVersion] = useState("");
  const [hiddenData, setHiddenData] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");

  const lang = isRtl ? ar : en;
  const [endDate, setEndDate] = useState(
    formatDate(Date.now() + 24 * 60 * 60 * 1000, false)
  );
  const pageRef = useRef();

  const [selectedGate, setSelectedGate] = useState(0); // State for selected gate (1 or 3)
  const getGateName = (gateNumber) => {
    switch (gateNumber) {
      case 1:
        return gateConfig.gate_1.text[isRtl ? "ar" : "en"];
      case 3:
        return gateConfig.gate_3.text[isRtl ? "ar" : "en"];
      case 4:
        return gateConfig.gate_4.text[isRtl ? "ar" : "en"];
      case 5:
        return gateConfig.gate_5.text[isRtl ? "ar" : "en"];
      default:
        return gateConfig.gate_1.text[isRtl ? "ar" : "en"]; // Default to Gate 1
    }
  };

  useEffect(() => {
    if (selectedGate === 0) return;
    else {
      GenerateQRCode();
    }
  }, [selectedGate]);
  useEffect(() => {
    setPassMessage(lang.passMessage);

    let selectedGateName = setHiddenEndDate(endDate + ` | ${getGateName}`);
    setHiddenEndDate(endDate + ` | ${getGateName}`);
    setHiddenData(
      `${lang.name} : ${state.currentUser.name} | ${lang.building} : ${state.currentUser.building} | ${lang.apartment} : ${state.currentUser.flat}`
    );
  }, [lang, state.currentUser]);

  async function GenerateQRCode() {
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
    });

    try {
      const response = await axios.post(
        "https://gh.darmasr2.com/api/Visitor/AddVisitor",
        json,
        {
          headers: {
            "X-Internal": "web_APP",
            "Content-Type": "application/json",
            "Accept-Language": isRtl ? "ar" : "en",
            Authorization: "Bearer " + token,
            "X-API-Version": version,
          },
        }
      );

      if (response.status === 200) {
        const cardNo = response.data["cardNo"];
        console.error("response:", response.data);

        if (response.data["gatesResult"][0]["success"]) {

          logEvent(analytics, "Qr_Generated", { Gate: selectedGate,
            timestamp: Date.now() });
          if (!qrCodeComponent) {
            setQRCodeComponent(
              <QRCode size={280} fgColor="#00000" value={cardNo.toString()} />
            );
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);

            setEndDate(formatDate(tomorrow, false));
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
        setHiddenEndDate(endDate + ` | ${getGateName(selectedGate)}`);
        setHiddenData(
          `${lang.name} : ${state.currentUser.name} | ${lang.building} : ${state.currentUser.building} | ${lang.apartment} : ${state.currentUser.flat}`
        );

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
  }

  async function captureQRCodeImage() {
    const canvas = await html2canvas(pageRef.current, { scale: 2 });
    const image = canvas.toDataURL("image/png");
    setQrImageUrl(image); // Store the generated image URL
  }
  async function getSharedToken() {
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
  }

  async function handleDownload(element, imageFileName) {
    const textElements = element.querySelectorAll(
      "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
    );
    const originalColors = [];

    textElements.forEach((el, index) => {
      originalColors[index] = el.style.color; // Save original color
      el.style.color = "black"; // Set to black for download
    });
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = imageFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      textElements.forEach((el, index) => {
        el.style.color = originalColors[index];
      });
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

      textElements.forEach((el, index) => {
        el.style.color = originalColors[index];
      });
    }
  }

  const getGateMessage = (selectedGate) => {
    let gateLocation;
    switch (selectedGate) {
      case 1:
        gateLocation = lang.Gate1Location;
        break;
      case 3:
        gateLocation = lang.Gate3Location;
        break;
      case 4:
        gateLocation = lang.Gate4Location;
        break;
      default:
        gateLocation = lang.Gate1Location; // default to Gate 1
    }

    return `${lang.passMessage}\n${gateLocation}`;
  };

  const handleShare = async (element) => {
    const textElements = element.querySelectorAll(
      "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
    );

    const originalColors = [];
    const originalBackground = element.style.backgroundColor;

    // Save original colors and set text color to black
    textElements.forEach((el, index) => {
      originalColors[index] = el.style.color;
      el.style.color = "black"; // Set to black for download
    });
    element.style.backgroundColor = "white";
    element.style.fontFamily = "Tajawal, sans-serif"; // Ensure the font is inline

    let newFile;
    try {
      // Convert the element to a Blob image using toBlob function
      newFile = await toBlob(element); // Ensure toBlob is working correctly
    } catch (error) {
      console.error("Error generating the blob:", error);
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
      // Always restore the original text colors
      textElements.forEach((el, index) => {
        el.style.color = originalColors[index];
        element.style.backgroundColor = originalBackground;
      });
    }
  };

  function formatDate(string, bool) {
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
  }
  const Panel = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    textAlign: "center",
  }));

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const logoVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.5, delay: 0.2 },
    },
  };
  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.6 } },
  };
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
          <Typography variant="caption" id="hiddenData">
            {hiddenData}
          </Typography>
          <Typography variant="caption" id="hiddenEndDate">
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
