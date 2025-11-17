// src/components/Chat/MessageDayDivider.jsx
import React from "react";

export default function MessageDayDivider({ label }) {
  return (
    <div className="day-divider">
      <div className="line"></div>
      <span className="text">{label}</span>
      <div className="line"></div>
    </div>
  );
}
