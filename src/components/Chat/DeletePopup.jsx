import React from "react";

export default function DeletePopup({ onClose, onDeleteMe, onDeleteEveryone }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <h3>Delete message?</h3>

        <button className="popup-btn red" onClick={onDeleteEveryone}>
          Delete for everyone
        </button>

        <button className="popup-btn" onClick={onDeleteMe}>
          Delete for me
        </button>

        <button className="popup-btn cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
