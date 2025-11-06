// src/components/Chat/ReactionBar.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const defaultReactions = ["❤️", "😂", "👍", "😢", "🔥"];

export default function ReactionBar({ onSelect, onAddEmoji, onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        transition={{ duration: 0.15 }}
        className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white dark:bg-gray-800 shadow-lg rounded-3xl px-3 py-2 border border-gray-200 dark:border-gray-700"
        onMouseLeave={onClose}
      >
        {defaultReactions.map((emoji) => (
          <motion.button
            key={emoji}
            onClick={() => onSelect(emoji)}
            whileTap={{ scale: 0.8 }}
            className="text-xl hover:scale-125 transition-transform"
          >
            {emoji}
          </motion.button>
        ))}

        {/* Plus Button for full picker */}
        <motion.button
          onClick={onAddEmoji}
          whileTap={{ scale: 0.8 }}
          className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <Plus size={18} className="text-gray-700 dark:text-gray-200" />
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}