// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import MessageBubble from "./Chat/MessageBubble";
import ReactionBar from "./Chat/ReactionBar";
import TypingIndicator from "./Chat/TypingIndicator";
import FileUploadButton from "./Chat/FileUploadButton";
import { uploadFileWithProgress } from "../awsS3";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const currentUser = auth.currentUser;

  /* -----------------------------
     🔥 Load chat and messages
  ----------------------------- */
  useEffect(() => {
    const fetchChatUser = async () => {
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        const userId =
          data.user1 === currentUser.uid ? data.user2 : data.user1;
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) setChatUser(userDoc.data());
      }
    };
    fetchChatUser();

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [chatId]);

  /* -----------------------------
     💬 Auto Scroll to bottom
  ----------------------------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* -----------------------------
     ✉️ Send message
  ----------------------------- */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: newMessage,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      type: "text",
    });

    setNewMessage("");
  };

  /* -----------------------------
     📎 Upload File
  ----------------------------- */
  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      const fileUrl = await uploadFileWithProgress(file, chatId);
      await addDoc(collection(db, "chats", chatId, "messages"), {
        fileUrl,
        fileName: file.name,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        type: "file",
      });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  /* -----------------------------
     🕒 Format Date Divider
  ----------------------------- */
  const formatDateLabel = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  /* -----------------------------
     💬 Render Message List
  ----------------------------- */
  const renderMessages = () => {
    let lastDate = "";
    return messages.map((msg) => {
      const dateLabel = formatDateLabel(msg.timestamp);
      const showDivider = dateLabel !== lastDate;
      lastDate = dateLabel;

      return (
        <React.Fragment key={msg.id}>
          {showDivider && (
            <div className="flex justify-center my-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
                {dateLabel}
              </span>
            </div>
          )}
          <MessageBubble msg={msg} isOwn={msg.senderId === currentUser.uid} />
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 bg-white dark:bg-gray-800 p-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <img
            src={chatUser?.photoURL || "/avatar.png"}
            alt="avatar"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h2 className="text-base font-semibold">{chatUser?.displayName}</h2>
            <p className="text-xs text-gray-500">
              {chatUser?.isOnline
                ? "Online"
                : `Last seen ${new Date(
                    chatUser?.lastSeen?.toDate?.()
                  ).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
            </p>
          </div>
        </div>
      </header>

      {/* ---------------- Messages ---------------- */}
      <div className="flex-1 overflow-y-auto p-3">{renderMessages()}</div>

      <div ref={messagesEndRef} />

      {/* ---------------- Typing Indicator ---------------- */}
      {isTyping && <TypingIndicator />}

      {/* ---------------- Input Section ---------------- */}
      <form
        onSubmit={handleSend}
        className="p-3 flex items-center gap-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
      >
        <FileUploadButton onFileSelect={handleFileUpload} disabled={uploading} />
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none text-sm bg-gray-100 dark:bg-gray-700"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            setIsTyping(e.target.value.length > 0);
          }}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}