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
  arrayRemove,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
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
  const lang = isRtl ? ar : en;
  const userId = state.currentUser?.id; // Assumes the user's ID is stored in `state.currentUser`
  const handleHome = () => {
    navigate("/home");
  };
  const handleLogout = async () => {
    try {
      if (userId !== "") {
        // 1. Remove FCM token from server
        await deleteFcmTokenToServer(userId);
  
        const userDocRef = doc(firestore, "hosts", userId);
        const currentDeviceId = localStorage.getItem("deviceId");
  
        if (currentDeviceId) {
          try {
            // 2. Remove current device from user's deviceIds array
            await updateDoc(userDocRef, {
              deviceIds: arrayRemove(currentDeviceId)
            });
          } catch (error) {
            console.error("Error removing device from list:", error);
            
            // Fallback: Try the old method if deviceIds array doesn't exist
            try {
              await updateDoc(userDocRef, { deviceId: "" });
            } catch (fallbackError) {
              console.error("Fallback error clearing deviceId:", fallbackError);
            }
          }
        }
      }
  
      // 3. Sign out from Firebase
      if (firebaseAuth.currentUser) {
        await signOut(firebaseAuth);
      }
  
      // 4. Clear local data
      localStorage.removeItem("deviceId");
      dispatch({ type: "UPDATE_USER", payload: null });
  
      // 5. Navigate to login
      navigate("/");
    } catch (error) {
      console.error("Error during logout:", error);
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.logoutError || "Error during logout",
        },
      });
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
