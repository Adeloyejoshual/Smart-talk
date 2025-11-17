// src/components/Chat/MessageBubble.jsx
import React from "react";
import { format } from "date-fns";

const MessageBubble = ({
  message,
  isSender,
  onLongPressStart,
  onLongPressEnd,
}) => {
  const handleTouchStart = () => {
    onLongPressStart(message);
  };

  const handleTouchEnd = () => {
    onLongPressEnd();
  };

  return (
    <div
      className={`flex w-full mb-2 ${isSender ? "justify-end" : "justify-start"}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPressStart(message);
      }}
    >
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl shadow 
          ${isSender ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-200 text-black rounded-bl-none"}`}
      >
        {message.replyTo && (
          <div className="bg-black bg-opacity-10 p-2 rounded-md mb-1 text-xs">
            Replying to: {message.replyTo.text?.slice(0, 40)}...
          </div>
        )}

        <p>{message.text}</p>

        <div className="flex justify-end mt-1">
          <span className="text-[10px] opacity-60">
            {message.createdAt ? format(message.createdAt.toDate(), "p") : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
