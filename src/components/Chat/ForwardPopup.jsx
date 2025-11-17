// src/components/Chat/ForwardPopup.jsx
import React from "react";

export default function ForwardPopup({
  isOpen,
  onClose,
  contacts,
  onForward,
}) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>Forward message to:</h3>

        <div className="forward-list">
          {contacts.map((user) => (
            <div
              key={user.id}
              className="forward-user"
              onClick={() => onForward(user.id)}
            >
              <img src={user.photoURL} alt="" className="forward-avatar" />
              <span className="forward-name">{user.name}</span>
            </div>
          ))}
        </div>

        <div className="popup-buttons">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
