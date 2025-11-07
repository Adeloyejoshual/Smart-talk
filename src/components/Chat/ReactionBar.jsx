// src/components/Chat/ReactionBar.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const defaultReactions = ["❤️", "😂", "👍", "🔥", "😮"];

export default function ReactionBar({ onSelect }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex items-center gap-1 bg-white dark:bg-gray-800 shadow-lg px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700"
      >
        {defaultReactions.slice(0, expanded ? defaultReactions.length : 5).map(
          (emoji, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.8 }}
              className="text-lg hover:scale-125 transition-transform"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </motion.button>
          )
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 text-sm ml-1"
        >
          {expanded ? "−" : "＋"}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}