// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [chatData, setChatData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  /* ------------------------------------------------
      1️⃣ Fetch Chat Info
  ------------------------------------------------- */
  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, "chats", chatId);
    getDoc(chatRef).then((snapshot) => {
      if (snapshot.exists()) {
        setChatData(snapshot.data());
      }
    });
  }, [chatId]);

  /* ------------------------------------------------
      2️⃣ Fetch Messages
  ------------------------------------------------- */
  useEffect(() => {
    if (!chatId) return;

    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    });

    return () => unsubscribe();
  }, [chatId]);

  /* ------------------------------------------------
      3️⃣ Send Message
  ------------------------------------------------- */
  const sendMessage = async () => {
    if (!input.trim()) return;

    const msgRef = collection(db, "chats", chatId, "messages");

    await addDoc(msgRef, {
      sender: auth.currentUser.uid,
      text: input.trim(),
      timestamp: serverTimestamp(),
    });

    setInput("");

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /* ------------------------------------------------
      4️⃣ Get Other Participant
  ------------------------------------------------- */
  const receiverId =
    chatData?.participants?.find((id) => id !== auth.currentUser.uid) || null;

  /* ------------------------------------------------
      5️⃣ Navigation Buttons
  ------------------------------------------------- */
  const openProfile = () => {
    if (!receiverId) return;
    navigate(`/profile/${receiverId}`);
  };

  const startVoiceCall = () => {
    if (!receiverId) return;
    navigate(`/voicecall/${receiverId}`);
  };

  const startVideoCall = () => {
    if (!receiverId) return;
    navigate(`/videocall/${receiverId}`);
  };

  /* ------------------------------------------------
      6️⃣ UI
  ------------------------------------------------- */
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backButton}>←</button>

        <h2 style={{ margin: 0, fontSize: 20 }}>Chat</h2>

        <div style={styles.actions}>
          <button onClick={openProfile} style={styles.iconBtn}>👤</button>
          <button onClick={startVoiceCall} style={styles.iconBtn}>📞</button>
          <button onClick={startVideoCall} style={styles.iconBtn}>🎥</button>
        </div>
      </div>

      {/* MESSAGES */}
      <div style={styles.messageArea}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.messageBubble,
              alignSelf:
                msg.sender === auth.currentUser.uid
                  ? "flex-end"
                  : "flex-start",
              background:
                msg.sender === auth.currentUser.uid ? "#3b82f6" : "#555",
            }}
          >
            {msg.text}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={styles.inputArea}>
        <input
          style={styles.input}
          placeholder="Message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button style={styles.sendBtn} onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------
   7️⃣ Styles
------------------------------------------------- */
const styles = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#111",
    color: "#fff",
  },
  header: {
    height: 60,
    padding: "0 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #333",
  },
  backButton: {
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    color: "#fff",
  },
  actions: {
    display: "flex",
    gap: 15,
  },
  iconBtn: {
    fontSize: 22,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#fff",
  },
  messageArea: {
    flex: 1,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  messageBubble: {
    padding: "10px 14px",
    borderRadius: 10,
    maxWidth: "70%",
    fontSize: 15,
  },
  inputArea: {
    padding: 12,
    borderTop: "1px solid #333",
    display: "flex",
    gap: 10,
  },
  input: {
    flex: 1,
    padding: 10,
    background: "#222",
    border: "1px solid #444",
    borderRadius: 6,
    color: "#fff",
  },
  sendBtn: {
    padding: "10px 16px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
  },
};