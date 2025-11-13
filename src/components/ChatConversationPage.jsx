// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import ChatHeader from "./Chat/ChatHeader";
import ChatInput from "./Chat/ChatInput";
import MessageBubble from "./Chat/MessageBubble";
import TypingIndicator from "./Chat/TypingIndicator";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef();

  // Real-time messages
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);

      // mark messages as read
      msgs.forEach(async (msg) => {
        if (!msg.readBy?.includes(auth.currentUser.uid)) {
          await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
            readBy: [...(msg.readBy || []), auth.currentUser.uid],
          });
        }
      });

      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return unsub;
  }, [chatId]);

  // Watch typing status
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "chats", chatId), (snap) => {
      const typing = snap.data()?.typing || {};
      const otherId = Object.keys(typing).find((id) => id !== auth.currentUser.uid);
      setIsTyping(typing[otherId]);
    });
    return unsub;
  }, [chatId]);

  // Send message handler
  const handleSendMessage = async (text, fileURL) => {
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      fileURL: fileURL || null,
      senderId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
      readBy: [auth.currentUser.uid],
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <ChatHeader chatId={chatId} />

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator isTyping={isTyping} />}
        <div ref={bottomRef} />
      </div>

      <ChatInput chatId={chatId} onSendMessage={handleSendMessage} />
    </div>
  );
}