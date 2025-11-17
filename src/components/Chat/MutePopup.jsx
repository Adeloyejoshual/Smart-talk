// src/components/Chat/MutePopup.jsx
import React from "react";

export default function MutePopup({ isOpen, onClose, onMute }) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>Mute Notifications</h3>

        <p>How long do you want to mute notifications for this chat?</p>

        <div className="mute-options">
          <button onClick={() => onMute("8h")}>8 hours</button>
          <button onClick={() => onMute("1w")}>1 week</button>
          <button onClick={() => onMute("always")}>Always</button>
        </div>

        <div className="popup-buttons">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
