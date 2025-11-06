// src/components/Chat/AllEmojiPicker.jsx
import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function AllEmojiPicker({ onSelect, onClose }) {
  const emojis = [
    "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😍","😘","😜","🤩","😎",
    "😢","😭","😡","😱","😮","😇","😴","🤔","🤭","😬","👍","👎","👏","🙌","🙏",
    "❤️","💔","🔥","🌹","🎉","💯","💀","🤙","💪","😺","😻","😹","😼","🙈","🙉","🙊"
  ];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="relative w-72 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-3 grid grid-cols-8 gap-2"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute -top-2 -right-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 rounded-full p-1 shadow-md hover:scale-105 transition-transform"
      >
        <X size={14} />
      </button>

      {/* Emojis */}
      {emojis.map((emoji, index) => (
        <motion.button
          key={index}
          whileTap={{ scale: 0.8 }}
          className="text-xl hover:scale-110 transition-transform"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}