// src/components/Chat/ImagePreviewModal.jsx
import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { auth } from "../../firebaseConfig";
import axios from "axios";

export default function ImagePreviewModal({
  files,
  onRemove,
  onCancel,
  onAddFiles,
  chatId,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const activeFile = files[activeIndex];

  const isImage = activeFile?.type.startsWith("image/");
  const isVideo = activeFile?.type.startsWith("video/");
  const isAudio = activeFile?.type.startsWith("audio/");
  const isFile = !isImage && !isVideo && !isAudio;

  const uploadToCloudinary = async (file) => {
    // Cloudinary upload
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "YOUR_CLOUDINARY_PRESET"); // <-- your preset
    const res = await axios.post(
      "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload",
      formData
    );
    return res.data.secure_url;
  };

  const handleSend = async () => {
    setUploading(true);
    try {
      for (const f of files) {
        let mediaUrl = "";
        let mediaType = null;

        if (isImage || isVideo || isAudio || isFile) {
          mediaUrl = await uploadToCloudinary(f);
          if (f.type.startsWith("image/")) mediaType = "image";
          else if (f.type.startsWith("video/")) mediaType = "video";
          else if (f.type.startsWith("audio/")) mediaType = "audio";
          else mediaType = "file";
        }

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser.uid,
          text: f.name || "",
          mediaUrl,
          mediaType,
          reactions: {},
          createdAt: serverTimestamp(),
          delivered: false,
          seen: false,
        });
      }
      onCancel();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
      {/* Close Button */}
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
        {isImage && <img src={URL.createObjectURL(activeFile)} alt="preview" style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12, objectFit: "contain" }} />}
        {isVideo && <video src={URL.createObjectURL(activeFile)} controls style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12 }} />}
        {isAudio && <audio src={URL.createObjectURL(activeFile)} controls />}
        {isFile && <div>{activeFile.name}</div>}
      </div>

      {/* Thumbnails */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, marginTop: 10 }}>
        {/* Add Files */}
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

        {files.map((f, i) => (
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
            {(f.type.startsWith("image/") || f.type.startsWith("video/")) && (
              <img src={URL.createObjectURL(f)} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
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
        ))}
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
          onClick={handleSend}
          disabled={uploading}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#34B7F1",
            color: "#fff",
            fontWeight: "bold",
            cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Sending..." : `Send (${files.length})`}
        </button>
      </div>
    </div>
  );
}