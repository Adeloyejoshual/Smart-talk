import React, { useState } from "react";
import { motion } from "framer-motion";
import ReactionBar from "./ReactionBar";
import MessageActionsMenu from "./MessageActionsMenu";

export default function MessageBubble({ message, isOwn }) {
  const [showActions, setShowActions] = useState(false);

  // Handle long press (for mobile + desktop)
  const handleLongPress = (e) => {
    e.preventDefault();
    setShowActions(true);
  };

  const handleClick = () => {
    // Single tap/click closes action menu
    if (showActions) setShowActions(false);
  };

  const isImage = message.type === "image";
  const isVideo = message.type === "video";
  const isFile = message.type === "file";
  const isAudio = message.type === "audio";

  return (
    <div
      onContextMenu={handleLongPress}
      onClick={handleClick}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} relative`}
    >
      <motion.div
        className={`max-w-[80%] p-3 rounded-2xl shadow-md ${
          isOwn
            ? "bg-blue-500 text-white rounded-br-none"
            : "bg-gray-200 dark:bg-gray-800 dark:text-gray-100 rounded-bl-none"
        }`}
        whileTap={{ scale: 0.98 }}
      >
        {/* 🖼️ Image */}
        {isImage && (
          <img
            src={message.mediaUrl}
            alt="sent"
            className="rounded-xl max-h-60 object-cover cursor-pointer"
          />
        )}

        {/* 🎥 Video */}
        {isVideo && (
          <video
            src={message.mediaUrl}
            controls
            className="rounded-xl max-h-60 w-full"
          />
        )}

        {/* 🎧 Audio */}
        {isAudio && (
          <audio controls src={message.mediaUrl} className="w-full" />
        )}

        {/* 📁 File */}
        {isFile && (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-sm"
          >
            📄 {message.fileName || "View file"}
          </a>
        )}

        {/* ✍️ Text */}
        {message.text && (
          <p className="whitespace-pre-line break-words text-[15px] mt-1">
            {message.text}
          </p>
        )}

        {/* ⏰ Timestamp */}
        <p
          className={`text-xs mt-1 ${
            isOwn ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {message.timestamp
            ? new Date(message.timestamp?.seconds * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Sending..."}
        </p>
      </motion.div>

      {/* ❤️ Reaction Bar */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <ReactionBar reactions={message.reactions} />
      )}

      {/* 📋 Actions Menu (Copy, Edit, etc.) */}
      {showActions && (
        <MessageActionsMenu
          message={message}
          onClose={() => setShowActions(false)}
        />
      )}
    </div>
  );
}