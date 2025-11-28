// src/components/Chat/ChatHeader.jsx
import React, { useState, useEffect } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft, HiDotsVertical } from "react-icons/hi";

export default function ChatHeader({ chatInfo, friendInfo, myUid }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

  // ---------------------------------
  // Load pinned & blocked status
  // ---------------------------------
  useEffect(() => {
    if (!chatInfo?.id) return;

    const unsub = onSnapshot(doc(db, "chats", chatInfo.id), (s) => {
      if (!s.exists()) return;
      const data = s.data();

      // ONLY ONE PIN: If an array exists, take only the LAST PINNED ITEM
      if (Array.isArray(data.pinnedMessages) && data.pinnedMessages.length > 0) {
        setPinned(data.pinnedMessages[data.pinnedMessages.length - 1]);
      } else {
        setPinned(null);
      }

      setIsBlocked(data.blockedBy?.includes(myUid) || false);
    });

    return () => unsub();
  }, [chatInfo?.id, myUid]);

  // ---------------------------------
  // Pin a message (ONLY ONE ALLOWED)
  // ---------------------------------
  const handlePin = async () => {
    if (!chatInfo?.id) return;

    // ONLY allow 1 pin:
    await updateDoc(doc(db, "chats", chatInfo.id), {
      pinnedMessages: pinned ? [pinned] : [], // ensures only ONE stays
    });
  };

  // ---------------------------------
  // Unpin message
  // ---------------------------------
  const handleUnpin = async () => {
    if (!chatInfo?.id) return;

    await updateDoc(doc(db, "chats", chatInfo.id), {
      pinnedMessages: [],
    });
  };

  // ---------------------------------
  // Block / Unblock
  // ---------------------------------
  const toggleBlock = async () => {
    if (!chatInfo?.id) return;

    const chatRef = doc(db, "chats", chatInfo.id);

    if (isBlocked) {
      // Unblock
      await updateDoc(chatRef, {
        blockedBy: [],
      });
    } else {
      // Block
      await updateDoc(chatRef, {
        blockedBy: [myUid],
      });
    }
  };

  return (
    <div
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        padding: "0 15px",
        background: "#111",
        color: "white",
        position: "relative",
      }}
    >
      <HiArrowLeft
        size={26}
        style={{ cursor: "pointer" }}
        onClick={() => navigate(-1)}
      />

      <div style={{ marginLeft: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {friendInfo?.username || "Chat"}
        </div>
      </div>

      <div style={{ marginLeft: "auto", cursor: "pointer" }}>
        <HiDotsVertical size={24} onClick={() => setMenuOpen(!menuOpen)} />
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: 58,
            right: 10,
            background: "#222",
            padding: "10px 15px",
            borderRadius: 10,
            width: 150,
            zIndex: 50,
          }}
        >
          {pinned ? (
            <div
              style={{ padding: "8px 0", cursor: "pointer" }}
              onClick={handleUnpin}
            >
              Unpin Message
            </div>
          ) : (
            <div
              style={{ padding: "8px 0", cursor: "pointer" }}
              onClick={handlePin}
            >
              Pin Message
            </div>
          )}

          <div
            style={{ padding: "8px 0", cursor: "pointer", marginTop: 5 }}
            onClick={toggleBlock}
          >
            {isBlocked ? "Unblock User" : "Block User"}
          </div>
        </div>
      )}

      {/* Pinned message preview (ONLY ONE) */}
      {pinned && (
        <div
          style={{
            position: "absolute",
            bottom: -28,
            left: 0,
            width: "100%",
            background: "#1f1f1f",
            color: "#ddd",
            padding: "6px 10px",
            fontSize: 12,
            borderBottom: "1px solid #333",
          }}
        >
          📌 {pinned.text || "[Media Message]"}
        </div>
      )}
    </div>
  );
}