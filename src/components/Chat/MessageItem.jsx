// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, deleteDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  reactionBg: "#111",
  pinnedBg: "#ffeeba",
};

const SPACING = { sm: 8, lg: 14, borderRadius: 12 };
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({
  message,
  myUid,
  isDark,
  chatId,
  pinnedMessageId,
  setPinnedMessageId,
  onReply,
}) {
  const isMine = message.senderId === myUid;
  const [reactionBar, setReactionBar] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const messageRef = useRef(null);
  const startX = useRef(0);
  const isSwiping = useRef(false);

  // -------------------- Helpers --------------------
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const applyReaction = async (emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;

      const existing = snap.data().reactions?.[myUid];
      const newReaction = existing === emoji ? null : emoji;
      await updateDoc(mRef, { [`reactions.${myUid}`]: newReaction });
      setReactionBar(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMessageForMe = async () => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deletedFor: arrayUnion(myUid) });
    setMenuOpen(false);
  };

  const deleteMessageForEveryone = async () => {
    if (!confirm("Delete for everyone?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
    setMenuOpen(false);
  };

  const copyMessageText = async () => {
    try {
      await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
      alert("Copied");
      setMenuOpen(false);
    } catch {
      alert("Copy failed");
    }
  };

  const togglePin = async () => {
    if (pinnedMessageId === message.id) {
      setPinnedMessageId(null);
      await updateDoc(doc(db, "chats", chatId), { pinnedMessage: null });
    } else {
      setPinnedMessageId(message.id);
      await updateDoc(doc(db, "chats", chatId), { pinnedMessage: message.id });
    }
    setMenuOpen(false);
  };

  // -------------------- Long press for reactions --------------------
  const handleLongPress = () => setReactionBar(true);

  // -------------------- Swipe-to-reply --------------------
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    isSwiping.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isSwiping.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if (!isMine && dx < 0) setSwipeOffset(Math.min(0, dx)); // left swipe only
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;
    if (swipeOffset < -50) onReply?.(message); // trigger reply
    setSwipeOffset(0);
    isSwiping.current = false;
  };

  // Close reactions bar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (messageRef.current && !messageRef.current.contains(e.target)) {
        setReactionBar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -------------------- JSX --------------------
  return (
    <div
      ref={messageRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
        transition: "all 0.3s ease",
        transform: `translateX(${swipeOffset}px)`,
        opacity: message.deletedFor?.includes(myUid) ? 0.4 : 1,
      }}
      onContextMenu={(e) => { e.preventDefault(); handleLongPress(); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating Reactions Bar */}
      {reactionBar && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 6,
            background: "#fff",
            borderRadius: 30,
            padding: "4px 6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 1000,
          }}
        >
          {INLINE_REACTIONS.map((e) => (
            <span
              key={e}
              style={{ fontSize: 22, cursor: "pointer" }}
              onClick={() => applyReaction(e)}
            >
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Message Bubble */}
      <div
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: pinnedMessageId === message.id
            ? COLORS.pinnedBg
            : isMine
            ? COLORS.primary
            : isDark
            ? COLORS.darkCard
            : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          cursor: "pointer",
          wordBreak: "break-word",
          transition: "all 0.3s ease",
        }}
        onClick={() => setReactionBar(false)}
      >
        {message.text}
        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {fmtTime(message.createdAt)} {isMine && message.status ? `• ${message.status}` : ""}
        </div>

        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
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
            display: "flex",
            flexDirection: "column",
          }}
        >
          <button style={menuBtn} onClick={copyMessageText}>Copy</button>
          <button style={menuBtn} onClick={togglePin}>{pinnedMessageId === message.id ? "Unpin" : "Pin"}</button>
          {isMine && <button style={menuBtn} onClick={deleteMessageForEveryone}>Delete for Everyone</button>}
          <button style={menuBtn} onClick={deleteMessageForMe}>Delete for Me</button>
          <button style={menuBtn} onClick={() => setMenuOpen(false)}>Close</button>
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
};