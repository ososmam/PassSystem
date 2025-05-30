import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import {getRemoteConfig} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-remote-config.js";
import {getAnalytics} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
const firebaseConfig = {
  apiKey: "AIzaSyDKjXDo_40lB_3pLlIZF6HksxIKi9rktiw",
  authDomain: "dar-misr-andalus-2.firebaseapp.com",
  projectId: "dar-misr-andalus-2",
  storageBucket: "dar-misr-andalus-2.firebasestorage.app",
  messagingSenderId: "960635801118",
  appId: "1:960635801118:web:72f9c44e1f221afd3b680f",
  measurementId: "G-WT0HCZC0J8"
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const messaging = getMessaging(firebaseApp);
const remoteConfig = getRemoteConfig(firebaseApp);
const analytics = getAnalytics(firebaseApp);

export { firebaseApp, firebaseAuth, firestore,messaging ,remoteConfig,analytics };
