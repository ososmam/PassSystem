import React, { useState ,useContext} from "react";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { firestore, firebaseAuth } from "./firebaseApp";
import en from "../locales/en.json";
import ar from "../locales/ar.json";
import {
  Button,
  Box,
  TextField,
  InputAdornment,
  IconButton,
  FormHelperText,
  Container,
  CssBaseline,
  Paper,
  Typography,
  styled,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";
import { RtlContext } from "./RtlContext";
import { useValue } from "./ContextProvider"
const Panel = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(3),
  textAlign: "center",
}));

function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [building, setBuilding] = useState("");
  const [flat, setFlat] = useState("");
  const [buildingError, setBuildingError] = useState("");
  const [flatError, setFlatError] = useState("");
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();
  const lang = isRtl ? ar : en;
  const navigate = useNavigate();

  const toggleRegister = () => {
    navigate('/'); 
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    // Basic validation
    if (!building) {
      setBuildingError(isRtl ? ar.requiredField : en.requiredField);
      return;
    }
    if (!flat) {
      setFlatError(isRtl ? ar.requiredField : en.requiredField);
      return;
    }
    if (password !== confirmPassword) {
      setError(isRtl ? ar.passwordMismatch : en.passwordMismatch);
      return;
    }
    if (password.length < 6) {
      setError(isRtl ? ar.passwordTooShort : en.passwordTooShort);
      return;
    }
    if (phone.length !== 11 || !phone.startsWith("0")) {
      setPhoneError(isRtl ? ar.invalidPhone : en.invalidPhone);
      return;
    } else {
      setPhoneError("");
    }

    try {
      const querySnapshot = await getDocs(
        query(
          collection(firestore, "hosts"),
          where("building", "==", parseInt(building)),
          where("flat", "==", parseInt(flat)),
          where("phone", "==", phone.substring(1)) // Remove leading 0 for Firestore query
        )
      );

      if (!querySnapshot.empty) {
        const userEmail = `${phone.substring(1)}@dm2.test`; // Use phone as email

        await createUserWithEmailAndPassword(firebaseAuth, userEmail, password);

        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "success",
            title: isRtl ? ar.success : en.success,
            message: isRtl ? ar.registrationSuccess : en.registrationSuccess,
          },
        });
        
      } else {
        dispatch({
          type: "UPDATE_ALERT",
          payload: {
            open: true,
            severity: "error",
            title: isRtl ? ar.error : en.error,
            message: isRtl ? ar.registrationFailed : en.registrationFailed,
          },
        });
      }
    } catch (error) {
      console.error("Error during registration:", error);
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: isRtl ? ar.error : en.error,
          message: isRtl ? ar.registrationFailed : en.registrationFailed,
        },
      });
    }
  };

  // Handle password change and set hints
  const handlePasswordChange = (event) => {
    const newPassword = event.target.value;
    setPassword(newPassword);

    // Provide hints for password strength
    if (newPassword.length < 6) {
      setPasswordHint(isRtl ? ar.passwordTooShort : en.passwordTooShort);
    } else if (!/\d/.test(newPassword)) {
      setPasswordHint(isRtl ? ar.passwordNeedsNumber : en.passwordNeedsNumber);
    } else if (!/[A-Z]/.test(newPassword)) {
      setPasswordHint(
        isRtl ? ar.passwordNeedsUppercase : en.passwordNeedsUppercase
      );
    } else {
      setPasswordHint(""); // Password is strong enough
    }
  };

  // Handle confirm password change
  const handleConfirmPasswordChange = (event) => {
    const newConfirmPassword = event.target.value;
    setConfirmPassword(newConfirmPassword);

    if (newConfirmPassword && newConfirmPassword !== password) {
      setError(isRtl ? ar.passwordMismatch : en.passwordMismatch);
    } else {
      setError("");
    }
  };

  // Handle phone number change
  const handlePhoneChange = (event) => {
    const newPhone = event.target.value;
    setPhone(newPhone);

    // Reset phone error if the number is valid
    if (newPhone.length === 11 && newPhone.startsWith("0")) {
      setPhoneError("");
    } else {
      setPhoneError(isRtl ? ar.invalidPhone : en.invalidPhone);
    }
  };

  // Handle building change
  const handleBuildingChange = (event) => {
    const newBuilding = event.target.value;
    setBuilding(newBuilding);
    setBuildingError(""); // Reset error on change
  };

  // Handle flat change
  const handleFlatChange = (event) => {
    const newFlat = event.target.value;
    setFlat(newFlat);
    setFlatError(""); // Reset error on change
  };

  // Check if the button should be disabled
  const isButtonDisabled =
    !building ||
    !flat ||
    phoneError ||
    !phone ||
    password.length < 6 ||
    password !== confirmPassword ||
    !!buildingError ||
    !!flatError;

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
        <Panel width={150}>
          <img
            src={require("../images/logo192.png")}
            width={100}
            height={"auto"}
            alt=""
          />
<br></br>
          <Typography component="h1" variant="h5">
            {lang.register}
          </Typography>
          <Box
            component="form"
            onSubmit={handleRegister}
            noValidate
            sx={{ mt: 1 }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              name="building"
              type="number"
              label={isRtl ? ar.building : en.building}
              id="building"
              value={building}
              onChange={handleBuildingChange}
            />
            {buildingError && (
              <FormHelperText error>{buildingError}</FormHelperText>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              name="flat"
              type="number"
              label={isRtl ? ar.apartment : en.apartment}
              id="flat"
              value={flat}
              onChange={handleFlatChange}
            />
            {flatError && <FormHelperText error>{flatError}</FormHelperText>}
            <TextField
              margin="normal"
              required
              fullWidth
              name="phone"
              type="number"
              label={isRtl ? ar.phone : en.phone}
              id="phone"
              value={phone}
              onChange={handlePhoneChange}
            />
            {phoneError && <FormHelperText error>{phoneError}</FormHelperText>}
            <TextField
              margin="normal"
              required
              fullWidth
              name="regPassword"
              label={isRtl ? ar.password : en.password}
              type={showPassword ? "text" : "password"}
              id="regPassword"
              value={password}
              onChange={handlePasswordChange}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {passwordHint && (
              <FormHelperText error>{passwordHint}</FormHelperText>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label={isRtl ? ar.confirmPassword : en.confirmPassword}
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {error && (
              <FormHelperText error>
                {isRtl ? ar.passwordMismatch : en.passwordMismatch}
              </FormHelperText>
            )}

            <Button
              type="submit"
              id="registerButton"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isButtonDisabled}
            >
              {isRtl ? ar.register : en.register}
            </Button>

            <Button
              onClick={toggleRegister}
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              {lang.switchToLogin}
            </Button>
          </Box>
        </Panel>
      </Box>
    </Container>
  );
}

export default Register;
