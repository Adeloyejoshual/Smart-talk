// src/components/Chat/MessageBubble.jsx

import React from "react";

export default function MessageBubble({ message, isOwn, isSelected, onSelect, onReact }) {
  return (
    <div
      onClick={onSelect}
      className={`my-1 flex ${isOwn ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`p-2 rounded-lg max-w-xs ${isOwn ? "bg-blue-500 text-white" : "bg-white text-black"} ${
          isSelected ? "ring-2 ring-blue-300" : ""
        }`}
      >
        {message.text && <p>{message.text}</p>}
        {message.file && (
          <a href={message.file} target="_blank" rel="noopener noreferrer">
            {message.fileName || "File"}
          </a>
        )}
        {message.reactions?.length > 0 && (
          <div className="flex gap-1 mt-1">
            {message.reactions.map((r) => (
              <span key={r.emoji}>
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}