import "./App.css";

import CssBaseline from "@mui/material/CssBaseline";
import {  ThemeProvider } from "@mui/material/styles";
import React, { useState,  useEffect } from "react";
import Login from "./components/Login";
import Loading from "./components/Loading";
import Notification from "./components/Notification";
import { useValue } from "./components/ContextProvider";
import QRCodePanel from "./components/QRCodePanel";
import { Routes, Route, Navigate } from "react-router-dom";
import UserPanel from "./components/UserPanel";

import { ColorModeContext, useMode } from "./theme";
import Topbar from "./components/Topbar";
import Register from "./components/Register";
import { useRtl } from "./components/RtlContext";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "./components/firebaseApp";
import FloatingButton from "./components/FloatingButton";
function App() {
  const { isRtl } = useRtl();
  const [theme, colorMode] = useMode(isRtl);
  const { state, dispatch } = useValue();
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
    direction: "rtl", // Set the direction to RTL
  };

  const ltrTheme = {
    ...theme,
    direction: "ltr", // Set the direction to LTR
  };
  // const [alignment, setAlignment] = React.useState(isRtl ? "ar" : "en");

  const [isRegistering, setIsRegistering] = useState(false);
// 2. Disable Console in Production
useEffect(() => {
  if (process.env.NODE_ENV === 'production') {
    console.log = function() {};
    console.info = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.debug = function() {};
    
    Object.defineProperty(window, 'console', {
      value: console,
      writable: false,
      configurable: false
    });
  }
}, []);

// 3. Detect Console Tampering
// useEffect(() => {
//   if (process.env.NODE_ENV === 'production') {
//     const checkConsole = () => {
//       if (window.outerWidth - window.innerWidth > 200 || 
//           window.outerHeight - window.innerHeight > 200) {
//         dispatch({
//           type: "UPDATE_ALERT",
//           payload: {
//             open: true,
//             severity: "error",
//             message: isRtl ? "تم اكتشاف انتهاك أمني" : "Security violation detected"
//           }
//         });
//         dispatch({
//           type: "START_LOADING"});
//         window.location.reload();
//       }
//     };

//     const interval = setInterval(checkConsole, 1000);
//     return () => clearInterval(interval);
//   }
// }, [isRtl, dispatch]);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        // Send a message to the service worker to inform about the user being logged in
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SET_USER_AUTH_STATE",
            isLoggedIn: true,
          });
        }
      } else {
        // Send a message to the service worker to inform about the user being logged out
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SET_USER_AUTH_STATE",
            isLoggedIn: false,
          });
        }
      }
    });

    return () => unsubscribe(); // Cleanup on component unmount
  }, []);

  const toggleRegister = () => {
    setIsRegistering((prev) => !prev);
  };


  return (
    <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={isRtl ? rtlTheme : ltrTheme}>
          <CssBaseline />
          <Loading />
          <Notification />
          <FloatingButton />
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
                    <Route path="*" element={<Navigate to="/" />} />
                  </>
                ) : (
                  <>
                    <Route path="/home" element={<UserPanel />} />
                    <Route path="/pass" element={<QRCodePanel />} />
                    <Route path="*" element={<Navigate to="/home" />} />
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
