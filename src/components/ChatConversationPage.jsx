// src/components/ChatConversationPage.jsx
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
import FullScreenPreview from "./Chat/FullScreenPreview";
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
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const bottomRef = useRef(null);

  // Load messages in real-time
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsub();
  }, [chatId]);

  // Send text message
  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMsg.trim();
    if (!trimmed) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: trimmed,
      senderId: auth.currentUser.uid,
      type: "text",
      timestamp: serverTimestamp(),
    });

    setNewMsg("");
  };

  // Upload file to AWS S3
  const handleFileUpload = async (file) => {
    try {
      setUploading(true);
      const url = await uploadFileWithProgress(file, chatId, setProgress);

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: auth.currentUser.uid,
        type: "file",
        fileName: file.name,
        fileUrl: url,
        fileType: file.type,
        timestamp: serverTimestamp(),
      });

      setUploading(false);
      setProgress(0);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploading(false);
      setProgress(0);
    }
  };

  // Handle image/video preview
  const handleMediaClick = (files, index = 0) => {
    setPreviewFiles(files);
    setActivePreviewIndex(index);
  };

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50"
      }`}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            No messages yet
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            chatId={chatId}
            isOwn={msg.senderId === auth.currentUser.uid}
            onMediaClick={handleMediaClick}
          />
        ))}

        <div ref={bottomRef}></div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="p-3 flex items-center gap-3 bg-gray-200 dark:bg-gray-800 text-sm">
          <Spinner /> Uploading... {Math.round(progress * 100)}%
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <FileUploadButton onFileSelect={handleFileUpload} />
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 rounded-full px-4 py-2 bg-gray-100 dark:bg-gray-700 focus:outline-none text-sm"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 text-sm"
        >
          Send
        </button>
      </form>

      {/* Fullscreen Preview */}
      {previewFiles.length > 0 && (
        <FullScreenPreview
          files={previewFiles}
          activeIndex={activePreviewIndex}
          onClose={() => setPreviewFiles([])}
          onPrev={() =>
            setActivePreviewIndex((i) =>
              i > 0 ? i - 1 : previewFiles.length - 1
            )
          }
          onNext={() =>
            setActivePreviewIndex((i) =>
              i < previewFiles.length - 1 ? i + 1 : 0
            )
          }
        />
      )}
    </div>
  );
}