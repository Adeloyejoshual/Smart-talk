
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
import { auth, db } from "../firebaseConfig";
import ChatHeader from "./Chat/ChatHeader";
import MessageBubble from "./Chat/MessageBubble";
import ChatInput from "./Chat/ChatInput";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // 🔁 Listen to messages in real-time
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return unsubscribe;
  }, [chatId]);

  // 🧭 Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✉️ Send message
  const handleSendMessage = async (text, fileURL) => {
    if (!text && !fileURL) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: auth.currentUser.uid,
      text: text || "",
      fileURL: fileURL || null,
      timestamp: serverTimestamp(),
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* 🧭 Header pinned to top */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <ChatHeader chatId={chatId} />
      </div>

      {/* 💬 Messages scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 📤 Input pinned bottom */}
      <div className="sticky bottom-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
// 🧱 Styles
const styles = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#f5f5f5",
  },
  header: {
    background: "#075E54",
    color: "white",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "white",
    fontSize: 20,
    cursor: "pointer",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover",
  },
  messages: {
    flexGrow: 1,
    overflowY: "auto",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  messageBubble: {
    padding: "10px",
    borderRadius: "10px",
    maxWidth: "75%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  time: { fontSize: "11px", color: "#777", marginTop: 4, float: "right" },
  inputBar: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    background: "#fff",
    borderTop: "1px solid #ddd",
    position: "sticky",
    bottom: 0,
    zIndex: 10,
  },
  input: {
    flexGrow: 1,
    border: "1px solid #ccc",
    borderRadius: "20px",
    padding: "8px 14px",
    outline: "none",
  },
  sendBtn: {
    background: "#25D366",
    border: "none",
    borderRadius: "50%",
    width: 40,
    height: 40,
    color: "#fff",
    fontSize: 18,
    marginLeft: 8,
    cursor: "pointer",
  },
  attachLabel: { cursor: "pointer", fontSize: 22, marginRight: 8 },
  previewBox: {
    position: "fixed",
    bottom: 70,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#fff",
    borderRadius: "12px",
    padding: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    zIndex: 15,
  },
  previewImg: { width: 80, height: 80, borderRadius: "8px", objectFit: "cover" },
  cancelBtn: {
    border: "none",
    background: "#ff4d4f",
    color: "white",
    borderRadius: "50%",
    width: 25,
    height: 25,
    cursor: "pointer",
  },
};