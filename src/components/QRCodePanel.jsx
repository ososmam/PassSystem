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
import { firestore } from "./firebaseApp";
import * as html2canvas from "html2canvas";
import {
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { useValue } from "./ContextProvider";
import { RtlContext } from "./RtlContext";

import { toBlob } from "html-to-image";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function QRCodePanel() {
  const [qrCodeComponent, setQRCodeComponent] = useState(null);
  const { state } = useValue();
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();

  const navigate = useNavigate();

  const [passMessage, setPassMessage] = useState("");
  const [hiddenEndDate, setHiddenEndDate] = useState("");
  const [hiddenData, setHiddenData] = useState("");

  const [qrImageUrl, setQrImageUrl] = useState("");

  const lang = isRtl ? ar : en;
  const [endDate, setEndDate] = useState(
    formatDate(Date.now() + 24 * 60 * 60 * 1000, false)
  );
  const pageRef = useRef();

  // const hasGeneratedQR = useRef(false); // Ref to track whether the QR code is already generated
  const [selectedGate, setSelectedGate] = useState(0); // State for selected gate (1 or 3)
  const getGateName = (gateNumber) => {
    switch(gateNumber) {
      case 1: return lang.gate1;
      case 3: return lang.gate3;
      case 4: return lang.gate4;
      default: return lang.gate1; // Default to Gate 1
    }
  };
  // useEffect(() => {
  //   if (!hasGeneratedQR.current) {
  //     GenerateQRCode(); // Call QR code generation once on component load
  //     hasGeneratedQR.current = true; // Mark it as generated
  //   }
  // }, []); // This effect only runs once, right after the initial render
  useEffect(() => {
    if (selectedGate === 0) return;
    else {
      GenerateQRCode();
    }
  }, [selectedGate]);
  useEffect(() => {
    // This will run whenever the language changes
    setPassMessage(lang.passMessage);

    let selectedGateName = 
    setHiddenEndDate(
      endDate + ` | ${getGateName}`
    );
    setHiddenData(
      `${lang.name} : ${state.currentUser.name} | ${lang.building} : ${state.currentUser.building} | ${lang.apartment} : ${state.currentUser.flat}`
    );
  }, [lang, state.currentUser]);

  async function GenerateQRCode() {
    // Prevent further POST requests
    dispatch({ type: "START_LOADING" });

    const token = await getSharedToken();
    if (!token) {
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

    const json = JSON.stringify({
      hostId: state.currentUser.id,
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
          },
        }
      );

      if (response.status === 200) {
        const cardNo = response.data["cardNo"];
        console.error("response:", response.data);

        if (response.data["gatesResult"][0]["success"]) {
          if (!qrCodeComponent) {
            setQRCodeComponent(
              <QRCode size={280} fgColor="#00000" value={cardNo.toString()} />
            );
            setEndDate(formatDate(Date.now() + 24 * 60 * 60 * 1000, false));
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
          endDate + ` | ${getGateName(selectedGate)}`
        );
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
    const tokenDoc = await getDoc(doc(firestore, "common", "sharedToken"));
    if (tokenDoc.exists()) {
      return tokenDoc.data().token;
    } else {
      console.error("No shared token found.");
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
    switch(selectedGate) {
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
      text: `${lang.passMessage}\n${getGateName(selectedGate)}\n${hiddenData}\n${hiddenEndDate}`
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
          url: qrImageUrl // Share the image URL if available
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
                  width={100}
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

                  <Button
                    disabled={true}
                    variant="contained"
                    sx={{ mt: 3, mb: 1.5 }}
                    fullWidth
                    onClick={() => {
                      setSelectedGate(1);
                    }}
                  >
                    {lang.gate1}
                  </Button>
                  <Button
                    variant="contained"
                    sx={{ mt: 1.5, mb: 2 }}
                    fullWidth
                    onClick={() => {
                      setSelectedGate(3);
                    }}
                  >
                    {lang.gate3}
                  </Button>

                  <Button
                    //  disabled={true}
                    variant="contained"
                    sx={{ mt: 1.5, mb: 2 }}
                    fullWidth
                    onClick={() => {
                      setSelectedGate(4);
                    }}
                  >
                    {lang.gate4}
                  </Button>
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
