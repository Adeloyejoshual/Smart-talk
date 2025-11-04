import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const defaultReactions = ["❤️", "😂", "👍", "😮", "😢"];
const allReactions = [
  "❤️", "😂", "👍", "😮", "😢", "🔥", "😍", "😭", "👏", "🤣", "😡", "😎", "🤔", "🙌", "💔",
];

export default function ReactionBar({ visible, onSelect, onClose }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ type: "spring", stiffness: 250, damping: 20 }}
          className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 shadow-xl rounded-full px-3 py-2 flex gap-2 z-50 items-center border border-gray-200 dark:border-gray-700"
        >
          {/* Main reactions (first 5) */}
          {(expanded ? allReactions : defaultReactions).map((emoji) => (
            <motion.button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              whileTap={{ scale: 1.3 }}
              className="text-xl hover:scale-125 transition"
            >
              {emoji}
            </motion.button>
          ))}

          {/* + Button to expand */}
          {!expanded && (
            <motion.button
              onClick={() => setExpanded(true)}
              whileTap={{ scale: 1.2 }}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <Plus size={14} />
            </motion.button>
          )}

          {/* Close when expanded */}
          {expanded && (
            <motion.button
              onClick={() => setExpanded(false)}
              whileTap={{ scale: 1.2 }}
              className="ml-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-300"
            >
              Close
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}