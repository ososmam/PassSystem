import React, { useState, useContext } from "react";
import { Fab, Box, Tooltip, useTheme } from "@mui/material";
import { ChatBubble, Close, WhatsApp, Facebook } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { RtlContext } from "./RtlContext";
import ar from "../locales/ar.json";
import en from "../locales/en.json";

const FloatingButton = () => {
  const [open, setOpen] = useState(false);
  const { isRtl } = useContext(RtlContext);
  const lang = isRtl ? ar : en;
  const theme = useTheme();

  const whatsappColor = theme.palette.mode === "dark" ? "#128C7E" : "#25D366";
  const facebookColor = theme.palette.mode === "dark" ? "#0061A8" : "#1877F2";
  const facebookGroupLink = "https://www.facebook.com/groups/darmasrandalus2";
  const whatsappChatLink = "https://wa.me/+201044189211";

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        zIndex: 10,
      }}
    >
      <AnimatePresence>
        {/* Conditionally rendered buttons with unique keys */}
        {open && (
          <>
            <motion.div
              key="whatsapp-button"  // Unique key
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <Tooltip title={lang.contactWhatsAppChat} placement="left">
                <Fab
                  size="small"
                  onClick={() => window.open(whatsappChatLink, "_blank")}
                  sx={{
                    backgroundColor: whatsappColor,
                    "&:hover": {
                      backgroundColor:
                        theme.palette.mode === "dark" ? "#075E54" : "#128C7E",
                    },
                  }}
                >
                  <WhatsApp sx={{ color: "white" }} />
                </Fab>
              </Tooltip>
            </motion.div>

            <motion.div
              key="facebook-button"  // Unique key
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Tooltip title={lang.joinFacebookGroup} placement="left">
                <Fab
                  size="small"
                  onClick={() => window.open(facebookGroupLink, "_blank")}
                  sx={{
                    backgroundColor: facebookColor,
                    "&:hover": {
                      backgroundColor: "#155E9C",
                    },
                  }}
                >
                  <Facebook sx={{ color: "white" }} />
                </Fab>
              </Tooltip>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Fab
        color="primary"
        onClick={() => setOpen(!open)}
        aria-label={lang.reachUs}
        sx={{
          transition: "transform 0.2s ease-in-out",
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
        }}
      >
        {open ? <Close /> : <ChatBubble />}
      </Fab>
    </Box>
  );
};

export default FloatingButton;