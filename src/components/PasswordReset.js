import React, { useState, useContext } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  styled,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Lock, Visibility, VisibilityOff, CheckCircle } from "@mui/icons-material";
import { motion } from "framer-motion";
import { RtlContext } from "./RtlContext";
import { useValue } from "./ContextProvider";
import en from "../locales/en.json";
import ar from "../locales/ar.json"; 

const Panel = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(4),
  textAlign: "center",
  borderRadius: 16,
}));

const PasswordReset = () => {
  const { isRtl } = useContext(RtlContext);
  const { state, dispatch } = useValue();
  const lang = isRtl ? ar : en;
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("form"); // form, success, error
  const [message, setMessage] = useState("");

  const token = searchParams.get("token");

  const validatePassword = (pwd) => {
    if (pwd.length < 6) {
      return lang.passwordMinLength;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token) {
      setStatus("error");
      setMessage(lang.invalidResetLink);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setMessage(lang.passwordsDoNotMatch);
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("https://auth.darmasr2.com/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          newPassword: password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(lang.passwordResetSuccess);
      } else {
        setStatus("error");
        setMessage(result.message || lang.passwordResetFailed);
      }
    } catch (error) {
      setStatus("error");
      setMessage(lang.somethingWentWrong);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.2 } },
  };

  if (status === "success") {
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
              <Lock sx={{ fontSize: 40, color: "success.main", mb: 2 }} />
            </Box>

            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
            >
              <CheckCircle sx={{ fontSize: 60, color: "success.main", mb: 2 }} />
            </motion.div>

            <Typography component="h2" variant="h5" gutterBottom>
              {lang.passwordResetSuccessTitle}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
              {message}
            </Typography>

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
                {lang.goToLogin}
              </Button>
            </motion.div>
          </Panel>
        </Box>
      </Container>
    );
  }

  if (!token) {
    return (
      <Container component="main" maxWidth="sm">
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minHeight: "100vh",
            justifyContent: "center",
          }}
        >
          <Panel>
            <Typography component="h1" variant="h4" gutterBottom>
              {lang.invalidResetLinkTitle}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {lang.invalidResetLinkDescription}
            </Typography>
            <Button variant="contained" onClick={handleGoToLogin}>
              {lang.goToLogin}
            </Button>
          </Panel>
        </Box>
      </Container>
    );
  }

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
            <Lock sx={{ fontSize: 40, color: "primary.main", mb: 2 }} />
          </Box>

          <Typography component="h2" variant="h5" gutterBottom>
            {lang.resetYourPassword}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
            {lang.resetPasswordInstructions}
          </Typography>

          {message && (
            <Alert 
              severity={status === "error" ? "error" : "info"} 
              sx={{ mb: 2, width: "100%" }}
            >
              {message}
            </Alert>
          )}

          <Box
            component={motion.form}
            variants={formVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleSubmit}
            sx={{ width: "100%", maxWidth: 400 }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={lang.newPassword}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label={lang.confirmNewPassword}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2 }}
            >
              {isLoading ? lang.resettingPassword : lang.resetPassword}
            </Button>

            <Button
              fullWidth
              variant="text"
              onClick={handleGoToLogin}
              sx={{ mt: 1 }}
            >
              {lang.backToLogin}
            </Button>
          </Box>
        </Panel>
      </Box>
    </Container>
  );
};

export default PasswordReset;