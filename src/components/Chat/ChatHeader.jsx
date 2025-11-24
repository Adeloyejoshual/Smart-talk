// src/components/Chat/ChatHeader.jsx
import React, { useContext } from "react";
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
  const { showPopup } = usePopup(); // use global popup

  const handleMenuClick = () => {
    showPopup({
      title: "Chat Options",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            style={{ padding: 8, border: "none", borderRadius: 8, cursor: "pointer" }}
            onClick={() => {
              navigate(`/UserProfilePage/${friendInfo?.id}`);
            }}
          >
            View Profile
          </button>
          <button
            style={{ padding: 8, border: "none", borderRadius: 8, cursor: "pointer" }}
            onClick={() => {
              showPopup({ title: "Clear Chat", content: "Chat cleared!" });
            }}
          >
            Clear Chat
          </button>
          <button
            style={{ padding: 8, border: "none", borderRadius: 8, cursor: "pointer" }}
            onClick={() => {
              showPopup({ title: "Block User", content: `${friendInfo?.name} is blocked` });
            }}
          >
            {chatInfo?.blockedBy?.includes(friendInfo?.id) ? "Unblock" : "Block"}
          </button>
          <button
            style={{ padding: 8, border: "none", borderRadius: 8, cursor: "pointer" }}
            onClick={() => {
              showPopup({ title: "Report", content: "User reported." });
            }}
          >
            Report
          </button>
        </div>
      ),
    });
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
              ? `Last seen ${
                  friendInfo.lastSeen.toDate
                    ? friendInfo.lastSeen.toDate().toLocaleString()
                    : new Date(friendInfo.lastSeen).toLocaleString()
                }`
              : "Last seen unavailable"}
          </div>
        </div>
      </div>

      {/* RIGHT: Voice & Video Call + 3-dot menu */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
      </div>
    </div>
  );
}