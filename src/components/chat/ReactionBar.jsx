import React from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

export default function ReactionBar({ onReact, onOpenPicker }) {
  const reactions = ["❤️", "😂", "👍", "😮", "😢", "💔"];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center gap-2 px-3 py-2 border dark:border-gray-700"
    >
      {reactions.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="text-lg hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
      <button
        onClick={onOpenPicker}
        className="ml-1 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Plus size={16} />
      </button>
    </motion.div>
  );
}