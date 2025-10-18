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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatConversationPage() {
  const { id } = useParams(); // Chat ID from URL
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

  // ✅ Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // ✅ Load chat info
  useEffect(() => {
    const loadChat = async () => {
      const chatRef = doc(db, "chats", id);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        setChatInfo(chatData);

        // Determine friend UID
        const friendId = chatData.members?.find(
          (uid) => uid !== auth.currentUser.uid
        );
        if (friendId) {
          const friendRef = doc(db, "users", friendId);
          // Listen for live presence updates
          return onSnapshot(friendRef, (friendSnap) => {
            if (friendSnap.exists()) {
              setFriendInfo(friendSnap.data());
            }
          });
        }
      } else {
        alert("Chat not found!");
        navigate("/chat");
      }
    };
    const unsub = loadChat();
    return () => unsub && unsub();
  }, [id, navigate]);

  // ✅ Real-time listener for messages
  useEffect(() => {
    const msgRef = collection(db, "chats", id, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [id]);

  // ✅ Send message (text/file)
  const handleSend = async () => {
    if (!input.trim() && !file) return;
    setLoading(true);

    try {
      let fileURL = null;
      let fileName = null;
      let type = "text";

      if (file) {
        const storageRef = ref(
          storage,
          `chatFiles/${id}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        fileURL = await getDownloadURL(storageRef);
        fileName = file.name;
        type = file.type.startsWith("image") ? "image" : "file";
      }

      await addDoc(collection(db, "chats", id, "messages"), {
        sender: auth.currentUser.uid,
        text: input.trim(),
        fileURL,
        fileName,
        type,
        createdAt: serverTimestamp(),
      });

      setInput("");
      setFile(null);
      setPreview(null);
    } catch (err) {
      console.error("Send error:", err);
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
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #ccc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* 🖼 Profile picture */}
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
          <div>
            <h4 style={{ margin: 0 }}>
              {friendInfo?.displayName || chatInfo?.name || "Chat"}
            </h4>
            <small style={{ color: theme === "dark" ? "#bbb" : "#666" }}>
              {friendInfo?.email || chatInfo?.email}
            </small>
            <br />
            <small
              style={{
                color: friendInfo?.online ? "limegreen" : "#aaa",
                fontSize: "12px",
              }}
            >
              {friendInfo?.online
                ? "Online"
                : friendInfo?.lastSeen
                ? `Last seen ${new Date(
                    friendInfo.lastSeen.seconds * 1000
                  ).toLocaleString()}`
                : "Offline"}
            </small>
          </div>
        </div>

        {/* 📞 🎥 Buttons */}
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

      {/* ✏️ Input */}
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