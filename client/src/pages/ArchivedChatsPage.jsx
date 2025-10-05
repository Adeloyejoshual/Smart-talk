import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebaseClient";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

export default function ArchivedChatsPage({ onBack }) {
  const [archived, setArchived] = useState([]);
  const [selected, setSelected] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const longPressTimer = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, "chats"),
      where("archived", "==", true),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) =>
      setArchived(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // 🧠 Handle select/unselect chat
  const handleSelect = (id) => {
    if (!isSelecting) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // 🕒 Long press starts selection mode
  const handleLongPressStart = (id) => {
    longPressTimer.current = setTimeout(() => {
      setIsSelecting(true);
      setSelected([id]);
      navigator.vibrate?.(30); // subtle vibration feedback (optional)
    }, 400);
  };

  const handleLongPressEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleSelectAll = () => {
    if (selected.length === archived.length) setSelected([]);
    else setSelected(archived.map((c) => c.id));
    setMenuOpen(false);
  };

  const handleUnarchiveSelected = async () => {
    if (selected.length === 0) return alert("No chat selected.");
    for (const id of selected) {
      await updateDoc(doc(db, "chats", id), { archived: false });
    }
    setSelected([]);
    setIsSelecting(false);
    setMenuOpen(false);
  };

  const handleCancelSelection = () => {
    setSelected([]);
    setIsSelecting(false);
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header or Selection Bar */}
      {!isSelecting ? (
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid #eee",
            position: "sticky",
            top: 0,
            background: "#f9f9f9",
            zIndex: 10,
          }}
        >
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <h4 style={{ margin: 0 }}>Archived Chats</h4>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ⋮
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                <button onClick={handleSelectAll} style={menuItemStyle}>
                  Select All
                </button>
              </div>
            )}
          </div>
        </header>
      ) : (
        /* Selection Toolbar */
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            background: "#e9f3ff",
            borderBottom: "1px solid #ccc",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {selected.length} selected
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSelectAll} style={actionButtonStyle}>
              ✅
            </button>
            <button onClick={handleUnarchiveSelected} style={actionButtonStyle}>
              🗂️
            </button>
            <button onClick={handleCancelSelection} style={actionButtonStyle}>
              ❌
            </button>
          </div>
        </div>
      )}

      {/* Chat List */}
      <div style={{ flex: 1 }}>
        {archived.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "#777",
              fontSize: 15,
            }}
          >
            No archived chats 📭
          </div>
        ) : (
          <AnimatePresence>
            {archived.map((chat) => (
              <motion.div
                key={chat.id}
                layout
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                whileTap={{ scale: 0.98 }}
                onTouchStart={() => handleLongPressStart(chat.id)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(chat.id)}
                onMouseUp={handleLongPressEnd}
                onClick={() => handleSelect(chat.id)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: selected.includes(chat.id)
                    ? "#e7f1ff"
                    : "#fff",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{chat.name}</div>
                  <small style={{ color: "#666" }}>
                    {chat.lastMessage || "No messages"}
                  </small>
                </div>
                <small style={{ color: "#999" }}>
                  {new Date(
                    chat.updatedAt?.toDate?.() || chat.updatedAt
                  ).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

const menuItemStyle = {
  background: "transparent",
  border: "none",
  padding: "10px 16px",
  textAlign: "left",
  width: "100%",
  cursor: "pointer",
  fontSize: 14,
};

const actionButtonStyle = {
  background: "transparent",
  border: "none",
  fontSize: 18,
  cursor: "pointer",
};