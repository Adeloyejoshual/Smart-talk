// src/components/Chat/MessageItem.jsx
import React, { useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const COLORS = {
  primary: "#34B7F1",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  darkText: "#fff",
  lightText: "#000",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  edited: "#999",
  reactionBg: "#111",
};

const SPACING = { sm: 8, borderRadius: 12 };

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({ message, myUid, chatId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionFor, setReactionFor] = useState(false);

  const isMine = message.senderId === myUid;

  const applyReaction = async (emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      const existing = message.reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing === emoji ? null : emoji });
      setReactionFor(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMessageForMe = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deletedFor: [myUid] });
      setMenuOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: SPACING.sm, position: "relative" }}>
      
      <div
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : COLORS.lightCard,
          color: isMine ? "#fff" : COLORS.lightText,
          wordBreak: "break-word",
          cursor: "pointer",
        }}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Media */}
        {message.mediaUrl && (
          <div style={{ marginTop: 4 }}>
            {message.mediaType === "image" && <img src={message.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
            {message.mediaType === "video" && <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
            {message.mediaType === "audio" && <audio src={message.mediaUrl} controls />}
            {message.mediaType === "pdf" && <a href={message.mediaUrl} target="_blank" rel="noreferrer">{message.fileName || "PDF Document"}</a>}
          </div>
        )}

        {/* Time and status */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {message.edited && "(edited)"} {message.status && isMine ? `• ${message.status}` : ""}
        </div>

        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div style={{ position: "absolute", bottom: -12, right: -12, display: "flex", gap: 2 }}>
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
        <div style={{ position: "absolute", top: -36, right: 0, background: COLORS.lightCard, border: `1px solid ${COLORS.grayBorder}`, borderRadius: SPACING.borderRadius, zIndex: 10 }}>
          <button style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }} onClick={() => setReactionFor(true)}>React</button>
          <button style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }} onClick={deleteMessageForMe}>Delete for Me</button>
          <button style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }} onClick={() => setMenuOpen(false)}>Close</button>
        </div>
      )}

      {/* Inline reaction picker */}
      {reactionFor && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          {INLINE_REACTIONS.map((r, i) => (
            <span key={i} style={{ cursor: "pointer", fontSize: 14 }} onClick={() => applyReaction(r)}>{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}