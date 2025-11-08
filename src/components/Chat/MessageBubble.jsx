import React from "react";
import { motion } from "framer-motion";
import { FileText, Download } from "lucide-react";

export default function MessageBubble({ msg, isOwn }) {
  const isImage = msg.type === "image";
  const isVideo = msg.type === "video";
  const isFile = msg.type === "file";

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
        {msg.type === "text" && (
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        )}

        {/* IMAGE MESSAGE */}
        {isImage && (
          <img
            src={msg.fileUrl}
            alt={msg.fileName}
            className="rounded-lg mt-1 cursor-pointer max-h-64 object-cover"
          />
        )}

        {/* VIDEO MESSAGE */}
        {isVideo && (
          <video
            controls
            className="rounded-lg mt-1 cursor-pointer max-h-64"
          >
            <source src={msg.fileUrl} type={msg.fileType} />
          </video>
        )}

        {/* FILE MESSAGE */}
        {isFile && (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mt-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            <FileText className="w-5 h-5" />
            <div className="flex-1 text-xs break-all">{msg.fileName}</div>
            <Download className="w-4 h-4 opacity-75" />
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
              msg.timestamp?.toDate?.() || Date.now()
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