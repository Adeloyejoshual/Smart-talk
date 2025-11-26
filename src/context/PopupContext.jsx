// src/context/PopupContext.jsx
import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { ThemeContext } from "./ThemeContext";

const PopupContext = createContext();
export const usePopup = () => useContext(PopupContext);

export const PopupProvider = ({ children }) => {
  const { theme } = useContext(ThemeContext);
  const [popup, setPopup] = useState({
    visible: false,
    content: null,
    autoHide: true,
  });

  const popupRef = useRef();
  const timeoutRef = useRef();

  const showPopup = (content, options = {}) => {
    const { autoHide = true } = options;

    setPopup({ visible: true, content, autoHide });

    // Clear previous timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Auto-hide after 2.5s for simple messages
    if (autoHide) {
      timeoutRef.current = setTimeout(() => {
        hidePopup();
      }, 2500);
    }
  };

  const hidePopup = () => {
    setPopup({ visible: false, content: null, autoHide: true });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  // Close when clicking outside (only for detailed popups)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) && !popup.autoHide) {
        hidePopup();
      }
    };
    if (popup.visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popup.visible, popup.autoHide]);

  // Centered popup style + theme
  const popupStyle = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: theme === "dark" ? "rgba(20,20,20,0.95)" : "#fff",
    color: theme === "dark" ? "#fff" : "#000",
    borderRadius: 12,
    boxShadow:
      theme === "dark"
        ? "0 8px 30px rgba(0,0,0,0.5)"
        : "0 8px 30px rgba(0,0,0,0.15)",
    zIndex: 99999,
    minWidth: 160,
    maxWidth: 320,
    padding: 12,
    border: theme === "dark" ? "1px solid #333" : "1px solid #eee",
    backdropFilter: "blur(6px)",
    transition: "all 0.2s ease",
    opacity: popup.visible ? 1 : 0,
    transformOrigin: "center",
  };

  return (
    <PopupContext.Provider value={{ popup, showPopup, hidePopup }}>
      {children}
      {popup.visible && (
        <div style={popupStyle} ref={popupRef} onClick={(e) => e.stopPropagation()}>
          {popup.content}
        </div>
      )}
    </PopupContext.Provider>
  );
};

export default PopupContext;