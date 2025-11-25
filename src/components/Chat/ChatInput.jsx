// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
import { Paperclip, Send, Mic } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  sendMediaMessage, // images/videos -> Cloudinary, files/audio -> B2
  selectedFiles,
  setSelectedFiles,
  isDark,
}) {
  const fileInputRef = useRef(null);

  const [showPreview, setShowPreview] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [voiceNote, setVoiceNote] = useState(null);
  const startXRef = useRef(0);
  const [showTrash, setShowTrash] = useState(false);
  const [trashBounce, setTrashBounce] = useState(false);

  // -----------------------------
  // File selection
  // -----------------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // Only images/videos in preview
    const mediaFiles = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setSelectedFiles([...selectedFiles, ...mediaFiles].slice(0, 30));
    if (mediaFiles.length) setShowPreview(true);
    e.target.value = null;
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendFromPreview = async () => {
    if (selectedFiles.length) {
      await sendMediaMessage(selectedFiles);
      setSelectedFiles([]);
    }
    if (voiceNote) {
      await sendMediaMessage([voiceNote]);
      setVoiceNote(null);
    }
    setShowPreview(false);
  };

  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setVoiceNote(null);
    setShowPreview(false);
  };

  const handleAddMoreFiles = () => fileInputRef.current.click();

  // -----------------------------
  // Voice note recording
  // -----------------------------
  const startRecording = async (e) => {
    if (!navigator.mediaDevices) return alert("Audio recording not supported.");
    startXRef.current = e.touches ? e.touches[0].clientX : e.clientX;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setVoiceNote(audioFile);
        setShowPreview(true); // open preview for audio
      };

      recorder.start();
      setRecording(true);
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
    } catch (err) {
      console.error("Recording error:", err);
    }
  };

  const stopRecording = (e) => {
    if (!recording) return;

    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const deltaX = startXRef.current - endX;

    // Slide left >80px to cancel
    if (deltaX > 80) {
      if (mediaRecorder) mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
      setAudioChunks([]);
      setVoiceNote(null);

      setShowTrash(true);
      setTrashBounce(true);
      setTimeout(() => {
        setTrashBounce(false);
        setShowTrash(false);
      }, 800);
    } else {
      if (mediaRecorder) mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
      setAudioChunks([]);
    }
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
        <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileChange} />
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
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          {recording ? "🔴" : text ? <Send /> : <Mic />}
        </button>
      </div>

      {/* Trash animation */}
      {showTrash && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: "50%",
            transform: `translateX(-50%) ${trashBounce ? "translateY(-10px)" : "translateY(0)"}`,
            transition: "transform 0.2s",
            fontSize: 36,
            color: "#ff3b30",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          🗑️
        </div>
      )}

      {/* Preview modal for images/videos/voice */}
      {showPreview && (selectedFiles.length > 0 || voiceNote) && (
        <ImagePreviewModal
          files={selectedFiles}
          voiceNote={voiceNote ? URL.createObjectURL(voiceNote) : null}
          onRemove={(index) => {
            if (voiceNote && index === -1) setVoiceNote(null);
            else handleRemoveFile(index);
          }}
          onSend={handleSendFromPreview}
          onCancel={handleCancelPreview}
          onAddFiles={handleAddMoreFiles}
        />
      )}
    </>
  );
}