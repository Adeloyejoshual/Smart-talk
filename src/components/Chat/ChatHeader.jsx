// src/components/Chat/ChatHeader.jsx
import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";

const COLORS = {
  headerBlue: "#1877F2",
  lightCard: "#fff",
  mutedText: "#888",
};
const SPACING = { sm: 8, borderRadius: 12 };
const btnStyle = {
  padding: SPACING.sm,
  borderRadius: SPACING.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

export default function ChatHeader({
  chatInfo,
  friendInfo,
  myUid,
  activeMessageForHeader,
  setActiveMessageForHeader,
  onReply,
  onEdit,
  onForward,
  onDelete,
  onPin,
}) {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const handleCancelAction = () => setActiveMessageForHeader(null);

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
      {activeMessageForHeader ? (
        // MESSAGE ACTION HEADER
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleCancelAction}
            style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
            title="Cancel"
          >
            ←
          </button>
          <span style={{ fontWeight: 600 }}>{activeMessageForHeader.text?.slice(0, 20) || "Message"}</span>
        </div>
      ) : (
        // REGULAR CHAT HEADER
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          onClick={() => friendInfo?.id && navigate(`/UserProfilePage/${friendInfo.id}`)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
          >
            ←
          </button>
          <img
            src={friendInfo?.photoURL || "/default-avatar.png"}
            alt=""
            style={{ width: 36, height: 36, borderRadius: "50%" }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 600 }}>{friendInfo?.name || "Chat"}</div>
            <div style={{ fontSize: 12, color: COLORS.mutedText }}>
              {friendInfo?.online
                ? "Online"
                : friendInfo?.lastSeen
                  ? `Last seen ${friendInfo.lastSeen.toDate ? friendInfo.lastSeen.toDate().toLocaleString() : new Date(friendInfo.lastSeen).toLocaleString()}`
                  : "Last seen unavailable"}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        {activeMessageForHeader ? (
          // ACTION BUTTONS
          <>
            <button style={btnStyle} onClick={() => onReply(activeMessageForHeader)} title="Reply">💬</button>
            {activeMessageForHeader.senderId === myUid && (
              <button style={btnStyle} onClick={() => onEdit(activeMessageForHeader)} title="Edit">✏️</button>
            )}
            <button style={btnStyle} onClick={() => onForward(activeMessageForHeader)} title="Forward">➡️</button>
            {activeMessageForHeader.senderId === myUid && (
              <button style={btnStyle} onClick={() => onDelete(activeMessageForHeader)} title="Delete">🗑️</button>
            )}
            <button style={btnStyle} onClick={() => onPin(activeMessageForHeader)} title="Pin">📌</button>
          </>
        ) : (
          // REGULAR CALL & MENU BUTTONS
          <>
            <button
              onClick={() => navigate("/VoiceCallPage", { state: { friendId: friendInfo?.id, chatId: chatInfo.id } })}
              style={btnStyle}
              title="Voice call"
            >
              📞
            </button>
            <button
              onClick={() => navigate("/VideoCallPage", { state: { friendId: friendInfo?.id, chatId: chatInfo.id } })}
              style={btnStyle}
              title="Video call"
            >
              🎥
            </button>
          </>
        )}
      </div>
    </div>
  );
}