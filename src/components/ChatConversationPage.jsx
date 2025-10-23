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
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const isDark = theme === "dark";

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat + friend info
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);

    const loadChat = async () => {
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        alert("Chat not found!");
        navigate("/chat");
        return;
      }

      const chatData = chatSnap.data();
      setChatInfo(chatData);

      const friendId = chatData.participants?.find(
        (uid) => uid !== auth.currentUser.uid
      );
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        const unsub = onSnapshot(friendRef, (snap) => {
          if (snap.exists()) setFriendInfo(snap.data());
        });
        return unsub;
      }
    };
    loadChat();
  }, [chatId, navigate]);

  // Real-time messages
  useEffect(() => {
    if (!chatId) return;
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => unsub();
  }, [chatId]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    if (!auth.currentUser) return;

    setUploading(true);
    try {
      const msgRef = collection(db, "chats", chatId, "messages");
      const fileURLs = [];

      // Upload multiple files
      for (const file of files) {
        const fileRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);
        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            null,
            reject,
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              fileURLs.push({
                name: file.name,
                url,
                type: file.type.startsWith("image") ? "image" : "file",
              });
              resolve();
            }
          );
        });
      }

      await addDoc(msgRef, {
        sender: auth.currentUser.uid,
        text: input.trim(),
        attachments: fileURLs,
        status: "sending",
        createdAt: serverTimestamp(),
      });

      // Update last message in chat
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: input.trim() || (fileURLs.length ? "📎 Attachment" : ""),
        lastMessageAt: serverTimestamp(),
      });

      setInput("");
      setFiles([]);
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Error sending message.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBack = () => navigate("/chat");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: wallpaper
          ? `url(${wallpaper}) center/cover no-repeat`
          : isDark
          ? "#121212"
          : "#f5f5f5",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: isDark ? "#1e1e1e" : "#fff",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #ccc",
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={handleBack}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "22px",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            ←
          </button>
          <img
            src={friendInfo?.photoURL || "/default-avatar.png"}
            alt="profile"
            style={{
              width: "45px",
              height: "45px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #ccc",
            }}
          />
          <div style={{ marginLeft: "10px" }}>
            <h4 style={{ margin: 0 }}>{friendInfo?.displayName || "Friend"}</h4>
            <span style={{ fontSize: "12px", color: "#888" }}>
              {friendInfo?.lastSeen
                ? formatLastSeen(friendInfo.lastSeen)
                : "Online"}
            </span>
          </div>
        </div>

        {/* 3-dot + call buttons */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button style={iconBtnStyle}>📞</button>
          <button style={iconBtnStyle}>🎥</button>
          <button style={iconBtnStyle}>⋮</button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "15px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "100px",
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
                  ? "#DCF8C6"
                  : isDark
                  ? "#333"
                  : "#fff",
              color: "#000",
              padding: "10px",
              borderRadius: "10px",
              maxWidth: "70%",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            {msg.text && <div>{msg.text}</div>}

            {/* Attachments */}
            {msg.attachments?.map((file, idx) =>
              file.type === "image" ? (
                <img
                  key={idx}
                  src={file.url}
                  alt="attachment"
                  style={{
                    width: "100%",
                    borderRadius: "8px",
                    marginTop: "8px",
                  }}
                />
              ) : (
                <a
                  key={idx}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#007bff", textDecoration: "none" }}
                >
                  📎 {file.name}
                </a>
              )
            )}

            <div
              style={{
                fontSize: "10px",
                textAlign: "right",
                opacity: 0.6,
                marginTop: "4px",
              }}
            >
              {msg.createdAt?.seconds
                ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
              {msg.sender === auth.currentUser.uid && (
                <span style={{ marginLeft: "5px" }}>
                  {msg.status === "seen"
                    ? "✔✔"
                    : msg.status === "sent"
                    ? "✔"
                    : "⌛"}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          padding: "10px",
          background: isDark ? "#1e1e1e" : "#fff",
          borderTop: "1px solid #ccc",
        }}
      >
        <label htmlFor="fileInput" style={{ fontSize: "22px", cursor: "pointer" }}>
          📎
        </label>
        <input
          type="file"
          id="fileInput"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* Preview Strip */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            maxWidth: "200px",
            margin: "0 10px",
          }}
        >
          {files.map((file, index) => (
            <div
              key={index}
              style={{
                position: "relative",
                width: "50px",
                height: "50px",
                borderRadius: "8px",
                overflow: "hidden",
                marginRight: "6px",
              }}
            >
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <button
                onClick={() => removeFile(index)}
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "#fff",
                  color: "#000",
                  border: "none",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            outline: "none",
            background: isDark ? "#2c2c2c" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
        />
        <button
          onClick={handleSend}
          disabled={uploading}
          style={{
            marginLeft: "8px",
            padding: "10px 15px",
            background: uploading ? "#999" : "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "⌛" : "↑"}
        </button>
      </div>
    </div>
  );
}

// Helper: format last seen
function formatLastSeen(timestamp) {
  const date = new Date(timestamp.seconds * 1000);
  const now = new Date();
  const diff = (now - date) / 1000 / 60; // minutes

  if (diff < 1) return "Online";
  if (diff < 60) return `${Math.floor(diff)}m ago`;
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString();
}

const iconBtnStyle = {
  background: "transparent",
  border: "none",
  fontSize: "20px",
  cursor: "pointer",
};