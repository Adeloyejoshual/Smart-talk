import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebaseClient";
import { motion } from "framer-motion";

export default function ChatPageView({ chat, onBack }) {
  const user = auth.currentUser;
  const uid = user?.uid;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingOther, setTypingOther] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const typingTimeout = useRef(null);

  const otherUid = chat.members?.find((m) => m !== uid);

  // Listen for messages
  useEffect(() => {
    if (!chat?.id) return;
    const q = query(collection(db, "chats", chat.id, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 200);
    });
    return unsub;
  }, [chat?.id]);

  // Listen for typing indicator
  useEffect(() => {
    if (!chat?.id) return;
    const unsub = onSnapshot(doc(db, "chats", chat.id), (snap) => {
      const data = snap.data();
      if (data?.typing && otherUid) setTypingOther(!!data.typing[otherUid]);
    });
    return unsub;
  }, [chat?.id, otherUid]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setUploading(true);
    try {
      await addDoc(collection(db, "chats", chat.id, "messages"), {
        from: uid,
        text,
        type: "text",
        timestamp: serverTimestamp(),
      });

      await updateDoc(doc(db, "chats", chat.id), {
        lastMessage: { text, type: "text" },
        lastMessageTime: serverTimestamp(),
        [`typing.${uid}`]: false,
      });

      setText("");
    } catch (err) {
      console.error("Send failed:", err);
    }
    setUploading(false);
  };

  // typing logic
  const handleTyping = async (val) => {
    setText(val);
    if (!chat?.id || !uid) return;
    if (!isTyping) {
      setIsTyping(true);
      await updateDoc(doc(db, "chats", chat.id), { [`typing.${uid}`]: true });
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(async () => {
      setIsTyping(false);
      await updateDoc(doc(db, "chats", chat.id), { [`typing.${uid}`]: false });
    }, 1500);
  };

  const friendlyTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fafafa" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 12px",
          background: "#f5f5f5",
          borderBottom: "1px solid #ddd",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <button onClick={onBack} style={iconBtn}>←</button>
        <img
          src={chat.photoURL || "/assets/default-avatar.png"}
          alt="profile"
          style={{ width: 38, height: 38, borderRadius: "50%", marginRight: 10 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "600" }}>
            {chat.isGroup ? chat.groupName || "Group" : chat.name || "Unknown"}
          </div>
          {!chat.isGroup && (
            <div style={{ fontSize: 13, color: "#666" }}>
              {typingOther ? "Typing..." : chat.online ? "Online" : "Last seen recently"}
            </div>
          )}
        </div>
        <button style={iconBtn}>⋮</button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              justifyContent: msg.from === uid ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                background: msg.from === uid ? "#007bff" : "#e9ecef",
                color: msg.from === uid ? "#fff" : "#000",
                padding: "8px 12px",
                borderRadius: 16,
                borderBottomRightRadius: msg.from === uid ? 0 : 16,
                borderBottomLeftRadius: msg.from === uid ? 16 : 0,
                wordBreak: "break-word",
                fontSize: 15,
              }}
            >
              {msg.text}
              <div style={{ fontSize: 11, textAlign: "right", marginTop: 4, opacity: 0.7 }}>
                {friendlyTime(msg.timestamp)}
              </div>
            </div>
          </motion.div>
        ))}

        {typingOther && (
          <div style={{ color: "#007bff", fontSize: 13, margin: "6px 0" }}>Typing...</div>
        )}
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: 10,
          borderTop: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          background: "#fff",
        }}
      >
        <button style={iconBtn}>📎</button>
        <input
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          placeholder="Type a message"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 20,
            border: "1px solid #ccc",
            margin: "0 8px",
            outline: "none",
          }}
        />
        <button onClick={handleSend} disabled={uploading || !text.trim()} style={sendBtn}>
          ➤
        </button>
      </div>
    </div>
  );
}

const iconBtn = {
  background: "transparent",
  border: "none",
  fontSize: 20,
  cursor: "pointer",
};

const sendBtn = {
  background: "#007bff",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: "50%",
  cursor: "pointer",
};