// src/components/TypingIndicator.jsx
import React from "react";
import { motion } from "framer-motion";

export default function TypingIndicator({ isTyping }) {
  if (!isTyping) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl px-3 py-1 shadow-sm flex items-center gap-1.5">
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
          className="w-2 h-2 bg-gray-500 dark:bg-gray-300 rounded-full"
        ></motion.span>
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
          className="w-2 h-2 bg-gray-500 dark:bg-gray-300 rounded-full"
        ></motion.span>
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
          className="w-2 h-2 bg-gray-500 dark:bg-gray-300 rounded-full"
        ></motion.span>
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400">Typing...</span>
    </div>
  );
}