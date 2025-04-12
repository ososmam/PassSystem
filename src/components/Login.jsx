import "../App.css";
import React, { useState, useEffect, useContext } from "react";
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";




import { firestore, firebaseAuth } from "./firebaseApp";
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
} from "@mui/material";

import { RtlContext } from "./RtlContext";
import { useValue } from "./ContextProvider";
import { useNavigate } from "react-router-dom";
import { requestNotificationPermission} from "./messaging";
import { motion } from "framer-motion"; // Import Framer Motion

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
  // const isNonMobile = useMediaQuery("(min-width:600px)");
  // const theme = useTheme();
  const { isRtl } = useContext(RtlContext);
  const { state,dispatch } = useValue();
  const lang = isRtl ? ar : en;
  const [isLoading, setIsLoading] = useState(true); 

  const currentDeviceId = localStorage.getItem("deviceId") || uuidv4();
  localStorage.setItem("deviceId", currentDeviceId); 
  const toggleRegister = () => {

    navigate("/register"); 
  };
  const verifyDeviceOnLoad = async () => {
    dispatch({ type: "START_LOADING" });
    const user = firebaseAuth.currentUser;

    if (user) {
      const email = user.email;
      const phoneNumber = email.split("@")[0]; 

      try {
        const userDocRef = collection(firestore, "hosts");
        const q = query(userDocRef, where("phone", "==", phoneNumber),where("verified", "==", true)); 
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          dispatch({ type: "END_LOADING" });
          setIsLoading(false);
          return;
        }

        const userData = querySnapshot.docs[0].data();
        const storedDeviceId = userData.deviceId;
        const docId = querySnapshot.docs[0].id;
userData.id = docId;
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
          dispatch({ type: "UPDATE_USER", payload: userData });
          navigate("/home");
          
          requestNotificationPermission(userData.id);
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

  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        verifyDeviceOnLoad(); 
      } else {
        setIsLoading(false); 
      }
    });
    return () => unsubscribe(); 
  },[]);

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
        const q = query(
          userDocRef,
          where("phone", "==", phone),
          where("verified", "==", true)
        );

        getDocs(q).then((querySnapshot) => {
          if (querySnapshot.empty) {
            dispatch({
              type: "UPDATE_ALERT",
              payload: {
                open: true,
                severity: "error",
                title: lang.error,
                message: lang.notVerified,
              },
            });
            return;
          } else {
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


  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const logoVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { duration: 0.5, delay: 0.2 } },
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
                  <motion.div variants={buttonVariants} initial="hidden" animate="visible">
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

                  <motion.div variants={buttonVariants} initial="hidden" animate="visible">
                    <Button
                      onClick={toggleRegister}
                      fullWidth
                      variant="contained"
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
