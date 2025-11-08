// src/components/Chat/MessageBubble.jsx
import React from "react";
import { motion } from "framer-motion";
import { FileText, Download } from "lucide-react";

export default function MessageBubble({ msg, isOwn, onMediaClick }) {
  const isImage = msg.fileType?.startsWith("image/");
  const isVideo = msg.fileType?.startsWith("video/");
  const isFile = msg.type === "file" && !isImage && !isVideo;

  const handleClick = () => {
    if (onMediaClick && (isImage || isVideo)) {
      onMediaClick([{ url: msg.fileUrl, type: msg.fileType }]);
    }
  };

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} w-full`}>
      <motion.div
        className={`relative max-w-[75%] md:max-w-[65%] p-3 rounded-2xl shadow-sm text-sm ${
          isOwn
            ? "bg-blue-500 text-white rounded-br-none"
            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* TEXT MESSAGE */}
        {msg.type === "text" && msg.text && (
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        )}

        {/* IMAGE MESSAGE */}
        {isImage && msg.fileUrl && (
          <img
            src={msg.fileUrl}
            alt={msg.fileName || "Image"}
            onClick={handleClick}
            loading="lazy"
            className="rounded-lg mt-2 cursor-pointer max-h-64 object-cover border border-gray-300 dark:border-gray-600"
          />
        )}

        {/* VIDEO MESSAGE */}
        {isVideo && msg.fileUrl && (
          <video
            controls
            className="rounded-lg mt-2 max-h-64 border border-gray-300 dark:border-gray-600"
          >
            <source src={msg.fileUrl} type={msg.fileType} />
            Your browser does not support video playback.
          </video>
        )}

        {/* OTHER FILE MESSAGE */}
        {isFile && msg.fileUrl && (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mt-2 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/20 hover:bg-gray-100 dark:hover:bg-gray-600 transition"
          >
            <FileText className="w-5 h-5 shrink-0" />
            <div className="flex-1 text-xs truncate">{msg.fileName}</div>
            <Download className="w-4 h-4 opacity-75 shrink-0" />
          </a>
        )}

        {/* TIMESTAMP */}
        {msg.timestamp && (
          <div
            className={`text-[10px] mt-1 text-right ${
              isOwn ? "text-blue-100" : "text-gray-400 dark:text-gray-400"
            }`}
          >
            {new Date(
              msg.timestamp?.toDate?.() || msg.timestamp
            ).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}