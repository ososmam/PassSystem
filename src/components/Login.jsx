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
} from "firebase/firestore";
import { fetchAndActivate, getValue } from "firebase/remote-config";

import { firestore, remoteConfig } from "./firebaseApp";
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
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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

function Login() {
  const navigate = useNavigate();
  const { isRtl } = useContext(RtlContext);
  const { state, dispatch } = useValue();
  const lang = isRtl ? ar : en;
  const [isLoading, setIsLoading] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [emailVerificationDialog, setEmailVerificationDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const baseUrl = "https://auth.darmasr2.com";
  // New state for email addition
  const [showAddEmailDialog, setShowAddEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [pendingUserData, setPendingUserData] = useState(null);
  const [isAddingEmail, setIsAddingEmail] = useState(false);

  const currentDeviceId = localStorage.getItem("deviceId") || uuidv4();
  localStorage.setItem("deviceId", currentDeviceId);

  const toggleRegister = () => {
    navigate("/register");
  };

  // Check if token is valid
  const validateToken = async (token) => {
    try {
      const response = await fetch(baseUrl + "/api/auth/verify-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Token validation failed:", error);
      return false;
    }
  };

  // Clear user session
  const clearUserSession = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    dispatch({ type: "UPDATE_USER", payload: null });
  };

  // Your existing device limit functions remain the same
  const checkDeviceLimit = async (userId, currentDeviceId) => {
    try {
      await fetchAndActivate(remoteConfig);
      const maxDevices =
        getValue(remoteConfig, "max_allowed_devices").asNumber() || 2;

      const userRef = doc(firestore, "hosts", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document not found");
      }

      const userData = userDoc.data();

      if (!userData.deviceIds) {
        await updateDoc(userRef, {
          deviceIds: [currentDeviceId],
        });
        return true;
      }

      if (userData.deviceIds.includes(currentDeviceId)) {
        return true;
      }

      if (userData.deviceIds.length >= maxDevices) {
        return false;
      }

      await updateDoc(userRef, {
        deviceIds: arrayUnion(currentDeviceId),
      });
      return true;
    } catch (error) {
      console.error("Remote Config failed, using default limit:", error);
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

    if (!userData.deviceIds) {
      await updateDoc(userRef, { deviceIds: [currentDeviceId] });
      return true;
    }

    if (userData.deviceIds.includes(currentDeviceId)) return true;
    if (userData.deviceIds.length >= defaultValue) return false;

    await updateDoc(userRef, { deviceIds: arrayUnion(currentDeviceId) });
    return true;
  };

  // Function to add email to user account
  const handleAddEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.invalidEmailTitle,
          message: lang.invalidEmailMessage,
        },
      });
      return;
    }

    setIsAddingEmail(true);

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(baseUrl + "/api/auth/add-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || lang.addEmailFailed);
      }

      // Update user data with new email
      const updatedUserData = { ...pendingUserData, email: newEmail };

      // Update Firebase document as well
      const userRef = doc(firestore, "hosts", pendingUserData.id);
      await updateDoc(userRef, {
        email: newEmail,
      });

      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "info",
          title: lang.emailAdded || "Email Added",
          message:
            lang.pleaseVerifyEmail ||
            "Please verify your email before logging in.",
          duration: 8000,
        },
      });
      setShowAddEmailDialog(false);
      setNewEmail("");
      clearUserSession(); // Clear session instead of Firebase signOut
    } catch (error) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: "Error",
          message: error.message || "Failed to add email address",
        },
      });
    } finally {
      setIsAddingEmail(false);
    }
  };

  // JWT-based user verification
  const verifyUserSession = async () => {
    dispatch({ type: "START_LOADING" });

    const authToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("currentUser");

    if (!authToken || !storedUser) {
      dispatch({ type: "END_LOADING" });
      setIsLoading(false);
      return;
    }

    const isTokenValid = await validateToken(authToken);
    if (!isTokenValid) {
      clearUserSession();
      dispatch({ type: "END_LOADING" });
      setIsLoading(false);
      return;
    }

    try {
      const userData = JSON.parse(storedUser);

      // Use Firebase document ID if available, fallback to backend ID
      const firebaseDocId = userData.firebaseDocumentId || userData.id;

      // Verify user still exists and is verified in Firestore using the correct document ID
      const userDocRef = doc(firestore, "hosts", firebaseDocId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists() || !userDoc.data().verified) {
        clearUserSession();
        dispatch({ type: "END_LOADING" });
        setIsLoading(false);
        return;
      }

      const currentUserData = {
        ...userDoc.data(),
        id: userDoc.id,
        firebaseDocumentId: userDoc.id, // Ensure we have the Firebase document ID
        backendId: userData.id, // Keep backend ID for API calls
      };

      // Check rental expiration
      if (
        currentUserData.endDate &&
        currentUserData.endDate.toDate() < new Date()
      ) {
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "error",
            title: lang.error,
            message: lang.rentalExpired || "Your rental period has ended",
          },
        });
        clearUserSession();
        dispatch({ type: "END_LOADING" });
        setIsLoading(false);
        return;
      }

      // Check device limit - use Firebase document ID for Firebase operations
      const isDeviceAllowed = await checkDeviceLimit(
        currentUserData.id,
        currentDeviceId
      );

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
        clearUserSession();
      } else {
        dispatch({ type: "UPDATE_USER", payload: currentUserData });
        console.debug(currentUserData);
        navigate("/home");

        // Use Firebase document ID for notifications
        requestNotificationPermission(currentUserData.id);
      }
    } catch (error) {
      console.error("Session verification failed:", error);
      clearUserSession();
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.verifyDeviceFailed,
        },
      });
    } finally {
      dispatch({ type: "END_LOADING" });
      setIsLoading(false);
    }
  };

  // Check user session on component mount
  useEffect(() => {
    verifyUserSession();
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
      const response = await fetch(baseUrl + "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: phone,
          password: password,
        }),
      });

      const result = await response.json();

      // Handle successful login
      if (response.ok && result.success) {
        localStorage.setItem("authToken", result.token);
        const userData = result.user;

        try {
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

          let firestoreUserData = null;
          if (!querySnapshot.empty || !querySnapshot2.empty) {
            const userDoc = querySnapshot.docs[0] || querySnapshot2.docs[0];
            firestoreUserData = { ...userDoc.data(), id: userDoc.id };

            // Update backend with Firebase document ID if not already set
            if (userData.firebaseDocumentId !== userDoc.id) {
              try {
                await fetch(baseUrl + "/api/auth/update-firebase-doc-id", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${result.token}`,
                  },
                  body: JSON.stringify({
                    firebaseDocumentId: userDoc.id,
                  }),
                });
              } catch (updateError) {
                console.warn(
                  "Failed to update Firebase document ID in backend:",
                  updateError
                );
                // Don't fail login for this
              }
            }

            // Check rental expiration
            if (
              firestoreUserData.endDate &&
              firestoreUserData.endDate.toDate() < new Date()
            ) {
              throw new Error(
                lang.rentalExpired ||
                  "Your rental period has ended. Please contact support."
              );
            }

            // Check device limit using Firebase document ID
            const isDeviceAllowed = await checkDeviceLimit(
              firestoreUserData.id, // Use Firebase document ID
              currentDeviceId
            );

            if (!isDeviceAllowed) {
              throw new Error(
                lang.deviceLimitReached ||
                  "Device limit reached. Please log out from another device."
              );
            }
          } else {
            throw new Error(
              lang.notVerified ||
                "Your account is not verified yet. Please wait for approval."
            );
          }

          // Success - merge backend and firestore data
          const completeUserData = {
            ...firestoreUserData,
            ...userData,
            firebaseDocumentId: firestoreUserData.id, // Ensure Firebase document ID is set
            backendId: userData.id, // Keep backend ID for API calls
          };
          localStorage.setItem("currentUser", JSON.stringify(completeUserData));
          dispatch({ type: "UPDATE_USER", payload: completeUserData });
          await requestNotificationPermission(firestoreUserData.id); // Use Firebase document ID
          navigate("/home");
          return;
        } catch (firestoreError) {
          console.error("Firestore query failed:", firestoreError);
          throw firestoreError;
        }
      }

      // Handle authentication failure scenarios
      if (!result.success) {
        // Handle email verification requirement
        if (result.requiresEmailVerification && result.user) {
          dispatch({
            type: "UPDATE_ALERT",
            payload: {
              open: true,
              severity: "warning",
              title:
                lang.emailVerificationRequired || "Email Verification Required",
              message:
                lang.pleaseVerifyEmail ||
                "Please verify your email before logging in.",
              duration: 8000,
            },
          });

          // Store the user data for potential resend verification
          setPendingUserId(result.user.id);
          //setEmailVerificationDialog(true);
          return;
        }

        // Handle missing email requirement
        if (result.requiresEmail && result.token && result.user) {
          dispatch({
            type: "UPDATE_ALERT",
            payload: {
              open: true,
              severity: "info",
              title: lang.emailRequired || "Email Required",
              message:
                lang.addEmailMessage ||
                "Please add an email address to your account.",
              duration: 6000,
            },
          });

          // Store auth token temporarily for adding email
          localStorage.setItem("authToken", result.token);

          // Try to get additional user data from Firebase for completeness
          try {
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

            let userData;
            if (!querySnapshot.empty || !querySnapshot2.empty) {
              const userDoc = querySnapshot.docs[0] || querySnapshot2.docs[0];
              userData = {
                ...userDoc.data(),
                id: userDoc.id,
                // Override with backend user data for consistency
                phoneNumber: result.user.phoneNumber,
                email: result.user.email,
                isEmailVerified: result.user.isEmailVerified,
              };
            } else {
              // Fallback to backend user data if not found in Firebase
              userData = {
                ...result.user,
                id: result.user.id.toString(), // Ensure string ID for Firebase compatibility
                phone: result.user.phoneNumber,
              };
            }

            setPendingUserData(userData);
            setShowAddEmailDialog(true);
          } catch (firebaseError) {
            console.error(
              "Firebase query failed, using backend user data:",
              firebaseError
            );
            // Use backend user data as fallback
            setPendingUserData({
              ...result.user,
              id: result.user.id.toString(),
              phone: result.user.phoneNumber,
            });
            setShowAddEmailDialog(true);
          }
          return;
        }

        // Handle invalid credentials or other authentication failures
        let errorMessage = result.message || lang.invalid || "Login failed";

        if (
          result.message &&
          (result.message.includes("Invalid phone number or password") ||
            result.message.includes("Invalid credentials"))
        ) {
          errorMessage =
            lang.invalidCredentials || "Invalid phone number or password";
        }

        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "error",
            title: lang.error || "Error",
            message: errorMessage,
            duration: 6000,
          },
        });
        return;
      }

      // Handle unexpected response format
      throw new Error("Unexpected response format from server");
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = lang.invalid || "Login failed";

      // Handle specific error types
      if (error.name === "TypeError" || error.message.includes("fetch")) {
        errorMessage =
          lang.networkError ||
          "Network error. Please check your connection and try again.";
      } else if (error.message.includes("rental period has ended")) {
        errorMessage = error.message;
      } else if (error.message.includes("Device limit reached")) {
        errorMessage = error.message;
      } else if (error.message.includes("not verified")) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error || "Error",
          message: errorMessage,
          duration: 6000,
        },
      });
    } finally {
      dispatch({ type: "END_LOADING" });
    }
  }

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.enterEmailPrompt,
        },
      });
      return;
    }

    try {
      const response = await fetch(baseUrl + "/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotPasswordEmail,
        }),
      });

      const result = await response.json();

      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "success",
          title: lang.passwordResetTitle,
          message: lang.passwordResetMessage,
          duration: 8000,
        },
      });

      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch (error) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "success", // Always show success to prevent email enumeration
          title: lang.passwordResetTitle,
          message: lang.passwordResetMessage,
          duration: 8000,
        },
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    }
  };

  const handleResendEmailVerification = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        baseUrl + "/api/auth/send-email-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "success",
            message: lang.emailSent,
            duration: 6000,
          },
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          message: error.message || lang.sendVerificationFailed,
        },
      });
    }
    setEmailVerificationDialog(false);
  };

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
    <Container component="main" maxWidth="sm">
      <Box
        component={motion.div}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "100vh",
          justifyContent: "center",
        }}
      >
        {isLoading ? (
          <Panel>
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

                  <Box sx={{ textAlign: "center", mt: 1, mb: 2 }}>
                    <Link
                      component="button"
                      type="button"
                      variant="body2"
                      onClick={() => setShowForgotPassword(true)}
                      sx={{ cursor: "pointer" }}
                    >
                      {lang.forgotPassword}
                    </Link>
                  </Box>

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
                      sx={{ mt: 1, mb: 2 }}
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
                      sx={{ mt: 1, mb: 2 }}
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

      {/* Forgot Password Dialog */}
      <Dialog
        open={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      >
        <DialogTitle>{lang.resetPassword}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {lang.enterResetEmail}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label={lang.emailAddress}
            type="email"
            fullWidth
            variant="outlined"
            value={forgotPasswordEmail}
            onChange={(e) => setForgotPasswordEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowForgotPassword(false)}>
            {lang.cancel}
          </Button>
          <Button onClick={handleForgotPassword} variant="contained">
            {lang.sendResetLink}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Verification Dialog */}
      <Dialog
        open={emailVerificationDialog}
        onClose={() => setEmailVerificationDialog(false)}
      >
        <DialogTitle>{lang.emailVerificationRequired}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {lang.pleaseVerifyEmail}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailVerificationDialog(false)}>
            {lang.close}
          </Button>
          <Button onClick={handleResendEmailVerification} variant="contained">
            {lang.resendVerification}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Email Dialog */}
      <Dialog
        open={showAddEmailDialog}
        onClose={() => !isAddingEmail && setShowAddEmailDialog(false)}
        disableEscapeKeyDown={isAddingEmail}
      >
        <DialogTitle>{lang.addEmail}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {lang.addEmailMessage}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label={lang.email}
            type="email"
            fullWidth
            variant="outlined"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isAddingEmail}
            placeholder="example@domain.com"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowAddEmailDialog(false)}
            disabled={isAddingEmail}
          >
            {lang.cancel}
          </Button>
          <Button
            onClick={handleAddEmail}
            variant="contained"
            disabled={isAddingEmail}
          >
            {isAddingEmail ? <CircularProgress size={20} /> : lang.addEmail}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Login;
