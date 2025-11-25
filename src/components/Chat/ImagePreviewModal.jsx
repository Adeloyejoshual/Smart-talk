import React, { useState } from "react";
import { X } from "lucide-react";

export default function ImagePreviewModal({
  files,
  onRemove,
  onSend,
  onCancel,
  onAddFiles,
  isDark,
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Only images/videos
  const mediaFiles = files.filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
  const activeFile = mediaFiles[activeIndex];
  const activeUrl = activeFile ? URL.createObjectURL(activeFile) : null;

  const isImage = activeFile?.type.startsWith("image/");
  const isVideo = activeFile?.type.startsWith("video/");

  if (!activeFile) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
        padding: 20,
        color: "#fff",
      }}
    >
      {/* Close button */}
      <button
        onClick={onCancel}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: "rgba(0,0,0,0.4)",
          borderRadius: "50%",
          border: "none",
          width: 40,
          height: 40,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <X color="#fff" size={22} />
      </button>

      {/* Active Preview */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          maxHeight: "70vh",
        }}
      >
        {isImage && <img src={activeUrl} style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12, objectFit: "contain" }} />}
        {isVideo && <video src={activeUrl} controls style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12 }} />}
      </div>

      {/* Thumbnail Selector */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, marginTop: 10 }}>
        {/* Add + button */}
        <div
          onClick={onAddFiles}
          style={{
            width: 80,
            height: 80,
            borderRadius: 10,
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 32,
            fontWeight: "bold",
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          +
        </div>

        {mediaFiles.map((file, i) => {
          const thumbUrl = URL.createObjectURL(file);
          const thumbIsImg = file.type.startsWith("image/");
          const thumbIsVid = file.type.startsWith("video/");

          return (
            <div
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                position: "relative",
                width: 80,
                height: 80,
                borderRadius: 10,
                cursor: "pointer",
                border: activeIndex === i ? "2px solid #34B7F1" : "2px solid transparent",
                overflow: "hidden",
                background: "rgba(255,255,255,0.1)",
                flexShrink: 0,
              }}
            >
              {thumbIsImg && <img src={thumbUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {thumbIsVid && <video src={thumbUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}

              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "rgba(0,0,0,0.5)",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} color="#fff" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 15, justifyContent: "center", marginTop: 20 }}>
        <button
          onClick={onCancel}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#666",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          Cancel
        </button>

        <button
          onClick={onSend}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#34B7F1",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          Send {mediaFiles.length > 1 ? `(${mediaFiles.length})` : ""}
        </button>
      </div>
    </div>
  );
}