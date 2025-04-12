import React, { useState, useRef, useContext } from "react";
import {
  Box,
  Button,
  Typography,
  Avatar,
  FormHelperText,
  Grid,
} from "@mui/material";
import { RtlContext } from "./RtlContext";
import ar from "../locales/ar.json";
import en from "../locales/en.json";

const MAX_FILE_SIZE_MB = 5;

function FileUpload({ label, onFileChange, error, hint }) {
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const { isRtl } = useContext(RtlContext);
  const fileInputRef = useRef(null);
  const lang = isRtl ? ar : en;

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    
    // Reset state if no file selected
    if (!file) {
      setPreview(null);
      setFileName("");
      onFileChange(null, null);
      return;
    }

    // Check file size
    if (file.size / (1024 * 1024) > MAX_FILE_SIZE_MB) {
      const errorMessage = lang.fileSizeError.replace(
        "{{size}}",
        MAX_FILE_SIZE_MB
      );
      onFileChange(null, errorMessage);
      return;
    }

    // Check file type
    const validImageTypes = ["image/jpeg", "image/png", "image/heic", "image/heif"]; // Added HEIC/HEIF for iOS
    if (!validImageTypes.includes(file.type)) {
      onFileChange(null, lang.invalidFileTypeError);
      return;
    }

    // Generate preview URL
    const fileURL = URL.createObjectURL(file);
    setPreview(fileURL);
    setFileName(file.name);

    // Notify parent component
    onFileChange(file, null);
  };

  // Special handler for iOS devices
  const handleButtonClick = (e) => {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      e.preventDefault();
      fileInputRef.current.click();
    }
  };

  return (
    <Box mt={2} sx={{ border: "1px solid #ccc", borderRadius: 2, padding: 2 }}>
      {/* Hint text */}
      {hint && (
        <Typography variant="body2" color="textSecondary" mb={1}>
          {hint}
        </Typography>
      )}

      {/* Label */}
      <Typography variant="h6" textAlign="center">
        {label}
      </Typography>

      <Grid
        container
        spacing={2}
        alignItems="center"
        justifyContent="center"
        mt={2}
      >
        {/* File preview and name */}
        <Grid item xs={12} md={6} textAlign="center">
          <Box display="flex" alignItems="center" justifyContent="center">
            <Typography variant="body2" sx={{ marginRight: 2 }}>
              {fileName || lang.noFileChosen}
            </Typography>
            {preview && (
              <Avatar
                src={preview}
                alt={fileName}
                variant="rounded"
                sx={{ width: 50, height: 50 }}
              />
            )}
          </Box>
        </Grid>

        {/* Upload button */}
        <Grid item xs={12} md={6} textAlign="center">
          <Button
            variant="contained"
            component="label"
            onClick={handleButtonClick}
            sx={{
              // iOS-specific styling
              "@media (max-width: 600px)": {
                padding: "8px 16px",
                fontSize: "0.875rem"
              }
            }}
          >
            {lang.upload}
            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*,image/heic,image/heif" // Added HEIC/HEIF support
              onChange={handleFileChange}
              onClick={(e) => e.stopPropagation()} // Prevent event bubbling
            />
          </Button>
        </Grid>
      </Grid>

      {/* Error message */}
      {error && (
        <FormHelperText error sx={{ textAlign: "center", mt: 2 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}

export default FileUpload;