import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import MessageBubble from "./Chat/MessageBubble";
import FileUploadButton from "./Chat/FileUploadButton";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const endRef = useRef(null);

  // 🔄 Load messages in real time
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
    });
    return () => unsub();
  }, [chatId]);

  // 📜 Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🖼️ Handle selected files (image or video)
  const handleFilesSelected = (files) => {
    const arr = Array.from(files || []);
    const newPreviews = arr.map((f) => {
      const type = f.type;
      let previewUrl = null;

      // Create preview for both images and videos
      if (type.startsWith("image/") || type.startsWith("video/")) {
        previewUrl = URL.createObjectURL(f);
      }

      return {
        url: previewUrl,
        type,
        name: f.name,
        file: f,
      };
    });

    setSelectedFiles((prev) => [...prev, ...arr]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  // ❌ Remove a preview before upload
  const removePreview = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // ☁️ Upload to Cloudinary
  const uploadToCloudinary = async (file, onProgress) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = e.loaded / e.total;
          onProgress && onProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          resolve(res.secure_url);
        } else {
          reject(new Error("Cloudinary upload failed"));
        }
      };

      xhr.onerror = () => reject(new Error("Upload error"));
      xhr.send(formData);
    });
  };

  // 📤 Send message
  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!chatId) return;
    if (!input.trim() && selectedFiles.length === 0) return;

    try {
      setUploading(true);

      // ✉️ Send text message
      if (input.trim()) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser?.uid || null,
          type: "text",
          text: input.trim(),
          timestamp: serverTimestamp(),
        });
        setInput("");
      }

      // 📁 Upload and send files
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgress(0);
        const url = await uploadToCloudinary(file, (p) => setProgress(p));

        let msgType = "file";
        if (file.type.startsWith("image/")) msgType = "image";
        else if (file.type.startsWith("video/")) msgType = "video";

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser?.uid || null,
          type: msgType,
          fileUrl: url,
          fileName: file.name,
          fileType: file.type,
          timestamp: serverTimestamp(),
        });
      }

      // Reset after send
      setSelectedFiles([]);
      previews.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      setPreviews([]);
      setProgress(0);
    } catch (err) {
      console.error("send error", err);
      alert("Upload failed — check Cloudinary config or network.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* 🗨️ Chat messages */}
      <div className="flex-1 overflow-auto p-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} isOwn={m.senderId === auth.currentUser?.uid} />
        ))}
        <div ref={endRef} />
      </div>

      {/* 📸 File previews */}
      {previews.length > 0 && (
        <div className="p-2 border-t bg-gray-50 dark:bg-gray-800 flex gap-2 items-center overflow-x-auto">
          {previews.map((p, idx) => (
            <div key={idx} className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
              {p.type.startsWith("image/") ? (
                <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
              ) : p.type.startsWith("video/") ? (
                <video src={p.url} className="w-full h-full object-cover" muted />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs bg-gray-100 dark:bg-gray-700">
                  {p.name}
                </div>
              )}
              <button
                onClick={() => removePreview(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ⏳ Upload progress */}
      {uploading && (
        <div className="p-2 text-xs text-center bg-gray-100 dark:bg-gray-800">
          Uploading {Math.round(progress * 100)}%
        </div>
      )}

      {/* ✍️ Input bar */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t bg-white dark:bg-gray-800 flex items-center gap-2"
      >
        <FileUploadButton onFileSelect={handleFilesSelected} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={uploading ? "Uploading..." : "Type a message"}
          className="flex-1 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-sm outline-none"
          disabled={uploading}
        />
        <button
          type="submit"
          disabled={uploading || (!input.trim() && selectedFiles.length === 0)}
          className="bg-blue-500 text-white px-4 py-2 rounded-full disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}