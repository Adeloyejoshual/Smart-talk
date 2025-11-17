// src/components/Chat/ReportUserPopup.jsx
import React, { useState } from "react";

export default function ReportUserPopup({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box big" onClick={(e) => e.stopPropagation()}>
        <h3>Report user</h3>

        <p>Please tell us the reason for reporting this user.</p>

        <textarea
          className="popup-textarea"
          placeholder="Describe the issue…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="popup-buttons">
          <button
            className="btn-danger"
            disabled={!reason.trim()}
            onClick={() => onSubmit(reason)}
          >
            Submit Report
          </button>

          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
