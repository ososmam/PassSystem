import "../App.css";
import React, { useState, useEffect, useContext } from "react";
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

import { firestore, firebaseAuth } from "./firebaseApp";
import { v4 as uuidv4 } from "uuid";
import en from "../locales/en.json";
import ar from "../locales/ar.json";
import {
  Button,
  Box,
  TextField,
  ToggleButton,
  CssBaseline,
  Container,
  Typography,
  useMediaQuery,
  useTheme,
  Paper,
  styled,
} from "@mui/material";
import { tokens } from "../theme";
import { RtlContext } from "./RtlContext";
import { useValue } from "./ContextProvider";
import { useNavigate } from "react-router-dom";

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
  const isNonMobile = useMediaQuery("(min-width:600px)");
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();
  const lang = isRtl ? ar : en;
  const [isLoading, setIsLoading] = useState(true); // Track loading state

  const currentDeviceId = localStorage.getItem("deviceId") || uuidv4();
  localStorage.setItem("deviceId", currentDeviceId); // Save device ID locally
  const toggleRegister = () => {
    // If you're using `useHistory` or `useNavigate` for navigation, make sure it's not navigating to the homepage.
    navigate("/register"); // Or whatever your registration route is
  };
  // Verifies the device ID and updates the user state
  const verifyDeviceOnLoad = async () => {
    dispatch({ type: "START_LOADING" });
    const user = firebaseAuth.currentUser;

    if (user) {
      const email = user.email;
      const phoneNumber = email.split("@")[0]; // Use the part before '@' as the phone number

      try {
        const userDocRef = collection(firestore, "hosts");
        const q = query(userDocRef, where("phone", "==", phoneNumber)); // Query by phone number
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          dispatch({ type: "END_LOADING" });
          setIsLoading(false);
          return;
        }

        const userData = querySnapshot.docs[0].data();
        const storedDeviceId = userData.deviceId;

        if (storedDeviceId && storedDeviceId !== currentDeviceId) {
          dispatch({
            type: "UPDATE_ALERT",
            payload: {
              open: true,
              severity: "error",
              title: lang.error,
              message: lang.restrictedDevice,
            },
          });

          await signOut(firebaseAuth);
          dispatch({ type: "UPDATE_USER", payload: null });
          dispatch({ type: "END_LOADING" });
          setIsLoading(false);
        } else {
          dispatch({
            type: "UPDATE_USER",
            payload: { ...userData, id: querySnapshot.docs[0].id },
          });
          navigate("/home");
          dispatch({ type: "END_LOADING" });
          setIsLoading(false);
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
        dispatch({ type: "END_LOADING" });
        setIsLoading(false);
      }
    } else {
      dispatch({ type: "END_LOADING" });
      setIsLoading(false);
    }
  };

  // useEffect to check auth state on page load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        verifyDeviceOnLoad(); // Call device verification only if user is logged in
      } else {
        setIsLoading(false); // End loading if no user
      }
    });
    return () => unsubscribe(); // Clean up the listener on unmount
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
    const currentDeviceId = localStorage.getItem("deviceId") || uuidv4();

    signInWithEmailAndPassword(firebaseAuth, phone + "@dm2.test", password)
      .then(() => {
        dispatch({ type: "END_LOADING" });
        const userDocRef = collection(firestore, "hosts");
        const q = query(userDocRef, where("phone", "==", phone));

        getDocs(q).then((querySnapshot) => {
          const data = querySnapshot.docs[0].data();
          data.id = querySnapshot.docs[0].id;

          const storedDeviceId = data.deviceId;
          if (!storedDeviceId) {
            updateDoc(doc(firestore, "hosts", data.id), {
              deviceId: currentDeviceId,
            }).then(() => {
              dispatch({ type: "UPDATE_USER", payload: data });
              navigate("/home");
            });
          } else if (storedDeviceId !== currentDeviceId) {
            dispatch({ type: "END_LOADING" });
            dispatch({
              type: "UPDATE_ALERT",
              payload: {
                open: true,
                severity: "error",
                title: lang.error,
                message: lang.restrictedDevice,
              },
            });
          }
        });
      })
      .catch((error) => {
        dispatch({ type: "END_LOADING" });
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "error",
            title: lang.error,
            message: lang.invalid,
          },
        });
      });
  }

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {isLoading ? (
          // Show only the logo while loading
          <Panel width={400}>
            <img
              src={require("../images/logo192.png")}
              width={350}
              height={"auto"}
              alt=""
            />
          </Panel>
        ) : (
          <Panel width={150}>
            <img
              src={require("../images/logo192.png")}
              width={100}
              height={"auto"}
              alt=""
            />
<br></br>
            <Typography component="h1" variant="h5">
              {isRtl ? ar.signIn : en.signIn}
            </Typography>
            <Box sx={{ mt: 1 }}>
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
                <Button
                  type="submit"
                  id="loginButton"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                >
                  {isRtl ? ar.signIn : en.signIn}
                </Button>

                <Button
                  onClick={toggleRegister}
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                >
                  {isRtl ? ar.switchToRegister : en.switchToRegister}
                </Button>
              </Box>
            </Box>
          </Panel>
        )}
      </Box>
    </Container>
  );
}
export default Login;
