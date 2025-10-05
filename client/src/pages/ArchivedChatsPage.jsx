// /src/pages/ArchivedChatsPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseClient";

export default function ArchivedChatsPage({ onBack, onOpenChat }) {
  const user = auth.currentUser;
  const uid = user?.uid;
  const [archivedChats, setArchivedChats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [menuForChat, setMenuForChat] = useState(null);
  const listRef = useRef(null);

  // Fetch archived chats in real-time
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "chats"),
      where(`archivedBy.${uid}`, "==", true),
      orderBy("lastMessageTime", "desc")
    );
    const unsub = onSnapshot(q, (snap) =>
      setArchivedChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [uid]);

  // Friendly time formatter
  const friendlyTime = (ts) => {
    if (!ts) return "";
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate()
    )
      return "Yesterday";
    return date.toLocaleDateString();
  };

  const toggleSelect = (chatId) => {
    if (!isSelecting) return;
    setSelected((prev) =>
      prev.includes(chatId)
        ? prev.filter((p) => p !== chatId)
        : [...prev, chatId]
    );
  };

  const selectAll = () => {
    if (selected.length === archivedChats.length) setSelected([]);
    else setSelected(archivedChats.map((c) => c.id));
    setMenuForChat(null);
  };

  const unarchiveChat = async (chatId) => {
    if (!uid) return;
    const ref = doc(db, "chats", chatId);
    await updateDoc(ref, {
      [`archivedBy.${uid}`]: null,
      updatedAt: serverTimestamp(),
    });
    setMenuForChat(null);
  };

  const handleUnarchiveSelected = async () => {
    if (!uid || selected.length === 0) return;
    await Promise.all(
      selected.map((id) =>
        updateDoc(doc(db, "chats", id), {
          [`archivedBy.${uid}`]: null,
          updatedAt: serverTimestamp(),
        })
      )
    );
    setSelected([]);
    setIsSelecting(false);
  };

  const handleClearSelected = async () => {
    if (!uid || selected.length === 0) return;
    await Promise.all(
      selected.map((id) =>
        updateDoc(doc(db, "chats", id), {
          [`clearedBy.${uid}`]: serverTimestamp(),
        })
      )
    );
    setSelected([]);
    setIsSelecting(false);
  };

  const menuItem = {
    display: "block",
    padding: "8px 14px",
    border: "none",
    background: "transparent",
    textAlign: "left",
    width: "100%",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: 12,
          borderBottom: "1px solid #eee",
          position: "sticky",
          top: 0,
          background: "#f9f9f9",
          zIndex: 40,
        }}
      >
        {!isSelecting ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button onClick={onBack} style={btnStyle}>
              ← Back
            </button>
            <h3 style={{ margin: 0 }}>Archived Chats</h3>
            <button
              onClick={() => setIsSelecting(true)}
              style={btnStyle}
              disabled={!archivedChats.length}
            >
              Select
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 600 }}>{selected.length} selected</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={selectAll} style={btnStyle}>
                Select All
              </button>
              <button onClick={handleUnarchiveSelected} style={btnStyle}>
                📂 Unarchive
              </button>
              <button onClick={handleClearSelected} style={btnStyle}>
                🧹 Clear
              </button>
              <button
                onClick={() => {
                  setSelected([]);
                  setIsSelecting(false);
                }}
                style={btnStyle}
              >
                ❌
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Archived chat list */}
      <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
        {archivedChats.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#777" }}>
            No archived chats
          </div>
        ) : (
          archivedChats.map((chat) => (
            <motion.div
              key={chat.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (isSelecting) toggleSelect(chat.id);
                else onOpenChat?.(chat);
              }}
              style={{
                padding: 12,
                borderBottom: "1px solid #eee",
                background: selected.includes(chat.id)
                  ? "#eef6ff"
                  : "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {chat.isGroup
                    ? chat.groupName || "Group"
                    : chat.name || "Unknown"}
                </div>
                <div style={{ color: "#666", fontSize: 13 }}>
                  {chat.lastMessage?.text || "No messages"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {friendlyTime(chat.lastMessageTime)}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuForChat(chat);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  ⋮
                </button>
                {menuForChat?.id === chat.id && (
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: 46,
                      background: "#fff",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
                      zIndex: 60,
                    }}
                  >
                    <button
                      onClick={() => unarchiveChat(chat.id)}
                      style={menuItem}
                    >
                      Unarchive
                    </button>
                    <button
                      onClick={() => handleClearSelected([chat.id])}
                      style={menuItem}
                    >
                      Clear Chat
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  background: "transparent",
  border: "none",
  padding: "6px 8px",
  cursor: "pointer",
};