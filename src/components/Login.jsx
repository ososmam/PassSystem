import "../App.css";
import React, { useState, useEffect, useContext } from "react";
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  fetchAndActivate,
  getValue,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-remote-config.js";

import { firestore, firebaseAuth, remoteConfig } from "./firebaseApp";
import { v4 as uuidv4 } from "uuid";
import en from "../locales/en.json";
import ar from "../locales/ar.json";
import {
  Button,
  Box,
  TextField,
  CssBaseline,
  Container,
  Typography,
  Paper,
  styled,
  CircularProgress,
} from "@mui/material";

import { RtlContext } from "./RtlContext";
import { useValue } from "./ContextProvider";
import { useNavigate } from "react-router-dom";
import { requestNotificationPermission } from "./messaging";
import { motion } from "framer-motion";

const Panel = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(3),
  textAlign: "center",
}));

setPersistence(firebaseAuth, browserLocalPersistence);

function Login() {
  const navigate = useNavigate();
  const { isRtl } = useContext(RtlContext);
  const { state, dispatch } = useValue();
  const lang = isRtl ? ar : en;
  const [isLoading, setIsLoading] = useState(true);
  const currentDeviceId = localStorage.getItem("deviceId") || uuidv4();
  localStorage.setItem("deviceId", currentDeviceId);

  const toggleRegister = () => {
    navigate("/register");
  };

  const checkDeviceLimit = async (userId, currentDeviceId) => {
    try {
      // Try to use Remote Config first
      await fetchAndActivate(remoteConfig);
      const maxDevices =
        getValue(remoteConfig, "max_allowed_devices").asNumber() || 2;

      const userRef = doc(firestore, "hosts", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document not found");
      }

      const userData = userDoc.data();

      // If no deviceIds array exists, create one with current device
      if (!userData.deviceIds) {
        await updateDoc(userRef, {
          deviceIds: [currentDeviceId],
        });
        return true;
      }

      // Device already registered
      if (userData.deviceIds.includes(currentDeviceId)) {
        return true;
      }

      // Check device limit
      if (userData.deviceIds.length >= maxDevices) {
        return false;
      }

      // Add new device
      await updateDoc(userRef, {
        deviceIds: arrayUnion(currentDeviceId),
      });
      return true;
    } catch (error) {
      console.error("Remote Config failed, using default limit:", error);
      // Fallback to default limit if Remote Config fails
      return checkDeviceLimitWithDefault(userId, currentDeviceId);
    }
  };

  const checkDeviceLimitWithDefault = async (
    userId,
    currentDeviceId,
    defaultValue = 3
  ) => {
    const userRef = doc(firestore, "hosts", userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    // Same logic as above but with default value
    if (!userData.deviceIds) {
      await updateDoc(userRef, { deviceIds: [currentDeviceId] });
      return true;
    }

    if (userData.deviceIds.includes(currentDeviceId)) return true;
    if (userData.deviceIds.length >= defaultValue) return false;

    await updateDoc(userRef, { deviceIds: arrayUnion(currentDeviceId) });
    return true;
  };

  const verifyDeviceOnLoad = async () => {
    dispatch({ type: "START_LOADING" });
    const user = firebaseAuth.currentUser;

    if (user) {
      const email = user.email;
      const phoneNumber = email.split("@")[0];

      try {
        const userDocRef = collection(firestore, "hosts");
        const q = query(
          userDocRef,
          where("phone", "==", phoneNumber),
          where("verified", "==", true)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          dispatch({ type: "END_LOADING" });
          setIsLoading(false);
          return;
        }

        const userData = querySnapshot.docs[0].data();
        const docId = querySnapshot.docs[0].id;
        userData.id = docId;

        if (userData.endDate && userData.endDate.toDate() < new Date()) {
          dispatch({
            type: "UPDATE_ALERT",
            payload: {
              open: true,
              severity: "error",
              title: lang.error,
              message: lang.rentalExpired || "Your rental period has ended",
            },
          });
          await signOut(firebaseAuth);
          dispatch({ type: "UPDATE_USER", payload: null });
          return;
        }

        const isDeviceAllowed = await checkDeviceLimit(docId, currentDeviceId);

        if (!isDeviceAllowed) {
          dispatch({
            type: "UPDATE_ALERT",
            payload: {
              open: true,
              severity: "error",
              title: lang.error,
              message:
                lang.deviceLimitReached ||
                "Device limit reached. Please log out from another device.",
            },
          });
          await signOut(firebaseAuth);
          dispatch({ type: "UPDATE_USER", payload: null });
        } else {
          dispatch({ type: "UPDATE_USER", payload: userData });
          navigate("/home");
          requestNotificationPermission(userData.id);
        }
      } catch (error) {
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "error",
            title: "Error",
            message: "Could not verify device.",
          },
        });
      } finally {
        dispatch({ type: "END_LOADING" });
        setIsLoading(false);
      }
    } else {
      dispatch({ type: "END_LOADING" });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        verifyDeviceOnLoad();
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await login(data);
  };

  async function login(data) {
    dispatch({ type: "START_LOADING" });
    const phone = data.get("phone").substring(1);
    const password = data.get("password");

    try {
      // Attempt Firebase authentication
      await signInWithEmailAndPassword(
        firebaseAuth,
        phone + "@dm2.test",
        password
      );

      // Query user document
      const userDocRef = collection(firestore, "hosts");
      const q = query(
        userDocRef,
        where("phone", "==", phone),
        where("verified", "==", true)
      );
      const q2 = query(
        userDocRef,
        where("secondPhone", "==", phone),
        where("verified", "==", true)
      );

      const [querySnapshot, querySnapshot2] = await Promise.all([
        getDocs(q),
        getDocs(q2),
      ]);
      // Check if user exists and is verified
      if (querySnapshot.empty && querySnapshot2.empty) {
        throw new Error(
          lang.notVerified ||
            "Your account is not verified yet. Please wait for approval."
        );
      }

      const userDoc = querySnapshot.docs[0] || querySnapshot2.docs[0];
      const userData = { ...userDoc.data(), id: userDoc.id };
      if (userData.endDate && userData.endDate.toDate() < new Date()) {
        throw new Error(
          lang.rentalExpired ||
            "Your rental period has ended. Please contact support."
        );
      }
      // Check device limit
      const isDeviceAllowed = await checkDeviceLimit(
        userData.id,
        currentDeviceId
      );

      if (!isDeviceAllowed) {
        throw new Error(
          lang.deviceLimitReached ||
            `You've reached the maximum allowed devices (${remoteConfig.defaultConfig.max_allowed_devices}). 
          Please log out from another device first.`
        );
      }

      // Success - update user state and navigate
      dispatch({ type: "UPDATE_USER", payload: userData });
      await requestNotificationPermission(userData.id);
      navigate("/home");
    } catch (error) {
      let errorMessage = lang.invalid;

      // Handle specific error cases
      switch (error.code) {
        case "auth/invalid-email":
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          errorMessage =
            lang.invalidCredentials || "Invalid phone number or password";
          break;
        case "auth/too-many-requests":
          errorMessage =
            lang.tooManyAttempts ||
            "Too many attempts. Please try again later.";
          break;
        default:
          // Use the error message we threw earlier or default message
          errorMessage = error.message || lang.invalid;
      }

      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: errorMessage,
          duration: 6000, // Show for 6 seconds
        },
      });

      // Clean up by signing out if authentication succeeded but other checks failed
      if (firebaseAuth.currentUser) {
        try {
          await signOut(firebaseAuth);
        } catch (signOutError) {
          console.error("Error during sign out:", signOutError);
        }
      }
    } finally {
      dispatch({ type: "END_LOADING" });
    }
  }

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

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.4 } },
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.6 } },
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        component={motion.div} // Animate the container
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {isLoading ? (
          // Show only the logo while loading
          <Panel width={400}>
            <motion.img
              src={require("../images/logo192.png")}
              width={350}
              height={"auto"}
              alt=""
              variants={logoVariants}
              initial="hidden"
              animate="visible"
            />
          </Panel>
        ) : (
          <Panel width={150}>
            <motion.img
              src={require("../images/logo192.png")}
              width={100}
              height={"auto"}
              alt=""
              variants={logoVariants}
              initial="hidden"
              animate="visible"
            />
            <br />
            <Typography component="h1" variant="h5">
              {lang.signIn}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <motion.div
                variants={formVariants}
                initial="hidden"
                animate="visible"
              >
                <Box
                  component="form"
                  onSubmit={handleSubmit}
                  noValidate
                  sx={{ mt: 1 }}
                >
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="phone"
                    label={isRtl ? ar.phone : en.phone}
                    name="phone"
                    InputLabelProps={{
                      style: {
                        textAlign: isRtl ? "right" : "left",
                      },
                    }}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label={isRtl ? ar.password : en.password}
                    type="password"
                    id="password"
                  />
                  <motion.div
                    variants={buttonVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Button
                      type="submit"
                      id="loginButton"
                      fullWidth
                      variant="contained"
                      sx={{ mt: 3, mb: 2 }}
                    >
                      {isRtl ? ar.signIn : en.signIn}
                    </Button>
                  </motion.div>

                  <motion.div
                    variants={buttonVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Button
                      onClick={toggleRegister}
                      fullWidth
                      variant="outlined"
                      color="secondary"
                      sx={{ mt: 3, mb: 2 }}
                    >
                      {isRtl ? ar.switchToRegister : en.switchToRegister}
                    </Button>
                  </motion.div>
                </Box>
              </motion.div>
            </Box>
          </Panel>
        )}
      </Box>
    </Container>
  );
}
export default Login;
