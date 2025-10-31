import React from "react";
import { motion } from "framer-motion";

const reactions = ["❤️", "😂", "👍", "😮", "😢", "💔"];

export default function ReactionPicker({ onSelect, onMore }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-gray-800 shadow-md rounded-full px-3 py-2 z-50 border border-gray-200 dark:border-gray-700"
    >
      {reactions.map((emoji, index) => (
        <button
          key={index}
          onClick={() => onSelect(emoji)}
          className="text-xl hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}

      {/* ➕ icon opens full emoji picker */}
      <button
        onClick={onMore}
        className="text-xl px-1 hover:scale-125 transition-transform"
      >
        ➕
      </button>
    </motion.div>
  );
}