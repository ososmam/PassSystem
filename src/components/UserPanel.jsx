import React, { useContext } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  styled,
  Paper,
  CssBaseline,
} from "@mui/material";
import { motion } from "framer-motion"; // Import Framer Motion
import en from "../../src/locales/en.json";
import ar from "../../src/locales/ar.json";

import { useValue } from "./ContextProvider";
import { RtlContext } from "./RtlContext";
import { useNavigate } from "react-router-dom";

function UserPanel() {
  const navigate = useNavigate();
  const { state } = useValue();
  const { isRtl } = useContext(RtlContext);

  const lang = isRtl ? ar : en;

  const Panel = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    textAlign: "center",
  }));

  // Handle QR code generation (uses qrRef)
  async function handleGenerate(event) {
    event.preventDefault();
    navigate("/pass");
  }

  // Framer Motion animations
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const logoVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { duration: 0.5, delay: 0.2 } },
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.4 } },
  };

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
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
        <Panel
          sx={{ width: "100%" }}
          component={motion.div} // Animate the panel
          variants={containerVariants}
        >
          <motion.img
            src={require("../images/logo192.png")}
            width={100}
            height={"auto"}
            alt=""
            variants={logoVariants} // Animate the logo
            initial="hidden"
            animate="visible"
          />
          <br />

          <Paper sx={{ width: "90%", padding: 2 }}>
            <Typography variant="h6">
              {lang.welcome} {state.currentUser.name}
            </Typography>
          </Paper>

          <motion.div variants={buttonVariants} initial="hidden" animate="visible">
            <Button
              id="generate"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              onClick={handleGenerate}
            >
              {lang.genrate}
            </Button>
          </motion.div>
        </Panel>
      </Box>
    </Container>
  );
}

export default UserPanel;
