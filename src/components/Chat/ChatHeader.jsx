// src/components/Chat/ChatHeader.jsx
import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";
import { usePopup } from "../../context/PopupContext"; // global popup hook

const COLORS = {
  headerBlue: "#1877F2",
  mutedText: "#dbe7ff",
};
const btnStyle = {
  padding: 8,
  borderRadius: 12,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#fff",
  fontSize: 18,
};

export default function ChatHeader({ chatInfo, friendInfo }) {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup(); // popup context
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [toast, setToast] = useState(null);

  // Close menu when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Toast helper
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2300);
  };

  const handleMenuClick = () => setMenuOpen((prev) => !prev);

  const handleBlock = () => {
    triggerToast(chatInfo?.blockedBy?.includes(friendInfo?.id) ? "User unblocked" : "User blocked");
    setMenuOpen(false);
  };

  const handleClearChat = () => {
    triggerToast("Chat cleared!");
    setMenuOpen(false);
  };

  const handleReport = () => {
    triggerToast("User reported.");
    setMenuOpen(false);
  };

  return (
    <div
      style={{
        height: 56,
        backgroundColor: COLORS.headerBlue,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* LEFT: Back + Avatar + Name */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => friendInfo?.id && navigate(`/UserProfilePage/${friendInfo.id}`)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(-1);
          }}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20 }}
        >
          ←
        </button>

        <img
          src={friendInfo?.photoURL || "/default-avatar.png"}
          alt=""
          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{friendInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 11, color: COLORS.mutedText }}>
            {friendInfo?.online
              ? "Online"
              : friendInfo?.lastSeen
              ? `Last seen: ${new Date(friendInfo.lastSeen?.toDate ? friendInfo.lastSeen.toDate() : friendInfo.lastSeen).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Last seen unavailable"}
          </div>
        </div>
      </div>

      {/* RIGHT: Voice & Video Call + 3-dot menu */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }}>
        <button
          onClick={() =>
            navigate("/voice-call", {
              state: { friendId: friendInfo?.id, chatId: chatInfo?.id },
            })
          }
          style={btnStyle}
          title="Voice Call"
        >
          📞
        </button>

        <button
          onClick={() =>
            navigate("/video-call", {
              state: { friendId: friendInfo?.id, chatId: chatInfo?.id },
            })
          }
          style={btnStyle}
          title="Video Call"
        >
          🎥
        </button>

        {/* 3-dot menu */}
        <button onClick={handleMenuClick} style={btnStyle} title="Menu">
          ⋮
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              background: "#fff",
              color: "#000",
              borderRadius: 8,
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              zIndex: 100,
              minWidth: 140,
            }}
          >
            <button
              style={{ padding: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
              onClick={() => navigate(`/UserProfilePage/${friendInfo?.id}`)}
            >
              View Profile
            </button>
            <button
              style={{ padding: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
              onClick={handleClearChat}
            >
              Clear Chat
            </button>
            <button
              style={{ padding: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
              onClick={handleBlock}
            >
              {chatInfo?.blockedBy?.includes(friendInfo?.id) ? "Unblock" : "Block"}
            </button>
            <button
              style={{ padding: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
              onClick={handleReport}
            >
              Report
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#333",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: 20,
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 999,
            opacity: 0.95,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}