// src/components/Chat/TypingIndicator.jsx
import React from "react";

export default function TypingIndicator({ isTyping }) {
  if (!isTyping) return null;

  return (
    <div className="flex items-center space-x-1 mt-1">
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150" />
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-300" />
      <p className="text-xs text-blue-500 ml-2">typing…</p>
    </div>
  );
}