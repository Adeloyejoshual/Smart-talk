// src/components/Chat/ProfessionalPopup.jsx

import React from "react";

export default function ProfessionalPopup({
  open,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-box">
        <h3 className="popup-title">{title}</h3>
        <p className="popup-message">{message}</p>

        <div className="popup-actions">
          <button onClick={onCancel} className="cancel-btn">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="confirm-btn">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
