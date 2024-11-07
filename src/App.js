import "./App.css";

import CssBaseline from "@mui/material/CssBaseline";
import { styled } from "@mui/material/styles";
import Paper from "@mui/material/Paper";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import React, { useState, useContext, useEffect } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import Login from "./components/Login";
import Loading from "./components/Loading";
import Notification from "./components/Notification";
import { useValue } from "./components/ContextProvider";
import QRCodePanel from "./components/QRCodePanel";
import { Routes, Route, Navigate } from "react-router-dom";
import UserPanel from "./components/UserPanel";
import { RtlProvider } from "./components/RtlContext";
import { ColorModeContext, useMode } from "./theme";
import Topbar from "./components/Topbar";
import Register from "./components/Register";
import { useRtl } from "./components/RtlContext";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

function App() {
  const { isRtl } = useRtl();
  const [theme, colorMode] = useMode(isRtl);
  const { state } = useValue();
  const isLoggedIn = state.currentUser !== null;
  const [isSidebar, setIsSidebar] = useState(true);

  const cacheLtr = createCache({
    key: "muiltr",
  });

  const cacheRtl = createCache({
    key: "muirtl",
    // prefixer is the only stylis plugin by default, so when
    // overriding the plugins you need to include it explicitly
    // if you want to retain the auto-prefixing behavior.
    stylisPlugins: [prefixer, rtlPlugin],
  });
  const rtlTheme = {
    ...theme,
    direction: "rtl",  // Set the direction to RTL
  };

  const ltrTheme = {
    ...theme,
    direction: "ltr",  // Set the direction to LTR
  };
  // const [alignment, setAlignment] = React.useState(isRtl ? "ar" : "en");

  const [isRegistering, setIsRegistering] = useState(false);

  // const handleChange = (event, newAlignment) => {
  //   if (newAlignment !== null) {
  //     setAlignment(newAlignment);
  //   }
  // };

  // const changeLanguage = (language) => {
  //   setIsRtl(language === "ar");
  // };
  const toggleRegister = () => {
    setIsRegistering((prev) => !prev);
  };

  const Panel = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    textAlign: "center",
  }));

  return (
    <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
      <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={isRtl ? rtlTheme : ltrTheme}>

            <CssBaseline />
            <Loading />
            <Notification />
            <div className="app">
              <Topbar setIsSidebar={setIsSidebar} />
              <main className="content">
                <Routes>
                  {!isLoggedIn ? (
                    <>
                      <Route path="/" element={<Login />} />
                      <Route
                        path="/register"
                        element={<Register toggleRegister={toggleRegister} />}
                      />
                    </>
                  ) : (
                    <>
                      <Route path="/home" element={<UserPanel />} />
                      <Route path="/pass" element={<QRCodePanel />} />
                    </>
                  )}
                </Routes>
              </main>
            </div>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </CacheProvider>
  );
}

export default App;
