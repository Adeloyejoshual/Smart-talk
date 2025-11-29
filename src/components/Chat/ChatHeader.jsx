// src/components/Chat/ChatHeader.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { UserContext } from "../../context/UserContext"; // useContext for current user

export default function ChatHeader({ friendId, onClearChat, onSearch, onBlock, onMute }) {
  const navigate = useNavigate();
  const { profilePic } = useContext(UserContext);
  const [friendInfo, setFriendInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // -------------------------------
  // Format last seen
  // -------------------------------
  function formatLastSeen(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isToday) return `Today, ${timeString}`;
    if (isYesterday) return "Yesterday";

    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  // -------------------------------
  // Load friend info
  // -------------------------------
  useEffect(() => {
    if (!friendId) return;

    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });

    return () => unsub();
  }, [friendId]);

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const profileImage = friendInfo?.profilePic || profilePic || null;

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
        zIndex: 20,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
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
          <img src={profileImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

      {/* Three-dot menu (inline SVG) */}
      <div style={{ position: "relative" }}>
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ cursor: "pointer", width: 22, height: 22, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 2 }}
        >
          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "white" }} />
          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "white" }} />
          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "white" }} />
        </div>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 30,
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
            <div style={menuItem} onClick={() => { setMenuOpen(false); onMute(); }}>Mute</div>
            <div style={{ ...menuItem, color: "red" }} onClick={() => { setMenuOpen(false); onBlock(); }}>Block</div>
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