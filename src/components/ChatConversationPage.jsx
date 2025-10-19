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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const isDark = theme === "dark";

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // Load chat & friend info
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

  // Listen to messages
  useEffect(() => {
    if (!chatId) return;
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [chatId]);

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  // Remove single file
  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Send message + files
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const uploadedFiles = [];

      // Upload files
      for (let file of files) {
        const storageRef = ref(
          storage,
          `chatFiles/${chatId}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        const fileURL = await getDownloadURL(storageRef);
        uploadedFiles.push({
          fileURL,
          fileName: file.name,
          type: file.type.startsWith("image") ? "image" : "file",
        });
      }

      const msgRef = collection(db, "chats", chatId, "messages");

      // Send text
      if (input.trim()) {
        await addDoc(msgRef, {
          sender: auth.currentUser.uid,
          text: input.trim(),
          type: "text",
          createdAt: serverTimestamp(),
        });
      }

      // Send files
      for (let f of uploadedFiles) {
        await addDoc(msgRef, {
          sender: auth.currentUser.uid,
          text: "",
          fileURL: f.fileURL,
          fileName: f.fileName,
          type: f.type,
          createdAt: serverTimestamp(),
        });
      }

      // Update chat lastMessage
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage:
          input.trim() ||
          (uploadedFiles[uploadedFiles.length - 1]?.fileName || ""),
        lastMessageAt: serverTimestamp(),
      });

      setInput("");
      setFiles([]);
      scrollToBottom();
    } catch (err) {
      console.error("Send message error:", err);
      alert("Error sending message.");
    } finally {
      setLoading(false);
    }
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
          borderBottom: "1px solid #ccc",
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}
      >
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
          <h4 style={{ margin: 0 }}>
            {friendInfo?.displayName || chatInfo?.name || "Chat"}
          </h4>
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
          marginBottom: "140px",
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
                  ? "#007bff"
                  : isDark
                  ? "#333"
                  : "#ddd",
              color: msg.sender === auth.currentUser.uid ? "#fff" : "#000",
              padding: "10px",
              borderRadius: "10px",
              maxWidth: "70%",
              wordBreak: "break-word",
            }}
          >
            {msg.sender !== auth.currentUser.uid && (
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "5px",
                  fontSize: "12px",
                }}
              >
                {friendInfo?.displayName || "Friend"}
              </div>
            )}

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
                style={{ color: "#fff", textDecoration: "underline" }}
              >
                📎 {msg.fileName}
              </a>
            ) : (
              msg.text
            )}

            {msg.createdAt && (
              <div
                style={{
                  fontSize: "10px",
                  textAlign: "right",
                  opacity: 0.6,
                  marginTop: "4px",
                }}
              >
                {new Date(
                  msg.createdAt.seconds
                    ? msg.createdAt.seconds * 1000
                    : msg.createdAt
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {files.length > 0 && (
        <div
          style={{
            padding: "10px",
            borderTop: "1px solid #ccc",
            background: isDark ? "#1e1e1e" : "#fff",
            display: "flex",
            gap: "10px",
            overflowX: "auto",
          }}
        >
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative" }}>
              {f.type.startsWith("image") ? (
                <img
                  src={URL.createObjectURL(f)}
                  alt="preview"
                  style={{ height: "60px", borderRadius: "8px" }}
                />
              ) : (
                <div
                  style={{
                    padding: "5px 10px",
                    background: "#888",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                >
                  {f.name}
                </div>
              )}
              <button
                onClick={() => removeFile(i)}
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "red",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  cursor: "pointer",
                }}
              >
                ✖
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
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
        <input
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          multiple
          style={{ display: "none" }}
          id="fileInput"
        />
        <label
          htmlFor="fileInput"
          style={{ padding: "0 10px", cursor: "pointer", fontSize: "18px" }}
        >
          📎
        </label>
        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            marginLeft: "5px",
            padding: "10px 15px",
            background: loading ? "#999" : "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}