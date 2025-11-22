// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import ChatHeader from "./Chat/ChatHeader";

// -------------------- Helpers --------------------
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const COLORS = {
  primary: "#34B7F1",
  darkBg: "#0b0b0b",
  lightBg: "#f5f5f5",
  darkText: "#fff",
  lightText: "#000",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
};

const SPACING = { sm: 8, borderRadius: 12 };

export default function ChatConversationPage({ user }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = user?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    let unsubUser = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });

          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const userRef = doc(db, "users", friendId);
            unsubUser = onSnapshot(userRef, (s) => {
              if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
            });
          }
        }
        unsubChat = onSnapshot(cRef, (s) => {
          if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => {
      unsubChat?.();
      unsubUser?.();
    };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      setLoadingMsgs(false);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId]);

  // -------------------- Send message --------------------
  const sendTextMessage = async () => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        text: text.trim(),
        createdAt: serverTimestamp(),
        status: "sent",
      });
      setText("");
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      console.error(e);
      alert("Failed to send");
    }
  };

  // -------------------- Render message --------------------
  const renderMessage = (m) => {
    const isMine = m.senderId === myUid;
    const align = isMine ? "flex-end" : "flex-start";
    const bg = isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard;
    const color = isMine ? "#fff" : isDark ? COLORS.darkText : COLORS.lightText;

    return (
      <div key={m.id} style={{ display: "flex", justifyContent: align, marginBottom: SPACING.sm }}>
        <div style={{ maxWidth: "70%", padding: SPACING.sm, borderRadius: SPACING.borderRadius, backgroundColor: bg, color }}>
          {m.text && <div>{m.text}</div>}

          {/* Audio */}
          {m.audioUrl && (
            <audio controls src={m.audioUrl} style={{ marginTop: SPACING.sm, width: "100%" }} />
          )}

          {/* File */}
          {m.fileUrl && (
            <a href={m.fileUrl} target="_blank" rel="noreferrer" style={{ marginTop: SPACING.sm, display: "block", color }}>
              {m.fileName || "Download File"}
            </a>
          )}

          <div style={{ fontSize: 10, color: COLORS.mutedText, textAlign: "right", marginTop: 2 }}>
            {fmtTime(m.createdAt)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg), color: isDark ? COLORS.darkText : COLORS.lightText }}>
      
      {/* Header */}
      <ChatHeader chatInfo={chatInfo} friendInfo={friendInfo} myUid={myUid} navigate={navigate} />

      {/* Messages scrollable */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: SPACING.sm }}>Loading...</div>}
        {messages.map(renderMessage)}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: SPACING.sm, display: "flex", gap: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: isDark ? COLORS.darkCard : COLORS.lightCard }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: `1px solid ${COLORS.grayBorder}`, outline: "none", background: isDark ? COLORS.darkBg : "#fff", color: isDark ? COLORS.darkText : COLORS.lightText }}
          onKeyDown={e => e.key === "Enter" && sendTextMessage()}
        />
        <button onClick={sendTextMessage} style={{ fontSize: 18, background: "transparent", border: "none" }}>📩</button>
      </div>
    </div>
  );
}