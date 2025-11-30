// src/components/Chat/MessageItem.jsx
import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, deleteDoc, getDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EmojiPicker from "./EmojiPicker";
import { motion, AnimatePresence } from "framer-motion";

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
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥", "👏"];

export default function MessageItem({
  message,
  myUid,
  isDark,
  chatId,
  setReplyTo,
  pinnedMessageId,
  setPinnedMessageId
}) {
  const isMine = message.senderId === myUid;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [reactionFor, setReactionFor] = useState(false);
  const [hovered, setHovered] = useState(false);
  const msgRef = useRef(null);

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
      setShowReactionBar(false);
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

  const togglePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    if (pinnedMessageId === message.id) {
      await updateDoc(chatRef, { pinnedMessageId: "" });
      setPinnedMessageId("");
    } else {
      await updateDoc(chatRef, { pinnedMessageId: message.id });
      setPinnedMessageId(message.id);
    }
    setMenuOpen(false);
  };

  const getCloudinaryUrl = (url, type = "image", width = 300) => {
    if (!url) return "";
    if (!url.includes("res.cloudinary.com")) return url;
    const trans = `c_fill,w_${width},q_auto`;
    return url.replace("/upload/", `/upload/${trans}/`);
  };

  // Auto close reaction bar when clicking outside
  useEffect(() => {
    const close = (e) => {
      if (msgRef.current && !msgRef.current.contains(e.target)) {
        setShowReactionBar(false);
        setReactionFor(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        ref={msgRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
          marginBottom: SPACING.sm,
          position: "relative",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Pinned message label */}
        {pinnedMessageId === message.id && (
          <div style={{ fontSize: 10, color: "#f1c40f", marginBottom: 2 }}>📌 Pinned</div>
        )}

        {/* Message bubble */}
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowReactionBar(true);
          }}
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
          {message.text && <div>{message.text}</div>}

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
              {message.mediaType === "audio" && (
                <audio src={message.mediaUrl} controls />
              )}
              {message.mediaType === "pdf" && (
                <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                  {message.fileName || "PDF Document"}
                </a>
              )}
            </div>
          )}

          {/* Time & status */}
          <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
            {message.edited && "(edited)"} {fmtTime(message.createdAt)} {isMine && message.status ? `• ${message.status}` : ""}
          </div>

          {/* Inline reactions */}
          {Object.keys(message.reactions || {}).length > 0 && (
            <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
              {Object.values(message.reactions).map((r, i) => r && (
                <span key={i} style={{ backgroundColor: COLORS.reactionBg, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 12 }}>
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Floating reaction bar */}
        <AnimatePresence>
          {showReactionBar && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={{
                position: "absolute",
                bottom: "100%",
                display: "flex",
                gap: 6,
                background: isDark ? COLORS.darkCard : COLORS.lightCard,
                padding: 4,
                borderRadius: 20,
                boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                zIndex: 100,
              }}
            >
              {INLINE_REACTIONS.map((e) => (
                <span key={e} style={{ fontSize: 20, cursor: "pointer" }} onClick={() => applyReaction(message.id, e)}>
                  {e}
                </span>
              ))}
              <span style={{ fontSize: 20, cursor: "pointer" }} onClick={() => setReactionFor(true)}>+</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menu options */}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: "absolute",
              top: -SPACING.lg,
              right: 0,
              background: COLORS.lightCard,
              border: `1px solid ${COLORS.grayBorder}`,
              borderRadius: SPACING.borderRadius,
              zIndex: 10,
              width: 120,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
          >
            <button style={menuBtnStyle} onClick={() => setReplyTo(message)}>Reply</button>
            <button style={menuBtnStyle} onClick={togglePin}>{pinnedMessageId === message.id ? "Unpin" : "Pin"}</button>
            <button style={menuBtnStyle} onClick={copyMessageText}>Copy</button>
            {isMine && <button style={menuBtnStyle} onClick={() => deleteMessageForEveryone(message.id)}>Delete</button>}
          </motion.div>
        )}

        {/* Emoji picker */}
        {reactionFor && (
          <EmojiPicker
            onSelect={(e) => applyReaction(message.id, e)}
            onClose={() => setReactionFor(false)}
            position={{ top: -50, left: 0 }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

const menuBtnStyle = {
  padding: 8,
  border: "none",
  background: "transparent",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
};