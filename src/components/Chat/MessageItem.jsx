// src/components/Chat/MessageItem.jsx
import React, { useState } from "react";
import { doc, updateDoc, deleteDoc, getDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";

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

const SPACING = { sm: 8, lg: 14, borderRadius: 12 };

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({ message, myUid, isDark, replyTo, setReplyTo, chatId }) {
  const isMine = message.senderId === myUid;
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionFor, setReactionFor] = useState(false);

  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing === emoji ? null : emoji });
      setReactionFor(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMessageForEveryone = async (id) => {
    if (!confirm("Delete for everyone?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", id));
    setMenuOpen(false);
  };

  const deleteMessageForMe = async (id) => {
    await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) });
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
      }}
    >
      <div
        onClick={() => setMenuOpen(!menuOpen)}
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
        {/* Reply preview */}
        {message.replyTo && (
          <div
            style={{
              fontSize: 12,
              color: COLORS.edited,
              borderLeft: `3px solid ${COLORS.mutedText}`,
              paddingLeft: 4,
              marginBottom: 4,
            }}
          >
            {message.replyTo.text || message.replyTo.mediaType}
          </div>
        )}

        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Media */}
        {message.mediaUrl && (
          <div style={{ marginTop: 4 }}>
            {message.mediaType === "image" && (
              <img src={message.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
            )}
            {message.mediaType === "video" && (
              <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
            )}
            {message.mediaType === "audio" && <audio src={message.mediaUrl} controls />}
            {message.mediaType === "pdf" && (
              <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                {message.fileName || "PDF Document"}
              </a>
            )}
          </div>
        )}

        {/* Time and status */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {message.edited && "(edited)"} {fmtTime(message.createdAt)} {isMine && message.status ? `• ${message.status}` : ""}
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
          <button style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }} onClick={() => setReplyTo(message)}>Reply</button>
          <button style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }} onClick={() => setReactionFor(true)}>React</button>
          {isMine && <button style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }} onClick={() => deleteMessageForEveryone(message.id)}>Delete for Everyone</button>}
          <button style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }} onClick={() => deleteMessageForMe(message.id)}>Delete for Me</button>
          <button style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }} onClick={copyMessageText}>Copy</button>
          <button style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }} onClick={() => setMenuOpen(false)}>Close</button>
        </div>
      )}

      {/* Reaction picker */}
      {reactionFor && (
        <div
          style={{
            position: "absolute",
            bottom: -28,
            left: 0,
            display: "flex",
            gap: 4,
            background: COLORS.lightCard,
            borderRadius: SPACING.borderRadius,
            padding: "2px 4px",
          }}
        >
          {INLINE_REACTIONS.map((r, i) => (
            <span key={i} style={{ cursor: "pointer", fontSize: 14 }} onClick={() => applyReaction(message.id, r)}>
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}