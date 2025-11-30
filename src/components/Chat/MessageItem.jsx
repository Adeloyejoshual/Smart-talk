// src/components/Chat/MessageItem.jsx
import React, { useState, useRef } from "react";
import { doc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EmojiPicker from "./EmojiPicker";

const COLORS = { primary: "#34B7F1", lightCard: "#fff", darkCard: "#1b1b1b", darkText: "#fff", mutedText: "#888", grayBorder: "rgba(0,0,0,0.06)", edited: "#999", reactionBg: "#111" };
const SPACING = { sm: 8, lg: 14, borderRadius: 12 };
const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({ message, myUid, isDark, chatId, setReplyTo, pinnedMessage, setPinnedMessage }) {
  const isMine = message.senderId === myUid;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });

  const containerRef = useRef(null);

  const fmtTime = (ts) => ts?.toDate ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  const togglePin = async () => {
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const newPin = !message.pinned;
    await updateDoc(msgRef, { pinned: newPin });
    if (newPin) setPinnedMessage(message);
    else setPinnedMessage(null);
  };

  const deleteMessage = async () => {
    if (!confirm("Delete this message?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
    alert("Copied!");
  };

  const openReactions = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    setEmojiPos({ top: rect.top - 50, left: rect.left + rect.width / 2 });
    setShowReactions(true);
  };

  const applyReaction = async (emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    await updateDoc(msgRef, { [`reactions.${myUid}`]: emoji });
    setShowReactions(false);
  };

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: SPACING.sm, position: "relative" }}>
      {/* Message bubble */}
      <div
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
        onLongPress={openReactions}
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          cursor: "pointer",
          wordBreak: "break-word",
        }}
      >
        {message.text && <div>{message.text}</div>}
        {message.mediaUrl && message.mediaType === "image" && <img src={message.mediaUrl} style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
        {message.mediaUrl && message.mediaType === "video" && <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
        {message.mediaUrl && message.mediaType === "audio" && <audio src={message.mediaUrl} controls />}
        {message.mediaUrl && message.mediaType === "file" && <a href={message.mediaUrl} target="_blank" rel="noreferrer">{message.fileName || "File"}</a>}

        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>{fmtTime(message.createdAt)}</div>

        {/* Show reactions */}
        {message.reactions && Object.values(message.reactions).filter(Boolean).length > 0 && (
          <div style={{ display: "flex", gap: 2, marginTop: 4 }}>{Object.values(message.reactions).filter(Boolean).map((r, i) => <span key={i} style={{ backgroundColor: COLORS.reactionBg, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 10 }}>{r}</span>)}</div>
        )}
      </div>

      {/* Context menu */}
      {menuOpen && (
        <div style={{ position: "absolute", top: -SPACING.lg, right: 0, background: COLORS.lightCard, border: `1px solid ${COLORS.grayBorder}`, borderRadius: SPACING.borderRadius, zIndex: 10 }}>
          <button style={{ padding: 8, width: "100%", textAlign: "left" }} onClick={() => { setReplyTo(message); setMenuOpen(false); }}>Reply</button>
          <button style={{ padding: 8, width: "100%", textAlign: "left" }} onClick={copyMessage}>Copy</button>
          <button style={{ padding: 8, width: "100%", textAlign: "left" }} onClick={togglePin}>{message.pinned ? "Unpin" : "Pin"}</button>
          {isMine && <button style={{ padding: 8, width: "100%", textAlign: "left" }} onClick={deleteMessage}>Delete</button>}
          <button style={{ padding: 8, width: "100%", textAlign: "left" }} onClick={() => setMenuOpen(false)}>Close</button>
        </div>
      )}

      {/* Emoji picker */}
      {showReactions && <EmojiPicker onSelect={applyReaction} onClose={() => setShowReactions(false)} position={emojiPos} />}
    </div>
  );
}