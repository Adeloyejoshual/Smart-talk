import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import API from "../api/api";

const socket = io("http://localhost:3000", {
  auth: { token: localStorage.getItem("token") },
});

const ChatWindow = ({ user, chatTarget }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const fileRef = useRef();

  useEffect(() => {
    const fetchMessages = async () => {
      const endpoint =
        chatTarget.type === "group"
          ? `/messages/group/${chatTarget.id}`
          : `/messages/${chatTarget.id}`;
      const res = await API.get(endpoint);
      setMessages(res.data);
    };

    fetchMessages();

    socket.off("receive_message");
    socket.off("receive_group_message");

    socket.on("receive_message", (msg) => {
      if (msg.sender !== user.id && chatTarget.type === "user") {
        setMessages((prev) => [...prev, msg]);
      }
    });

    socket.on("receive_group_message", (msg) => {
      if (msg.group === chatTarget.id && chatTarget.type === "group") {
        setMessages((prev) => [...prev, msg]);
      }
    });
  }, [chatTarget]);

  const send = () => {
    if (!input.trim()) return;
    const payload = {
      content: input,
      ...(chatTarget.type === "user"
        ? { to: chatTarget.id }
        : { groupId: chatTarget.id }),
    };
    socket.emit(
      chatTarget.type === "user" ? "send_message" : "send_group_message",
      payload
    );
    setMessages((prev) => [
      ...prev,
      { sender: user.id, content: input, group: chatTarget.id },
    ]);
    setInput("");
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);

    const res = await axios.post("http://localhost:3000/api/upload", form, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const url = res.data.url;
    const payload = {
      content: url,
      ...(chatTarget.type === "user"
        ? { to: chatTarget.id }
        : { groupId: chatTarget.id }),
    };

    socket.emit(
      chatTarget.type === "user" ? "send_message" : "send_group_message",
      payload
    );
    setMessages((prev) => [
      ...prev,
      { sender: user.id, content: url, group: chatTarget.id },
    ]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {messages.map((msg, i) => {
          const isMe = msg.sender === user.id;
          const isImage = msg.content.startsWith("http");
          return (
            <div
              key={i}
              className={`max-w-xs px-4 py-2 rounded-lg ${
                isMe
                  ? "ml-auto bg-green-200 text-right"
                  : "mr-auto bg-white border"
              }`}
            >
              {isImage ? (
                <img src={msg.content} alt="sent" className="rounded" />
              ) : (
                msg.content
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 p-3 border-t bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          onClick={send}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Send
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current.click()}
          className="text-blue-600 hover:underline"
        >
          📷
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;