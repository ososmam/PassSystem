import {
  Box,
  IconButton,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useContext } from "react";
import { ColorModeContext, tokens } from "../theme";
import { firebaseAuth, firestore } from "./firebaseApp";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";

import { useRtl } from "./RtlContext";
import React from "react";
import { useValue } from "./ContextProvider";
import { useNavigate } from "react-router-dom";
import {
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { Padding } from "@mui/icons-material";

const Topbar = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);
  const { state, dispatch } = useValue();
  const navigate = useNavigate();
  const isLoggedIn = state.currentUser !== null;

  const { isRtl, toggleRtl } = useRtl();

  const handleChange = (event, newAlignment) => {
    if (newAlignment !== null) {
      setAlignment(newAlignment);
    }
  };
  const [alignment, setAlignment] = React.useState(isRtl ? "ar" : "en");

  const userId = state.currentUser?.id; // Assumes the user's ID is stored in `state.currentUser`

  const handleLogout = async () => {
    try {
      if (userId) {
        // Reference to the user document in Firebase
        const userDocRef = doc(firestore, "hosts", userId);

        // Clear the `deviceId` from the user's document
        await updateDoc(userDocRef, { deviceId: "" });
      }

      // Sign out from Firebase
      await firebaseAuth.signOut();

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
    <Box display="flex" justifyContent="space-between" p={3}>
      {/* SEARCH BAR */}
      <Box
        display="flex"
        backgroundColor={colors.primary[400]}
        borderRadius="3px"
      >
        {/* <InputBase sx={{ ml: 2, flex: 1 }} placeholder="Search" />
        <IconButton type="button" sx={{ p: 1 }}>
          <SearchIcon />
        </IconButton> */}
      </Box>

      {/* SEARCH BAR */}
      <Box display="flex">
        <IconButton onClick={colorMode.toggleColorMode}>
          {theme.palette.mode === "dark" ? (
            <DarkModeOutlinedIcon />
          ) : (
            <LightModeOutlinedIcon />
          )}
        </IconButton>
        {isLoggedIn && (
          <IconButton onClick={handleLogout}>
            <LogoutOutlinedIcon />
          </IconButton>
        )}

        <IconButton onClick={toggleRtl}>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
            {isRtl ? "English" : "عربى"}
          </Typography>
        </IconButton>

        {/* <IconButton>
          <PersonOutlinedIcon />
        </IconButton> */}
      </Box>
    </Box>
  );
};
export default Topbar;
