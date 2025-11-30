// src/components/Chat/ImagePreviewModal.jsx
import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function ImagePreviewModal({
  files,
  onCancel,
  onSend,
  onRemove,
  onAddFiles,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeUrl, setActiveUrl] = useState("");

  const mediaFiles = files.filter(
    (f) =>
      f.type.startsWith("image/") ||
      f.type.startsWith("video/") ||
      f.type.startsWith("audio/") ||
      f.type.startsWith("application/")
  );

  const activeFile = mediaFiles[activeIndex];

  useEffect(() => {
    if (!activeFile) return;

    const url = URL.createObjectURL(activeFile);
    setActiveUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [activeFile]);

  if (!activeFile) return null;

  const isImage = activeFile.type.startsWith("image/");
  const isVideo = activeFile.type.startsWith("video/");
  const isAudio = activeFile.type.startsWith("audio/");
  const isFile =
    activeFile.type.startsWith("application/") ||
    (!isImage && !isVideo && !isAudio);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        padding: 10,
        color: "white",
      }}
    >
      {/* Close Button */}
      <button
        onClick={onCancel}
        style={{
          position: "absolute",
          top: 15,
          right: 15,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.15)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <X color="#fff" size={22} />
      </button>

      {/* Preview Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 10,
        }}
      >
        {isImage && (
          <img
            src={activeUrl}
            alt="preview"
            style={{ maxWidth: "100%", maxHeight: "80%", borderRadius: 12 }}
          />
        )}

        {isVideo && (
          <video
            src={activeUrl}
            controls
            style={{ maxWidth: "100%", maxHeight: "80%", borderRadius: 12 }}
          />
        )}

        {isAudio && (
          <audio controls src={activeUrl} style={{ width: "90%" }} />
        )}

        {isFile && (
          <div
            style={{
              padding: 20,
              background: "rgba(255,255,255,0.15)",
              borderRadius: 12,
              textAlign: "center",
              width: "90%",
            }}
          >
            📄 {activeFile.name}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 10,
          padding: "5px 0",
        }}
      >
        {/* Add More Button */}
        <div
          onClick={onAddFiles}
          style={{
            width: 70,
            height: 70,
            borderRadius: 10,
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            fontSize: 30,
          }}
        >
          +
        </div>

        {mediaFiles.map((file, i) => {
          const url = URL.createObjectURL(file);

          return (
            <div
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                width: 70,
                height: 70,
                borderRadius: 10,
                position: "relative",
                border:
                  activeIndex === i
                    ? "2px solid #34B7F1"
                    : "2px solid transparent",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              {file.type.startsWith("image/") ? (
                <img
                  src={url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : file.type.startsWith("video/") ? (
                <video
                  src={url}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "rgba(255,255,255,0.2)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 20,
                  }}
                >
                  📄
                </div>
              )}

              {/* Remove */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.7)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} color="#fff" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Send Button */}
      <button
        onClick={() => onSend(mediaFiles)}
        style={{
          marginTop: 10,
          padding: "14px 0",
          width: "100%",
          borderRadius: 10,
          border: "none",
          background: "#34B7F1",
          color: "#fff",
          fontSize: 17,
          fontWeight: "bold",
        }}
      >
        Send ({mediaFiles.length})
      </button>
    </div>
  );
}