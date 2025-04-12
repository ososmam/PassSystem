import {
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { messaging } from "./firebaseApp"; // Assume messaging is initialized in firebaseApp.js
import { useValue } from "./ContextProvider"; // Assuming you use a context provider for state management
import axios from "axios";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firestore } from "./firebaseApp"; // Make sure your firestore is initialized

// Request permission to send notifications and get the FCM token
const requestNotificationPermission = async (userId) => {
  // Access user state from context (assumes user is logged in)

  if (userId === "") {
    console.error("No current user found.");
    return;
  }
  try {
    const token = await getToken(messaging, {
      vapidKey:
        "BOhwbuI02eOtFrrf2oHNiMZQC_ByBorFmZJJfoHD9G2G8kae_rmMt66GeDy2gpMZzsmboBa7KpXSRRHPj09N7HQ", // Replace with your VAPID key
    });

    if (token) {
      
      await saveFcmTokenToServer(token, userId); // Pass token to save it on the server
    } else {
      console.log("No registration token available.");
    }
  } catch (error) {
    console.error("Error getting token:", error);
  }
};

// Save the FCM token to the server
const saveFcmTokenToServer = async (fcmToken, userId, isRtl) => {
  // Access user state from context (assumes user is logged in)
  
  if (userId === "") {
    console.error("No current user found.");
    return;
  }

  const json = JSON.stringify({
    userId: userId, // Assuming the user has an 'id' field
    fcmToken: fcmToken,
  });

  try {
    const token = await getSharedToken();
    const response = await axios.post(
      "https://gh.darmasr2.com/api/notifications/store-token", // API endpoint to store FCM token
      json,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": isRtl ? "ar" : "en", // Adjust language based on RTL state
          Authorization: `Bearer ${token}`, // Assuming token is stored in the state
        },
      }
    );

    if (response.status === 200) {
      console.log("FCM token stored successfully.");
    } else {
      console.error("Failed to store FCM token.");
    }
  } catch (error) {
    console.error("Error saving FCM token to server:", error);
  }
};

const deleteFcmTokenToServer = async (userId) => {
  const json = JSON.stringify({
    userId: userId,
  });

  try {
    const token = await getSharedToken();
    const response = await axios.post(
      "https://gh.darmasr2.com/api/notifications/delete-token", // API endpoint to store FCM token
      json,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Assuming token is stored in the state
        },
      }
    );

    if (response.status === 200) {
      console.log("FCM token deleted successfully.");
    } else {
      console.error("Failed to delete FCM token.");
    }
  } catch (error) {
    console.error("Error delete FCM token to server:", error);
  }
};

// Retrieve a shared token from Firestore
const getSharedToken = async () => {
  try {
    const tokenDoc = await getDoc(doc(firestore, "common", "sharedToken"));
    if (tokenDoc.exists()) {
      return tokenDoc.data().token;
    } else {
      console.error("No shared token found.");
      return null;
    }
  } catch (error) {
    console.error("Error retrieving shared token:", error);
    return null;
  }
};

// Listen for incoming messages
const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Notification received", payload);
      const { state } = useValue();
      if (!state.currentUser) {
        console.error("No current user found.");
        return;
      }
      // Display the notification only once
      if (Notification.permission === "granted") {
        const notificationOptions = {
          body: payload.notification.body,
          icon: payload.notification.icon,
        };
        new Notification(payload.notification.title, notificationOptions);
      }
      resolve(payload);
    });
  });

export {
  requestNotificationPermission,
  onMessageListener,
  deleteFcmTokenToServer,
};
