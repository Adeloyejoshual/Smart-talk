// src/pages/GroupChat.jsx
import React, { useEffect, useState } from "react";
import API from "../api"; // adjust path if needed

const GroupChat = ({ groupId }) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await API.get(`/messages/group/${groupId}`);
        setMessages(res.data);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchChats();
  }, [groupId]);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Group Messages</h2>
      <div className="space-y-2">
        {messages.map((msg) => (
          <div key={msg._id} className="p-2 bg-gray-100 rounded">
            <strong>{msg.sender.username}</strong>: {msg.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroupChat;