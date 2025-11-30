// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EmojiPicker from "./EmojiPicker";

const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  edited: "#999",
  reactionBg: "#111",
};

export default function MessageItem({ message, myUid, isDark, chatId, onPin }) {
  const isMine = message.senderId === myUid;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionPos, setReactionPos] = useState("top"); // top or bottom
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const msgRef = useRef(null);
  const pressTimer = useRef(null);

  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  // -------------------- Long press detection --------------------
  const onLongPressStart = () => {
    pressTimer.current = setTimeout(() => {
      if (msgRef.current) {
        const rect = msgRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        setReactionPos(rect.top > 60 ? "top" : "bottom");
      }
      setShowReactions(true);
    }, 500);
  };
  const onLongPressEnd = () => clearTimeout(pressTimer.current);

  // -------------------- Reactions --------------------
  const applyReaction = async (emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      const existing = message.reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing === emoji ? null : emoji });
      setShowReactions(false);
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------- Message actions --------------------
  const deleteMessageForEveryone = async () => {
    if (!confirm("Delete for everyone?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
  };
  const deleteMessageForMe = async () => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deletedFor: arrayUnion(myUid) });
  };
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
      alert("Copied");
    } catch {
      alert("Copy failed");
    }
  };
  const pinMessage = () => {
    onPin?.(message);
    setMenuOpen(false);
  };

  // -------------------- JSX --------------------
  return (
    <div
      ref={msgRef}
      onMouseDown={onLongPressStart}
      onTouchStart={onLongPressStart}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
      onTouchEnd={onLongPressEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 10,
        position: "relative",
        transition: "all 0.2s ease",
      }}
    >
      {/* Reaction bar */}
      {showReactions && (
        <div
          style={{
            position: "absolute",
            [reactionPos === "top" ? "bottom" : "top"]: "100%",
            display: "flex",
            gap: 6,
            background: "#fff",
            borderRadius: 16,
            padding: "4px 6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            zIndex: 50,
            flexWrap: "wrap",
            minWidth: 120,
          }}
        >
          {QUICK_REACTIONS.map((r) => (
            <span key={r} style={{ fontSize: 22, cursor: "pointer" }} onClick={() => applyReaction(r)}>
              {r}
            </span>
          ))}
          <span style={{ cursor: "pointer", fontSize: 22 }} onClick={() => setEmojiPickerOpen(true)}>+</span>

          {/* Actions under reactions */}
          <button onClick={() => copyMessage()} style={actionBtn}>Copy</button>
          <button onClick={() => pinMessage()} style={actionBtn}>Pin</button>
          <button onClick={() => deleteMessageForMe()} style={actionBtn}>Delete</button>
        </div>
      )}

      {/* Full emoji picker */}
      {emojiPickerOpen && (
        <EmojiPicker
          onSelect={(e) => { applyReaction(e); setEmojiPickerOpen(false); }}
          onClose={() => setEmojiPickerOpen(false)}
          position={{ top: 0, left: 0 }}
        />
      )}

      {/* Message bubble */}
      <div
        style={{
          maxWidth: "70%",
          padding: 10,
          borderRadius: 12,
          backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          cursor: "pointer",
          wordBreak: "break-word",
        }}
      >
        {message.text && <div>{message.text}</div>}
        <div style={{ fontSize: 10, color: COLORS.mutedText, textAlign: "right", marginTop: 2 }}>
          {fmtTime(message.createdAt)} {isMine && message.status ? `• ${message.status}` : ""}
        </div>
        {/* Reactions under message */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {Object.values(message.reactions).map((r, i) => r && (
              <span key={i} style={{ background: COLORS.reactionBg, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 10 }}>
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const actionBtn = {
  padding: "2px 6px",
  fontSize: 12,
  cursor: "pointer",
  border: "none",
  background: "#eee",
  borderRadius: 6,
};