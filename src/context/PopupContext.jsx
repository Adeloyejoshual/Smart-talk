// src/context/PopupContext.jsx
import React, { createContext, useState, useContext } from "react";

const PopupContext = createContext();

export const usePopup = () => useContext(PopupContext);

export const PopupProvider = ({ children }) => {
  const [popup, setPopup] = useState({ visible: false, content: null, position: { top: 0, left: 0 } });

  const showPopup = (content, position = { top: 0, left: 0 }) => setPopup({ visible: true, content, position });
  const hidePopup = () => setPopup({ visible: false, content: null });

  return (
    <PopupContext.Provider value={{ popup, showPopup, hidePopup }}>
      {children}
      {popup.visible && (
        <div
          style={{
            position: "absolute",
            top: popup.position.top,
            left: popup.position.left,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            zIndex: 9999,
            minWidth: 150,
            padding: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {popup.content}
        </div>
      )}
    </PopupContext.Provider>
  );
};