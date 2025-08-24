import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  styled,
} from "@mui/material";
import { CheckCircle, Error, Email } from "@mui/icons-material";
import { motion } from "framer-motion";

const Panel = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(4),
  textAlign: "center",
  borderRadius: 16,
}));

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying, success, error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");
      const userId = searchParams.get("userId");

      if (!token || !userId) {
        setStatus("error");
        setMessage("Invalid verification link. Please try again.");
        return;
      }

      try {
        const response = await fetch("https://auth.darmasr2.com/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: parseInt(userId),
            token: token,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage("Email verified successfully! You can now log in to your account.");
        } else {
          setStatus("error");
          setMessage(result.message || "Email verification failed. The link may be expired or invalid.");
        }
      } catch (error) {
        setStatus("error");
        setMessage("Something went wrong. Please try again later.");
      }
    };

    verifyEmail();
  }, [searchParams]);

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const iconVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1, 
      transition: { 
        duration: 0.5, 
        delay: 0.3,
        type: "spring",
        stiffness: 200 
      } 
    },
  };

  const renderIcon = () => {
    switch (status) {
      case "verifying":
        return <CircularProgress size={60} color="primary" />;
      case "success":
        return (
          <motion.div
            variants={iconVariants}
            initial="hidden"
            animate="visible"
          >
            <CheckCircle sx={{ fontSize: 60, color: "success.main" }} />
          </motion.div>
        );
      case "error":
        return (
          <motion.div
            variants={iconVariants}
            initial="hidden"
            animate="visible"
          >
            <Error sx={{ fontSize: 60, color: "error.main" }} />
          </motion.div>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (status) {
      case "verifying":
        return "Verifying Your Email...";
      case "success":
        return "Email Verified Successfully!";
      case "error":
        return "Verification Failed";
      default:
        return "";
    }
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
        <Panel>
          <Box sx={{ mb: 3 }}>
            <Email sx={{ fontSize: 40, color: "primary.main", mb: 2 }} />
            <Typography component="h1" variant="h4" gutterBottom>
              Gate Management System
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            {renderIcon()}
          </Box>

          <Typography component="h2" variant="h5" gutterBottom>
            {getTitle()}
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
            {message}
          </Typography>

          {status !== "verifying" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                variant="contained"
                size="large"
                onClick={handleGoToLogin}
                sx={{ mt: 2, px: 4 }}
              >
                Go to Login
              </Button>
            </motion.div>
          )}
        </Panel>
      </Box>
    </Container>
  );
};

export default EmailVerification;