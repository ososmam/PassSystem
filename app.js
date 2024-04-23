// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  getDoc,
  doc,
  setDoc,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import QrCreator from "https://cdn.jsdelivr.net/npm/qr-creator/dist/qr-creator.es6.min.js";
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

if (!window.location.pathname.endsWith("landing.html")) {
  let loginForm = document.getElementById("loginForm");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    login();
  });
} else{

  let qrForm = document.getElementById("QRForm");

  qrForm.addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById('generate').style.visibility = 'hidden';
    generateQRCode();
  });

  loadUserData();
} 
function login() {
  let username = document.getElementById("username").value;
  let password = document.getElementById("password").value;
  console.debug(username);
  console.debug(password);
  signInWithEmailAndPassword(auth, username + "@darMasrAndalus.test", password)
    .then((userCredential) => {
      // Signed in
      getUserData();

      // Call QR code generation on successful login
    })
    .catch((error) => {
      alert("Invalid username or password");
      console.error(error);
      console.debug(password);
    });
}
async function getUserData() {
  const userDocRef = doc(db, "hosts", auth.currentUser.uid);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    // Read the 'name' field from the document
    const name = userDoc.data().name;
    const flat = userDoc.data().flat;
    const building = userDoc.data().building;
    sessionStorage.setItem("name", name);
    sessionStorage.setItem("flat", flat);
    sessionStorage.setItem("building", building);

    console.log("User name:", name);
    window.location.href = "landing.html";
    return name;
  } else {
    console.log("No such document!");
    return null;
  }
}
function loadUserData() {
  if (window.location.pathname.endsWith("landing.html")) {
    document.addEventListener("DOMContentLoaded", (event) => {
      document.getElementById("name").textContent =
        sessionStorage.getItem("name");
      document.getElementById("flat").textContent =
        sessionStorage.getItem("flat");
      document.getElementById("building").textContent =
        sessionStorage.getItem("building");
    });
  }
}
function generateQRCode() {
  // Ensure Firestore functions are imported

  const uid = auth.currentUser.uid; // Get current user ID for secure data association

  // Generate a unique ID and set expiry time
  const uniqueID =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  const visitorData = {
    hostID: uid,
    uniqueID,
    expiry: Date.now() + 24 * 60 * 60 * 1000, // Use server timestamp for expiry
  };

  // Add visitor data to Firestore collection
  addDoc(collection(db, "visitors"), visitorData)
    .then(() => {
      const qrCodeElement = document.getElementById("qr-code");
      if (!qrCodeElement) {
        console.error('Element with ID "qr-code" not found.');
        return;
      }

      // Use Nimiq QR Creator to generate the QR code
      QrCreator.render(
        {
          text: uniqueID,
          radius: 0.5, // 0.0 to 0.5 for corner radius
          ecLevel: "H", // Error correction level: L, M, Q, H
          fill: "#2D8736", // QR code color
          background: null, // Transparent background
          size: 256, // Size in pixels
        },
        qrCodeElement
      );

      const qrDownloadLink = document.getElementById("qr-download");
      if (!qrDownloadLink) {
        console.error('Element with ID "qr-download" not found.');
        return;
      }
      qrDownloadLink.href = qrCodeElement.toDataURL("image/png");

      const qrContainer = document.getElementById("qr-container");
      if (!qrContainer) {
        console.error('Element with ID "qr-container" not found.');
        return;
      }
      qrContainer.style.display = "block";
    })
    .catch((error) => {
      alert("QR code generation failed: " + error.message);
      console.error(error);
    });
}
