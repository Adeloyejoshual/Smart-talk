// src/components/Chat/ChatHeader.jsx
import React, { useContext, useState, useEffect, useRef } from "react";
import { ThemeContext } from "../../context/ThemeContext";
import { UserContext } from "../../context/UserContext";

export default function ChatHeader({
  chatInfo,
  friendInfo,
  onGoToPinned,
  onPinMessage,
}) {
  const { theme } = useContext(ThemeContext);
  const { cloudinaryUpload } = useContext(UserContext); // optional, if needed
  const isDark = theme === "dark";

  const [menuOpen, setMenuOpen] = useState(false);
  const [pinMenuOpen, setPinMenuOpen] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);

  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setPinMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = () => setMenuOpen((prev) => !prev);

  const handlePinMessage = (duration) => {
    if (!chatInfo || !chatInfo.messages?.length) return;

    const lastMsg = chatInfo.messages[chatInfo.messages.length - 1];
    const expireAt = new Date();
    if (duration === "24h") expireAt.setHours(expireAt.getHours() + 24);
    if (duration === "7d") expireAt.setDate(expireAt.getDate() + 7);
    if (duration === "30d") expireAt.setDate(expireAt.getDate() + 30);

    const pinData = { ...lastMsg, expireAt };
    setPinnedMessage(pinData);
    if (onPinMessage) onPinMessage(pinData);

    setPinMenuOpen(false);
    setMenuOpen(false);
  };

  const handleGoToPinned = () => {
    if (pinnedMessage && onGoToPinned) onGoToPinned(pinnedMessage);
    setMenuOpen(false);
  };

  const handleUnpinMessage = () => {
    setPinnedMessage(null);
    setMenuOpen(false);
  };

  const handleClearChat = () => {
    alert("Clear chat clicked!");
    setMenuOpen(false);
  };

  const handleMuteChat = () => {
    alert("Mute chat clicked!");
    setMenuOpen(false);
  };

  const handleSearchChat = () => {
    alert("Search in chat clicked!");
    setMenuOpen(false);
  };

  const primaryColor = "#007BFF"; // Bootstrap Blue
  const bgColor = isDark ? "#1c1c1c" : "#f8f9fa";
  const textColor = isDark ? "#fff" : "#000";

  return (
    <div
      style={{
        height: 56,
        backgroundColor: bgColor,
        color: textColor,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 20,
        borderBottom: isDark ? "1px solid #333" : "1px solid #dee2e6",
      }}
    >
      {/* LEFT: Back + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            color: primaryColor,
          }}
          onClick={() => window.history.back()}
        >
          ←
        </button>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{friendInfo?.name || "Chat"}</div>
      </div>

      {/* RIGHT: 3-dot menu */}
      <div style={{ position: "relative" }}>
        <button
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            color: primaryColor,
          }}
          onClick={handleMenuClick}
        >
          ⋮
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: 36,
              right: 0,
              background: bgColor,
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              minWidth: 220,
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            {/* Pin submenu */}
            <div
              style={{
                padding: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: primaryColor,
                fontWeight: 500,
                position: "relative",
              }}
              onMouseEnter={() => setPinMenuOpen(true)}
              onMouseLeave={() => setPinMenuOpen(false)}
            >
              Pin Message ▸
              {pinMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "100%",
                    background: bgColor,
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 140,
                    zIndex: 101,
                  }}
                >
                  <button
                    style={{
                      padding: 10,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      color: primaryColor,
                      fontWeight: 500,
                    }}
                    onClick={() => handlePinMessage("24h")}
                  >
                    24 Hours
                  </button>
                  <button
                    style={{
                      padding: 10,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      color: primaryColor,
                      fontWeight: 500,
                    }}
                    onClick={() => handlePinMessage("7d")}
                  >
                    7 Days
                  </button>
                  <button
                    style={{
                      padding: 10,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      color: primaryColor,
                      fontWeight: 500,
                    }}
                    onClick={() => handlePinMessage("30d")}
                  >
                    30 Days
                  </button>
                </div>
              )}
            </div>

            {pinnedMessage && (
              <>
                <button
                  style={{
                    padding: 10,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    color: primaryColor,
                    fontWeight: 500,
                  }}
                  onClick={handleGoToPinned}
                >
                  Go to Pinned
                </button>
                <button
                  style={{
                    padding: 10,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    color: primaryColor,
                    fontWeight: 500,
                  }}
                  onClick={handleUnpinMessage}
                >
                  Unpin
                </button>
              </>
            )}

            <hr style={{ margin: 0, borderColor: isDark ? "#333" : "#dee2e6" }} />

            {/* Secondary actions */}
            <button
              style={{
                padding: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: textColor,
              }}
              onClick={handleSearchChat}
            >
              Search in Chat
            </button>
            <button
              style={{
                padding: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: textColor,
              }}
              onClick={handleMuteChat}
            >
              Mute Notifications
            </button>
            <button
              style={{
                padding: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: textColor,
              }}
              onClick={handleClearChat}
            >
              Clear Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}