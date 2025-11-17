// src/components/Chat/DeleteMessagePopup.jsx
import React from "react";

export default function DeleteMessagePopup({
  isOpen,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>Delete message?</h3>

        <p>This action cannot be undone.</p>

        <div className="popup-buttons column">
          <button className="btn-danger" onClick={onDeleteForEveryone}>
            Delete for everyone
          </button>

          <button className="btn-danger-lite" onClick={onDeleteForMe}>
            Delete for me
          </button>

          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
