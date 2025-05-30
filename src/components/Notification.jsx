import { Alert, AlertTitle, Snackbar } from "@mui/material";
import React, { memo } from "react";
import { useValue } from "./ContextProvider";
import { color } from "framer-motion";

const Notification = memo(() => {
  const {
    state: { alert },
    dispatch,
  } = useValue();

  const handleClose = (event, reason) => {
    if (reason === "clickaway") return;
    dispatch({ type: "UPDATE_ALERT", payload: { ...alert, open: false } });
  };

  return (
    <Snackbar
      open={alert?.open}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      sx={{
        "& .MuiAlertTitle-root": {
          color: "#f5f5f5", // Light color for title in filled alerts
          fontWeight: "bold",
          marginBottom: "4px",
        },
      }}
    >
      <Alert
        onClose={handleClose}
        severity={alert?.severity}
        variant="filled"
        elevation={10}
      >
        <AlertTitle>{alert?.title}</AlertTitle>
        {alert?.message}
      </Alert>
    </Snackbar>
  );
});

export default Notification;
