// src/components/Chat/AllEmojiPicker.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const allEmojis = [
  "❤️", "😂", "👍", "😢", "🔥", "😎", "😍", "😡", "👏", "🙌",
  "🤔", "😴", "🥰", "🎉", "🤯", "😱", "💯", "🤩", "😭", "🙏",
];

export default function AllEmojiPicker({ show, onSelect, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 150, damping: 22 }}
          className="fixed bottom-0 left-0 w-full h-[45vh] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-4 z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-lg">
              Pick Reaction
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Emoji Grid */}
          <div className="grid grid-cols-7 gap-3 overflow-y-auto scrollbar-hide">
            {allEmojis.map((emoji, index) => (
              <motion.button
                key={index}
                onClick={() => {
                  onSelect(emoji);
                  onClose();
                }}
                whileTap={{ scale: 0.85 }}
                className="text-2xl p-1 hover:scale-125 transition-transform"
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}