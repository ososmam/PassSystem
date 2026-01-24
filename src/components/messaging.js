// messaging.js - Firebase Messaging Disabled
// This file is hollowed out as part of the migration from Firebase.

export const requestNotificationPermission = async (userId) => {
  console.log("Notification permission requested (Disabled in Migration).");
  return null;
};

export const onMessageListener = () => new Promise((resolve) => resolve(null));

export const deleteFcmTokenToServer = async (userId) => {
  console.log("Delete FCM Token requested (Disabled).");
  return;
};
