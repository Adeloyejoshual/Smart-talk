import React, { useEffect, useState, useRef } from "react";
import API from "../api";
import { io } from "socket.io-client";

const SOCKET_URL = "https://smart-talk-backend.onrender.com";

const GroupChat = ({ groupId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
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
    try {
      let data;

      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("groupId", groupId);

        const res = await API.post("/messages/group/image", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        data = res.data;
        setImageFile(null); // clear file
      } else if (newMessage.trim()) {
        const res = await API.post("/messages/group", {
          groupId,
          text: newMessage,
        });

        data = res.data;
        setNewMessage(""); // clear text
      } else {
        return;
      }

      socket.current.emit("group-message", data);
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
            <strong>{msg.sender?.username || "User"}</strong>
            {msg.text && <p>{msg.text}</p>}
            {msg.image && (
              <img
                src={msg.image}
                alt="chat-img"
                className="mt-2 max-w-xs rounded"
              />
            )}
          </div>
        ))}
      </div>

      {/* Image preview */}
      {imageFile && (
        <div className="mt-2">
          <p className="text-sm text-gray-600">Preview:</p>
          <img
            src={URL.createObjectURL(imageFile)}
            alt="preview"
            className="w-32 rounded border"
          />
        </div>
      )}

      {/* Send Form */}
      <form onSubmit={handleSend} className="flex gap-2 mt-4">
        <input
          type="text"
          className="flex-1 p-2 border rounded"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
          className="p-1"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 rounded hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default GroupChat;