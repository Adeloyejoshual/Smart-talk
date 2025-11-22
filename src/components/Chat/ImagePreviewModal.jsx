// src/components/Chat/ImagePreviewModal.jsx
import React from "react";
import { X } from "lucide-react";

export default function ImagePreviewModal({ files, onRemove, onSend, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        padding: 16,
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          maxWidth: "90%",
          maxHeight: "60%",
          overflowY: "auto",
          justifyContent: "center",
        }}
      >
        {files.map((file, index) => {
          const url = URL.createObjectURL(file);
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");

          return (
            <div
              key={index}
              style={{
                position: "relative",
                width: 100,
                height: 100,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #ccc",
              }}
            >
              {isImage && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {isVideo && <video src={url} style={{ width: "100%", height: "100%" }} controls />}
              <button
                onClick={() => onRemove(index)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "rgba(0,0,0,0.5)",
                  border: "none",
                  borderRadius: "50%",
                  color: "#fff",
                  width: 20,
                  height: 20,
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={onCancel}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#ccc" }}
        >
          Cancel
        </button>
        <button
          onClick={onSend}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#34B7F1", color: "#fff" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}