// src/components/ChatConversationPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import EmojiPicker from "emoji-picker-react";
import { FiSend, FiPlus, FiSmile } from "react-icons/fi";
import { motion } from "framer-motion";

// ✅ Split components
import MessageBubble from "./MessageBubble";
import MessageActionsMenu from "./MessageActionsMenu";
import ReactionBar from "./ReactionBar";
import FullScreenPreview from "./FullScreenPreview";
import ReplyPreview from "./ReplyPreview";
import HeaderActionsBar from "./HeaderActionsBar";
import TypingIndicator from "./TypingIndicator";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [fullPreview, setFullPreview] = useState(null);
  const messagesEndRef = useRef(null);

  // 🔥 Fetch messages in real time
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatId]);

  // 🔥 Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✉️ Send text message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const msg = {
      text: newMessage.trim(),
      senderId: auth.currentUser.uid,
      type: "text",
      timestamp: serverTimestamp(),
      ...(replyTo && { replyTo }),
    };
    await addDoc(collection(db, "chats", chatId, "messages"), msg);
    setNewMessage("");
    setReplyTo(null);
    setShowEmojiPicker(false);
  };

  // 😎 Typing indicator simulation
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1500);
  };

  // 😀 Emoji add
  const onEmojiClick = (emojiObject) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* HEADER */}
      <HeaderActionsBar
        name="Kude"
        status="Online"
        onBack={() => navigate("/chat")}
        onVoiceCall={() => navigate("/voicecall")}
        onVideoCall={() => navigate("/videocall")}
      />

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble
              message={msg}
              onReply={() => setReplyTo(msg)}
              onPreview={(media) => setFullPreview(media)}
            />
            <ReactionBar messageId={msg.id} />
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* REPLY PREVIEW */}
      {replyTo && (
        <ReplyPreview
          replyTo={replyTo}
          onCancel={() => setReplyTo(null)}
        />
      )}

      {/* INPUT BAR */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-white dark:bg-gray-800">
        <button
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <FiSmile size={22} />
        </button>

        <input
          value={newMessage}
          onChange={handleTyping}
          placeholder="Message..."
          className="flex-1 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none"
        />

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={sendMessage}
          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
        >
          <FiSend size={20} />
        </motion.button>
      </div>

      {/* EMOJI PICKER */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-2 z-50">
          <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
        </div>
      )}

      {/* FULL SCREEN PREVIEW */}
      {fullPreview && (
        <FullScreenPreview media={fullPreview} onClose={() => setFullPreview(null)} />
      )}
    </div>
  );
}