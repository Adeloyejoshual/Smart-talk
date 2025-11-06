// src/components/Chat/ReactionBar.jsx
import React from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

const quickReactions = ["❤️", "😂", "👍", "😢", "🔥"];

export default function ReactionBar({ onSelect, onOpenAll }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center bg-white dark:bg-gray-800 shadow-md rounded-full px-2 py-1"
    >
      {quickReactions.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="text-xl mx-1 hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
      <button
        onClick={onOpenAll}
        className="ml-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-full hover:scale-110 transition-transform"
      >
        <Plus size={16} className="text-gray-700 dark:text-gray-300" />
      </button>
    </motion.div>
  );
}