// src/components/Chat/ChatHeader.jsx
import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";
import { UserContext } from "../../context/UserContext"; // for Cloudinary

export default function ChatHeader({ chatInfo, friendInfo, myUid, onPinMessage, pinnedMessage, onGoToPinned, onUnpin }) {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  if (!friendInfo) return null;

  // -----------------------------
  // Format last seen
  // -----------------------------
  const formatLastSeen = (ts) => {
    if (!ts) return "Offline";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (d.toDateString() === now.toDateString()) return `Last seen today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (d.toDateString() === yesterday.toDateString()) return `Last seen yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const options = { month: "short", day: "numeric" };
    if (d.getFullYear() !== now.getFullYear()) options.year = "numeric";
    return `Last seen ${d.toLocaleDateString(undefined, options)}`;
  };

  const profilePicUrl = friendInfo.photoURL
    ? `${friendInfo.photoURL}` // already uploaded via Cloudinary
    : null;

  // -----------------------------
  // Menu actions
  // -----------------------------
  const handleMenuClick = (action) => {
    switch (action) {
      case "clear":
        // Implement clear chat logic here
        alert("Clear chat clicked");
        break;
      case "search":
        // Implement search
        alert("Search clicked");
        break;
      case "block":
        alert("Block clicked");
        break;
      case "mute":
        alert("Mute clicked");
        break;
      default:
        break;
    }
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        backgroundColor: "#0d6efd", // Bootstrap blue
        color: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        cursor: "pointer"
      }}
      onClick={() => navigate("/friend-profile/" + friendInfo.id)}
    >
      {/* Profile */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {profilePicUrl ? (
          <img
            src={profilePicUrl}
            alt={friendInfo.displayName || "User"}
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", marginRight: 12 }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "#6c757d",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              marginRight: 12,
              textTransform: "uppercase",
            }}
          >
            {friendInfo.displayName ? friendInfo.displayName[0] : "U"}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{friendInfo.displayName || "Unknown"}</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>{formatLastSeen(friendInfo.lastSeen)}</span>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Pinned message shortcut */}
      {pinnedMessage && (
        <button
          onClick={(e) => { e.stopPropagation(); onGoToPinned(); }}
          style={{
            backgroundColor: "#fff",
            color: "#0d6efd",
            border: "none",
            borderRadius: 20,
            padding: "2px 10px",
            fontSize: 12,
            marginRight: 8,
            cursor: "pointer"
          }}
        >
          Pinned
        </button>
      )}

      {/* 3-dot menu */}
      <div style={{ position: "relative" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const menu = document.getElementById("chat-menu");
            if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: 20,
            cursor: "pointer",
          }}
        >
          ⋮
        </button>
        <div
          id="chat-menu"
          style={{
            display: "none",
            position: "absolute",
            right: 0,
            top: "100%",
            background: "#fff",
            color: "#000",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            overflow: "hidden",
            minWidth: 140,
          }}
        >
          {["Clear Chat", "Search", "Block", "Mute"].map((item) => (
            <div
              key={item}
              onClick={() => handleMenuClick(item.toLowerCase().replace(" ", ""))}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
                fontSize: 14,
                fontWeight: 500
              }}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f1f1f1"}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}