// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
import { Paperclip, Send, Mic } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  sendMediaMessage,
  selectedFiles,
  setSelectedFiles,
  isDark,
}) {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  // -----------------------------
  // File selection (images/videos only for preview)
  // -----------------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setSelectedFiles([...selectedFiles, ...files].slice(0, 30));
    setShowPreview(true);
    e.target.value = null; // reset input
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

  // -----------------------------
  // Voice note recording
  // -----------------------------
  const startRecording = async () => {
    if (!navigator.mediaDevices) return alert("Audio recording not supported.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });

        // Send voice note
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
        {/* File input */}
        <input
          type="file"
          multiple
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <button
          onClick={handleAddMoreFiles}
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
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

        {/* Send / Voice */}
        <button
          onClick={text ? sendTextMessage : recording ? stopRecording : startRecording}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          {recording ? "🔴" : text ? <Send /> : <Mic />}
        </button>
      </div>

      {/* Preview modal */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={handleRemoveFile}
          onSend={handleSendFromPreview}
          onCancel={handleCancelPreview}
          onAddFiles={handleAddMoreFiles}
        />
      )}
    </>
  );
}