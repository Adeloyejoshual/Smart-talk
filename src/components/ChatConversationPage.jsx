// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatConversationPage() {
  const { id } = useParams(); // Chat ID from URL
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);

  const [chatInfo, setChatInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const messagesEndRef = useRef(null);

  // ✅ Scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // ✅ Load chat info
  useEffect(() => {
    const loadChat = async () => {
      const docRef = doc(db, "chats", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setChatInfo(docSnap.data());
      } else {
        alert("Chat not found!");
        navigate("/home");
      }
    };
    loadChat();
  }, [id, navigate]);

  // ✅ Real-time message listener
  useEffect(() => {
    const msgRef = collection(db, "chats", id, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [id]);

  // ✅ Send message
  const handleSend = async () => {
    if (!input.trim() && !file) return;

    const messageData = {
      sender: auth.currentUser.uid,
      text: input.trim() || "",
      createdAt: serverTimestamp(),
      type: file ? (file.type.startsWith("image") ? "image" : "file") : "text",
    };

    if (file) {
      messageData.fileName = file.name;
      messageData.fileURL = URL.createObjectURL(file); // Temporary preview
    }

    await addDoc(collection(db, "chats", id, "messages"), messageData);
    setInput("");
    setFile(null);
    setPreview(null);
  };

  // ✅ File upload & preview
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  // ✅ Cancel preview
  const cancelPreview = () => {
    setFile(null);
    setPreview(null);
  };

  // ✅ Handle call navigation
  const handleVoiceCall = () => navigate(`/call?chatId=${id}&type=voice`);
  const handleVideoCall = () => navigate(`/call?chatId=${id}&type=video`);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: wallpaper
          ? `url(${wallpaper}) center/cover no-repeat`
          : theme === "dark"
          ? "#121212"
          : "#f5f5f5",
        color: theme === "dark" ? "#fff" : "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 🧭 Header */}
      <div
        style={{
          background: theme === "dark" ? "#1e1e1e" : "#fff",
          padding: "15px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #ccc",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{chatInfo?.name || "Chat"}</h3>
          <small>{chatInfo?.email || ""}</small>
        </div>
        <div>
          <button
            onClick={handleVoiceCall}
            style={{
              marginRight: "10px",
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            📞
          </button>
          <button
            onClick={handleVideoCall}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            🎥
          </button>
        </div>
      </div>

      {/* 💬 Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "15px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf:
                msg.sender === auth.currentUser.uid ? "flex-end" : "flex-start",
              background:
                msg.sender === auth.currentUser.uid
                  ? theme === "dark"
                    ? "#4a90e2"
                    : "#007bff"
                  : theme === "dark"
                  ? "#333"
                  : "#ddd",
              color: msg.sender === auth.currentUser.uid ? "#fff" : "#000",
              padding: "10px",
              borderRadius: "10px",
              maxWidth: "70%",
              wordBreak: "break-word",
            }}
          >
            {msg.type === "image" ? (
              <img
                src={msg.fileURL}
                alt="sent"
                style={{ width: "100%", borderRadius: "8px" }}
              />
            ) : msg.type === "file" ? (
              <a
                href={msg.fileURL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#fff",
                  textDecoration: "underline",
                }}
              >
                📎 {msg.fileName}
              </a>
            ) : (
              msg.text
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 📎 Preview */}
      {preview && (
        <div
          style={{
            background: theme === "dark" ? "#333" : "#fff",
            padding: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {file.type.startsWith("image") && (
              <img
                src={preview}
                alt="preview"
                style={{
                  height: "60px",
                  borderRadius: "8px",
                  marginRight: "10px",
                }}
              />
            )}
            <span>{file.name}</span>
          </div>
          <button
            onClick={cancelPreview}
            style={{
              background: "red",
              color: "#fff",
              border: "none",
              padding: "5px 10px",
              borderRadius: "6px",
            }}
          >
            ✖
          </button>
        </div>
      )}

      {/* ✏️ Message input */}
      <div
        style={{
          display: "flex",
          padding: "10px",
          borderTop: "1px solid #ccc",
          background: theme === "dark" ? "#1e1e1e" : "#fff",
        }}
      >
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            outline: "none",
            background: theme === "dark" ? "#2c2c2c" : "#fff",
            color: theme === "dark" ? "#fff" : "#000",
          }}
        />
        <input
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          style={{ display: "none" }}
          id="fileInput"
        />
        <label
          htmlFor="fileInput"
          style={{
            padding: "10px",
            cursor: "pointer",
            fontSize: "18px",
            marginLeft: "5px",
          }}
        >
          📎
        </label>
        <button
          onClick={handleSend}
          style={{
            marginLeft: "5px",
            padding: "10px 15px",
            background: "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}