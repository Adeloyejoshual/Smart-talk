// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { FiArrowLeft, FiPhone, FiVideo } from "react-icons/fi";
import MessageBubble from "./Chat/MessageBubble";
import Spinner from "./Chat/Spinner";
import TypingIndicator from "./Chat/TypingIndicator";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useContext(ThemeContext);
  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const getChatUser = async () => {
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const otherUserId = chatData.members.find(
          (id) => id !== auth.currentUser.uid
        );
        const userRef = doc(db, "users", otherUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setChatUser(userSnap.data());
      }
    };
    getChatUser();
  }, [chatId]);

  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(list);
      setLoading(false);
      scrollToBottom();
    });
    return () => unsubscribe();
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgRef = collection(db, "chats", chatId, "messages");
    await addDoc(msgRef, {
      text: newMessage,
      senderId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
      reactions: {},
    });
    setNewMessage("");
    scrollToBottom();
  };

  const formatTime = (ts) => {
    if (!ts?.toDate) return "";
    const date = ts.toDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const day = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${day} ${hours}:${minutes}`;
  };

  return (
    <div
      className={`flex flex-col h-screen ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      {/* 🧭 HEADER */}
      <div
        className={`flex items-center justify-between px-4 py-3 shadow-md sticky top-0 z-10 ${
          isDarkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-700/20"
          >
            <FiArrowLeft size={22} />
          </button>
          {chatUser && (
            <div>
              <div className="font-semibold text-base">{chatUser.displayName}</div>
              <div className="text-xs opacity-70">
                {chatUser.isOnline
                  ? "Online"
                  : `Last seen ${formatTime(chatUser.lastSeen)}`}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <FiPhone size={20} className="cursor-pointer hover:text-blue-500" />
          <FiVideo size={20} className="cursor-pointer hover:text-blue-500" />
        </div>
      </div>

      {/* 💬 MESSAGES */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading ? (
          <Spinner />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.senderId === auth.currentUser.uid}
              isDarkMode={isDarkMode}
            />
          ))
        )}
        <div ref={messagesEndRef}></div>
      </div>

      <TypingIndicator />

      {/* 📨 INPUT */}
      <form
        onSubmit={handleSend}
        className={`flex items-center gap-2 p-3 sticky bottom-0 border-t ${
          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <input
          type="text"
          placeholder="Message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className={`flex-1 px-4 py-2 rounded-full outline-none text-sm ${
            isDarkMode
              ? "bg-gray-700 text-white placeholder-gray-400"
              : "bg-gray-100 text-gray-800 placeholder-gray-500"
          }`}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 active:scale-95"
        >
          Send
        </button>
      </form>
    </div>
  );
}