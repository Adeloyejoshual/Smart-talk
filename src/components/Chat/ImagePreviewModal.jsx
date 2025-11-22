// src/components/Chat/ImagePreviewModal.jsx
import React, { useState } from "react";

export default function ImagePreviewModal({ files, onCancel, onSend }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fileList, setFileList] = useState(files);

  if (!fileList || fileList.length === 0) return null;

  const currentFile = fileList[currentIndex];
  const objectURL = URL.createObjectURL(currentFile);

  const next = () => setCurrentIndex((i) => (i + 1) % fileList.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + fileList.length) % fileList.length);

  const removeCurrent = () => {
    const newList = fileList.filter((_, i) => i !== currentIndex);
    setFileList(newList);
    if (currentIndex >= newList.length) setCurrentIndex(newList.length - 1);
  };

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

        {fileList.length > 1 && (
          <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={prev} style={{ cursor: "pointer" }}>◀</button>
            <span>{currentIndex + 1} / {fileList.length}</span>
            <button onClick={next} style={{ cursor: "pointer" }}>▶</button>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <button
            onClick={removeCurrent}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              backgroundColor: "#ff4d4f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Remove
          </button>

          <button
            onClick={onCancel}
            style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
          >
            Cancel
          </button>

          <button
            onClick={() => onSend(fileList)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              backgroundColor: "#1877F2",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Send All
          </button>
        </div>
      </div>
    </div>
  );
}