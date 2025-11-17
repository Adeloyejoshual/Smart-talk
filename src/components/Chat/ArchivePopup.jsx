// src/components/Chat/ArchivePopup.jsx
import React from "react";

export default function ArchivePopup({ isOpen, onClose, onArchive }) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>Archive Chat?</h3>

        <p>This chat will be moved to your archived list.</p>

        <div className="popup-buttons">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-confirm" onClick={onArchive}>Archive</button>
        </div>
      </div>
    </div>
  );
}
