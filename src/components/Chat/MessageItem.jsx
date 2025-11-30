// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EmojiPicker from "./EmojiPicker";

const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  reactionBg: "#111",
};

const SPACING = { sm: 8, lg: 14, borderRadius: 12 };
const QUICK_EMOJIS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({ message, myUid, isDark, chatId, setReplyTo, pinnedMessageId, setPinnedMessageId }) {
  const isMine = message.senderId === myUid;
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const containerRef = useRef(null);

  // Format time
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  // Cloudinary URL helper
  const getCloudinaryUrl = (url, type = "image", width = 300) => {
    if (!url) return "";
    if (!url.includes("res.cloudinary.com")) return url;
    const trans = type === "image" ? `c_fill,w_${width},q_auto` : `c_fill,w_${width},q_auto`;
    return url.replace("/upload/", `/upload/${trans}/`);
  };

  // Apply reaction
  const applyReaction = async (emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      const current = message.reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: current === emoji ? null : emoji });
      setReactionPickerOpen(false);
    } catch (e) { console.error(e); }
  };

  // Delete message
  const deleteMessage = async () => {
    if (!window.confirm("Delete this message?")) return;
    if (isMine) {
      await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
    } else {
      await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deletedFor: arrayUnion(myUid) });
    }
    setMenuOpen(false);
  };

  // Copy message
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
      alert("Copied!");
      setMenuOpen(false);
    } catch {
      alert("Copy failed");
    }
  };

  // Pin message (only one at a time)
  const togglePin = async () => {
    const mRef = doc(db, "chats", chatId, "messages", message.id);
    if (pinnedMessageId === message.id) {
      setPinnedMessageId(null);
      await updateDoc(mRef, { pinned: false });
    } else {
      if (pinnedMessageId) {
        const oldRef = doc(db, "chats", chatId, "messages", pinnedMessageId);
        await updateDoc(oldRef, { pinned: false });
      }
      setPinnedMessageId(message.id);
      await updateDoc(mRef, { pinned: true });
    }
    setMenuOpen(false);
  };

  // Swipe left to reply
  const onTouchMove = (e) => {
    const touch = e.touches[0];
    setSwipeOffset(Math.min(Math.max(touch.clientX - startX.current, -100), 0));
  };
  const startX = useRef(0);
  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = () => {
    if (swipeOffset < -50) setReplyTo(message);
    setSwipeOffset(0);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        transform: `translateX(${swipeOffset}px)`,
        transition: swipeOffset === 0 ? "transform 0.2s ease" : "none",
        position: "relative",
      }}
    >
      {/* Floating reactions bar */}
      {reactionPickerOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            display: "flex",
            background: isDark ? COLORS.darkCard : COLORS.lightCard,
            padding: "4px 8px",
            borderRadius: SPACING.borderRadius,
            gap: 4,
            marginBottom: 4,
            zIndex: 999,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          {QUICK_EMOJIS.map((e) => (
            <span key={e} style={{ fontSize: 22, cursor: "pointer" }} onClick={() => applyReaction(e)}>{e}</span>
          ))}
          <span style={{ fontSize: 22, cursor: "pointer" }} onClick={() => setReactionPickerOpen(false)}>+</span>
        </div>
      )}

      {/* Message bubble */}
      <div
        onClick={() => { setMenuOpen(false); setReactionPickerOpen(false); }}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          cursor: "pointer",
          wordBreak: "break-word",
          position: "relative",
        }}
      >
        {/* Pinned icon */}
        {message.pinned && <div style={{ position: "absolute", top: -12, right: -12 }}>📌</div>}

        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Media */}
        {message.mediaUrl && message.mediaType === "image" && <img src={getCloudinaryUrl(message.mediaUrl, "image")} alt="" style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
        {message.mediaUrl && message.mediaType === "video" && <video src={getCloudinaryUrl(message.mediaUrl, "video")} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
        {message.mediaUrl && message.mediaType === "audio" && <audio src={message.mediaUrl} controls />}
        {message.mediaUrl && message.mediaType === "pdf" && <a href={message.mediaUrl} target="_blank" rel="noreferrer">{message.fileName || "PDF"}</a>}

        {/* Time */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, textAlign: "right", marginTop: 2 }}>
          {fmtTime(message.createdAt)}
        </div>

        {/* Reactions under bubble */}
        {message.reactions && Object.values(message.reactions).length > 0 && (
          <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
            {Object.values(message.reactions).map((r, i) => r && (
              <span key={i} style={{ backgroundColor: COLORS.reactionBg, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 10 }}>
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Inline menu */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: -SPACING.lg,
            right: 0,
            background: COLORS.lightCard,
            border: `1px solid ${COLORS.grayBorder}`,
            borderRadius: SPACING.borderRadius,
            zIndex: 10,
          }}
        >
          <button onClick={() => { setReplyTo(message); setMenuOpen(false); }} style={menuBtn}>Reply</button>
          <button onClick={() => setReactionPickerOpen(true)} style={menuBtn}>React</button>
          <button onClick={togglePin} style={menuBtn}>Pin</button>
          <button onClick={copyMessage} style={menuBtn}>Copy</button>
          <button onClick={deleteMessage} style={menuBtn}>Delete</button>
          <button onClick={() => setMenuOpen(false)} style={menuBtn}>Close</button>
        </div>
      )}
    </div>
  );
}

const menuBtn = {
  padding: 8,
  border: "none",
  background: "transparent",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  fontSize: 14,
};