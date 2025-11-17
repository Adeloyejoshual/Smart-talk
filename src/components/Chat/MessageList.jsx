// src/components/Chat/MessageList.jsx
import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

const MessageList = ({
  messages,
  userId,
  onLongPressStart,
  onLongPressEnd,
}) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isSender={msg.senderId === userId}
          onLongPressStart={onLongPressStart}
          onLongPressEnd={onLongPressEnd}
        />
      ))}

      <div ref={bottomRef}></div>
    </div>
  );
};

export default MessageList;
