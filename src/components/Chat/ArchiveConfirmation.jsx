// src/components/Chat/ArchiveConfirmation.jsx
import React from "react";

export default function ArchiveConfirmation({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="popup-overlay" onClick={onCancel}>
      <div
        className="popup-box small"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Archive Chat</h3>

        <p>Are you sure you want to archive this chat?</p>

        <div className="popup-buttons">
          <button className="btn-danger" onClick={onConfirm}>
            Archive
          </button>

          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
