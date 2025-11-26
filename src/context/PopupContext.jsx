import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { ThemeContext } from "./ThemeContext";

const PopupContext = createContext();
export const usePopup = () => useContext(PopupContext);

export const PopupProvider = ({ children }) => {
  const { theme } = useContext(ThemeContext);
  const [popup, setPopup] = useState({
    visible: false,
    content: null,
    centered: false,       // NEW: whether popup is center screen
    position: { top: 0, left: 0 },
  });

  const popupRef = useRef();

  // Show popup: can be centered or relative to an element
  const showPopup = (content, options = {}) => {
    const { elementRef = null, offset = { x: 0, y: 0 }, centered = true } = options;

    if (centered || !elementRef?.current) {
      setPopup({ visible: true, content, centered: true, position: { top: 0, left: 0 } });
      return;
    }

    const rect = elementRef.current.getBoundingClientRect();
    const popupWidth = 200;
    const popupHeight = 80;

    let top = rect.bottom + offset.y + window.scrollY;
    let left = rect.left + offset.x + window.scrollX;

    // Flip above if too close to bottom
    if (top + popupHeight > window.innerHeight + window.scrollY) {
      top = rect.top - popupHeight - offset.y + window.scrollY;
    }

    if (left + popupWidth > window.innerWidth + window.scrollX) {
      left = window.innerWidth - popupWidth - 10;
    }

    setPopup({ visible: true, content, centered: false, position: { top, left } });
  };

  const hidePopup = () => setPopup({ visible: false, content: null });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        hidePopup();
      }
    };
    if (popup.visible) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popup.visible]);

  // Styles
  const popupStyle = {
    position: "fixed",
    top: popup.centered ? "50%" : popup.position.top,
    left: popup.centered ? "50%" : popup.position.left,
    transform: popup.centered ? "translate(-50%, -50%)" : "none",
    background: theme === "dark" ? "rgba(20,20,20,0.95)" : "#fff",
    color: theme === "dark" ? "#fff" : "#000",
    borderRadius: 12,
    boxShadow:
      theme === "dark"
        ? "0 8px 30px rgba(0,0,0,0.5)"
        : "0 8px 30px rgba(0,0,0,0.15)",
    zIndex: 99999,
    minWidth: 160,
    maxWidth: 300,
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