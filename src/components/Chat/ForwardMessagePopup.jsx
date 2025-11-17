// src/components/Chat/ForwardMessagePopup.jsx
import React from "react";

export default function ForwardMessagePopup({
  isOpen,
  chats,
  onClose,
  onForward,
}) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box big" onClick={(e) => e.stopPropagation()}>
        <h3>Forward message</h3>

        <div className="forward-list">
          {chats.length === 0 ? (
            <p style={{ textAlign: "center", opacity: 0.6 }}>
              No chats available
            </p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className="forward-item"
                onClick={() => onForward(chat.id)}
              >
                <img
                  src={chat.photoURL}
                  alt=""
                  className="forward-avatar"
                />
                <div className="forward-info">
                  <p className="forward-name">{chat.name}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <button className="btn-cancel full" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
