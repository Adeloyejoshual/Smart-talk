// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
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
import HeaderActionsBar from "./Chat/HeaderActionsBar";
import TypingIndicator from "./Chat/TypingIndicator";
import ReplyPreview from "./Chat/ReplyPreview";
import ReactionBar from "./Chat/ReactionBar";
import MessageActionsMenu from "./Chat/MessageActionsMenu";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef();

  // Load chat partner info
  useEffect(() => {
    const fetchChatUser = async () => {
      const chatRef = doc(db, "users", chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) setChatUser(chatSnap.data());
    };
    fetchChatUser();
  }, [chatId]);

  // Load messages live
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [chatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send a message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: auth.currentUser.uid,
      text,
      timestamp: serverTimestamp(),
      replyTo: replyingTo ? replyingTo.id : null,
    });
    setText("");
    setReplyingTo(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* 🧭 Header – fixed, never scrolls */}
      <HeaderActionsBar chatUser={chatUser} />

      {/* 💬 Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
              msg.senderId === auth.currentUser.uid
                ? "ml-auto bg-blue-500 text-white"
                : "mr-auto bg-gray-200 dark:bg-gray-800 dark:text-gray-100"
            }`}
          >
            {msg.replyTo && (
              <div className="text-xs opacity-70 border-l-2 border-blue-400 pl-2 mb-1">
                Replying…
              </div>
            )}
            {msg.text}
            <div className="text-[10px] text-gray-500 mt-1 text-right">
              {msg.timestamp?.toDate
                ? msg.timestamp.toDate().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </div>
          </div>
        ))}

        {typing && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ✏️ Reply preview above input */}
      {replyingTo && <ReplyPreview replyingTo={replyingTo} onCancel={() => setReplyingTo(null)} />}

      {/* 📝 Input bar */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 p-3 border-t bg-white dark:bg-gray-950"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          placeholder="Message..."
          className="flex-1 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 px-4 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white rounded-full px-4 py-2 hover:bg-blue-600 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}