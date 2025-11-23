// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  sendMediaMessage,       // <-- Upload & send media files
  selectedFiles,
  setSelectedFiles,
  holdStart,
  holdEnd,
  recording,
  isDark,
}) {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Limit max files
    const newFiles = [...selectedFiles, ...files].slice(0, 30);
    setSelectedFiles(newFiles);

    setShowPreview(true);
    e.target.value = null; // reset input
  };

  // Remove a file from selection
  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Send button inside preview modal
  const handleSendFromPreview = async () => {
    if (!selectedFiles.length) return;

    setShowPreview(false);

    // Upload & send media files
    await sendMediaMessage(selectedFiles);

    setSelectedFiles([]);
  };

  // Cancel preview modal
  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setShowPreview(false);
  };

  // Add more files from preview modal
  const handleAddMoreFiles = () => {
    fileInputRef.current.click();
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: 8,
          gap: 8,
          borderTop: `1px solid ${isDark ? "#333" : "rgba(0,0,0,0.06)"}`,
          background: isDark ? "#1b1b1b" : "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 20,
        }}
      >
        {/* Hidden file input */}
        <input
          type="file"
          multiple
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        <button
          onClick={() => fileInputRef.current.click()}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18 }}
        >
          <Paperclip />
        </button>

        {/* Text input */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 12,
            border: `1px solid ${isDark ? "#333" : "rgba(0,0,0,0.06)"}`,
            outline: "none",
            background: isDark ? "#0b0b0b" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
        />

        {/* Send / Record */}
        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          {recording ? "🔴" : <Send />}
        </button>
      </div>

      {/* Image/Video preview modal */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={handleRemoveFile}
          onSend={handleSendFromPreview}  // Send selected media
          onCancel={handleCancelPreview}
          onAddFiles={handleAddMoreFiles} // Add more files
        />
      )}
    </>
  );
}