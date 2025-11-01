// src/components/ReactionBar.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ReactionBar({ reactions = {}, onReactClick }) {
  const hasReactions = Object.keys(reactions).length > 0;
  if (!hasReactions) return null;

  // Count occurrences of each emoji
  const emojiCounts = Object.entries(
    reactions.reduce((acc, emoji) => {
      acc[emoji] = (acc[emoji] || 0) + 1;
      return acc;
    }, {})
  );

  return (
    <AnimatePresence>
      {hasReactions && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="flex gap-1 mt-1 ml-10 flex-wrap"
        >
          {emojiCounts.map(([emoji, count]) => (
            <motion.button
              key={emoji}
              whileTap={{ scale: 0.9 }}
              onClick={() => onReactClick(emoji)}
              className="px-2 py-1 bg-sky-100 dark:bg-sky-800/40 text-sky-800 dark:text-sky-200 text-sm rounded-full flex items-center gap-1 shadow-sm hover:scale-105 transition-transform"
            >
              <span>{emoji}</span>
              <span className="text-xs font-medium">{count > 1 && count}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}