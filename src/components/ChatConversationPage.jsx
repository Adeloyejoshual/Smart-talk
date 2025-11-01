import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

import MessageBubble from "./MessageBubble";
import MessageActionsMenu from "./MessageActionsMenu";
import ReactionBar from "./ReactionBar";
import FullScreenPreview from "./FullScreenPreview";
import ReplyPreview from "./ReplyPreview";
import HeaderActionsBar from "./HeaderActionsBar";
import TypingIndicator from "./TypingIndicator";
import EmojiMessageInput from "./EmojiMessageInput";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [fullPreview, setFullPreview] = useState(null);
  const [typing, setTyping] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef(null);

  // 🧩 Fetch chat messages in real-time
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(data);
    });
    return () => unsub();
  }, [chatId]);

  // 🧠 Load chat user data (for header)
  useEffect(() => {
    const loadUserData = async () => {
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      if (chatDoc.exists()) {
        const users = chatDoc.data().users || [];
        const other = users.find((u) => u.uid !== auth.currentUser.uid);
        setUserData(other || null);
      }
    };
    loadUserData();
  }, [chatId]);

  // 📩 Send new message
  const handleSendMessage = async (text) => {
    if (!text.trim()) return;
    const messageRef = collection(db, "chats", chatId, "messages");
    await addDoc(messageRef, {
      text,
      senderId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      replyTo: replyTo ? replyTo.id : null,
      reactions: [],
    });
    setReplyTo(null);
    scrollToBottom();
  };

  // 🧹 Scroll behavior
  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 👀 Show scroll down button
  const handleScroll = (e) => {
    const bottom =
      e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    setShowScrollBtn(!bottom);
  };

  // 💬 Typing simulation
  useEffect(() => {
    const typingTimeout = setTimeout(() => setTyping(false), 2000);
    return () => clearTimeout(typingTimeout);
  }, [typing]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* 🧠 Header with user info + actions */}
      <HeaderActionsBar user={userData} />

      {/* 💬 Messages list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {messages.map((msg, index) => (
          <div key={msg.id} className="relative">
            <MessageBubble
              message={msg}
              isOwn={msg.senderId === auth.currentUser.uid}
              onReply={() => setReplyTo(msg)}
              onMediaClick={(mediaUrl) => setFullPreview(mediaUrl)}
            />
            <ReactionBar message={msg} chatId={chatId} />
            <MessageActionsMenu message={msg} chatId={chatId} />
          </div>
        ))}
        {typing && <TypingIndicator />}
      </div>

      {/* 💡 Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-5 bg-blue-500 text-white rounded-full p-3 shadow-lg"
        >
          ↓
        </button>
      )}

      {/* 💬 Reply preview */}
      {replyTo && (
        <ReplyPreview
          message={replyTo}
          onCancel={() => setReplyTo(null)}
        />
      )}

      {/* ✏️ Input bar (with emoji + send) */}
      <EmojiMessageInput onSend={handleSendMessage} />

      {/* 🖼️ Full-screen preview */}
      {fullPreview && (
        <FullScreenPreview
          mediaUrl={fullPreview}
          onClose={() => setFullPreview(null)}
        />
      )}
    </div>
  );
}