// src/components/Chat/ReportPopup.jsx

import React from "react";

export default function ReportPopup({ open, onConfirm, onCancel, name }) {
  if (!open) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-box">
        <p>Do you want to report {name}?</p>

        <div className="popup-actions">
          <button onClick={onCancel} className="cancel-btn">Cancel</button>
          <button onClick={onConfirm} className="confirm-btn">OK</button>
        </div>
      </div>
    </div>
  );
}
