// src/components/Chat/MessageBubble.jsx
import React, { useState } from "react";
import ReactionBar from "./ReactionBar";
import AllEmojiPicker from "./AllEmojiPicker";
import { motion, AnimatePresence } from "framer-motion";

export default function MessageBubble({ message, isOwn, onReact }) {
  const [showReactions, setShowReactions] = useState(false);
  const [showAllEmojis, setShowAllEmojis] = useState(false);

  const handleReaction = (emoji) => {
    onReact(message.id, emoji);
    setShowReactions(false);
  };

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} relative`}>
      <motion.div
        onClick={() => setShowReactions((prev) => !prev)}
        className={`relative p-3 rounded-2xl max-w-[75%] ${
          isOwn
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
        }`}
      >
        <p className="text-sm leading-snug">{message.text}</p>

        {/* Show user's reaction */}
        {message.reaction && (
          <span className="absolute -bottom-4 right-2 text-lg">
            {message.reaction}
          </span>
        )}
      </motion.div>

      {/* Reaction Bar (Quick 5) */}
      <AnimatePresence>
        {showReactions && (
          <div className="absolute -top-10 z-40">
            <ReactionBar
              onSelect={handleReaction}
              onOpenAll={() => {
                setShowAllEmojis(true);
                setShowReactions(false);
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Full Emoji Picker */}
      <AllEmojiPicker
        show={showAllEmojis}
        onSelect={handleReaction}
        onClose={() => setShowAllEmojis(false)}
      />
    </div>
  );
}