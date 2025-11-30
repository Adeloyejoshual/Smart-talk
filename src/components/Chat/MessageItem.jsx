// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EmojiPicker from "./EmojiPicker";

const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#888",
  reactionBg: "#111",
};

const SPACING = { sm: 8, lg: 14, borderRadius: 12 };

const QUICK = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({
  message,
  myUid,
  isDark,
  chatId,
  setReplyTo,
  pinnedMessageId,
  setPinnedMessageId,
}) {
  const isMine = message.senderId === myUid;
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionBarOpen, setReactionBarOpen] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });

  const msgRef = useRef(null);

  // -------------------- Close reaction bar when clicking outside --------------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (msgRef.current && !msgRef.current.contains(e.target)) {
        setReactionBarOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -------------------- Format time --------------------
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  // -------------------- Apply reaction --------------------
  const applyReaction = async (emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing === emoji ? null : emoji });
      setReactionBarOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------- Delete message --------------------
  const deleteMessage = async () => {
    if (window.confirm("Delete message?")) {
      await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
    }
  };

  // -------------------- Copy message --------------------
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.text || "");
      alert("Copied");
      setMenuOpen(false);
    } catch {
      alert("Copy failed");
    }
  };

  // -------------------- Pin/Unpin message --------------------
  const togglePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    if (pinnedMessageId === message.id) {
      // unpin
      await updateDoc(chatRef, { pinnedMessageId: "" });
      setPinnedMessageId("");
    } else {
      await updateDoc(chatRef, { pinnedMessageId: message.id });
      setPinnedMessageId(message.id);
    }
    setMenuOpen(false);
  };

  // -------------------- Long press detection --------------------
  let pressTimer;
  const handleMouseDown = (e) => {
    pressTimer = setTimeout(() => {
      const rect = e.target.getBoundingClientRect();
      setEmojiPos({ top: rect.top - 50, left: rect.left });
      setReactionBarOpen(true);
    }, 500);
  };
  const handleMouseUp = () => clearTimeout(pressTimer);
  const handleTouchStart = handleMouseDown;
  const handleTouchEnd = handleMouseUp;

  // -------------------- Media rendering --------------------
  const renderMedia = () => {
    if (message.mediaType === "image")
      return <img src={message.mediaUrl} style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />;
    if (message.mediaType === "video")
      return <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />;
    if (message.mediaType === "audio")
      return <audio src={message.mediaUrl} controls />;
    if (message.mediaType === "pdf")
      return <a href={message.mediaUrl} target="_blank" rel="noreferrer">{message.fileName || "PDF"}</a>;
    return null;
  };

  return (
    <div
      ref={msgRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
      }}
    >
      {/* Pinned Indicator */}
      {pinnedMessageId === message.id && (
        <div style={{ fontSize: 12, color: "orange", marginBottom: 2 }}>📌 Pinned</div>
      )}

      {/* Message bubble */}
      <div
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          cursor: "pointer",
          wordBreak: "break-word",
          transition: "all 0.2s",
        }}
      >
        {message.text && <div>{message.text}</div>}
        {renderMedia()}

        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {fmtTime(message.createdAt)}
        </div>

        {/* Reactions under message */}
        {message.reactions && Object.values(message.reactions).filter(Boolean).length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {Object.values(message.reactions).filter(Boolean).map((r, i) => (
              <span key={i} style={{ backgroundColor: COLORS.reactionBg, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 12 }}>
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Menu: Reply, Copy, Pin/Unpin, Delete */}
      {menuOpen && (
        <div style={{
          position: "absolute",
          top: -40,
          right: 0,
          background: isDark ? "#1b1b1b" : "#fff",
          border: `1px solid ${isDark ? "#333" : "rgba(0,0,0,0.1)"}`,
          borderRadius: 8,
          zIndex: 10,
        }}>
          <button onClick={() => { setReplyTo(message); setMenuOpen(false); }}>Reply</button>
          <button onClick={copyMessage}>Copy</button>
          <button onClick={togglePin}>{pinnedMessageId === message.id ? "Unpin" : "Pin"}</button>
          <button onClick={deleteMessage}>Delete</button>
        </div>
      )}

      {/* Floating reaction bar */}
      {reactionBarOpen && (
        <div style={{
          position: "fixed",
          top: emojiPos.top,
          left: emojiPos.left,
          display: "flex",
          gap: 6,
          background: "#fff",
          borderRadius: 24,
          padding: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          zIndex: 2000,
        }}>
          {QUICK.map((e) => (
            <span key={e} style={{ cursor: "pointer", fontSize: 24 }} onClick={() => applyReaction(e)}>
              {e}
            </span>
          ))}
          <span style={{ cursor: "pointer", fontSize: 24 }}>+</span>
        </div>
      )}
    </div>
  );
}