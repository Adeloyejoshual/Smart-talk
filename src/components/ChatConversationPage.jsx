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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // Load chat info & friend info
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

      const friendId = chatData.participants?.find(uid => uid !== auth.currentUser.uid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        const unsub = onSnapshot(friendRef, snap => {
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
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, snapshot => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => unsub();
  }, [chatId]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() && !file) return;
    setLoading(true);

    try {
      let fileURL = null;
      let fileName = null;
      let type = "text";

      if (file) {
        const storageRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        fileURL = await getDownloadURL(storageRef);
        fileName = file.name;
        type = file.type.startsWith("image") ? "image" : "file";
      }

      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || auth.currentUser.email.split("@")[0],
        text: input.trim(),
        fileURL,
        fileName,
        type,
        createdAt: serverTimestamp(),
      });

      // Update lastMessage and lastMessageAt in chat document
      const chatRef = doc(db, "chats", chatId);
      await chatRef.update({
        lastMessage: input.trim() || (file ? fileName : ""),
        lastMessageAt: serverTimestamp(),
      });

      setInput("");
      setFile(null);
      setPreview(null);
      scrollToBottom();
    } catch (err) {
      console.error("Send error:", err);
      alert("Error sending message.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = e => {
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

  const handleVoiceCall = () => navigate(`/call?chatId=${chatId}&type=voice`);
  const handleVideoCall = () => navigate(`/call?chatId=${chatId}&type=video`);
  const handleBack = () => navigate("/chat");

  const formatTime = ts => {
    if (!ts) return "";
    const dateObj = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!chatInfo)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: theme === "dark" ? "#fff" : "#000" }}>
        Loading chat...
      </div>
    );

  return (
    <div style={{
      minHeight: "100vh",
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : theme === "dark" ? "#121212" : "#f5f5f5",
      color: theme === "dark" ? "#fff" : "#000",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{ background: theme === "dark" ? "#1e1e1e" : "#fff", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #ccc", position: "sticky", top: 0, zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={handleBack} style={{ background: "transparent", border: "none", fontSize: "22px", cursor: "pointer", marginRight: "8px" }}>←</button>
          <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="profile" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ccc" }} />
          <div>
            <h4 style={{ margin: 0 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</h4>
            <small style={{ color: theme === "dark" ? "#bbb" : "#666" }}>{friendInfo?.email || ""}</small>
          </div>
        </div>
        <div>
          <button onClick={handleVoiceCall} style={iconBtnStyle}>📞</button>
          <button onClick={handleVideoCall} style={iconBtnStyle}>🎥</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            alignSelf: msg.sender === auth.currentUser.uid ? "flex-end" : "flex-start",
            background: msg.sender === auth.currentUser.uid ? (theme === "dark" ? "#4a90e2" : "#007bff") : (theme === "dark" ? "#333" : "#ddd"),
            color: msg.sender === auth.currentUser.uid ? "#fff" : "#000",
            padding: "10px",
            borderRadius: "10px",
            maxWidth: "70%",
            wordBreak: "break-word",
            display: "flex",
            flexDirection: "column",
          }}>
            <strong style={{ marginBottom: "4px" }}>{msg.senderName || "Unknown"}</strong>
            {msg.type === "image" ? (
              <img src={msg.fileURL} alt="sent" style={{ width: "100%", borderRadius: "8px" }} />
            ) : msg.type === "file" ? (
              <a href={msg.fileURL} target="_blank" rel="noopener noreferrer" style={{ color: msg.sender === auth.currentUser.uid ? "#fff" : "#000", textDecoration: "underline" }}>📎 {msg.fileName}</a>
            ) : (
              <span>{msg.text}</span>
            )}
            <small style={{ marginTop: "4px", fontSize: "11px", color: msg.sender === auth.currentUser.uid ? "#eee" : "#555", alignSelf: "flex-end" }}>
              {formatTime(msg.createdAt)}
            </small>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {preview && (
        <div style={{ background: theme === "dark" ? "#333" : "#fff", padding: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {file.type.startsWith("image") && <img src={preview} alt="preview" style={{ height: "60px", borderRadius: "8px", marginRight: "10px" }} />}
            <span>{file.name}</span>
          </div>
          <button onClick={cancelPreview} style={{ background: "red", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px" }}>✖</button>
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", padding: "10px", borderTop: "1px solid #ccc", background: theme === "dark" ? "#1e1e1e" : "#fff" }}>
        <input type="text" placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc", outline: "none", background: theme === "dark" ? "#2c2c2c" : "#fff", color: theme === "dark" ? "#fff" : "#000" }} />
        <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileChange} style={{ display: "none" }} id="fileInput" />
        <label htmlFor="fileInput" style={{ padding: "10px", cursor: "pointer", fontSize: "18px" }}>📎</label>
        <button onClick={handleSend} disabled={loading} style={{ marginLeft: "5px", padding: "10px 15px", background: loading ? "#999" : "#007BFF", color: "#fff", border: "none", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer" }}>{loading ? "Sending..." : "Send"}</button>
      </div>
    </div>
  );
}

const iconBtnStyle = { marginLeft: "8px", background: "transparent", border: "none", fontSize: "20px", cursor: "pointer" };