// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { formatDate } from "../utils/formatDate";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  // Fetch messages
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return unsubscribe;
  }, [chatId]);

  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const userId = data.users.find((u) => u !== auth.currentUser.uid);
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setChatUser(userSnap.data());
      }
    };
    fetchUser();
  }, [chatId]);

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgRef = collection(db, "chats", chatId, "messages");
    await addDoc(msgRef, {
      text: newMessage,
      senderId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
    });

    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 🧠 Header */}
      <div className="flex items-center justify-between bg-white p-3 border-b border-gray-200 fixed top-0 left-0 right-0 z-10 shadow-sm">
        <button onClick={() => navigate("/chat")} className="text-gray-600 font-bold text-xl">←</button>
        <div className="flex flex-col items-center flex-1">
          <p className="font-semibold">{chatUser?.name || "Loading..."}</p>
          <p className="text-xs text-gray-500">
            {chatUser?.isOnline ? "Online" : `last seen ${formatDate(chatUser?.lastSeen)}`}
          </p>
        </div>
        <div className="flex gap-3">
          <button>📞</button>
          <button>🎥</button>
        </div>
      </div>

      {/* 💬 Message area */}
      <div className="flex-1 overflow-y-auto pt-[65px] pb-[70px] px-3 space-y-2">
        {messages.map((msg) => {
          const isMine = msg.senderId === auth.currentUser.uid;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl shadow-sm ${
                  isMine
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-white text-gray-800 rounded-bl-none"
                }`}
              >
                <p className="text-sm break-words">{msg.text}</p>
                <div className="text-[10px] text-gray-300 text-right mt-1">
                  {formatDate(msg.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ✍️ Input box */}
      <form
        onSubmit={sendMessage}
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 flex items-center gap-2"
      >
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Message..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-full"
        >
          ➤
        </button>
      </form>
    </div>
  );
}