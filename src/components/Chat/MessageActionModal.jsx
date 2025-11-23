// src/components/Chat/MessageActionModal.jsx
import React from "react";

export default function MessageActionModal({
  isOpen,
  onClose,
  message,
  actions = {},
}) {
  if (!isOpen || !message) return null;

  const handleAction = async (action) => {
    if (actions[action]) await actions[action](message);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          minWidth: 220,
          padding: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {Object.keys(actions).map((key) => (
          <button
            key={key}
            onClick={() => handleAction(key)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "none",
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 12px",
            marginTop: 6,
            border: "none",
            background: "#eee",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
              }
