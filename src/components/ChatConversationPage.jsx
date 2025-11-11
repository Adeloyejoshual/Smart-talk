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

  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

  // 🟢 Load messages in real-time
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
    });
    return () => unsub();
  }, [chatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🟢 Handle file select
  const handleFilesSelected = (files) => {
    const arr = Array.from(files || []);
    const newPreviews = arr.map((f) => ({
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      type: f.type,
      name: f.name,
      file: f,
    }));
    setSelectedFiles((prev) => [...prev, ...arr]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  // 🟢 Remove preview
  const removePreview = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // 🟢 Upload to Cloudinary
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url;
  };

  // 🟢 Handle send
  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!chatId || (!input.trim() && selectedFiles.length === 0)) return;

    try {
      setUploading(true);
      setProgress(0);

      // Send text message
      if (input.trim()) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser?.uid || null,
          type: "text",
          text: input.trim(),
          timestamp: serverTimestamp(),
        });
        setInput("");
      }

      // Send files (Cloudinary)
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgress(((i + 1) / selectedFiles.length) * 100);

        const url = await uploadToCloudinary(file);
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

      setSelectedFiles([]);
      previews.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      setPreviews([]);
      setProgress(0);
    } catch (err) {
      console.error("❌ Send failed:", err);
      alert("Failed to send message or file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* 🟢 Messages */}
      <div className="flex-1 overflow-auto p-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} isOwn={m.senderId === auth.currentUser?.uid} />
        ))}
        <div ref={endRef} />
      </div>

      {/* 🟢 File Previews */}
      {previews.length > 0 && (
        <div className="p-2 border-t bg-gray-50 dark:bg-gray-800 flex gap-2 items-center overflow-x-auto">
          {previews.map((p, idx) => (
            <div key={idx} className="relative w-20 h-20 flex-shrink-0">
              {p.url ? (
                <img src={p.url} alt={p.name} className="w-full h-full object-cover rounded" />
              ) : (
                <div className="w-full h-full flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-xs p-1">
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

      {/* 🟢 Uploading Progress */}
      {uploading && (
        <div className="p-2 text-xs text-center bg-gray-100 dark:bg-gray-800">
          Uploading {Math.round(progress)}%
        </div>
      )}

      {/* 🟢 Composer */}
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