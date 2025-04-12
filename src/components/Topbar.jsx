import { Box, IconButton, useTheme, Typography } from "@mui/material";
import { useContext } from "react";
import { ColorModeContext } from "../theme";
import { firebaseAuth, firestore } from "./firebaseApp";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { useRtl } from "./RtlContext";
import React from "react";
import { useValue } from "./ContextProvider";
import { useNavigate } from "react-router-dom";
import {
  doc,
  updateDoc,
  FieldValue,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import en from "../locales/en.json";
import ar from "../locales/ar.json";
import { deleteFcmTokenToServer } from "./messaging";

const Topbar = () => {
  const theme = useTheme();
  const version = process.env.REACT_APP_VERSION;
  const colorMode = useContext(ColorModeContext);
  const { state, dispatch } = useValue();
  const navigate = useNavigate();
  const isLoggedIn = state.currentUser !== null;

  const { isRtl, toggleRtl } = useRtl();

  const userId = state.currentUser?.id; // Assumes the user's ID is stored in `state.currentUser`
  const handleHome = () => {
    navigate("/home");
  };
  const handleLogout = async () => {
    try {
      if (userId !== "") {
        await deleteFcmTokenToServer(userId);

        const userDocRef = doc(firestore, "hosts", userId);

        try {
          await updateDoc(userDocRef, { deviceId: "" });
        } catch (error) {
          console.error("Error clearing deviceId:", error);
        }
      }
      if (firebaseAuth.currentUser) {
        // Sign out from Firebase
        await firebaseAuth.signOut();
      }
      // Clear user data from local storage and context state
      localStorage.removeItem("deviceId");
      dispatch({ type: "UPDATE_USER", payload: null });

      // Navigate back to login page
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Box display="flex" justifyContent="space-between" p={2}>
      {/* Left-aligned version text */}
      <Box >
      <Typography variant="v" component="div">
        {version} {isRtl ? ar.beta : en.beta}
      </Typography>
        {isLoggedIn && (
          <IconButton onClick={handleLogout}>
            <LogoutOutlinedIcon />
          </IconButton>
        )}
        {isLoggedIn && (
          <IconButton onClick={handleHome}>
            <HomeOutlinedIcon />
          </IconButton>
        )}
      </Box>

      {/* Right-aligned buttons */}
      <Box display="flex" alignItems="center">
        <IconButton onClick={colorMode.toggleColorMode}>
          {theme.palette.mode === "dark" ? (
            <DarkModeOutlinedIcon />
          ) : (
            <LightModeOutlinedIcon />
          )}
        </IconButton>

        <IconButton onClick={toggleRtl}>
          <Typography variant="h5" component="div">
            {isRtl ? "English" : "عربى"}
          </Typography>
        </IconButton>
      </Box>
    </Box>
  );
};
export default Topbar;
