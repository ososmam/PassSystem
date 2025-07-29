// UserDataFetcher.js
import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { firestore } from "./firebaseApp";
import { collection, query, where, getDocs } from "firebase/firestore";

const UserDataFetcher = forwardRef(({ phone, dispatch, setUserData, setLoggedIn }, ref) => {
  const [loading, setLoading] = useState(false);

  // Get user data from Firestore
  const getUserData = async (phone) => {
    setLoading(true); // Set loading to true
    console.log("Fetching user data for phone:", phone); // Debugging
    try {
      const userDocRef = collection(firestore, "hosts");
      const q = query(userDocRef, where("phone", "==", phone));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0]; // Get the first matching document
        const data = userDoc.data();

        // Update user data and loggedIn state
        setUserData({
          name: data.name,
          flat: data.flat,
          building: data.building,
          phone: data.phone,
          userid: userDoc.id.toString(),
        });

        setLoggedIn(true); 
        
        dispatch({
          type: "END_LOADING",
        });
        console.log("User data fetched successfully:", data);
      } else {
        handleError();
      }
    } catch (error) {
      handleError();
    }
  };

  useImperativeHandle(ref, () => ({
    getUserData,
  }));

  function handleError() {
    dispatch({
      type: "END_LOADING",
    });
    dispatch({
      type: "UPDATE_ALERT",
      payload: {
        open: true,
        severity: "error",
        title: "Error",
        message: "Error fetching data",
      },
    });
  }

  useEffect(() => {
    if (phone) {
      getUserData(phone); // Call getUserData when phone prop changes
    }
  }, [phone]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return null; // No need to render anything directly here
});

export default UserDataFetcher;
