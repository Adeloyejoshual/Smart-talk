// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  limit as fsLimit,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Helpers --------------------
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};
const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// -------------------- Constants --------------------
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const COLORS = {
  primary: "#0084ff", // sent bubble
  received: "#e4e6eb", // received bubble
  reactionBg: "#555",
  lightBg: "#d0e6ff", // chat page background
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  edited: "#999",
  darkText: "#fff",
};
const SPACING = { xs: 4, sm: 8, md: 12, lg: 14, xl: 20, borderRadius: 20 };
const menuBtnStyle = {
  padding: SPACING.sm,
  borderRadius: SPACING.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

// -------------------- Component --------------------
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(null);

  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // -------------------- Scroll --------------------
  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      if (isAtBottom) scrollToBottom();
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Touch handlers --------------------
  const handleMsgTouchStart = m => { longPressTimer.current = setTimeout(() => setMenuOpenFor(m.id), 500); swipeStartX.current = null; };
  const handleMsgTouchMove = ev => { if (!swipeStartX.current && ev.touches?.[0]) swipeStartX.current = ev.touches[0].clientX; };
  const handleMsgTouchEnd = (m, e) => {
    clearTimeout(longPressTimer.current);
    if (!swipeStartX.current) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if (endX == null) return;
    if (swipeStartX.current - endX > 80) setReplyTo(m);
    swipeStartX.current = null;
  };

  // -------------------- Click outside --------------------
  const handleClickOutside = useCallback((e) => {
    if (menuOpenFor && !e.target.closest(`#msg-menu-${menuOpenFor}`)) setMenuOpenFor(null);
    if (reactionFor && !e.target.closest(".reaction-picker")) setReactionFor(null);
  }, [menuOpenFor, reactionFor]);
  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [handleClickOutside]);

  // -------------------- Send message --------------------
  const sendTextMessage = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: myUid,
      text: text.trim(),
      mediaUrl: "",
      mediaType: null,
      createdAt: serverTimestamp(),
      reactions: {},
    });
    setText("");
    scrollToBottom();
  };

  // -------------------- Apply reaction --------------------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      setReactionFor(null);
    } catch (e) { console.error(e); }
  };

  // -------------------- Render message --------------------
  const renderMessage = (m) => {
    const isMine = m.senderId === myUid;
    const showMenu = menuOpenFor === m.id;
    const showReactionPicker = reactionFor === m.id;

    return (
      <div
        key={m.id}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
          marginBottom: SPACING.sm,
        }}
        onTouchStart={() => handleMsgTouchStart(m)}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={(e) => handleMsgTouchEnd(m, e)}
      >
        <div
          className="msg-bubble"
          style={{
            maxWidth: "70%",
            padding: "10px 15px",
            borderRadius: SPACING.borderRadius,
            backgroundColor: isMine ? COLORS.primary : COLORS.received,
            color: isMine ? "#fff" : "#000",
            position: "relative",
            wordBreak: "break-word",
            cursor: "pointer",
          }}
          onClick={() => setMenuOpenFor(m.id)}
        >
          {m.replyTo && <div style={{ fontSize: 12, color: COLORS.edited, borderLeft: "3px solid #888", paddingLeft: 4, marginBottom: 4 }}>{m.replyTo.text || m.replyTo.mediaType}</div>}
          {m.text && <div>{m.text}</div>}

          {/* Reactions */}
          {Object.keys(m.reactions || {}).length > 0 && (
            <div style={{ position: "absolute", bottom: -12, right: -12, display: "flex", gap: 2 }}>
              {Object.values(m.reactions).map((r, i) => r && <span key={i} style={{ backgroundColor: COLORS.reactionBg, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 10 }}>{r}</span>)}
            </div>
          )}

          {/* Menu */}
          {showMenu && (
            <div id={`msg-menu-${m.id}`} style={{ position: "absolute", top: -SPACING.lg, right: 0, background: COLORS.lightCard, border: `1px solid ${COLORS.grayBorder}`, borderRadius: SPACING.borderRadius, zIndex: 10 }}>
              <button style={menuBtnStyle} onClick={() => setReactionFor(m.id)}>React</button>
              <button style={menuBtnStyle} onClick={() => setMenuOpenFor(null)}>Close</button>
            </div>
          )}

          {/* Reaction Picker */}
          {showReactionPicker && (
            <div className="reaction-picker" style={{ position: "absolute", bottom: -28, left: 0, display: "flex", gap: 4, background: "#fff", borderRadius: SPACING.borderRadius, padding: "2px 4px" }}>
              {INLINE_REACTIONS.map((r, i) => (
                <span key={i} style={{ cursor: "pointer", fontSize: 14 }} onClick={() => applyReaction(m.id, r)}>{r}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------- Render --------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: COLORS.lightBg }}>
      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}>
        {messages.map(renderMessage)}
        <div ref={endRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ background: COLORS.lightCard, padding: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}` }}>
          Replying to: {replyTo.text || replyTo.mediaType}
          <button onClick={() => setReplyTo(null)} style={{ marginLeft: SPACING.sm }}>✖</button>
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", padding: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: COLORS.lightCard }}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" style={{ flex: 1, padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: `1px solid ${COLORS.grayBorder}`, marginRight: SPACING.sm }} />
        <button onClick={sendTextMessage}>➡️</button>
      </div>
    </div>
  );
}