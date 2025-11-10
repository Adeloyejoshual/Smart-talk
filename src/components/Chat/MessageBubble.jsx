import React from "react";

export default function MessageBubble({ msg, isOwn }) {
  const bubbleClass = isOwn
    ? "bg-blue-500 text-white self-end"
    : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100";

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-2`}>
      {msg.type === "text" && (
        <div className={`px-3 py-2 rounded-2xl max-w-xs ${bubbleClass}`}>
          {msg.text}
        </div>
      )}
      {msg.type === "image" && (
        <img
          src={msg.fileUrl}
          alt={msg.fileName}
          className="w-48 h-auto rounded-2xl"
        />
      )}
      {msg.type === "video" && (
        <video controls className="w-48 rounded-2xl">
          <source src={msg.fileUrl} type={msg.fileType} />
        </video>
      )}
      {msg.type === "file" && (
        <a
          href={msg.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-400 text-sm"
        >
          {msg.fileName}
        </a>
      )}
      {msg.timestamp && (
        <p className="text-xs text-gray-400 mt-1">
          {new Date(msg.timestamp?.seconds * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}