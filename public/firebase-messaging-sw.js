try {
    importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');
  } catch (e) {
    console.error("Failed to load Firebase scripts:", e);
  }
  
  const firebaseConfig = {
    apiKey: "AIzaSyDKjXDo_40lB_3pLlIZF6HksxIKi9rktiw",
    authDomain: "dar-misr-andalus-2.firebaseapp.com",
    projectId: "dar-misr-andalus-2",
    storageBucket: "dar-misr-andalus-2.firebasestorage.app",
    messagingSenderId: "960635801118",
    appId: "1:960635801118:web:72f9c44e1f221afd3b680f",
    measurementId: "G-WT0HCZC0J8",
  };
  
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  
  // Variable to store user authentication state
  let isUserLoggedIn = false;
  
  // Listen for messages from the main app (for user's login state)
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_USER_AUTH_STATE') {
      isUserLoggedIn = event.data.isLoggedIn;
    }
  });
  
  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    console.log("Received background message", payload);
  
    // Only show notification if the user is logged in
    if (isUserLoggedIn) {
      const notificationTitle = payload.notification.title || 'Default Title';
      const notificationOptions = {
        body: payload.notification.body || 'Default Body',
        icon: payload.notification.icon || '/default-icon.png',
      };
  
      self.registration.showNotification(notificationTitle, notificationOptions).catch((error) => {
        console.error("Error showing notification:", error);
      });
    } else {
      console.log("User is not logged in. Notification will not be shown.");
    }
  });
  