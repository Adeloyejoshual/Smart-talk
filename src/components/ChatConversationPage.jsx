// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [myTyping, setMyTyping] = useState(false);

  const [text, setText] = useState("");

  const messagesEndRef = useRef(null);

  /* -------------------------------
     🔥 Auto-scroll when messages update
  -------------------------------- */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /* -------------------------------
     🔥 Load chat user info
  -------------------------------- */
  useEffect(() => {
    const loadUser = async () => {
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const otherId = data.users.find((id) => id !== user.uid);

        const userRef = doc(db, "users", otherId);
        const userSnap = await getDoc(userRef);
        setChatUser(userSnap.data());
      }
    };

    loadUser();
  }, [chatId]);

  /* -------------------------------
     🔥 Real-time messages listener
  -------------------------------- */
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");

    const unsub = onSnapshot(msgRef, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });

    return () => unsub();
  }, [chatId]);

  /* -------------------------------
     ✨ Typing Indicator System
  -------------------------------- */
  useEffect(() => {
    const typingRef = doc(db, "chats", chatId, "typing", user.uid);

    let timeout;

    if (myTyping) {
      setDoc(typingRef, { typing: true });
      timeout = setTimeout(() => {
        setDoc(typingRef, { typing: false });
        setMyTyping(false);
      }, 2300);
    }

    return () => {
      clearTimeout(timeout);
      setDoc(typingRef, { typing: false });
    };
  }, [myTyping]);

  useEffect(() => {
    const otherId = chatUser?.uid;
    if (!otherId) return;

    const ref = doc(db, "chats", chatId, "typing", otherId);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setTyping(snap.data().typing);
    });

    return () => unsub();
  }, [chatUser]);

  /* -------------------------------
     📝 Send message
  -------------------------------- */
  const sendMessage = async () => {
    if (!text.trim()) return;

    const msgRef = collection(db, "chats", chatId, "messages");
    await addDoc(msgRef, {
      text,
      senderId: user.uid,
      createdAt: serverTimestamp(),
    });

    setText("");
    scrollToBottom();
  };

  /* -------------------------------
     🎨 UI Styles
  -------------------------------- */
  const isDark = false; // your theme logic
  const iconBtn = {
    border: "none",
    background: "transparent",
    fontSize: "22px",
    cursor: "pointer",
    color: "#25D366",
  };

  /* -------------------------------
     📱 Render UI
  -------------------------------- */
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: isDark ? "#121212" : "#f5f5f5",
      }}
    >
      {/* HEADER — pinned */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: isDark ? "#1f1f1f" : "#fff",
          padding: "12px 16px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Left: Back + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/chat")} style={iconBtn}>
            ←
          </button>

          <img
            src={chatUser?.photoURL || "https://via.placeholder.com/80"}
            style={{
              width: 45,
              height: 45,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />

          <div>
            <strong>{chatUser?.displayName || "User"}</strong>
            <p
              style={{
                fontSize: 12,
                margin: 0,
                color: chatUser?.isOnline ? "#25D366" : "#999",
              }}
            >
              {typing
                ? "typing..."
                : chatUser?.isOnline
                ? "Online"
                : "Last seen recently"}
            </p>
          </div>
        </div>

        {/* Right: Call + Menu */}
        <div style={{ display: "flex", gap: 12 }}>
          <button style={iconBtn}>📞</button>
          <button style={iconBtn}>🎥</button>
          <button style={iconBtn}>⋮</button>
        </div>
      </div>

      {/* MESSAGES — scrollable */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px",
          background: isDark ? "#111" : "#e9ecef",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent:
                msg.senderId === user.uid ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                background:
                  msg.senderId === user.uid
                    ? "#25D366"
                    : isDark
                    ? "#333"
                    : "#fff",
                color: msg.senderId === user.uid ? "#fff" : "#000",
                padding: "8px 12px",
                borderRadius: 16,
                maxWidth: "70%",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Scroll bottom anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT — pinned */}
      <div
        style={{
          padding: "10px",
          display: "flex",
          gap: 10,
          background: isDark ? "#1f1f1f" : "#fff",
          borderTop: "1px solid #ddd",
        }}
      >
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMyTyping(true);
          }}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: 20,
            border: "1px solid #ccc",
            outline: "none",
          }}
        />

        <button
          onClick={sendMessage}
          style={{
            background: "#25D366",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 45,
            height: 45,
            fontSize: 20,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}