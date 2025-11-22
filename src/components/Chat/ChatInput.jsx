// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  onFilesSelected,
  selectedFiles,
  holdStart,
  holdEnd,
  recording,
  isDark,
}) {
  const fileInputRef = useRef(null);
  const [filePreview, setFilePreview] = useState(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setFilePreview(files[0]);
  };

  const handleSendFile = (file) => {
    onFilesSelected({ target: { files: [file] } });
    setFilePreview(null);
    sendTextMessage();
  };

  return (
    <>
      <div
        style={{
          padding: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderTop: `1px solid rgba(0,0,0,0.06)`,
          background: isDark ? "#1b1b1b" : "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 20,
        }}
      >
        {/* File input */}
        <input
          type="file"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current.click()}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18 }}
        >
          📎
        </button>

        {/* Text input */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 12,
            border: `1px solid rgba(0,0,0,0.06)`,
            outline: "none",
            background: isDark ? "#0b0b0b" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
        />

        {/* Send / Record button */}
        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          {recording ? "🔴" : "📩"}
        </button>
      </div>

      {/* Image preview modal */}
      <ImagePreviewModal
        file={filePreview}
        onCancel={() => setFilePreview(null)}
        onSend={handleSendFile}
      />
    </>
  );
}