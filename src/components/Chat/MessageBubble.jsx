// src/components/Chat/MessageBubble.jsx
import React, { useState } from "react";
import ReactionBar from "./ReactionBar";
import { motion, AnimatePresence } from "framer-motion";

export default function MessageBubble({ message, isMine, isDarkMode }) {
  const [showReactions, setShowReactions] = useState(false);

  const toggleReactions = () => setShowReactions(!showReactions);

  return (
    <div
      className={`w-full flex ${
        isMine ? "justify-end" : "justify-start"
      } relative group`}
    >
      <div className="flex flex-col max-w-[80%]">
        {/* 💬 Message bubble */}
        <motion.div
          className={`relative px-4 py-2 rounded-2xl shadow-sm ${
            isMine
              ? isDarkMode
                ? "bg-blue-600 text-white"
                : "bg-blue-500 text-white"
              : isDarkMode
              ? "bg-gray-700 text-gray-100"
              : "bg-white text-gray-900 border border-gray-200"
          }`}
          onClick={toggleReactions}
          whileTap={{ scale: 0.97 }}
        >
          {message.text && <p className="text-sm">{message.text}</p>}

          {/* ⏱ Timestamp */}
          {message.timestamp?.toDate && (
            <span
              className={`text-[10px] opacity-70 mt-1 block ${
                isMine ? "text-right" : "text-left"
              }`}
            >
              {message.timestamp.toDate().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </motion.div>

        {/* 💖 Reactions below message */}
        {message.reaction && (
          <div
            className={`flex mt-1 items-center gap-1 ${
              isMine ? "justify-end" : "justify-start"
            }`}
          >
            <span className="text-sm bg-gray-200 dark:bg-gray-600 px-2 py-[2px] rounded-full">
              {message.reaction}
            </span>
          </div>
        )}
      </div>

      {/* ✨ Reaction popup */}
      <AnimatePresence>
        {showReactions && (
          <ReactionBar
            onSelect={(emoji) => {
              message.reaction = emoji;
              setShowReactions(false);
            }}
            isMine={isMine}
          />
        )}
      </AnimatePresence>
    </div>
  );
}