// src/components/Chat/MessageBubble.jsx
import React, { useState } from "react";
import { db } from "../../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import ReactionBar from "./ReactionBar";

export default function MessageBubble({ msg, isOwn, chatId }) {
  const [showReactions, setShowReactions] = useState(false);

  const time =
    msg.timestamp?.toDate?.().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) || "";

  const handleReaction = async (emoji) => {
    try {
      const msgRef = doc(db, "chats", chatId, "messages", msg.id);
      await updateDoc(msgRef, { reaction: emoji });
      setShowReactions(false);
    } catch (err) {
      console.error("❌ Error reacting:", err);
    }
  };

  return (
    <div
      className={`flex flex-col ${
        isOwn ? "items-end" : "items-start"
      } mb-3 relative`}
    >
      {/* Message bubble */}
      <div
        className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm relative cursor-pointer ${
          isOwn
            ? "bg-blue-500 text-white rounded-tr-none"
            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-none"
        }`}
        onClick={() => setShowReactions(!showReactions)}
      >
        {msg.type === "file" ? (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-words"
          >
            📎 {msg.fileName || "Attachment"}
          </a>
        ) : (
          <span className="whitespace-pre-wrap break-words">{msg.text}</span>
        )}

        <span
          className={`text-[10px] mt-1 block ${
            isOwn ? "text-blue-100" : "text-gray-500"
          }`}
        >
          {time}
        </span>
      </div>

      {/* Reaction bubble */}
      {msg.reaction && (
        <div
          className={`mt-1 text-lg ${
            isOwn ? "mr-2" : "ml-2"
          } select-none`}
        >
          {msg.reaction}
        </div>
      )}

      {/* Emoji Picker */}
      {showReactions && (
        <div
          className={`absolute z-10 ${
            isOwn ? "right-0" : "left-0"
          } -top-10`}
        >
          <ReactionBar onSelect={handleReaction} />
        </div>
      )}
    </div>
  );
}