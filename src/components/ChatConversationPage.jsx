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
import Spinner from "./Chat/Spinner";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const endRef = useRef(null);

  /* -------------------- 🔄 Real-time Messages -------------------- */
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
    });
    return () => unsub();
  }, [chatId]);

  /* -------------------- 📜 Auto-scroll -------------------- */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* -------------------- 📂 Handle File Selection -------------------- */
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

  const removePreview = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  /* -------------------- ☁️ Upload File -------------------- */
  const uploadSingle = async (file, onProgress) => {
    const path = `chats/${chatId}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);

    return await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          const p = snapshot.totalBytes
            ? snapshot.bytesTransferred / snapshot.totalBytes
            : 0;
          onProgress && onProgress(p);
        },
        (err) => reject(err),
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  };

  /* -------------------- 📤 Send Message -------------------- */
  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!chatId) return;

    if (!input.trim() && selectedFiles.length === 0) return;

    try {
      setUploading(true);

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

      // Upload files one by one
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgress(0);
        const url = await uploadSingle(file, (p) => setProgress(p));

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

      // cleanup
      previews.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      setSelectedFiles([]);
      setPreviews([]);
      setProgress(0);
    } catch (err) {
      console.error("send error", err);
      alert("Failed to send. Try again.");
    } finally {
      setUploading(false);
    }
  };

  /* -------------------- 🧱 UI Layout -------------------- */
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <img
            src="/default-avatar.png"
            alt="user"
            className="w-8 h-8 rounded-full object-cover"
          />
          <div>
            <p className="font-medium text-sm text-gray-800 dark:text-gray-200">
              Chat Room
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            No messages yet. Say hi 👋
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isOwn={m.senderId === auth.currentUser?.uid}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* File Previews */}
      {previews.length > 0 && (
        <div className="p-2 border-t bg-gray-50 dark:bg-gray-800 flex gap-2 items-center overflow-x-auto">
          {previews.map((p, idx) => (
            <div key={idx} className="relative w-20 h-20 flex-shrink-0">
              {p.url ? (
                <img
                  src={p.url}
                  alt={p.name}
                  className="w-full h-full object-cover rounded"
                />
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

      {/* Upload Progress */}
      {uploading && (
        <div className="p-2 text-xs text-center bg-gray-100 dark:bg-gray-800">
          Uploading {Math.round(progress * 100)}%
        </div>
      )}

      {/* Message Input */}
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