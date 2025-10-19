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
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
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

  // Real-time messages listener
  useEffect(() => {
    if (!chatId) return;
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc")); // oldest first

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => unsub();
  }, [chatId]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() && !file) return;
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      let fileURL = null;
      let fileName = null;
      let type = "text";

      if (file) {
        const storageRef = ref(
          storage,
          `chatFiles/${chatId}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        fileURL = await getDownloadURL(storageRef);
        fileName = file.name;
        type = file.type.startsWith("image") ? "image" : "file";
      }

      const msgRef = collection(db, "chats", chatId, "messages");
      await addDoc(msgRef, {
        sender: auth.currentUser.uid,
        senderName:
          auth.currentUser.displayName ||
          auth.currentUser.email.split("@")[0],
        text: input.trim(),
        fileURL,
        fileName,
        type,
        createdAt: serverTimestamp(),
      });

      // Update lastMessage in chat
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: input.trim() || (file ? fileName : ""),
        lastMessageAt: serverTimestamp(),
      });

      setInput("");
      setFile(null);
      setPreview(null);
      scrollToBottom();
    } catch (err) {
      console.error("Send message error:", err);
      alert("Error sending message.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const cancelPreview = () => {
    setFile(null);
    setPreview(null);
  };

  const handleBack = () => navigate("/chat");

  if (!chatInfo)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isDark ? "#fff" : "#000",
        }}
      >
        Loading chat...
      </div>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: wallpaper
          ? `url(${wallpaper}) center/cover no-repeat`
          : isDark
          ? "#121212"
          : "#f5f5f5",
        color: isDark ? "#fff" : "#000",
        display: "flex",
        flexDirection: "column",
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
          <small style={{ color: isDark ? "#bbb" : "#666" }}>
            {friendInfo?.email || ""}
          </small>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                marginBottom: "5px",
                opacity: 0.7,
              }}
            >
              <span>{msg.senderName}</span>
              {msg.createdAt && (
                <span>
                  {new Date(
                    msg.createdAt.seconds
                      ? msg.createdAt.seconds * 1000
                      : msg.createdAt
                  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

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
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Preview */}
      {preview && (
        <div
          style={{
            background: isDark ? "#333" : "#fff",
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
                style={{ height: "60px", borderRadius: "8px", marginRight: "10px" }}
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

      {/* Input */}
      <div
        style={{
          display: "flex",
          padding: "10px",
          borderTop: "1px solid #ccc",
          background: isDark ? "#1e1e1e" : "#fff",
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
            background: isDark ? "#2c2c2c" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
          style={{ padding: "10px", cursor: "pointer", fontSize: "18px" }}
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