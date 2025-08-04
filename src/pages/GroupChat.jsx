import React, { useEffect, useState } from "react";
import API from "../api";

const GroupChat = ({ groupId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Load messages
  const fetchChats = async () => {
    try {
      const res = await API.get(`/messages/group/${groupId}`);
      setMessages(res.data);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [groupId]);

  // Send new message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await API.post("/messages/group", {
        groupId,
        text: newMessage,
      });

      setNewMessage("");
      fetchChats(); // Refresh after send
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 flex flex-col h-screen">
      <h2 className="text-xl font-bold mb-2">Group Chat</h2>

      <div className="flex-1 overflow-y-auto space-y-2 bg-gray-100 p-4 rounded">
        {messages.map((msg) => (
          <div key={msg._id} className="bg-white p-2 rounded shadow">
            <strong>{msg.sender?.username || "User"}</strong>: {msg.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="flex mt-4">
        <input
          type="text"
          className="flex-1 p-2 border rounded-l"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 rounded-r hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default GroupChat;