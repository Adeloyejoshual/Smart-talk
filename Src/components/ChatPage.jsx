import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export default function ChatPage() {
  const { id } = useParams(); // user or group id
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [groupMode, setGroupMode] = useState(false); // switch between 1-to-1 and group chat

  const messagesRef = collection(db, "messages");

  // Load chat messages in real-time
  useEffect(() => {
    const q = query(messagesRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((msg) => msg.roomId === id); // filter by chat room
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [id]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    await addDoc(messagesRef, {
      text: newMessage,
      sender: auth.currentUser?.email || "Guest",
      roomId: id,
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
  };

  return (
    <div
      style={{
        padding: "20px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f7f7f7",
      }}
    >
      <h2 style={{ textAlign: "center" }}>
        {groupMode ? "Group Chat" : `Chat with ${id}`}
      </h2>

      {/* Chat Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "10px",
          background: "#fff",
          marginBottom: "10px",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              textAlign:
                msg.sender === auth.currentUser?.email ? "right" : "left",
              margin: "5px 0",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "15px",
                background:
                  msg.sender === auth.currentUser?.email
                    ? "#0078ff"
                    : "#e5e5e5",
                color:
                  msg.sender === auth.currentUser?.email ? "#fff" : "#000",
                maxWidth: "70%",
                wordWrap: "break-word",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input Field */}
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0078ff",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}