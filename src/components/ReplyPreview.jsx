// src/components/ReplyPreview.jsx
import React from "react";
import { X } from "lucide-react";

export default function ReplyPreview({ replyTo, onCancel }) {
  if (!replyTo) return null;

  return (
    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 border-l-4 border-blue-500 px-3 py-2 rounded-t-md animate-slide-up">
      <div className="flex-1 overflow-hidden">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Replying to {replyTo.senderName || "someone"}
        </p>

        {replyTo.type === "image" && (
          <div className="flex items-center gap-2">
            <img
              src={replyTo.content}
              alt="Reply thumbnail"
              className="w-10 h-10 object-cover rounded"
            />
            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
              Photo
            </p>
          </div>
        )}

        {replyTo.type === "text" && (
          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
            {replyTo.content}
          </p>
        )}

        {replyTo.type === "video" && (
          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
            🎬 Video
          </p>
        )}

        {replyTo.type === "audio" && (
          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
            🔊 Voice message
          </p>
        )}
      </div>

      <button
        onClick={onCancel}
        className="ml-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <X size={20} />
      </button>
    </div>
  );
}