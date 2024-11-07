import React, { useContext, useState, useRef, useEffect } from "react";
import QRCode from "react-qr-code";
import Button from "@mui/material/Button";
import { Box, Typography, Container } from "@mui/material";
import { ShareRounded, DownloadingRounded } from "@mui/icons-material";
import axios from "axios";
import en from "../../src/locales/en.json";
import ar from "../../src/locales/ar.json";
import { firestore } from "./firebaseApp";
import * as html2canvas from "html2canvas";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

import { uid } from "./UserPanel";
import { useValue } from "./ContextProvider";
import { RtlContext } from "./RtlContext";

import { toBlob } from "html-to-image";
function QRCodePanel() {
  const [qrCodeComponent, setQRCodeComponent] = useState(null);
  const { state } = useValue();
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();

  const [passMessage, setPassMessage] = useState("");
  const [hiddenEndDate, setHiddenEndDate] = useState("");
  const [hiddenData, setHiddenData] = useState("");

  const [qrImageUrl, setQrImageUrl] = useState("");

  const lang = isRtl ? ar : en;

  const pageRef = useRef();

  const hasGeneratedQR = useRef(false); // Ref to track whether the QR code is already generated

  useEffect(() => {
    if (!hasGeneratedQR.current) {
      GenerateQRCode(); // Call QR code generation once on component load
      hasGeneratedQR.current = true; // Mark it as generated
    }
  }, []); // This effect only runs once, right after the initial render

  useEffect(() => {
    // This will run whenever the language changes
    setPassMessage(lang.passMessage);
    setHiddenEndDate(formatDate(Date.now() + 24 * 60 * 60 * 1000, false));
    setHiddenData(
      `${lang.name} : ${state.currentUser.name} ${lang.building} : ${state.currentUser.building} ${lang.apartment} : ${state.currentUser.flat}`
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
        },});
      return;
    }

    const json = JSON.stringify({ hostID: state.currentUser.id });

    const response = await axios.post(
      "https://darmasr.ddns.net/api/Visitor/AddVisitor",
      json,
      {
        headers: {
          "X-Internal": "web_APP",
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      }
    );

    if (response.status === 200) {
      const cardNo = response.data["cardNo"];

      if (!qrCodeComponent) {
        setQRCodeComponent(
          <QRCode size={280} fgColor="#2D8736" value={cardNo.toString()} />
        );
      }


    captureQRCodeImage();
    // Set hidden data and visibility logic
    document.getElementById("passMessage").textContent = lang.passMessage;
    document.getElementById("hiddenEndDate").textContent = formatDate(
      Date.now() + 24 * 60 * 60 * 1000,
      false
    );
    document.getElementById(
      "hiddenData"
    ).textContent = `${lang.name} : ${state.currentUser.name} ${lang.building} : ${state.currentUser.building} ${lang.apartment} : ${state.currentUser.flat}`;

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
    } else {
      dispatch({ type: "END_LOADING" });
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.failedGenerate,
        },});
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

  const handleShare = async (element) => {
    const textElements = element.querySelectorAll(
      "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
    );
    
    const originalColors = [];
  
    // Save original colors and set text color to black
    textElements.forEach((el, index) => {
      originalColors[index] = el.style.color;
      el.style.color = "black"; // Set to black for download
    });
  
    element.style.fontFamily = "Tajawal, sans-serif"; // Ensure the font is inline



    let newFile;
    try {
  
  

    
      // Convert the element to a Blob image using toBlob function
      newFile = await toBlob(element); // Ensure toBlob is working correctly
    } catch (error) {
      console.error("Error generating the blob:", error);
      return;
    }
  
    const data = {
      files: [
        new File([newFile], "pass.png", {
          type: newFile.type,
        }),
      ],
      title: lang.darMisr,
      text: lang.passMessage,
    };
  
    // Share the content using the Web Share API
    try {
      if (navigator.canShare && navigator.canShare(data)) {
        await navigator.share(data);
      } else {
        console.error("Sharing is not supported or the data cannot be shared.");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    } finally {
      // Always restore the original text colors
      textElements.forEach((el, index) => {
        el.style.color = originalColors[index];
      });
    }
  };

  // async function handleShare(element) {
  //   const textElements = element.querySelectorAll(
  //     "p, h4, span, #passMessage, #hiddenData, #hiddenEndDate"
  //   );
  //   const originalColors = [];

  //   textElements.forEach((el, index) => {
  //     originalColors[index] = el.style.color; // Save original color
  //     el.style.color = "black"; // Set to black for download
  //   });

  //   try {
  //     const canvas = await html2canvas(element, { scale: 2 });
  //     const image = canvas.toDataURL("image/png");

  //     // Convert the base64 image to a Blob
  //     const byteString = atob(image.split(",")[1]); // Decode base64 string
  //     const arrayBuffer = new ArrayBuffer(byteString.length);
  //     const uint8Array = new Uint8Array(arrayBuffer);

  //     for (let i = 0; i < byteString.length; i++) {
  //       uint8Array[i] = byteString.charCodeAt(i);
  //     }

  //     const blob = new Blob([uint8Array], { type: "image/png" });
  //     const imageUrl = URL.createObjectURL(blob);

  //     // Share via Web Share API
  //     if (navigator.share) {
  //       navigator
  //         .share({
  //           title: lang.darMisr,
  //           text: lang.passMessage,
  //           url: imageUrl, // This is the image URL to share
  //         })
  //         .catch((error) => {
  //           console.error("Error sharing:", error);
  //           dispatch({
  //             type: "UPDATE_ALERT",
  //             payload: {
  //               open: true,
  //               severity: "error",
  //               title: lang.error,
  //               message: lang.failed,
  //             },
  //           });
  //         });
  //     } else {
  //       dispatch({
  //         type: "UPDATE_ALERT",
  //         payload: {
  //           open: true,
  //           severity: "warning",
  //           title: lang.warning,
  //           message: lang.shareUnsupported,
  //         },
  //       });
  //     }
  //   } catch (error) {
  //     dispatch({
  //       type: "UPDATE_ALERT",
  //       payload: {
  //         open: true,
  //         severity: "error",
  //         title: lang.error,
  //         message: lang.failed,
  //       },
  //     });

  //     textElements.forEach((el, index) => {
  //       el.style.color = originalColors[index];
  //     });
  //   }
  // }

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

  return (
    <Container component="main" maxWidth="xs">
      <div id="qrCode" ref={pageRef} style={{ visibility: "hidden" }}>
        <Box
          sx={{
            padding: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <img
            src={require("../images/logo192.png")}
            width={50}
            height="auto"
            alt=""
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
