import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebaseClient";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pinned, setPinned] = useState(null);
  const [chatId] = useState("global_chat");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      scrollToBottom();
    });

    // Load pinned message and check expiry
    const pinnedRef = doc(db, "chats", chatId);
    getDoc(pinnedRef).then((snap) => {
      const data = snap.data();
      if (data?.pinnedMessage) {
        const { pinnedAt } = data.pinnedMessage;
        const expired = Date.now() - pinnedAt > 30 * 24 * 60 * 60 * 1000;
        if (expired) {
          updateDoc(pinnedRef, { pinnedMessage: null });
          setPinned(null);
        } else {
          setPinned(data.pinnedMessage);
        }
      }
    });

    return () => unsub();
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const msg = {
      text: input.trim(),
      sender: auth.currentUser?.uid || "anon",
      createdAt: Date.now(),
    };
    await addDoc(collection(db, "chats", chatId, "messages"), msg);
    setInput("");
  };

  const handlePin = async (m) => {
    const ref = doc(db, "chats", chatId);
    await updateDoc(ref, { pinnedMessage: { ...m, pinnedAt: Date.now() } });
    setPinned({ ...m, pinnedAt: Date.now() });
  };

  const handleUnpin = async () => {
    const ref = doc(db, "chats", chatId);
    await updateDoc(ref, { pinnedMessage: null });
    setPinned(null);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h3 style={{ margin: 0 }}>💬 Chat</h3>
      </header>

      {/* Pinned Message */}
      {pinned && (
        <div style={styles.pinnedBox}>
          <div>
            📌 <b>Pinned:</b> {pinned.text}
          </div>
          <button style={styles.unpinBtn} onClick={handleUnpin}>
            Unpin
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.message,
              alignSelf:
                m.sender === auth.currentUser?.uid ? "flex-end" : "flex-start",
              background:
                m.sender === auth.currentUser?.uid ? "#007bff" : "#f1f1f1",
              color: m.sender === auth.currentUser?.uid ? "#fff" : "#000",
            }}
          >
            <div>{m.text}</div>
            <small
              style={{ opacity: 0.6, fontSize: 10, marginTop: 4, cursor: "pointer" }}
              onClick={() => handlePin(m)}
            >
              📍 Pin
            </small>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputBox}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.sendBtn}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: 600,
    margin: "0 auto",
  },
  header: {
    padding: "12px",
    borderBottom: "1px solid #eee",
    background: "#fafafa",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  pinnedBox: {
    background: "#fff3cd",
    padding: "10px",
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  unpinBtn: {
    background: "transparent",
    border: "none",
    color: "#007bff",
    cursor: "pointer",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  message: {
    padding: "10px 14px",
    borderRadius: 10,
    maxWidth: "70%",
  },
  inputBox: {
    display: "flex",
    padding: "10px",
    borderTop: "1px solid #eee",
    background: "#fafafa",
  },
  input: {
    flex: 1,
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: 8,
    outline: "none",
  },
  sendBtn: {
    marginLeft: "8px",
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#007bff",
    color: "#fff",
    cursor: "pointer",
  },
};