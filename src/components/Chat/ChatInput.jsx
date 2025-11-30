// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
import { Paperclip, Send, Mic } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";
import axios from "axios";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  chatId,
  selectedFiles,
  setSelectedFiles,
  isDark,
}) {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/<your-cloud-name>/upload";
  const CLOUDINARY_UPLOAD_PRESET = "<your-upload-preset>";

  // -----------------------------
  // Handle file selection (images, videos, audio, PDFs)
  // -----------------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setSelectedFiles([...selectedFiles, ...files].slice(0, 30));
    setShowPreview(true);

    e.target.value = null; // reset input
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddMoreFiles = () => fileInputRef.current.click();

  // -----------------------------
  // Upload media to Cloudinary
  // -----------------------------
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await axios.post(CLOUDINARY_UPLOAD_URL, formData);
    return res.data.secure_url;
  };

  // -----------------------------
  // Send selected files
  // -----------------------------
  const handleSendFromPreview = async () => {
    if (!selectedFiles.length) return;

    const uploadedFiles = [];
    for (let f of selectedFiles) {
      try {
        const url = await uploadFile(f);
        let mediaType = "file";

        if (f.type.startsWith("image/")) mediaType = "image";
        else if (f.type.startsWith("video/")) mediaType = "video";
        else if (f.type.startsWith("audio/")) mediaType = "audio";
        else if (f.type === "application/pdf") mediaType = "pdf";

        uploadedFiles.push({ mediaUrl: url, mediaType, fileName: f.name });
      } catch (err) {
        console.error("Upload failed for", f.name, err);
        alert(`Failed to upload ${f.name}`);
      }
    }

    for (let file of uploadedFiles) {
      await sendTextMessage({ mediaUrl: file.mediaUrl, mediaType: file.mediaType, fileName: file.fileName });
    }

    setSelectedFiles([]);
    setShowPreview(false);
  };

  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setShowPreview(false);
  };

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

        setSelectedFiles([audioFile]);
        setShowPreview(true);
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
          accept="image/*,video/*,audio/*,application/pdf"
        />
        <button onClick={() => fileInputRef.current.click()} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
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
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          onClick={() => sendTextMessage({ text })}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          {recording ? "🔴" : text ? <Send /> : <Mic />}
        </button>
      </div>

      {/* Preview modal for images/videos/audio */}
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