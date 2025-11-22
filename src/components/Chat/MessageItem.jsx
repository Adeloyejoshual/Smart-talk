// src/components/Chat/MessageItem.jsx
import React, { useState } from "react";
import { doc, updateDoc, deleteDoc, arrayUnion, getDoc } from "firebase/firestore";
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

const SPACING = { sm: 8, md: 12, borderRadius: 12 };
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({ message, myUid, chatId, onReply, onPin, onForward, uploadingPct }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionFor, setReactionFor] = useState(false);

  const isMine = message.senderId === myUid;

  // -------------------- Actions --------------------
  const applyReaction = async (emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing === emoji ? null : emoji });
      setReactionFor(false);
    } catch (e) {
      console.error(e);
    }
  };

  const editMessage = async () => {
    if (!isMine) return alert("You can only edit your messages.");
    const newText = window.prompt("Edit message", message.text || "");
    if (newText == null) return;
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { text: newText, edited: true });
    setMenuOpen(false);
  };

  const deleteForEveryone = async () => {
    if (!isMine) return alert("You can only delete your messages for everyone.");
    if (!confirm("Delete for everyone?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
    setMenuOpen(false);
  };

  const deleteForMe = async () => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deletedFor: arrayUnion(myUid) });
    setMenuOpen(false);
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
      alert("Copied!");
      setMenuOpen(false);
    } catch (e) {
      alert("Copy failed");
    }
  };

  const toggleReactionPicker = () => setReactionFor(!reactionFor);

  // -------------------- Render --------------------
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
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : COLORS.lightCard,
          color: isMine ? "#fff" : COLORS.lightText,
          wordBreak: "break-word",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => setMenuOpen(!menuOpen)}
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
                {message.fileName || "File"}
              </a>
            )}
            {message.mediaType && !["image","video","audio","pdf"].includes(message.mediaType) && (
              <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                {message.fileName || "File"}
              </a>
            )}
          </div>
        )}

        {/* Upload progress */}
        {uploadingPct != null && (
          <div style={{ marginTop: 4, fontSize: 10, color: COLORS.mutedText }}>Uploading: {uploadingPct}%</div>
        )}

        {/* Time & status */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {message.edited && "(edited)"} {isMine && message.status ? `• ${message.status}` : ""}
        </div>

        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div style={{ position: "absolute", bottom: -12, right: -12, display: "flex", gap: 2 }}>
            {Object.values(message.reactions).map((r, i) => r && (
              <span
                key={i}
                style={{ backgroundColor: COLORS.reactionBg, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 10 }}
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Message menu */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: -SPACING.md * 3,
            right: 0,
            background: COLORS.lightCard,
            border: `1px solid ${COLORS.grayBorder}`,
            borderRadius: SPACING.borderRadius,
            zIndex: 10,
          }}
        >
          <button onClick={() => onReply(message)} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Reply</button>
          <button onClick={toggleReactionPicker} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>React</button>
          {isMine && <button onClick={editMessage} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Edit</button>}
          {isMine && <button onClick={deleteForEveryone} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Delete for Everyone</button>}
          <button onClick={deleteForMe} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Delete for Me</button>
          <button onClick={() => onForward(message)} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Forward</button>
          <button onClick={() => onPin(message)} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Pin</button>
          <button onClick={copyMessage} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Copy</button>
          <button onClick={() => setMenuOpen(false)} style={{ padding: 6, width: "100%", border: "none", background: "transparent", cursor: "pointer" }}>Close</button>
        </div>
      )}

      {/* Inline reactions picker */}
      {reactionFor && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          {INLINE_REACTIONS.map((r, i) => (
            <span key={i} style={{ cursor: "pointer", fontSize: 14 }} onClick={() => applyReaction(r)}>
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
      }
