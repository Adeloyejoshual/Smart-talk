// src/components/Chat/ReactionBar.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import AllEmojiPicker from "./AllEmojiPicker";

export default function ReactionBar({ onSelect, isMine }) {
  const [showAll, setShowAll] = useState(false);

  const quickReactions = ["❤️", "😂", "😮", "😢", "👍"];

  const handleEmojiSelect = (emoji) => {
    onSelect(emoji);
    setShowAll(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className={`absolute ${
        isMine ? "right-0" : "left-0"
      } -top-10 z-50 flex items-center gap-1 bg-white dark:bg-gray-800 shadow-md rounded-full px-2 py-1`}
    >
      {/* Quick Reactions */}
      {quickReactions.map((emoji) => (
        <motion.button
          key={emoji}
          whileTap={{ scale: 0.8 }}
          className="text-xl hover:scale-110 transition-transform"
          onClick={() => handleEmojiSelect(emoji)}
        >
          {emoji}
        </motion.button>
      ))}

      {/* More (+) Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
        onClick={() => setShowAll(!showAll)}
      >
        <Plus size={14} />
      </motion.button>

      {/* Full Emoji Picker Modal */}
      {showAll && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50">
          <AllEmojiPicker
            onSelect={(emoji) => handleEmojiSelect(emoji)}
            onClose={() => setShowAll(false)}
          />
        </div>
      )}
    </motion.div>
  );
}