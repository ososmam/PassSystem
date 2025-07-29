import React, { useState, useContext, useEffect } from "react";
import {
  collection,
  getDoc,
  setDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Grid,
  CircularProgress,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";
import { RtlContext } from "./RtlContext";
import { useValue } from "./ContextProvider";
import FileUpload from "./FileUpload";
import axios from "axios";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/ar";
import { motion } from "framer-motion";
import heic2any from "heic2any";

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
  const [type, setType] = useState("");
  const [userFound, setUserFound] = useState(false);
  const [rentEndDate, setRentEndDate] = useState(null);

  const [termsChecked, setTermsChecked] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [building, setBuilding] = useState("");
  const [name, setName] = useState("");
  const [flat, setFlat] = useState("");
  const [buildingError, setBuildingError] = useState("");
  const [flatError, setFlatError] = useState("");
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();
  const lang = isRtl ? ar : en;
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [fileErrors, setFileErrors] = useState({});
  const [contractFile, setContractFile] = useState(null);
  const [idFile, setIdFile] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false); // Dialog open state
  const [contractHint, setContractHint] = useState("");
  const [idHint, setIdHint] = useState("");
  useEffect(() => {
    dayjs.locale(isRtl ? "ar" : "en");
  }, [isRtl]);
  const toggleRegister = () => {
    navigate("/");
  };

  const toggleDialog = () => {
    setDialogOpen(!dialogOpen);
  };

  const convertArabicToEnglishNumbers = (input) => {
    const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return input
      .split("")
      .map((char) => {
        const index = arabicNumbers.indexOf(char);
        return index !== -1 ? index.toString() : char;
      })
      .join("");
  };
  const uploadFileWithAxios = async (file, containerName, docId) => {
    try {
      // Construct the SAS URL
      const sasURL = new URL(
        `https://darmasr.blob.core.windows.net/darmasr2/${containerName}/${docId}.jpg?sp=racwdli&st=2024-11-17T17:44:11Z&se=2025-11-27T01:44:11Z&sv=2022-11-02&sr=c&sig=USoAvD5pBVHTAbKJeI9EUmGG5aLtC6J04nF%2FUoJC2Ho%3D`
      );

      // Convert HEIC/HEIF to JPEG if needed (iOS images)
      let uploadFile = file;
      if (file.type === "image/heic" || file.type === "image/heif") {
        uploadFile = await convertHeicToJpeg(file);
      }

      const response = await axios.put(sasURL.toString(), uploadFile, {
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": uploadFile.type,
          "x-ms-blob-content-type": uploadFile.type,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Upload progress: ${percentCompleted}%`);
        },
      });

      if (response.status === 201) {
        return sasURL.origin + sasURL.pathname; // Return URL without SAS token
      }
      throw new Error(`Upload failed with status ${response.status}`);
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error(
        error.response?.data?.message || "File upload failed. Please try again."
      );
    }
  };

  async function convertHeicToJpeg(file) {
    try {
      console.log("Converting HEIC/HEIF to JPEG...");

      // Convert HEIC/HEIF to JPEG
      const conversionResult = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9, // Quality between 0 and 1 (default: 0.92)
      });

      // The conversion can return either a Blob or an array of Blobs
      const jpegBlob = Array.isArray(conversionResult)
        ? conversionResult[0]
        : conversionResult;

      // Create a new File object with the converted blob
      const jpegFile = new File(
        [jpegBlob],
        file.name.replace(/\.[^/.]+$/, ".jpg"),
        {
          type: "image/jpeg",
          lastModified: Date.now(),
        }
      );

      console.log("Conversion successful", jpegFile);
      return jpegFile;
    } catch (error) {
      console.error("HEIC conversion failed:", error);
      throw new Error("Failed to convert HEIC image to JPEG");
    }
  }

  const handleTypeChange = (event) => {
    setType(event.target.value);
    if (event.target.value !== "rent") {
      setRentEndDate(null);
    }
  };
  const handleRegister = async (event) => {
    event.preventDefault();
    if (!name) {
      setNameError(lang.requiredField);
      return;
    }
    // Basic validation
    if (!building) {
      setBuildingError(lang.requiredField);
      return;
    }
    if (!flat) {
      setFlatError(lang.requiredField);
      return;
    }
    if (password !== confirmPassword) {
      setError(lang.passwordMismatch);
      return;
    }
    if (password.length < 6) {
      setError(lang.passwordTooShort);
      return;
    }
    if (phone.length !== 11 || !phone.startsWith("0")) {
      setPhoneError(lang.invalidPhone);
      return;
    } else {
      setPhoneError("");
    }

    try {
      toggleDialog();
    } catch (error) {
      console.error("Error during registration:", error);
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.registrationFailed,
        },
      });
    }
  };
  const resetForm = () => {
    setName("");
    setBuilding("");
    setFlat("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setType("");
    setRentEndDate(null);
    setContractFile(null);
    setIdFile(null);
    setError("");
    setNameError("");
    setBuildingError("");
    setFlatError("");
    setPhoneError("");
    setPasswordHint("");
    setDialogOpen(false); // Close dialog
    setFileErrors({}); // Clear file errors
    setUserFound(false);
  };

  useEffect(() => {
    if (contractFile) {
      setContractHint("");
    }
  }, [contractFile]);

  useEffect(() => {
    if (idFile) {
      setIdHint("");
    }
  }, [idFile]);
  const handleFileUpload = async () => {
    try {
      // Validate files before upload
      if (!contractFile || !idFile) {
        setFileErrors({
          contract: !contractFile ? lang.fileRequired : "",
          id: !idFile ? lang.fileRequired : "",
        });
        return;
      }

      if (contractFile && idFile && contractFile.name === idFile.name) {
        setFileErrors({
          contract: lang.sameFileError,
          id: lang.sameFileError,
        });
        return;
      }

      setIsUploading(true);
      dispatch({ type: "START_LOADING" });

      const hostId = `${building}-${flat}${type.charAt(0).toLocaleLowerCase()}`;
      const verifiedRef = doc(firestore, "hosts", hostId);
      const verifiedSnap = await getDoc(verifiedRef);

      const hostData = {
        name: name,
        building: parseInt(building),
        flat: parseInt(flat),
        type: type,
        verified: false,
      };

      if (verifiedSnap.exists()) {
        const verifiedData = verifiedSnap.data();

        if (verifiedData.verified === true) {


          if (
            verifiedData.phone === phone.substring(1) ||
            verifiedData.secondPhone === phone.substring(1)
          ) {
            throw new Error(lang.userAlreadyExists);
          }

          if (verifiedData.phone && verifiedData.secondPhone) {
            throw new Error(lang.maxUsersPerUnit);
          }
          hostData.name = verifiedData.name.toString();
          hostData.phone = verifiedData.phone.toString();
          hostData.secondPhone = phone.substring(1);
        } else {
          hostData.phone = phone.substring(1);
        }
      } else {
        hostData.phone = phone.substring(1);
      }

      // Upload files with error handling
      let contractUrl, idPhotoUrl;
      try {
        contractUrl = await uploadFileWithAxios(
          contractFile,
          "contracts",
          hostId
        );
        idPhotoUrl = await uploadFileWithAxios(idFile, "ids", hostId);
      } catch (uploadError) {
        console.error("File upload failed:", uploadError);
        throw new Error(lang.fileUploadFailed);
      }

      // Validate URLs were received
      if (!contractUrl || !idPhotoUrl) {
        throw new Error(lang.fileUploadFailed);
      }

      const newHostRef = doc(firestore, "unverified", hostId);

      hostData.contract = contractUrl;
      hostData.idPhoto = idPhotoUrl;

      if (type === "rent") {
        if (!rentEndDate) {
          throw new Error(lang.rentEndDateRequired);
        }
        const dateObject = dayjs(rentEndDate).toDate();
        hostData.endDate = Timestamp.fromDate(dateObject);
      }

      const userEmail = `${phone.substring(1)}@dm2.test`;

      // Create user and save data with error handling
      try {
        await createUserWithEmailAndPassword(firebaseAuth, userEmail, password);
        await setDoc(newHostRef, hostData, { merge: true });
      } catch (authError) {
        console.error("Authentication error:", authError);
        // Handle specific auth errors
        if (authError.code === "auth/email-already-in-use") {
          throw new Error(lang.userAlreadyExists);
        } else if (authError.code === "auth/weak-password") {
          throw new Error(lang.weakPassword);
        } else {
          throw new Error(lang.registrationFailed);
        }
      }

      // Success flow
      setIsUploading(false);
      dispatch({ type: "END_LOADING" });
      resetForm();
      setDialogOpen(false);
      navigate("/");
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "success",
          title: lang.success,
          message: lang.registrationSuccess,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      setIsUploading(false);
      dispatch({ type: "END_LOADING" });

      const errorMessage = error.message || lang.failed;

      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: errorMessage,
        },
      });

      // Additional error handling for specific cases
      if (error.message === lang.fileUploadFailed) {
        setFileErrors({
          contract: lang.fileUploadFailed,
          id: lang.fileUploadFailed,
        });
      }
    }
  };

  // Handle password change and set hints
  const handlePasswordChange = (event) => {
    const newPassword = event.target.value;
    setPassword(newPassword);

    // Provide hints for password strength
    if (newPassword.length < 6) {
      setPasswordHint(lang.passwordTooShort);
    } else if (!/\d/.test(newPassword)) {
      setPasswordHint(lang.passwordNeedsNumber);
    } else if (!/[A-Z]/.test(newPassword)) {
      setPasswordHint(lang.passwordNeedsUppercase);
    } else {
      setPasswordHint(""); // Password is strong enough
    }
  };

  // Handle confirm password change
  const handleConfirmPasswordChange = (event) => {
    const newConfirmPassword = event.target.value;
    setConfirmPassword(newConfirmPassword);

    if (newConfirmPassword && newConfirmPassword !== password) {
      setError(lang.passwordMismatch);
    } else {
      setError("");
    }
  };

  // Handle phone number change
  const handlePhoneChange = (event) => {
    const newPhone = convertArabicToEnglishNumbers(event.target.value);
    setPhone(newPhone);

    // Reset phone error if the number is valid
    if (newPhone.length === 11 && newPhone.startsWith("0")) {
      setPhoneError("");
    } else {
      setPhoneError(lang.invalidPhone);
    }
  };

  // Handle building change
  const handleBuildingChange = (event) => {
    const newBuilding = convertArabicToEnglishNumbers(event.target.value);
    setBuilding(newBuilding);
    setBuildingError(""); // Reset error on change
  };

  const handleNameChange = (event) => {
    const newName = event.target.value;
    setName(newName);
    setNameError(""); // Reset error on change
  };

  // Handle flat change
  const handleFlatChange = (event) => {
    const newFlat = convertArabicToEnglishNumbers(event.target.value);
    setFlat(newFlat);
    setFlatError(""); // Reset error on change
  };

  const toggleTermsDialog = () => {
    setTermsDialogOpen(!termsDialogOpen);
  };

  const handleTermsChange = (event) => {
    setTermsChecked(event.target.checked);
  };

  // Check if the button should be disabled
  const isButtonDisabled =
    !name ||
    !building ||
    !flat ||
    phoneError ||
    !phone ||
    !type ||
    (type === "rent" && !rentEndDate) ||
    password.length < 6 ||
    password !== confirmPassword ||
    !!buildingError ||
    !!flatError ||
    !termsChecked;

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
  const dialogVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
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
            <motion.div
              variants={formVariants}
              initial="hidden"
              animate="visible"
            >
              <TextField
                margin="normal"
                required
                fullWidth
                name="name"
                type="text"
                label={lang.name}
                id="name"
                value={name}
                onChange={handleNameChange}
              />
              {nameError && <FormHelperText error>{nameError}</FormHelperText>}

              <TextField
                margin="normal"
                required
                fullWidth
                name="building"
                type="number"
                label={lang.building}
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
                label={lang.apartment}
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
                label={lang.phone}
                id="phone"
                value={phone}
                onChange={handlePhoneChange}
              />
              {phoneError && (
                <FormHelperText error>{phoneError}</FormHelperText>
              )}

              <TextField
                margin="normal"
                required
                fullWidth
                name="regPassword"
                label={lang.password}
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
                label={lang.confirmPassword}
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
                        {showConfirmPassword ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {error && (
                <FormHelperText error>{lang.passwordMismatch}</FormHelperText>
              )}
              <FormControl fullWidth margin="normal">
                <InputLabel id="type-label">{lang.userType}</InputLabel>
                <Select
                  labelId="type-label"
                  id="type"
                  value={type}
                  onChange={handleTypeChange}
                  label={lang.userType}
                >
                  <MenuItem value="" disabled>
                    {lang.selectUserType}
                  </MenuItem>
                  <MenuItem value="owner">{lang.owner}</MenuItem>
                  <MenuItem value="rent">{lang.rent}</MenuItem>
                </Select>
              </FormControl>
            </motion.div>
            {type === "rent" && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <motion.div
                  variants={formVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <FormHelperText>{lang.pleaseSelectDate} </FormHelperText>
                  <br />
                  <DatePicker
                    label={lang.rentEndDate} // Localized label
                    value={rentEndDate}
                    onChange={(newValue) => setRentEndDate(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        margin="normal"
                        fullWidth
                        required
                        error={!rentEndDate}
                        helperText={!rentEndDate ? lang.pleaseSelectDate : ""}
                      />
                    )}
                  />
                </motion.div>
              </LocalizationProvider>
            )}
            <Box display="flex" alignItems="center" mt={2}>
              <input
                type="checkbox"
                id="terms"
                checked={termsChecked}
                onChange={handleTermsChange}
              />
              <Typography
                component="span"
                variant="body2"
                sx={{
                  marginLeft: 1,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
                onClick={toggleTermsDialog}
              >
                {lang.agreeToTerms}
              </Typography>
            </Box>
            <motion.div
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
            >
              <Button
                type="submit"
                id="registerButton"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isButtonDisabled}
              >
                {lang.register}
              </Button>

              <Button
                onClick={toggleRegister}
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
              >
                {lang.switchToLogin}
              </Button>
            </motion.div>
          </Box>
        </Panel>
      </Box>
      {/* Terms and Conditions Dialog */}
      <Dialog
        open={termsDialogOpen}
        onClose={toggleTermsDialog}
        maxWidth="md"
        fullWidth
        component={motion.div} // Animate the dialog
        variants={dialogVariants}
        initial="hidden"
        animate="visible"
      >
        <DialogTitle>{lang.termsTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" paragraph>
            {lang.userObligations}
          </Typography>
          <Typography variant="body1" paragraph>
            {lang.dataPrivacy}
          </Typography>
          <Typography variant="body1" paragraph>
            {lang.prohibitedActivities}
          </Typography>
          <Typography variant="body1" paragraph>
            {lang.limitationOfLiability}
          </Typography>
          <Typography variant="body1" paragraph>
            {lang.changesToTerms}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={toggleTermsDialog} color="secondary">
            {lang.close}
          </Button>
        </DialogActions>
      </Dialog>
      {/* File Upload Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={toggleDialog}
        maxWidth="sm"
        fullWidth
        component={motion.div} // Animate the dialog
        variants={dialogVariants}
        initial="hidden"
        animate="visible"
      >
        <DialogTitle>{lang.uploadFiles}</DialogTitle>
        <DialogContent>
          <FormHelperText
            sx={{
              whiteSpace: "pre-line",
              color: { color: "red" },
              fontSize: "0.75rem",
            }}
          >
            {lang.uploadInstructions}
          </FormHelperText>
          {/* File upload status or feedback */}
          {contractFile && idFile && idFile.name !== contractFile.name && (
            <FormHelperText sx={{ color: "green" }}>
              {lang.filesReadyToUpload}
            </FormHelperText>
          )}

          {/* File Upload Components */}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FileUpload
                label={lang.contract} // Localized label
                onFileChange={(file, error) => {
                  if (error) {
                    setFileErrors((prev) => ({ ...prev, contract: error }));
                  } else {
                    setFileErrors((prev) => ({ ...prev, contract: "" }));
                    setContractFile(file);
                    if (idFile && file.name === idFile.name) {
                      setFileErrors({
                        contract: lang.sameFileError,
                        id: lang.sameFileError,
                      });
                    }
                  }
                }}
                error={fileErrors.contract}
              />
              <FormHelperText
                sx={{ color: { color: "primary" }, fontSize: "0.75rem" }}
              >
                {lang.contractHint}
              </FormHelperText>
            </Grid>

            <Grid item xs={12}>
              <FileUpload
                label={lang.idPhoto} // Localized label
                onFileChange={(file, error) => {
                  if (error) {
                    setFileErrors((prev) => ({ ...prev, id: error }));
                  } else {
                    setFileErrors((prev) => ({ ...prev, id: "" }));
                    setIdFile(file);
                    if (contractFile && file.name === contractFile.name) {
                      setFileErrors({
                        contract: lang.sameFileError,
                        id: lang.sameFileError,
                      });
                    }
                  }
                }}
                error={fileErrors.id}
              />
              <FormHelperText
                sx={{ color: { color: "primary" }, fontSize: "0.75rem" }}
              >
                {lang.idHint}
              </FormHelperText>
            </Grid>
          </Grid>

          {/* Display loading spinner if uploading */}
          {isUploading && <CircularProgress sx={{ marginTop: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={toggleDialog} color="secondary">
            {lang.cancel}
          </Button>
          <Button
            onClick={handleFileUpload}
            color="primary"
            disabled={
              !contractFile ||
              !idFile ||
              isUploading ||
              (contractFile && idFile && contractFile.name === idFile.name)
            }
          >
            {isUploading ? lang.uploading : lang.upload}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Register;
