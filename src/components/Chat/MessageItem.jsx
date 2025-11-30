// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, deleteDoc, getDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EmojiPicker from "./EmojiPicker";

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
const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({ message, myUid, isDark, chatId }) {
  const isMine = message.senderId === myUid;

  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(false);
  const [emojiPosition, setEmojiPosition] = useState({ top: 0, left: 0 });

  const messageRef = useRef(null);

  // -------------------- Format timestamp --------------------
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // -------------------- Cloudinary helper --------------------
  const getCloudinaryUrl = (url, type = "image", width = 300) => {
    if (!url) return "";
    if (!url.includes("res.cloudinary.com")) return url;
    const trans = type === "image" ? `c_fill,w_${width},q_auto` : `c_fill,w_${width},q_auto`;
    return url.replace("/upload/", `/upload/${trans}/`);
  };

  // -------------------- Reactions --------------------
  const applyReaction = async (emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing === emoji ? null : emoji });
      setReactionPicker(false);
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------- Message actions --------------------
  const deleteForEveryone = async () => {
    if (!confirm("Delete for everyone?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
    setMenuOpen(false);
  };

  const deleteForMe = async () => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
      deletedFor: arrayUnion(myUid),
    });
    setMenuOpen(false);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
      alert("Copied");
      setMenuOpen(false);
    } catch {
      alert("Copy failed");
    }
  };

  const pinMessage = async () => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", message.id);
      await updateDoc(mRef, { pinned: true });
      alert("Message pinned");
      setMenuOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------- Long press --------------------
  const handleLongPress = (e) => {
    const rect = messageRef.current?.getBoundingClientRect();
    setEmojiPosition({ top: rect?.top - 50, left: rect?.left || 0 });
    setReactionPicker(true);
  };

  const handleClickOutside = (e) => {
    if (messageRef.current && !messageRef.current.contains(e.target)) {
      setReactionPicker(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -------------------- JSX --------------------
  return (
    <div
      ref={messageRef}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
        maxWidth: "75%",
      }}
    >
      {/* Message content */}
      <div
        style={{
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          wordBreak: "break-word",
          cursor: "pointer",
        }}
      >
        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Media */}
        {message.mediaUrl && (
          <div style={{ marginTop: 4 }}>
            {message.mediaType === "image" && (
              <img
                src={getCloudinaryUrl(message.mediaUrl, "image")}
                alt=""
                style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }}
              />
            )}
            {message.mediaType === "video" && (
              <video
                src={getCloudinaryUrl(message.mediaUrl, "video")}
                controls
                style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }}
              />
            )}
            {message.mediaType === "audio" && <audio src={message.mediaUrl} controls />}
            {message.mediaType === "pdf" && (
              <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                {message.fileName || "PDF Document"}
              </a>
            )}
          </div>
        )}

        {/* Time */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {message.edited && "(edited)"} {fmtTime(message.createdAt)}
        </div>
      </div>

      {/* Floating Emoji + Actions */}
      {reactionPicker && (
        <div
          style={{
            position: "fixed",
            top: emojiPosition.top,
            left: emojiPosition.left,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
            padding: 8,
            zIndex: 2000,
          }}
        >
          {/* Quick reactions */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {QUICK_REACTIONS.map((e) => (
              <span
                key={e}
                style={{ fontSize: 22, cursor: "pointer" }}
                onClick={() => applyReaction(e)}
              >
                {e}
              </span>
            ))}
            <span
              style={{
                fontSize: 18,
                cursor: "pointer",
                padding: "0 6px",
                borderRadius: "50%",
                background: "#eee",
              }}
              onClick={() => {}}
            >
              +
            </span>
          </div>

          {/* Actions below emoji */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button onClick={() => alert("Reply")} style={actionButton}>Reply</button>
            <button onClick={copyText} style={actionButton}>Copy</button>
            <button onClick={pinMessage} style={actionButton}>Pin</button>
            <button onClick={deleteForEveryone} style={actionButton}>Delete</button>
          </div>
        </div>
      )}

      {/* Existing reactions under message */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
          {Object.values(message.reactions)
            .filter(Boolean)
            .map((r, i) => (
              <span
                key={i}
                style={{
                  fontSize: 14,
                  padding: "2px 6px",
                  borderRadius: 10,
                  backgroundColor: COLORS.reactionBg,
                  color: "#fff",
                }}
              >
                {r}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

const actionButton = {
  padding: 6,
  background: "#f0f0f0",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  textAlign: "center",
};