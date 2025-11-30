// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import EmojiPicker from "./EmojiPicker";

const QUICK = ["💝","💟","💟","❣️","😝"];

export default function MessageItem({ message, myUid, chatId, isDark, pinnedMessageId, setPinnedMessageId }) {
  const isMine = message.senderId === myUid;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [reactions, setReactions] = useState(message.reactions || {});
  const [animatingDelete, setAnimatingDelete] = useState(false);
  const messageRef = useRef(null);

  // ---------------- Apply reaction ----------------
  const applyReaction = async (emoji) => {
    const mRef = doc(db, "chats", chatId, "messages", message.id);
    const current = reactions[myUid];
    const newValue = current === emoji ? null : emoji;

    try {
      await updateDoc(mRef, { [`reactions.${myUid}`]: newValue });
      setReactions(prev => ({ ...prev, [myUid]: newValue }));
      setShowEmojiPicker(false);
      setMenuOpen(false);
    } catch (e) { console.error(e); }
  };

  // ---------------- Pin message ----------------
  const pinMessage = async () => {
    try {
      await updateDoc(doc(db, "chats", chatId), { pinnedMessage: message.id });
      setPinnedMessageId(message.id);
      setMenuOpen(false);
    } catch(e) { console.error(e); }
  };

  // ---------------- Delete message ----------------
  const deleteMessage = async () => {
    if(!window.confirm("Delete this message?")) return;
    setAnimatingDelete(true);
    setTimeout(async () => {
      await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
    }, 300); // wait for animation
  };

  // ---------------- Copy message ----------------
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.text || "");
      alert("Copied");
      setMenuOpen(false);
    } catch { alert("Failed to copy"); }
  };

  // ---------------- Long press (mouse & touch) ----------------
  let timer = null;
  const handlePressStart = (e) => {
    e.preventDefault();
    timer = setTimeout(() => {
      const rect = messageRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.top - 80, left: rect.left });
      setMenuOpen(true);
    }, 500);
  };
  const handlePressEnd = () => clearTimeout(timer);

  // ---------------- Close menu when clicking outside ----------------
  useEffect(() => {
    const close = (e) => {
      if (messageRef.current && !messageRef.current.contains(e.target)) {
        setMenuOpen(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, []);

  // ---------------- Styles ----------------
  const bubbleStyles = {
    maxWidth: "70%",
    padding: 10,
    borderRadius: 12,
    backgroundColor: isMine ? "#34B7F1" : isDark ? "#1b1b1b" : "#fff",
    color: isMine ? "#fff" : isDark ? "#fff" : "#000",
    cursor: "pointer",
    wordBreak: "break-word",
    transition: "transform 0.3s ease, opacity 0.3s ease",
    transform: animatingDelete ? "translateX(-100%)" : "translateX(0)",
    opacity: animatingDelete ? 0 : 1,
  };

  const menuBtn = {
    padding: 6,
    border: "none",
    background: "#eee",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 14,
  };

  return (
    <div
      ref={messageRef}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 10,
        position: "relative",
      }}
    >
      {/* Message bubble */}
      <div style={bubbleStyles}>
        {message.text}

        {/* Current reactions under bubble */}
        {Object.values(reactions).filter(Boolean).length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {Object.values(reactions).filter(Boolean).map((r, i) => (
              <span key={i} style={{ fontSize: 14 }}>{r}</span>
            ))}
          </div>
        )}

        {/* Pinned badge */}
        {pinnedMessageId === message.id && (
          <div style={{ fontSize: 12, color: "#f39c12", marginTop: 4 }}>📌 Pinned</div>
        )}
      </div>

      {/* Long press menu */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: menuPosition.top,
            left: menuPosition.left,
            background: "#fff",
            borderRadius: 12,
            padding: 8,
            boxShadow: "0 6px 15px rgba(0,0,0,0.25)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 200,
          }}
        >
          {/* Reaction bar above actions */}
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {QUICK.map(e => (
              <span key={e} style={{ fontSize: 22, cursor: "pointer" }} onClick={() => applyReaction(e)}>
                {e}
              </span>
            ))}
            <span style={{ fontSize: 20, cursor: "pointer" }} onClick={() => setShowEmojiPicker(true)}>+</span>
          </div>

          {/* Actions under reactions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button style={menuBtn} onClick={copyMessage}>Copy</button>
            <button style={menuBtn} onClick={pinMessage}>Pin</button>
            <button style={menuBtn} onClick={deleteMessage}>Delete</button>
          </div>

          {/* Emoji picker */}
          {showEmojiPicker && (
            <EmojiPicker
              position={{ top: -250, left: 0 }}
              onSelect={applyReaction}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}