// src/components/ChatConversationPage.jsx
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
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db, storage, auth } from "../firebaseConfig";
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

  // 🔄 Real-time listener for messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
    });
    return () => unsub();
  }, [chatId]);

  // ⬇️ Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 📁 When user picks files
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

  // ❌ Remove a file preview before sending
  const removePreview = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // ⬆️ Upload a single file to Firebase Storage
  const uploadSingle = async (file, onProgress) => {
    const path = `chats/${chatId}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);

    return new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const p = snap.bytesTransferred / snap.totalBytes;
          onProgress?.(p);
        },
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  // 🚀 Send message (text + files)
  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!chatId) return;
    if (!input.trim() && selectedFiles.length === 0) return;

    try {
      setUploading(true);

      // ✏️ Send text message first (if any)
      if (input.trim()) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser?.uid || null,
          type: "text",
          text: input.trim(),
          timestamp: serverTimestamp(),
        });
        setInput("");
      }

      // 📤 Handle file uploads with instant local preview
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const type = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
          ? "video"
          : "file";

        // 👁 Add a temporary message to UI immediately
        const tempId = `temp-${Date.now()}-${i}`;
        const tempMsg = {
          id: tempId,
          senderId: auth.currentUser?.uid,
          type,
          fileUrl: previews[i]?.url,
          fileName: file.name,
          fileType: file.type,
          timestamp: { toDate: () => new Date() },
          _uploading: true,
        };
        setMessages((prev) => [...prev, tempMsg]);

        // 🔼 Upload and replace temporary preview once done
        const url = await uploadSingle(file, (p) => setProgress(p));

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser?.uid || null,
          type,
          fileUrl: url,
          fileName: file.name,
          fileType: file.type,
          timestamp: serverTimestamp(),
        });
      }

      // 🧹 Clean up previews after all uploads complete
      setSelectedFiles([]);
      setPreviews([]);
      setProgress(0);
    } catch (err) {
      console.error("Send message error:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* 💬 Messages Area */}
      <div className="flex-1 overflow-auto p-3">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isOwn={m.senderId === auth.currentUser?.uid}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* 📸 File Previews */}
      {previews.length > 0 && (
        <div className="p-2 border-t bg-gray-50 dark:bg-gray-800 flex gap-2 items-center overflow-x-auto">
          {previews.map((p, idx) => (
            <div
              key={idx}
              className="relative w-20 h-20 flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded overflow-hidden"
            >
              {p.url ? (
                <img
                  src={p.url}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 p-2">
                  {p.name}
                </div>
              )}
              <button
                onClick={() => removePreview(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ⏳ Upload Progress */}
      {uploading && (
        <div className="p-2 text-xs text-center bg-gray-100 dark:bg-gray-800">
          Uploading {Math.round(progress * 100)}%
        </div>
      )}

      {/* 📝 Input Composer */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t bg-white dark:bg-gray-800 flex items-center gap-2"
      >
        <FileUploadButton onFileSelect={handleFilesSelected} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={uploading ? "Uploading..." : "Type a message..."}
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