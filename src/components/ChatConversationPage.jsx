import React, { useState, useEffect, useRef, useContext } from "react";
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
import Spinner from "./Chat/Spinner";
import { uploadFileWithProgress } from "../awsS3";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewFiles, setPreviewFiles] = useState([]);
  const bottomRef = useRef(null);

  // 🧠 Load messages in real time
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsub();
  }, [chatId]);

  // ✉️ Send message (text + file support)
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() && previewFiles.length === 0) return;

    try {
      setUploading(true);

      // Upload files if any
      const uploadedFiles = [];
      for (const file of previewFiles) {
        const url = await uploadFileWithProgress(file, chatId, setProgress);
        uploadedFiles.push({
          fileUrl: url,
          fileName: file.name,
          fileType: file.type,
          type: "file",
        });
      }

      // Save text message
      if (newMsg.trim()) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          text: newMsg.trim(),
          senderId: auth.currentUser.uid,
          type: "text",
          timestamp: serverTimestamp(),
        });
      }

      // Save each uploaded file message
      for (const file of uploadedFiles) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          ...file,
          senderId: auth.currentUser.uid,
          timestamp: serverTimestamp(),
        });
      }

      // Reset state
      setNewMsg("");
      setPreviewFiles([]);
      setProgress(0);
      setUploading(false);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploading(false);
      setProgress(0);
    }
  };

  // 📸 Preview selected files
  const handleFileSelect = (files) => {
    const previews = Array.from(files);
    setPreviewFiles(previews);
  };

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50"
      }`}
    >
      {/* 💬 Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">No messages yet</div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderId === auth.currentUser.uid}
          />
        ))}

        <div ref={bottomRef}></div>
      </div>

      {/* 📤 Upload preview */}
      {previewFiles.length > 0 && (
        <div className="flex gap-2 p-2 border-t border-gray-300 bg-gray-100 dark:bg-gray-800 overflow-x-auto">
          {previewFiles.map((file, i) => (
            <div key={i} className="relative">
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center bg-gray-300 dark:bg-gray-700 rounded-lg text-xs">
                  {file.name.split(".").pop().toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 🔄 Upload progress */}
      {uploading && (
        <div className="p-3 flex items-center gap-3 bg-gray-200 dark:bg-gray-800 text-sm">
          <Spinner /> Uploading... {Math.round(progress * 100)}%
        </div>
      )}

      {/* 📝 Input bar */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <FileUploadButton onFileSelect={handleFileSelect} />
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 rounded-full px-4 py-2 bg-gray-100 dark:bg-gray-700 focus:outline-none text-sm"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
        />
        <button
          type="submit"
          disabled={uploading}
          className={`rounded-full px-4 py-2 text-sm text-white ${
            uploading
              ? "bg-gray-400"
              : "bg-blue-500 hover:bg-blue-600 transition"
          }`}
        >
          Send
        </button>
      </form>
    </div>
  );
}