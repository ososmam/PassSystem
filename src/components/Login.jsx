import "../App.css";
import React, { useState, useEffect, useContext } from "react";
import { apiClient } from "../apiClient";
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

  // Device limit logic is now handled by the API during registration


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

      // Update Firebase document update removed - handled by backend if needed, or ignored.
      // If we need to update "Properties" table email (if it existed), we'd need an endpoint.
      // For now we assume email is only Auth concern.


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

    if (!authToken) {
      dispatch({ type: "END_LOADING" });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Verify Token
      const isValid = await apiClient.verifyToken(authToken);
      if (!isValid) {
        throw new Error("Invalid token");
      }

      // 2. Refresh User Data (optional but recommended to check verified status)
      // We assume stored user has phone number. 
      const storedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (!storedUser.phone && !storedUser.phoneNumber) {
        // If no phone, just assume valid for now or force logout
        // throw new Error("No user profile found");
      }

      const phone = storedUser.phone || storedUser.phoneNumber;
      let currentUserData = storedUser;

      if (phone) {
        const propertyData = await apiClient.getPropertyByPhone(phone);
        if (propertyData) {
          currentUserData = {
            ...currentUserData,
            ...propertyData,
            id: propertyData.hostId // Ensure id is set from hostId
          };

          // Check Verified Status
          if (!currentUserData.verifiedAccount) {
            throw new Error("Account not verified");
          }

          // Check Rental Expiration
          if (currentUserData.endDate) {
            const endDate = new Date(currentUserData.endDate);
            if (endDate < new Date()) {
              throw new Error(lang.rentalExpired || "Your rental period has ended");
            }
          }
        }
      }

      dispatch({ type: "UPDATE_USER", payload: currentUserData });
      navigate("/home");

      // Use User ID for notifications
      if (currentUserData.id) {
        requestNotificationPermission(currentUserData.id);
      }

    } catch (error) {
      console.error("Session verification failed:", error);
      clearUserSession();
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
      // 1. Auth Login
      const response = await apiClient.login(phone, password);

      if (response && response.success) {
        // 2. Fetch Property Data to check active/verified status
        const propertyData = await apiClient.getPropertyByPhone(phone, response.token);

        if (!propertyData) {
          throw new Error(lang.notVerified || "Account not found or not verified.");
        }

        if (!propertyData.verifiedAccount) {
          throw new Error(lang.notVerified || "Your account is not verified yet.");
        }

        // 3. Check/Register Device
        // The API handles limit checks. If limit reached, it throws 400.
        try {
          const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "iOS" : /Android/.test(navigator.userAgent) ? "Android" : "Web";
          const typeChar = propertyData.type ? propertyData.type.charAt(0).toLowerCase() : "";
          await apiClient.registerDevice(propertyData.hostId || (propertyData.building + "-" + propertyData.flat + typeChar), currentDeviceId, platform, response.token);
        } catch (deviceError) {
          if (deviceError.message.includes("limit")) {
            throw new Error(lang.deviceLimitReached || "Device limit reached.");
          }
          // For other device errors, we might want to allow login but warn? 
          // Or fail strict. Let's fail strict for now as requested.
          throw deviceError;
        }

        // 4. Check Rental Expiration
        if (propertyData.endDate) {
          const endDate = new Date(propertyData.endDate);
          if (endDate < new Date()) {
            throw new Error(lang.rentalExpired || "Your rental period has ended.");
          }
        }

        // 5. Success
        const userData = {
          ...response.user,
          ...propertyData,
          id: propertyData.hostId // Unify ID usage
        };

        localStorage.setItem("authToken", response.token);
        localStorage.setItem("currentUser", JSON.stringify(userData));
        dispatch({ type: "UPDATE_USER", payload: userData });

        if (userData.id) {
          requestNotificationPermission(userData.id);
        }

        navigate("/home");
        return;
      }

      // Handle known failures from Auth API
      if (response.requiresEmailVerification) {
        throw new Error(lang.pleaseVerifyEmail || "Please verify your email.");
      }
      if (response.requiresEmail) {
        // Logic to show Add Email dialog can be restored if needed
        throw new Error(lang.emailRequired || "Email required.");
      }

      throw new Error(response.message || "Login failed");

    } catch (error) {
      console.error("Login error:", error);
      let errorMessage = error.message || "Login failed";

      if (errorMessage.includes("fetch")) errorMessage = lang.networkError || "Network error";

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