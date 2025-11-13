// src/components/Chat/MessageBubble.jsx
import React from "react";
import { auth } from "../../firebaseConfig";

export default function MessageBubble({ message }) {
  const isSender = message.senderId === auth.currentUser?.uid;

  const timeString = message.timestamp?.toDate
    ? new Date(message.timestamp.toDate()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={`flex mb-3 ${isSender ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[80%] sm:max-w-[70%] p-3 rounded-2xl shadow 
          text-sm
          ${isSender
            ? "bg-[#005C4B] text-white rounded-br-none" // WhatsApp sender bubble
            : "bg-[#ECECEC] dark:bg-[#202C33] text-gray-900 dark:text-gray-100 rounded-bl-none" // WhatsApp receiver bubble
          }
        `}
      >
        {/* Image message */}
        {message.fileURL && (
          <img
            src={message.fileURL}
            alt="attachment"
            className="mb-2 rounded-lg max-w-full max-h-64 object-cover"
          />
        )}

        {/* Text message */}
        {message.text && (
          <p className="whitespace-pre-line leading-relaxed">{message.text}</p>
        )}

        {/* Timestamp */}
        <p className="text-[10px] mt-1 opacity-70 text-right">{timeString}</p>
      </div>
    </div>
  );
}