// src/components/Chat/ChatInput.jsx
import React, { useRef, useState } from "react";
import { Paperclip, Send, Mic, X } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  sendMediaMessage,
  selectedFiles,
  setSelectedFiles,
  isDark,
  setShowPreview,
  replyTo,
  setReplyTo,
}) {
  const fileInputRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  // ------------------- File Handling -------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setSelectedFiles([...selectedFiles, ...files].slice(0, 30));
    setShowPreview(true);
    e.target.value = null;
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendFromPreview = async () => {
    if (!selectedFiles.length) return;
    await sendMediaMessage(selectedFiles);
    setSelectedFiles([]);
    setShowPreview(false);
  };

  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setShowPreview(false);
  };

  const handleAddMoreFiles = () => fileInputRef.current.click();

  // ------------------- Voice Note -------------------
  const startRecording = async () => {
    if (!navigator.mediaDevices) return alert("Audio recording not supported.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        await sendMediaMessage([audioFile]);
      };

      recorder.start();
      setRecording(true);
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
    } catch (err) {
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder) return;
    mediaRecorder.stop();
    setRecording(false);
    setMediaRecorder(null);
    setAudioChunks([]);
  };

  return (
    <>
      {/* Reply Preview */}
      {replyTo && (
        <div
          style={{
            background: isDark ? "#1b1b1b" : "#eaeaea",
            padding: 8,
            margin: 4,
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            Replying to: <strong>{replyTo.text || replyTo.mediaType || "Media"}</strong>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: isDark ? "#fff" : "#333",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* File Input */}
      <input
        type="file"
        multiple
        hidden
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* Chat Controls */}
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
        {/* Attach */}
        <button
          onClick={handleAddMoreFiles}
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <Paperclip />
        </button>

        {/* Input */}
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

        {/* Send / Voice */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          {recording ? "🔴" : text ? <Send /> : <Mic />}
        </button>
      </div>

      {/* Image/Video Preview Modal */}
      {selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={handleRemoveFile}
          onSend={handleSendFromPreview}
          onCancel={handleCancelPreview}
          onAddFiles={handleAddMoreFiles}
          isDark={isDark}
        />
      )}
    </>
  );
}