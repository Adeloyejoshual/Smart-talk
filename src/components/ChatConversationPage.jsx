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

// Format last seen
const formatLastSeen = (lastSeen, isOnline) => {
  if (isOnline) return "Online";
  if (!lastSeen) return "";
  const now = new Date();
  const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = (now - last) / 1000;
  const min = Math.floor(diff / 60);
  const hr = Math.floor(min / 60);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (now.toDateString() === last.toDateString()) {
    if (min < 1) return "just now";
    if (min < 60) return `${min} minute${min > 1 ? "s" : ""} ago`;
    return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  }
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [sending, setSending] = useState(false);
  const [fullImage, setFullImage] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(scrollToBottom, [messages]);

  // Load chat + friend info
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    getDoc(chatRef).then(async (snap) => {
      if (!snap.exists()) return navigate("/chat");
      const data = snap.data();
      const friendId = data.participants.find((uid) => uid !== auth.currentUser.uid);
      const friendRef = doc(db, "users", friendId);
      onSnapshot(friendRef, (fSnap) => {
        if (fSnap.exists()) setFriend(fSnap.data());
      });
    });
  }, [chatId, navigate]);

  // Listen to messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // Update "delivered" for receiver when they open the chat
      const batch = msgs.filter(
        (m) => m.sender !== auth.currentUser.uid && m.status === "sent"
      );
      for (const m of batch) {
        await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
      }
    });
    return unsub;
  }, [chatId]);

  // When chat is visible, mark all delivered messages as seen
  useEffect(() => {
    const markSeen = async () => {
      const unseen = messages.filter(
        (m) => m.sender !== auth.currentUser.uid && m.status === "delivered"
      );
      for (const m of unseen) {
        await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "seen" });
      }
    };
    if (messages.length > 0) markSeen();
  }, [messages, chatId]);

  // File selection
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles([...files, ...selected]);
    setPreviews([
      ...previews,
      ...selected.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    ]);
  };

  const cancelPreview = (i) => {
    const f = [...files];
    const p = [...previews];
    f.splice(i, 1);
    p.splice(i, 1);
    setFiles(f);
    setPreviews(p);
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    setSending(true);

    const msgRef = collection(db, "chats", chatId, "messages");
    const allMsgs = [];

    try {
      // Upload files
      for (const file of files) {
        const fileRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        allMsgs.push({
          sender: auth.currentUser.uid,
          fileURL: url,
          fileName: file.name,
          type: file.type.startsWith("image") ? "image" : "file",
          createdAt: serverTimestamp(),
          status: "sent",
        });
      }

      if (input.trim()) {
        allMsgs.push({
          sender: auth.currentUser.uid,
          text: input.trim(),
          type: "text",
          createdAt: serverTimestamp(),
          status: "sent",
        });
      }

      for (const m of allMsgs) await addDoc(msgRef, m);

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: input.trim() || allMsgs[0]?.fileName || "📎 File",
        lastMessageAt: serverTimestamp(),
      });

      setInput("");
      setFiles([]);
      setPreviews([]);
    } catch (e) {
      console.error(e);
      alert("Message failed");
    } finally {
      setSending(false);
    }
  };

  if (!friend) return <div style={{ padding: 20 }}>Loading chat...</div>;

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
          : "#f4f4f4",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          background: isDark ? "#1f1f1f" : "#fff",
          borderBottom: "1px solid #ccc",
        }}
      >
        <button
          onClick={() => navigate("/chat")}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            marginRight: 10,
            color: isDark ? "#fff" : "#000",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <img
          src={friend?.photoURL || "/default-avatar.png"}
          alt="user"
          style={{ width: 45, height: 45, borderRadius: "50%" }}
        />
        <div style={{ marginLeft: 10 }}>
          <h4 style={{ margin: 0 }}>{friend.displayName}</h4>
          <small style={{ color: "#888" }}>
            {formatLastSeen(friend.lastSeen, friend.isOnline)}
          </small>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: 15,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 100,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === auth.currentUser.uid ? "flex-end" : "flex-start",
              background:
                m.sender === auth.currentUser.uid
                  ? "#007bff"
                  : isDark
                  ? "#2e2e2e"
                  : "#e0e0e0",
              color: m.sender === auth.currentUser.uid ? "#fff" : "#000",
              padding: 10,
              borderRadius: 10,
              maxWidth: "75%",
              wordBreak: "break-word",
            }}
          >
            {m.type === "text" && m.text}
            {m.type === "image" && (
              <img
                src={m.fileURL}
                alt="sent"
                onClick={() => setFullImage(m.fileURL)}
                style={{ maxWidth: "100%", borderRadius: 8, cursor: "pointer" }}
              />
            )}
            {m.type === "file" && (
              <a
                href={m.fileURL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: m.sender === auth.currentUser.uid ? "#fff" : "#007bff",
                  textDecoration: "underline",
                }}
              >
                📎 {m.fileName}
              </a>
            )}
            <div
              style={{
                fontSize: 10,
                textAlign: "right",
                opacity: 0.7,
                marginTop: 5,
              }}
            >
              {m.createdAt?.seconds
                ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Sending..."}{" "}
              {m.sender === auth.currentUser.uid && (
                <>
                  {m.status === "sending" && "🕓"}
                  {m.status === "sent" && "✅"}
                  {m.status === "delivered" && "📬"}
                  {m.status === "seen" && "👁"}
                </>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div
            style={{
              alignSelf: "flex-end",
              background: "#007bff",
              color: "#fff",
              padding: "10px 15px",
              borderRadius: 10,
              opacity: 0.7,
            }}
          >
            Sending...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Previews */}
      {files.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 10,
            background: isDark ? "#1f1f1f" : "#fff",
            borderTop: "1px solid #ccc",
            overflowX: "auto",
          }}
        >
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative" }}>
              {f.type.startsWith("image/") ? (
                <img src={previews[i]} alt="preview" style={{ height: 70, borderRadius: 8 }} />
              ) : (
                <div
                  style={{
                    height: 70,
                    width: 70,
                    background: "#ccc",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                  }}
                >
                  📎
                </div>
              )}
              <button
                onClick={() => cancelPreview(i)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "red",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  cursor: "pointer",
                }}
              >
                ✖
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          background: isDark ? "#1f1f1f" : "#fff",
          borderTop: "1px solid #ccc",
          padding: 10,
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
            borderRadius: 8,
            border: "1px solid #ccc",
            padding: 10,
            background: isDark ? "#2c2c2c" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
        />
        <input
          id="fileInput"
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <label htmlFor="fileInput" style={{ fontSize: 22, marginLeft: 10, cursor: "pointer" }}>
          📎
        </label>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            marginLeft: 10,
            padding: "10px 16px",
            background: sending ? "#888" : "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 8,
          }}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>

      {/* Full Image View */}
      {fullImage && (
        <div
          onClick={() => setFullImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <img
            src={fullImage}
            alt="full"
            style={{ maxHeight: "90%", maxWidth: "90%", borderRadius: 10 }}
          />
        </div>
      )}
    </div>
  );
}