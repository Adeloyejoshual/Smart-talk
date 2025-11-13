// src/components/Chat/MessageBubble.jsx
import React from "react";
import { auth } from "../../firebaseConfig";

export default function MessageBubble({ message }) {
  const isSender = message.senderId === auth.currentUser?.uid;

  return (
    <div
      className={`flex ${isSender ? "justify-end" : "justify-start"} mb-2`}
    >
      <div
        className={`max-w-xs sm:max-w-md p-3 rounded-2xl shadow ${
          isSender
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none"
        }`}
      >
        {message.fileURL && (
          <img
            src={message.fileURL}
            alt="attachment"
            className="mb-2 rounded-lg max-w-full"
          />
        )}
        {message.text && <p>{message.text}</p>}

        <p className="text-[10px] mt-1 opacity-70 text-right">
          {message.timestamp?.toDate
            ? new Date(message.timestamp.toDate()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </p>
      </div>
    </div>
  );
}