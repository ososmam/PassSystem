import { createContext, useState, useMemo } from "react";
import { createTheme } from "@mui/material";

// Color design tokens with better organization
export const tokens = (mode) => ({
  common: {
    white: "#ffffff",
    black: "#000000"
  },
  grey: {
    50: mode === "dark" ? "#fafafa" : "#212121",  // New - extra contrast level
    100: mode === "dark" ? "#f5f5f5" : "#424242", // Brighter in light mode
    200: mode === "dark" ? "#eeeeee" : "#616161",
    300: mode === "dark" ? "#e0e0e0" : "#757575",
    400: mode === "dark" ? "#bdbdbd" : "#9e9e9e",
    500: "#9e9e9e", // Neutral midpoint
    600: mode === "dark" ? "#757575" : "#bdbdbd",
    700: mode === "dark" ? "#616161" : "#e0e0e0",
    800: mode === "dark" ? "#424242" : "#eeeeee",
    900: mode === "dark" ? "#212121" : "#f5f5f5"
  },
  primary: {
    100: mode === "dark" ? "#d0d1d5" : "#040509",
    200: mode === "dark" ? "#a1a4ab" : "#080b12",
    300: mode === "dark" ? "#727681" : "#0c101b",
    400: mode === "dark" ? "#1F2A40" : "#434956", // Brighter in light mode
    500: "#141b2d",
    600: mode === "dark" ? "#101624" : "#1F2A40",
    700: mode === "dark" ? "#0c101b" : "#727681",
    800: mode === "dark" ? "#080b12" : "#a1a4ab",
    900: mode === "dark" ? "#040509" : "#d0d1d5"
  },
  greenAccent: {
    100: mode === "dark" ? "#dbf5ee" : "#0f2922",
    200: mode === "dark" ? "#b7ebde" : "#1e5245",
    300: mode === "dark" ? "#94e2cd" : "#2e7c67",
    400: mode === "dark" ? "#70d8bd" : "#3da58a",
    500: "#4cceac", // Same in both modes
    600: mode === "dark" ? "#3da58a" : "#70d8bd",
    700: mode === "dark" ? "#2e7c67" : "#94e2cd",
    800: mode === "dark" ? "#1e5245" : "#b7ebde",
    900: mode === "dark" ? "#0f2922" : "#dbf5ee"
  },
  redAccent: {
    100: mode === "dark" ? "#f8dcdb" : "#2c100f",
    200: mode === "dark" ? "#f1b9b7" : "#58201e",
    300: mode === "dark" ? "#e99592" : "#832f2c",
    400: mode === "dark" ? "#e2726e" : "#af3f3b",
    500: "#db4f4a", // Same in both modes
    600: mode === "dark" ? "#af3f3b" : "#e2726e",
    700: mode === "dark" ? "#832f2c" : "#e99592",
    800: mode === "dark" ? "#58201e" : "#f1b9b7",
    900: mode === "dark" ? "#2c100f" : "#f8dcdb"
  },
  blueAccent: {
    100: mode === "dark" ? "#e1e2fe" : "#151632",
    200: mode === "dark" ? "#c3c6fd" : "#2a2d64",
    300: mode === "dark" ? "#a4a9fc" : "#3e4396",
    400: mode === "dark" ? "#868dfb" : "#535ac8",
    500: "#6870fa", // Same in both modes
    600: mode === "dark" ? "#535ac8" : "#868dfb",
    700: mode === "dark" ? "#3e4396" : "#a4a9fc",
    800: mode === "dark" ? "#2a2d64" : "#c3c6fd",
    900: mode === "dark" ? "#151632" : "#e1e2fe"
  }
});

// Enhanced theme settings with RTL support
export const themeSettings = (mode, isRtl) => {
  const colors = tokens(mode);
  const fontFamily = isRtl ? "'Tajawal', sans-serif" : "'Roboto', 'Tajawal', sans-serif";

  return {
    direction: isRtl ? "rtl" : "ltr",
    palette: {
      mode: mode,
      common: colors.common,
      grey: colors.grey,
      primary: {
        main: mode === "dark" ? colors.greenAccent[800] : colors.greenAccent[400],
        contrastText: colors.common.white
      },
      text: {
        primary:  colors.grey[100] ,  // High contrast
        secondary:  colors.grey[300] , // Slightly lighter
        disabled:  colors.grey[600]   // Clear disabled state
      },
      background: {
        default: mode === "dark" ? colors.primary[600] : "#fcfcfc",
        paper: mode === "dark" ? colors.primary[500] : colors.common.white
      },
      secondary: {
        main: mode === "dark" ? colors.greenAccent[400] : colors.greenAccent[300],
        contrastText: colors.common.white
      },
      error: {
        main: colors.redAccent[500],
        contrastText: colors.common.white
      },
      success: {
        main: colors.greenAccent[500],
        contrastText: colors.common.white
      },
      info: {
        main: colors.blueAccent[500],
        contrastText: colors.common.white
      }
    },
    typography: {
      fontFamily: fontFamily,
      fontSize: 15,
      allVariants: {
        color:colors.grey[100] // Base text color
      },
      h1: { fontSize: 40, fontWeight: 700,},
      h2: { fontSize: 32, fontWeight: 600,},
      h3: { fontSize: 24, fontWeight: 500 },
      h4: { fontSize: 22, fontWeight: 500 },
      h5: { fontSize: 18, fontWeight: 500 },
      h6: { fontSize: 16, fontWeight: 500 },
      subtitle1: { fontSize: 14 },
      subtitle2: { fontSize: 12 },
      body1: { fontSize: 15 },
      body2: { fontSize: 13 },
      button: { fontWeight: 500 },
      caption: { fontSize: 10 }
    },
    components: {
      MuiTypography: {
        defaultProps: {
          variantMapping: {
            h1: 'h1',
            h2: 'h2',
            body1: 'p',
          }
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: '8px',
            transition: 'all 0.3s ease',
          },
        },
        
      },
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true, // Optional: removes ripple effect for cleaner look
        },
      },
    },
  };
};

// Enhanced Color Mode Context
export const ColorModeContext = createContext({
  toggleColorMode: () => {},
  currentMode: "light"
});

export const useMode = (isRtl) => {
  const [mode, setMode] = useState("light");

  const colorMode = useMemo(() => ({
    toggleColorMode: () => setMode((prev) => (prev === "light" ? "dark" : "light")),
    currentMode: mode
  }), [mode]);

  const theme = useMemo(
    () => createTheme(themeSettings(mode, isRtl)),
    [mode, isRtl]
  );

  return [theme, colorMode];
};