// src/components/chat/MessageBubble.jsx
import React from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function MessageBubble({ message, isOwn }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col ${
        isOwn ? "items-end" : "items-start"
      } mb-3 px-2`}
    >
      <div
        className={`relative rounded-2xl px-4 py-2 max-w-[75%] ${
          isOwn
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none"
        }`}
      >
        {/* 📨 Forwarded label */}
        {message.forwarded && (
          <p
            className={`text-xs mb-1 font-medium ${
              isOwn ? "text-blue-100" : "text-gray-500"
            }`}
          >
            Forwarded
          </p>
        )}

        {/* 📝 Message text */}
        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}

        {/* 🖼️ Image or video preview */}
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Media"
            className="rounded-lg mt-2 max-h-60 object-cover"
          />
        )}

        {/* ⏰ Timestamp */}
        <span
          className={`absolute bottom-1 right-3 text-[10px] ${
            isOwn ? "text-blue-100" : "text-gray-500"
          }`}
        >
          {message.timestamp
            ? format(message.timestamp.toDate(), "h:mm a")
            : ""}
        </span>
      </div>
    </motion.div>
  );
}