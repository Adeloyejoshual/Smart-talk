// src/components/Chat/UpdatePinPopup.jsx
import React from "react";

export default function UpdatePinPopup({
  isOpen,
  isPinned,
  onClose,
  onPin,
  onUnpin,
}) {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>{isPinned ? "Unpin chat?" : "Pin chat?"}</h3>

        <p>{isPinned ? "Remove this chat from pinned list?" : "Pin this chat to the top?"}</p>

        <div className="popup-buttons">
          {isPinned ? (
            <button className="btn-primary" onClick={onUnpin}>Unpin</button>
          ) : (
            <button className="btn-primary" onClick={onPin}>Pin</button>
          )}

          <button className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
