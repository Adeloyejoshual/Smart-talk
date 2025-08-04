import React, { useState } from "react";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";

const ChatApp = ({ user }) => {
  const [chatTarget, setChatTarget] = useState(null); // { type: "user" | "group", id }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-full md:w-1/3 lg:w-1/4 border-r bg-white overflow-y-auto">
        <ChatList user={user} setChatTarget={setChatTarget} />
      </div>
      <div className="flex-1 flex flex-col">
        {chatTarget ? (
          <ChatWindow user={user} chatTarget={chatTarget} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;