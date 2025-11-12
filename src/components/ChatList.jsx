// src/pages/ChatDashboard.jsx
import React, { useState } from "react";
import ChatList from "../components/ChatList";
import ChatConversationPage from "../components/ChatConversationPage";

export default function ChatDashboard() {
  const [activeChatId, setActiveChatId] = useState(null);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Chat list sidebar */}
      <ChatList onSelectChat={setActiveChatId} activeChatId={activeChatId} />

      {/* Chat conversation */}
      <div className="flex-1">
        {activeChatId ? (
          <ChatConversationPage chatId={activeChatId} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a chat to start messaging 💬
          </div>
        )}
      </div>
    </div>
  );
}