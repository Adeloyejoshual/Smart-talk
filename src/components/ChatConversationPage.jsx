import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

import HeaderActionsBar from "./HeaderActionsBar";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import EmojiPicker from "emoji-picker-react";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);

  // 🔹 Fetch messages in real-time
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [chatId]);

  // 🔹 Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔹 Send message
  const handleSend = async () => {
    if (!messageText.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: messageText,
      senderId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
    });
    setMessageText("");
  };

  // 🔹 Handle emoji select
  const handleEmojiSelect = (emojiData) => {
    setMessageText((prev) => prev + emojiData.emoji);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      {/* 🧭 Header pinned to top */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-sm">
        <HeaderActionsBar
          contactName="Kude"
          contactStatus="Online"
          onBack={() => navigate("/chat")}
          onCall={() => console.log("Voice call")}
          onVideo={() => console.log("Video call")}
        />
      </div>

      {/* 💬 Scrollable chat area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* ✍️ Input bar pinned to bottom */}
      <div className="sticky bottom-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="text-gray-500 hover:text-yellow-500"
        >
          😀
        </button>

        {showEmoji && (
          <div className="absolute bottom-16 left-3 z-50">
            <EmojiPicker onEmojiClick={handleEmojiSelect} theme="dark" />
          </div>
        )}

        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Message..."
          className="flex-1 bg-transparent outline-none px-2 text-gray-900 dark:text-gray-100 placeholder-gray-400"
        />

        <button
          onClick={handleSend}
          className="text-blue-500 font-semibold hover:text-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}