import React from "react";

export default function MediaViewer({ url, type, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.92)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
    >
      {type === "image" && (
        <img
          src={url}
          alt=""
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            borderRadius: 12,
            userSelect: "none",
          }}
        />
      )}

      {type === "video" && (
        <video
          src={url}
          controls
          autoPlay
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            borderRadius: 12,
          }}
        />
      )}

      {/* close button */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          fontSize: 32,
          color: "#fff",
          cursor: "pointer",
        }}
      >
        ✕
      </div>
    </div>
  );
}