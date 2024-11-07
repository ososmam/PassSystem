import React, { createContext, useState, useContext, useEffect } from "react";

// Create the context
export const RtlContext = createContext();

// Create a provider component
export const RtlProvider = ({ children }) => {
  const [isRtl, setIsRtl] = useState(false);
  const toggleRtl = () => {
    setIsRtl((prev) => !prev);
  };
  useEffect(() => {
    if (isRtl) {
      document.body.setAttribute("dir", "rtl");
    } else {
      document.body.setAttribute("dir", "ltr");
    }
  }, [isRtl]);

  return (
    <RtlContext.Provider value={{ isRtl, toggleRtl }}>
      {children}
    </RtlContext.Provider>
  );
};

export const useRtl = () => useContext(RtlContext);
