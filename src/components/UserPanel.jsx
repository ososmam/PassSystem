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

import en from "../../src/locales/en.json";
import ar from "../../src/locales/ar.json";

import { useValue } from "./ContextProvider";
import { RtlContext } from "./RtlContext";
import { useNavigate } from "react-router-dom";

function UserPanel() {
  const navigate = useNavigate();
  const { state } = useValue();
  const { isRtl } = useContext(RtlContext);
  const { dispatch } = useValue();

  const lang = isRtl ? ar : en;
  const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: "center",
  }));

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
        <Panel sx={{ width: "100%" }}>
          <img
            src={require("../images/logo192.png")}
            width={100}
            height={"auto"}
            alt=""
          />
          <br />

          <Item sx={{ width: "90%" }}>
            <Typography variant="h6">
              {lang.welcome} {state.currentUser.name}
            </Typography>
          </Item>

            <Button
              id="generate"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              onClick={handleGenerate}
            >
              {lang.genrate}
            </Button>
        </Panel>
      </Box>
    </Container>
  );
}
export default UserPanel;
