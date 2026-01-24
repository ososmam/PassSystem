import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { apiClient } from "../apiClient";

const UserDataFetcher = forwardRef(({ phone, dispatch, setUserData, setLoggedIn }, ref) => {
  const [loading, setLoading] = useState(false);

  // Get user data from API
  const getUserData = async (phone) => {
    setLoading(true);
    console.log("Fetching user data for phone:", phone);
    try {
      const data = await apiClient.getPropertyByPhone(phone);

      if (data) {
        // Update user data and loggedIn state
        setUserData({
          name: data.name,
          flat: data.flat,
          building: data.building,
          phone: data.phone,
          userid: data.hostId || data.id,
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
      console.error(error);
      handleError();
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    getUserData,
  }));

  function handleError() {
    dispatch({
      type: "END_LOADING",
    });
    setLoading(false);
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
      getUserData(phone);
    }
  }, [phone]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return null;
});

export default UserDataFetcher;
