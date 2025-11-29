import React from "react";
import { useNavigate } from "react-router-dom";

const COLORS = {
  headerBlue: "#1877F2",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  mutedText: "#888",
};

const SPACING = { sm: 8, borderRadius: 12 };

const menuBtnStyle = {
  padding: SPACING.sm,
  borderRadius: SPACING.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

export default function ChatHeader({
  friendInfo,
  chatInfo,
  myUid,
  theme,
  headerMenuOpen,
  setHeaderMenuOpen,
  clearChat,
  toggleBlock,
}) {
  const isDark = theme === "dark";
  const navigate = useNavigate();

  // -------------------- Profile picture or initials --------------------
  const renderHeaderProfile = () => {
    if (friendInfo?.photoURL) {
      // Cloudinary transformation: resize to 36x36, crop fill
      const url = friendInfo.photoURL.includes("res.cloudinary.com")
        ? friendInfo.photoURL.replace("/upload/", "/upload/c_fill,h_36,w_36/")
        : friendInfo.photoURL;
      return <img src={url} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />;
    }

    // Fallback: initials
    const name = friendInfo?.name || "U";
    const initials = (() => {
      const parts = name.trim().split(" ");
      if (parts.length === 1) return parts[0][0].toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    })();

    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isDark ? "#fff" : "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontWeight: 600,
        }}
      >
        {initials}
      </div>
    );
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
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => friendInfo?.id && navigate(`/UserProfilePage/${friendInfo.id}`)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(-1);
          }}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
        >
          ←
        </button>

        {renderHeaderProfile()}

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 600 }}>{friendInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 12, color: COLORS.mutedText }}>
            {friendInfo?.online
              ? "Online"
              : friendInfo?.lastSeen
              ? `Last seen ${(() => {
                  try {
                    const d = friendInfo.lastSeen.toDate ? friendInfo.lastSeen.toDate() : new Date(friendInfo.lastSeen);
                    return d.toLocaleString();
                  } catch {
                    return "unknown";
                  }
                })()}`
              : "Last seen unavailable"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => navigate("/VoiceCallPage", { state: { friendId: friendInfo?.id, chatId: chatInfo?.id } })}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
          title="Voice call"
        >
          📞
        </button>

        <button
          onClick={() => navigate("/VideoCallPage", { state: { friendId: friendInfo?.id, chatId: chatInfo?.id } })}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
          title="Video call"
        >
          🎥
        </button>

        <button onClick={() => setHeaderMenuOpen((prev) => !prev)} style={{ background: "transparent", border: "none", color: "#fff" }}>
          ⋮
        </button>
      </div>

      {headerMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 12,
            background: isDark ? COLORS.darkCard : COLORS.lightCard,
            borderRadius: SPACING.borderRadius,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: 30,
          }}
        >
          <button style={menuBtnStyle} onClick={clearChat}>
            Clear Chat
          </button>
          <button style={menuBtnStyle} onClick={toggleBlock}>
            {(chatInfo?.blockedBy || []).includes(myUid) ? "Unblock" : "Block"}
          </button>
          <button style={menuBtnStyle} onClick={() => setHeaderMenuOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}