import React, { useContext, useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  styled,
  Paper,
  CssBaseline,
  useTheme
} from "@mui/material";
import { motion } from "framer-motion";
import en from "../../src/locales/en.json";
import ar from "../../src/locales/ar.json";
import { QrCodeScanner,Announcement } from "@mui/icons-material";
import { useValue } from "./ContextProvider";
import { RtlContext } from "./RtlContext";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "./firebaseApp";

function UserPanel() {
  const navigate = useNavigate();
  const { state } = useValue();
  const { isRtl } = useContext(RtlContext);
  const lang = isRtl ? ar : en;
  const [news, setNews] = useState(null);
  const theme = useTheme();
  const bgColor = theme.palette.mode === "dark"
  ? theme.palette.blueAccent?.[600] || "#246bb2" 
  : theme.palette.blueAccent?.[100] || "#439fff";
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const docRef = doc(firestore, "api_config", "news");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setNews(docSnap.data()); // { en: "...", ar: "..." }
        } else {
          setNews({ en: en.noNews, ar: ar.noNews });
        }
      } catch (error) {
        console.error("Error fetching news:", error);
        setNews({ en: en.noNews, ar: ar.noNews });
      }
    };
    fetchNews();
  }, []);

  const Panel = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#FCFCFC",
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    textAlign: "center",
  }));

  const handleGenerate = (event) => {
    event.preventDefault();
    navigate("/pass");
  };

    const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
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
        <Panel
        >
          <motion.img
            src={require("../images/logo192.png")}
            width={70}
            height={"auto"}
            alt=""
            variants={logoVariants}
            initial="hidden"
            animate="visible"
          />
          <br />

          <Paper  sx={{ width: "100%", padding: 1.5 , backgroundColor: bgColor }}>
            <Typography variant="h5w" >
              {lang.welcome}{lang.comma} {state.currentUser.name.trim()}!
            </Typography>
            <br/>
            <Typography variant="captionw">
              {lang.building} {state.currentUser.building} {lang.apartment} {state.currentUser.flat}
            </Typography>
          </Paper>

          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              gap: 2,
              width: "100%",
              mt: 2,
            }}
          >
            {/* QR Card */}
            <Paper sx={{ width: "50%", padding: 1.5 }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 0.5,
                  mb: 1,
                }}
              >
                <QrCodeScanner/>
                <Typography variant="h6">{lang.passes}</Typography>
              </Box>
              <motion.div variants={buttonVariants} initial="hidden" animate="visible">
                <Button
                  id="generate"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 5 }}
                  onClick={handleGenerate}
                >
                  {lang.genrate}
                </Button>
              </motion.div>
            </Paper>

            {/* News Card */}
            <Paper sx={{ width: "50%", padding: 1.5 }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 0.5,
                  mb: 1,
                }}
              >
                <Announcement/>
                <Typography variant="h6">{lang.news}</Typography>
              </Box>
              <Typography variant="body2">
                {news ? (isRtl ? news.ar : news.en) : lang.noNews}
              </Typography>
            </Paper>
          </Box>
        </Panel>
      </Box>
    </Container>
  );
}

export default UserPanel;
