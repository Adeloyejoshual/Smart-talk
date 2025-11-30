// src/components/Chat/ChatHeader.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { UserContext } from "../../context/UserContext";
import { FiMoreVertical } from "react-icons/fi";

export default function ChatHeader({ friendId, chatId, onClearChat, onSearch }) {
  const navigate = useNavigate();
  const { profilePic: myProfilePic } = useContext(UserContext);
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // -------------------- Click outside to close menu --------------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -------------------- Load friend info --------------------
  useEffect(() => {
    if (!friendId) return;
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });
    return () => unsub();
  }, [friendId]);

  // -------------------- Load chat info (for block/mute) --------------------
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (snap.exists()) setChatInfo(snap.data());
    });
    return () => unsub();
  }, [chatId]);

  const toggleBlock = async () => {
    if (!chatInfo) return;
    const blocked = chatInfo.blocked || false;
    await updateDoc(doc(db, "chats", chatId), { blocked: !blocked });
    setMenuOpen(false);
  };

  const toggleMute = async () => {
    if (!chatInfo) return;
    const muted = chatInfo.mutedUntil && chatInfo.mutedUntil > new Date().getTime();
    await updateDoc(doc(db, "chats", chatId), {
      mutedUntil: muted ? 0 : new Date().getTime() + 24 * 60 * 60 * 1000, // mute 24h
    });
    setMenuOpen(false);
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const profileImage = friendInfo?.profilePic || null;

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (date.toDateString() === now.toDateString()) return `Today, ${timeString}`;
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  };

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#0d6efd",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 30,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      {/* Back arrow */}
      <div
        onClick={() => navigate("/chat")}
        style={{
          width: 32,
          height: 32,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          marginRight: 8,
          color: "white",
          fontSize: 20,
          fontWeight: "bold",
        }}
      >
        ←
      </div>

      {/* Profile picture / initials */}
      <div
        onClick={() => navigate(`/friend/${friendId}`)}
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          backgroundColor: "#e0e0e0",
          overflow: "hidden",
          marginRight: 10,
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontWeight: "500",
          fontSize: 16,
          color: "#333",
        }}
      >
        {profileImage ? (
          <img
            src={profileImage}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          getInitials(friendInfo?.name)
        )}
      </div>

      {/* Name + status */}
      <div onClick={() => navigate(`/friend/${friendId}`)} style={{ flex: 1, color: "white", cursor: "pointer" }}>
        <div style={{ fontSize: 16, fontWeight: "600" }}>{friendInfo?.name || "Loading..."}</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          {friendInfo?.isOnline ? "Online" : formatLastSeen(friendInfo?.lastSeen)}
        </div>
      </div>

      {/* Three-dot menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <FiMoreVertical
          onClick={() => setMenuOpen(!menuOpen)}
          size={22}
          color="white"
          style={{ cursor: "pointer" }}
        />

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 28,
              right: 0,
              background: "white",
              borderRadius: 6,
              padding: "8px 0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              width: 160,
            }}
          >
            <div style={menuItem} onClick={() => { setMenuOpen(false); onSearch(); }}>Search</div>
            <div style={menuItem} onClick={() => { setMenuOpen(false); onClearChat(); }}>Clear Chat</div>
            <div style={menuItem} onClick={toggleMute}>
              {chatInfo?.mutedUntil && chatInfo.mutedUntil > new Date().getTime() ? "Unmute" : "Mute"}
            </div>
            <div style={{ ...menuItem, color: "red" }} onClick={toggleBlock}>
              {chatInfo?.blocked ? "Unblock" : "Block"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const menuItem = {
  padding: "10px 15px",
  cursor: "pointer",
  fontSize: 14,
  color: "#333",
};