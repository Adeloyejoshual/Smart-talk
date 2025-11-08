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
import { uploadFileWithProgress } from "../awsS3";
import { ThemeContext } from "../context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewFiles, setPreviewFiles] = useState([]);
  const bottomRef = useRef(null);

  // Load messages
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsub();
  }, [chatId]);

  // Send text and files
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() && previewFiles.length === 0) return;

    // Send text
    if (newMsg.trim()) {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: newMsg.trim(),
        senderId: auth.currentUser.uid,
        type: "text",
        timestamp: serverTimestamp(),
      });
      setNewMsg("");
    }

    // Send files
    if (previewFiles.length > 0) {
      setUploading(true);
      for (const file of previewFiles) {
        try {
          const url = await uploadFileWithProgress(file, chatId, setProgress);
          await addDoc(collection(db, "chats", chatId, "messages"), {
            senderId: auth.currentUser.uid,
            type: "file",
            fileName: file.name,
            fileUrl: url,
            fileType: file.type,
            timestamp: serverTimestamp(),
          });
        } catch (err) {
          console.error("Upload failed:", err);
        }
      }
      setPreviewFiles([]);
      setUploading(false);
      setProgress(0);
    }
  };

  // Handle file select
  const handleFileSelect = (files) => {
    const arr = Array.from(files);
    setPreviewFiles(arr);
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
          <div className="text-center text-gray-400 mt-20">No messages yet</div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            chatId={chatId}
            isOwn={msg.senderId === auth.currentUser.uid}
          />
        ))}

        <div ref={bottomRef}></div>
      </div>

      {/* Animated Preview Bar */}
      <AnimatePresence>
        {previewFiles.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="flex gap-2 p-2 border-t dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-x-auto shadow-inner"
          >
            {previewFiles.map((file, i) => (
              <div
                key={i}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"
              >
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-gray-200 dark:bg-gray-700 text-xs text-center p-1">
                    {file.name.split(".").pop()}
                  </div>
                )}
                <button
                  onClick={() =>
                    setPreviewFiles(
                      previewFiles.filter((_, index) => index !== i)
                    )
                  }
                  className="absolute top-0 right-0 bg-black/70 text-white text-xs px-1 rounded-bl"
                >
                  ✕
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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
          className={`rounded-full px-4 py-2 text-sm text-white transition ${
            newMsg.trim() || previewFiles.length
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-gray-400 cursor-not-allowed"
          }`}
          disabled={!newMsg.trim() && previewFiles.length === 0}
        >
          Send
        </button>
      </form>
    </div>
  );
}