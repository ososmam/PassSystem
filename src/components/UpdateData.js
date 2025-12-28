import React, { useState, useContext, useEffect, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "./firebaseApp";
import en from "../locales/en.json";
import ar from "../locales/ar.json";
import {
  Button,
  Box,
  TextField,
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
  Grid,
  CircularProgress,
  IconButton,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
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

function UpdateData() {
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("");
  const [rentEndDate, setRentEndDate] = useState(null);
  const [entries, setEntries] = useState([{ cardNumber: "", carPlate: "" }]);
  const [entriesError, setEntriesError] = useState([
    { cardNumber: "", carPlate: "" },
  ]);

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
  const [personalCardFiles, setPersonalCardFiles] = useState([]);

  const noCardNumbers =
    entries.filter(
      (entry) => entry.cardNumber && entry.cardNumber.trim() !== ""
    ).length === 0;

  // Require at least one non-empty carPlate
  const noCarPlates =
    entries.filter((entry) => entry.carPlate && entry.carPlate.trim() !== "")
      .length === 0;

  useEffect(() => {
    dayjs.locale(isRtl ? "ar" : "en");
  }, [isRtl]);

const getSharedToken = useCallback(async () => {
    try {
      const [tokenDoc, apiVersionDoc] = await Promise.all([
        getDoc(doc(firestore, "common", "sharedToken")),
        getDoc(doc(firestore, "api_config", "version_settings"))
      ]);
  
      if (!tokenDoc.exists()) {
        console.error("No shared token found.");
        return null;
      }
  
      let requiredVersion = "1.0"; // default fallback
      if (apiVersionDoc.exists()) {
        requiredVersion = apiVersionDoc.data().required_version;
        console.log("Required API Version:", requiredVersion);
      } else {
        console.warn("No API version config found, using default");
      }
  
      return {
        token: tokenDoc.data().token,
        version: requiredVersion
      };
  
    } catch (error) {
      console.error("Error fetching config:", error);
      return null;
    }
  }, []);

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
      const sasURL = new URL(
        `https://darmasr.blob.core.windows.net/darmasr2/${containerName}/${docId}.jpg?sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2030-11-28T05:52:27Z&st=2025-11-27T21:37:27Z&spr=https&sig=ExWav03Ch4Ab2LScn1%2FFVGlac4OiESsUBV56ssq3H1M%3D`
      );

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
        return sasURL.origin + sasURL.pathname;
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

      const conversionResult = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });

      const jpegBlob = Array.isArray(conversionResult)
        ? conversionResult[0]
        : conversionResult;

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Reset errors
    setNameError("");
    setBuildingError("");
    setFlatError("");
    setPhoneError("");
    setEntriesError([]);

    // Validation
    if (!name) {
      setNameError(lang.requiredField);
      return;
    }
    if (!building) {
      setBuildingError(lang.requiredField);
      return;
    }
    if (!flat) {
      setFlatError(lang.requiredField);
      return;
    }
    if (!phone) {
      setPhoneError(lang.requiredField);
      return;
    }
    if (phone.length !== 11 || !phone.startsWith("0")) {
      setPhoneError(lang.invalidPhone);
      return;
    }
    // Validate card numbers
    const validCardNumbers = entries
      .filter((e) => e.cardNumber && e.cardNumber.trim() !== "")
      .map((e) => e.cardNumber.trim());

    if (validCardNumbers.length === 0) {
      const newErrors = [...entriesError];
      newErrors[0].cardNumber = lang.requiredField; // force first row error
      setEntriesError(newErrors);
      return;
    }

    // Validate car plates
    const validCarPlates = entries
      .filter((e) => e.carPlate && e.carPlate.trim() !== "")
      .map((e) => e.carPlate.trim());

    if (validCarPlates.length === 0) {
      const newErrors = [...entriesError];
      newErrors[0].carPlate = lang.requiredField; // force first row error
      setEntriesError(newErrors);
      return;
    }
    if (!type) {
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.requiredField,
        },
      });
      return;
    }

    try {
      handleFileUpload();
    } catch (error) {
      console.error("Error during data update:", error);
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.failed,
        },
      });
    }
  };

  const resetForm = () => {
    setName("");
    setBuilding("");
    setFlat("");
    setPhone("");
    setEntries([""]);
    setType("");
    setRentEndDate(null);
    setContractFile(null);
    setIdFile(null);
    setPersonalCardFiles([]);
    setNameError("");
    setBuildingError("");
    setFlatError("");
    setPhoneError("");
    setEntriesError([]);
    setFileErrors({});
  };

  useEffect(() => {
    if (contractFile) {
      setFileErrors((prev) => ({ ...prev, contract: "" }));
    }
  }, [contractFile]);

  useEffect(() => {
    if (idFile) {
      setFileErrors((prev) => ({ ...prev, id: "" }));
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

      const hostId = `${building}-${flat}${type.charAt(0).toLowerCase()}`;

      // Upload files with error handling
      let contractUrl,
        idPhotoUrl,
        personalCardUrls = [];

      try {
        // Upload contract and ID files
        contractUrl = await uploadFileWithAxios(
          contractFile,
          "UpdatedContracts",
          hostId
        );
        idPhotoUrl = await uploadFileWithAxios(idFile, "UpdatedIds", hostId);

        // Upload personal card files
        const validPersonalCardFiles = personalCardFiles.filter(
          (file) => file !== null
        );
        for (let i = 0; i < validPersonalCardFiles.length; i++) {
          const personalCardUrl = await uploadFileWithAxios(
            validPersonalCardFiles[i],
            "Updated-cards",
            `${hostId}-card-${i}`
          );
          personalCardUrls.push(personalCardUrl);
        }
      } catch (uploadError) {
        console.error("File upload failed:", uploadError);
        throw new Error(lang.fileUploadFailed);
      }

      // Validate URLs were received
      if (!contractUrl || !idPhotoUrl) {
        throw new Error(lang.fileUploadFailed);
      }

      // Prepare the property data according to the UpdatePropertyRequest structure
      const propertyData = {
        Name: name,
        Building: parseInt(building),
        Flat: parseInt(flat),
        Type: type.toLowerCase(),
        Phone: phone.startsWith("1") ? phone : phone.substring(1), // Ensure phone starts with 1
        CardsInfo: entries
  .filter((e) => (e.cardNumber && e.cardNumber.trim() !== "") || (e.carPlate && e.carPlate.trim() !== ""))
  .map((e) => ({
    Card: e.cardNumber ? e.cardNumber.trim() : "",
    CarPlate: e.carPlate ? e.carPlate.trim() : ""
  })),
        IdPhoto: idPhotoUrl,
        Contract: contractUrl,
        Verified: false,
      };

      if (type.toLocaleLowerCase() === "rent") {
        if (!rentEndDate) {
          throw new Error(lang.rentEndDateRequired);
        }
        propertyData.EndDate = dayjs(rentEndDate).toISOString();
      }

      // Prepare the update request
      const updateRequest = {
        Property: propertyData,
        CardPhotoUrls: personalCardUrls,
        SubmittedBy: "user", // You might want to get this from context or auth
        UseVerificationWorkflow: true,
      };

      const result = await getSharedToken();
    if (!result) {
      dispatch({ type: "END_LOADING" });
      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "error",
          title: lang.error,
          message: lang.failed,
        },
      });
      return;
    }
    const { token, version } = result;
      // Call the PropertyController endpoint
      const response = await axios.post("https://gh.darmasr2.com/api/property/update", updateRequest, {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
          "X-API-Version": version,
        },
      });

      if (response.status !== 200) {
        throw new Error(lang.updateFailed);
      }

      // Success flow
      setIsUploading(false);
      dispatch({ type: "END_LOADING" });
      resetForm();

      // Show success message
      const successMessage =
        lang.dataUpdatedSuccessfully ||
        "Data updated successfully! Your information has been submitted for review.";

      dispatch({
        type: "UPDATE_ALERT",
        payload: {
          open: true,
          severity: "success",
          title: lang.success,
          message: successMessage,
        },
      });
    } catch (error) {
      console.error("Data update error:", error);
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

      if (error.message === lang.fileUploadFailed) {
        setFileErrors({
          contract: lang.fileUploadFailed,
          id: lang.fileUploadFailed,
          personalCards: lang.fileUploadFailed,
        });
      }
    }
  };

  // Handle phone number change
  const handlePhoneChange = (event) => {
    const newPhone = convertArabicToEnglishNumbers(event.target.value);
    setPhone(newPhone);

    if (newPhone.length === 11 && newPhone.startsWith("0")) {
      setPhoneError("");
    } else if (newPhone.length > 0) {
      setPhoneError(lang.invalidPhone);
    }
  };

  // Handle building change
  const handleBuildingChange = (event) => {
    const newBuilding = convertArabicToEnglishNumbers(event.target.value);
    setBuilding(newBuilding);
    setBuildingError("");
  };

  const handleNameChange = (event) => {
    const newName = event.target.value;
    setName(newName);
    setNameError("");
  };

  // Handle flat change
  const handleFlatChange = (event) => {
    const newFlat = convertArabicToEnglishNumbers(event.target.value);
    setFlat(newFlat);
    setFlatError("");
  };

  // Handle card numbers
  const handleEntryChange = (index, field, value) => {
    const newEntries = [...entries];
    if (field === "cardNumber") {
      newEntries[index][field] = convertArabicToEnglishNumbers(value);
    } else {
      newEntries[index][field] = value;
    }
    setEntries(newEntries);

    const newErrors = [...entriesError];
    newErrors[index][field] = "";
    setEntriesError(newErrors);
  };
  const addEntry = () => {
    setEntries([...entries, { cardNumber: "", carPlate: "" }]);
    setEntriesError([...entriesError, { cardNumber: "", carPlate: "" }]);
  };

  // Remove entry
  const removeEntry = (index) => {
    if (entries.length > 1) {
      const newEntries = entries.filter((_, i) => i !== index);
      const newErrors = entriesError.filter((_, i) => i !== index);
      setEntries(newEntries);
      setEntriesError(newErrors);
    }
  };
  // Check if the button should be disabled
  const isButtonDisabled =
    !name ||
    !building ||
    !flat ||
    !phone ||
    noCardNumbers ||
    noCarPlates ||
    phoneError ||
    !type ||
    (type === "rent" && !rentEndDate) ||
    !!buildingError ||
    !!flatError;

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
          mb: 3,
        }}
      >
        <Panel>
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
          <Typography component="h1" variant="h3">
            {lang.updateData || "Update Data"}
          </Typography>

          <Box
            component={motion.form}
            variants={formVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleSubmit}
            sx={{ width: "100%", maxWidth: 400 }}
          >
            <FormHelperText
              sx={{
                whiteSpace: "pre-line",
                fontSize: "0.7rem",
                color: { color: "red" },
                mb: 2,
                mt: 2,
              }}
            >
              {lang.uploadInstructions}
            </FormHelperText>
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
            {phoneError && <FormHelperText error>{phoneError}</FormHelperText>}
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
                    label={lang.rentEndDate}
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
            {/* Card Numbers Section */}
            <Divider sx={{ mb: 1, mt: 1 }} />
            <Typography variant="h4" sx={{ mt: 2, mb: 1 }}>
              {lang.cardsAndPlates || "Cards & Plates"}
            </Typography>
            <FormHelperText
              sx={{ color: "text.secondary", fontSize: "0.75rem" }}
            >
              <Typography
                variant="subtitle1"
                sx={{ mb: 2, whiteSpace: "pre-line", color: { color: "red" } }}
              >
                {lang.cardNumberHint}
              </Typography>
            </FormHelperText>
            <motion.img
              src={require("../images/Badge.png")}
              width="80%"
              height={"auto"}
              alt=""
              variants={logoVariants}
              initial="hidden"
              animate="visible"
            />

            {entries.map((entry, index) => (
              <Box
                key={index}
                sx={{ display: "flex", alignItems: "center", mb: 1 }}
              >
                {/* Card Number */}
                <TextField
                  margin="normal"
                  required={index === 0}
                  fullWidth
                  name={`cardNumber-${index}`}
                  type="text"
                  label={`${lang.cardNumber || "Card Number"} ${index + 1}`}
                  value={entry.cardNumber}
                  onChange={(e) =>
                    handleEntryChange(index, "cardNumber", e.target.value)
                  }
                  error={!!entriesError[index]?.cardNumber}
                  sx={{ mr: 1 }}
                />

                {/* Car Plate */}
                <TextField
                  margin="normal"
                  required={index === 0}
                  fullWidth
                  name={`carPlate-${index}`}
                  type="text"
                  label={`${lang.carPlate || "Car Plate"} ${index + 1}`}
                  value={entry.carPlate}
                  onChange={(e) =>
                    handleEntryChange(index, "carPlate", e.target.value)
                  }
                  error={!!entriesError[index]?.carPlate}
                  sx={{ mr: 1 }}
                />

                {/* Buttons */}
                <IconButton onClick={addEntry} color="primary" sx={{ mt: 1 }}>
                  <AddIcon />
                </IconButton>
                {entries.length > 1 && (
                  <IconButton
                    onClick={() => removeEntry(index)}
                    color="error"
                    sx={{ mt: 1 }}
                  >
                    <RemoveIcon />
                  </IconButton>
                )}
              </Box>
            ))}
            <Divider sx={{ mb: 1, mt: 1 }} />
            <Typography variant="h4" sx={{ mt: 2, mb: 1 }}>
              {lang.personalCards || "Cards"}
            </Typography>
            <FormHelperText>
              <Typography
                variant="subtitle1"
                sx={{ mb: 2, whiteSpace: "pre-line", color: { color: "red" } }}
              >
                {lang.personalCardHint}
              </Typography>
            </FormHelperText>
            <motion.img
              src={require("../images/Card.png")}
              width="80%"
              height={"auto"}
              alt=""
              variants={logoVariants}
              initial="hidden"
              animate="visible"
              margin="20"
            />

            <Grid item xs={12}>
              {personalCardFiles.map((file, index) => (
                <Box key={index} sx={{ mt: 2, mb: 2 }}>
                  <FileUpload
                    label={`${lang.personalCard} ${index + 1}`}
                    onFileChange={(file, error) => {
                      if (error) {
                        setFileErrors((prev) => ({
                          ...prev,
                          [`personalCard${index}`]: error,
                        }));
                      } else {
                        setFileErrors((prev) => ({
                          ...prev,
                          [`personalCard${index}`]: "",
                        }));
                        const newFiles = [...personalCardFiles];
                        newFiles[index] = file;
                        setPersonalCardFiles(newFiles);
                      }
                    }}
                    error={fileErrors[`personalCard${index}`]}
                  />
                  <Button
                    variant="contained"
                    onClick={() => {
                      const newFiles = personalCardFiles.filter(
                        (_, i) => i !== index
                      );
                      setPersonalCardFiles(newFiles);
                    }}
                    color="error"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    {lang.removeCard}
                  </Button>
                </Box>
              ))}

              <Button
                onClick={() =>
                  setPersonalCardFiles([...personalCardFiles, null])
                }
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mt: 2, mb: 2 }}
              >
                {lang.addPersonalCard}
              </Button>

              {fileErrors.personalCards && (
                <FormHelperText error>
                  {fileErrors.personalCards}
                </FormHelperText>
              )}
            </Grid>
            {/* Validation error message */}
            {entriesError.some((err) => err.cardNumber || err.carPlate) && (
              <FormHelperText error>
                {entriesError.find((err) => err.cardNumber || err.carPlate)
                  ?.cardNumber ||
                  entriesError.find((err) => err.cardNumber || err.carPlate)
                    ?.carPlate ||
                  lang.requiredField}
              </FormHelperText>
            )}

            {/* File Upload Section */}
            <Typography variant="h4" sx={{ mt: 3, mb: 2 }}>
              {lang.uploadFiles}
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FileUpload
                  label={lang.contract}
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
                  sx={{
                    mb: 2,
                    whiteSpace: "pre-line",
                    color: { color: "red" },
                    fontSize: "0.75rem",
                  }}
                >
                  {lang.contractHint}
                </FormHelperText>
              </Grid>

              <Grid item xs={12}>
                <FileUpload
                  label={lang.idPhoto}
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
                  sx={{
                    mb: 2,
                    whiteSpace: "pre-line",
                    color: { color: "red" },
                    fontSize: "0.75rem",
                  }}
                >
                  {lang.idHint}
                </FormHelperText>
              </Grid>
            </Grid>

            {contractFile && idFile && idFile.name !== contractFile.name && (
              <FormHelperText sx={{ color: "success.main", mt: 2 }}>
                {lang.filesReadyToUpload}
              </FormHelperText>
            )}

            {isUploading && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <CircularProgress />
              </Box>
            )}

            <motion.div
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
            >
              <Button
                type="submit"
                id="updateButton"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isButtonDisabled}
              >
                {lang.updateData || "Update Data"}
              </Button>

              <Button
                onClick={() => navigate("/")}
                fullWidth
                variant="outlined"
                sx={{ mt: 1, mb: 2 }}
              >
                {lang.cancel || "Cancel"}
              </Button>
            </motion.div>
          </Box>
        </Panel>
      </Box>
    </Container>
  );
}

export default UpdateData;
