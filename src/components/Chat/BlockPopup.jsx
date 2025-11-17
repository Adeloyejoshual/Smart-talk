// src/components/Chat/BlockPopup.jsx
import React from "react";

export default function BlockPopup({ isOpen, onClose, onBlock, username }) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>Block {username}?</h3>

        <p>You will no longer receive messages from this user.</p>

        <div className="popup-buttons">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-confirm" onClick={onBlock}>Block</button>
        </div>
      </div>
    </div>
  );
}
