import "./App.css";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import {
  getFirestore,
  getDoc,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import QRCode from "react-qr-code";
import React, { useState, useRef, Suspense } from "react";
import { Grid } from "@mui/material";
import * as html2canvas from "html2canvas";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import en from "../src/locales/en/translations.json";
import ar from "../src/locales/ar/translations.json";


const cacheLtr = createCache({
  key: "muiltr",
});

const cacheRtl = createCache({
  key: "muirtl",
  // prefixer is the only stylis plugin by default, so when
  // overriding the plugins you need to include it explicitly
  // if you want to retain the auto-prefixing behavior.
  stylisPlugins: [prefixer, rtlPlugin],
});

const ltrTheme = createTheme({ direction: "ltr" });
const rtlTheme = createTheme({ direction: "rtl" });

const firebaseConfig = {
  apiKey: "AIzaSyDKjXDo_40lB_3pLlIZF6HksxIKi9rktiw",
  authDomain: "dar-misr-andalus-2.firebaseapp.com",
  projectId: "dar-misr-andalus-2",
  storageBucket: "dar-misr-andalus-2.appspot.com",
  messagingSenderId: "960635801118",
  appId: "1:960635801118:web:72f9c44e1f221afd3b680f",
  measurementId: "G-WT0HCZC0J8",
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
let uid;
let name;
let flat;
let building;
let phone;

function App() {
  const pageRef = useRef();
  const [isRtl, setIsRtl] = React.useState(false);

  React.useLayoutEffect(() => {
    document.body.setAttribute("dir", isRtl ? "rtl" : "ltr");
  }, [isRtl]);

  const [alignment, setAlignment] = React.useState(isRtl ? "ar" : "en");

  const [qrCodeComponent, setQRCodeComponent] = useState(null);

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

  const handleChange = (event, newAlignment) => {
    setAlignment(newAlignment);
  };

  const changeLanguage = (language) => {
    setIsRtl(language == "ar");
  };

  async function handleDownload(element, imageFileName) {
    try {
      document.getElementById("hiddenEndDate").visibility = "visible";
      const canvas = await html2canvas(element, {
        windowWidth: 1024,
        windowHeight: 2048,
        width: 400,
        hegiht: 1000,
        scale:2,
      });

      const image = canvas.toDataURL("image/png");

      // Trigger download
      const link = document.createElement("a");
      link.href = image;
      link.download = imageFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      //document.getElementById("hiddenEndDate").visibility = "hidden";
    } catch (error) {
      console.error("Error generating screenshot:", error);
      alert(isRtl ? ar.failed : en.failed);
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    await login(data);
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    GenerateQRCode();
  };

  function login(data) {
    signInWithEmailAndPassword(
      auth,
      data.get("username") + "@darMasrAndalus.test",
      data.get("password")
    )
      .then(() => {
        getUserData();
      })
      .catch((error) => {
        alert(isRtl ? ar.invalid : en.invalid);
        console.error(error);
      });
  }

  async function getUserData() {
    const userDocRef = doc(db, "hosts", auth.currentUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      name = userDoc.data().name;
      flat = userDoc.data().flat;
      building = userDoc.data().building;
      phone = userDoc.data().phone;
      document.getElementById("name").textContent = name;
      document.getElementById("flat").textContent = flat;
      document.getElementById("building").textContent = building;
      document.getElementById("phone").textContent = phone;
      uid = auth.currentUser.uid;
      document.getElementById("login").style.visibility = "hidden";
      document.getElementById("UserData").style.visibility = "visible";
    } else {
      console.log("No such document!");
    }
  }

  function GenerateQRCode() {
    const uniqueID =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const visitorData = {
      hostID: uid,
      expiry: Date.now() + 24 * 60 * 60 * 1000,
    };

    setDoc(doc(db, "visitors", uniqueID), visitorData)
      .then(() => {
        const qrCodeComponent = (
          <QRCode size={200} fgColor="#2D8736" value={uniqueID} />
        );
        setQRCodeComponent(qrCodeComponent);
        document.getElementById("name").textContent = name;
        document.getElementById("flat").textContent = flat;
        document.getElementById("building").textContent = building;
        document.getElementById("passMessage").textContent = isRtl
          ? ar.passMessage
          : en.passMessage;
        // document.getElementById("endDate").textContent =
        //   (isRtl ? ar.end : en.end) +
        //   " " +
        //   formatDate(Date.now() + 24 * 60 * 60 * 1000,true);

          document.getElementById("hiddenEndDate").textContent =
          // (isRtl ? ar.end : en.end) +
          // " " +
          formatDate(Date.now() + 24 * 60 * 60 * 1000,false);

        document.getElementById("UserData").style.visibility = "hidden";
        document.getElementById("qrCode").style.visibility = "visible";
        document.getElementById("qr-download").style.visibility = "visible";
      })
      .catch((error) => {
        alert(isRtl ? ar.failed : en.failed);
        console.error(error);
      });
  }
  function formatDate(string , bool) {
    var options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minutes: "numeric",
    };
    return new Date(string).toLocaleDateString(bool?isRtl ? "ar-EG" : "en":[], options);
  }
  const Loader = () => (
    <div className="App">
      <div>loading...</div>
    </div>
  );
  return (
    <Suspense fallback="Loader">
      <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
        <ThemeProvider theme={isRtl ? rtlTheme : ltrTheme}>
          <div id="login">
            <Container component="main" maxWidth="xs">
              <CssBaseline />
              <Box
                sx={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Panel>
                  {/* <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
                    <LockOutlinedIcon />
                  </Avatar> */}
                  <img src={require('./images/logo192.png')} width={100} height={"auto"}   />
                  <Typography component="h1" variant="h5">
                    {isRtl ? ar.signIn : en.signIn}
                  </Typography>
                  <Box
                    component="form"
                    onSubmit={handleSubmit}
                    noValidate
                    sx={{ mt: 1 }}
                  >
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      id="username"
                      label={isRtl ? ar.username : en.username}
                      name="username"
                      autoComplete="username"
                      autoFocus
                    />
                    <TextField
                      margin="normal"
                      required
                      fullWidth
                      name="password"
                      label={isRtl ? ar.password : en.password}
                      type="password"
                      id="password"
                      autoComplete="current-password"
                    />
                    {/* <FormControlLabel
                control={<Checkbox value="remember" color="primary" />}
                label="Remember me"
              /> */}
                    <Button
                      type="submit"
                      id="loginButton"
                      fullWidth
                      variant="contained"
                      sx={{ mt: 3, mb: 2 }}
                    >
                      {isRtl ? ar.signIn : en.signIn}
                    </Button>

                    <Box
                      sx={{
                        marginTop: 8,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <ToggleButtonGroup
                        color="primary"
                        value={alignment}
                        exclusive
                        onChange={handleChange}
                        aria-label="Language"
                      >
                        <ToggleButton
                          value="en"
                          onClick={() => changeLanguage("en")}
                        >
                          En
                        </ToggleButton>

                        <ToggleButton
                          value="ar"
                          onClick={() => changeLanguage("ar")}
                        >
                          ع
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </Box>
                </Panel>
              </Box>
            </Container>
          </div>
          <div id="UserData" style={{ visibility: "hidden" }}>
            <Container component="main" maxWidth="xs">
              <Box
                sx={{
                  marginTop: -70,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
                >
                <Panel>
                <img src={require('./images/logo192.png')} width={100} height={"auto"}  />
                <br/>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Item>
                      <Typography variant="h6">
                        {isRtl ? ar.name : en.name}
                      </Typography>
                    </Item>
                  </Grid>
                  <Grid item xs={6}>
                    <Item>
                      <Typography variant="h6" id="name"></Typography>
                    </Item>
                  </Grid>
                  <CssBaseline />
                  <Grid item xs={6}>
                    <Item>
                      <Typography variant="h6">
                        {isRtl ? ar.building : en.building}
                      </Typography>
                    </Item>
                  </Grid>
                  <Grid item xs={6}>
                    <Item>
                      <Typography variant="h6" id="building"></Typography>
                    </Item>
                  </Grid>
                  <Grid item xs={6}>
                    <Item>
                      <Typography component="h3" variant="h6">
                        {isRtl ? ar.apartment : en.apartment}
                      </Typography>
                    </Item>
                  </Grid>
                  <Grid item xs={6}>
                    <Item>
                      <Typography id="flat" variant="h6"></Typography>
                    </Item>
                  </Grid>
                  <Grid item xs={6}>
                    <Item>
                      <Typography component="h3" variant="h6">
                        {isRtl ? ar.phone : en.phone}
                      </Typography>
                    </Item>
                  </Grid>
                  <Grid item xs={6}>
                    <Item>
                      <Typography id="phone" variant="h6"></Typography>
                    </Item>
                  </Grid>
                </Grid>
                </Panel>
              </Box>
              <Box
                component="form"
                onSubmit={handleGenerate}
                noValidate
                sx={{ mt: 1 }}
              >
                <Button
                  type="submit"
                  id="generate"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                >
                  {isRtl ? ar.genrate : en.genrate}
                </Button>
              </Box>
            </Container>
          </div>
          <Container component="main" maxWidth="xs">
            <div id="qrCode" ref={pageRef} style={{ visibility: "hidden" }}>
              <Box
                sx={{
                  marginTop: -70,
                  padding: 3,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <br />
                
                <img src={require('./images/logo192.png')} width={100} height={"auto"}  />
                <br />
                <Typography variant="h4">{"Dar Misr Andalus 2"}</Typography>

                <br />

                {qrCodeComponent}
                <br />
                <Typography variant="caption" id= "hiddenEndDate"  ></Typography>
                <br />
                <br />
              </Box>
            </div>
            <Box
              sx={{
                marginTop: -10,
                padding: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <Typography id="passMessage" variant="body"></Typography>
              {/* <Typography id="endDate" variant="body"></Typography> */}
            </Box>
            <div id="qr-download" style={{ visibility: "hidden" }}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                onClick={() => handleDownload(pageRef.current, "pass.png")}
              >
                {isRtl ? ar.download : en.download}
              </Button>
            </div>
          </Container>
          <div></div>
        </ThemeProvider>
      </CacheProvider>
    </Suspense>
  );
}

export default App;
