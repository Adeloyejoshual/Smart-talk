// src/components/Chat/PinBanner.jsx
import React from "react";

export default function PinBanner({ pinnedMessage, onUnpin }) {
  if (!pinnedMessage) return null;

  return (
    <div className="pin-banner">
      <div className="pin-left">
        📌 <span className="pin-text">{pinnedMessage.text || "Pinned message"}</span>
      </div>
      <button className="pin-unpin-btn" onClick={onUnpin}>
        Unpin
      </button>
    </div>
  );
}
