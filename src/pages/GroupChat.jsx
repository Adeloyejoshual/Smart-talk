import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { io } from "socket.io-client";

const SOCKET_URL = "https://smart-talk-backend.onrender.com";

const GroupChat = ({ groupId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const socket = useRef(null);

  const fetchChats = async () => {
    try {
      const res = await API.get(`/messages/group/${groupId}`);
      setMessages(res.data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    socket.current = io(SOCKET_URL);
    socket.current.emit("join-group", groupId);

    socket.current.on("group-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    fetchChats();

    return () => {
      socket.current.disconnect();
    };
  }, [groupId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const { data } = await API.post("/messages/group", {
        groupId,
        text: newMessage,
      });

      socket.current.emit("group-message", data);
      setNewMessage("");
    } catch (err) {
      console.error("Send error:", err);
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