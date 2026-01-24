import { Box, IconButton, useTheme, Typography } from "@mui/material";
import { useContext } from "react";
import { ColorModeContext } from "../theme";
import { apiClient } from "../apiClient";
import { useNavigate } from "react-router-dom";
import { useValue } from "./ContextProvider";
import { useRtl } from "./RtlContext";
import ar from "../locales/ar.json";
import en from "../locales/en.json";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

const Topbar = () => {
  const theme = useTheme();
  const version = process.env.REACT_APP_VERSION;
  const colorMode = useContext(ColorModeContext);
  const { state, dispatch } = useValue();
  const navigate = useNavigate();
  const isLoggedIn = state.currentUser !== null;

  const { isRtl, toggleRtl } = useRtl();
  const lang = isRtl ? ar : en;
  const userId = state.currentUser?.id;

  const handleHome = () => {
    navigate("/home");
  };

  // Clear user session function (same as in Login component)
  const clearUserSession = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("deviceId");
    dispatch({ type: "UPDATE_USER", payload: null });
  };

  const handleLogout = async () => {
    try {
      if (userId) {
        const currentDeviceId = localStorage.getItem("deviceId");
        if (currentDeviceId) {
          try {
            await apiClient.removeDevice(userId, currentDeviceId);
          } catch (e) {
            console.error("Failed to remove device:", e);
          }
        }
      }

      // Clear all user session data (including JWT token)
      clearUserSession();

      // Navigate to login
      navigate("/");
    } catch (error) {
      console.error("Error during logout:", error);

      // Even if there's an error, clear the session to prevent auto-login
      clearUserSession();

      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.logoutError || "Error during logout",
        },
      });

      navigate("/");
    }
  };

  return (
    <Box display="flex" justifyContent="space-between" p={2}>
      {/* Left-aligned version text */}
      <Box>
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