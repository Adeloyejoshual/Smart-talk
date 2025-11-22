// src/components/Chat/ImagePreviewModal.jsx
import React from "react";

export default function ImagePreviewModal({ file, onCancel, onSend }) {
  if (!file) return null;

  const objectURL = URL.createObjectURL(file);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: 16,
          borderRadius: 12,
          maxWidth: "90%",
          maxHeight: "90%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <img
          src={objectURL}
          alt="preview"
          style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSend(file)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              backgroundColor: "#1877F2",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}