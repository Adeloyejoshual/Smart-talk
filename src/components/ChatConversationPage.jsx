// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
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
import AllEmojiPicker from "./Chat/AllEmojiPicker";
import Spinner from "./Chat/Spinner";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReactions, setShowReactions] = useState(null); // messageId
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const messageEndRef = useRef();

  // 🔥 Load messages in real-time
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendReaction = async (emoji) => {
    if (!selectedMessage) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: `${auth.currentUser.displayName} reacted ${emoji}`,
      senderId: auth.currentUser.uid,
      type: "reaction",
      createdAt: serverTimestamp(),
    });
    setShowAllEmojis(false);
    setShowReactions(null);
  };

  const handleLongPress = (msg) => {
    setSelectedMessage(msg);
    setShowReactions(msg.id);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Chat Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-gray-800 p-3 shadow-md">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Chat Room
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Online • Nov 4, 11:45 AM
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading ? (
          <Spinner />
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="relative">
              <MessageBubble msg={msg} onLongPress={() => handleLongPress(msg)} />
              {showReactions === msg.id && (
                <ReactionBar
                  onAddEmoji={() => setShowAllEmojis(true)}
                  onClose={() => setShowReactions(null)}
                  onSelect={(emoji) => handleSendReaction(emoji)}
                />
              )}
            </div>
          ))
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Emoji Picker */}
      {showAllEmojis && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          <AllEmojiPicker
            onSelect={(emoji) => handleSendReaction(emoji)}
            onClose={() => setShowAllEmojis(false)}
          />
        </div>
      )}

      {/* Message Input */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-3 shadow-inner">
        <input
          type="text"
          placeholder="Message..."
          className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white p-3 rounded-xl outline-none"
        />
      </div>
    </div>
  );
}