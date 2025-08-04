import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import API from "../api/api";

const socket = io("http://localhost:3000", {
  auth: {
    token: localStorage.getItem("token"),
  },
});

const ChatBox = ({ user }) => {
  const [recipientId, setRecipientId] = useState("");
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!recipientId) return;

    socket.emit("join", user.id);

    socket.on("receive_message", (msg) => {
      if (msg.sender === recipientId) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socket.on("user_typing", (from) => {
      if (from === recipientId) {
        setTyping(true);
        setTimeout(() => setTyping(false), 1000);
      }
    });

    API.get(`/messages/${recipientId}`).then((res) => setMessages(res.data));

    return () => {
      socket.off("receive_message");
      socket.off("user_typing");
    };
  }, [recipientId, user.id]);

  const sendMessage = () => {
    socket.emit("send_message", {
      to: recipientId,
      content,
    });
    setContent("");
  };

  const handleTyping = () => {
    socket.emit("typing", { to: recipientId });
  };

  return (
    <div>
      <h3>Chatting as: {user.username}</h3>
      <input
        placeholder="Recipient user ID"
        onChange={(e) => setRecipientId(e.target.value)}
      />
      <div style={{ height: "200px", overflowY: "scroll", border: "1px solid gray", margin: "10px 0" }}>
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.sender === user.id ? "You" : "Them"}:</b> {m.content}
          </div>
        ))}
      </div>
      {typing && <div><i>Typing...</i></div>}
      <input
        value={content}
        placeholder="Type a message..."
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleTyping}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

export default ChatBox;