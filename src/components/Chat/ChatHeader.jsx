
import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";

const btnStyle = {
  padding: 8,
  borderRadius: 12,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 18,
};

// Helper: friendly last seen
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "Last seen unavailable";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();

  const optionsToday = { hour: "2-digit", minute: "2-digit", hour12: true };
  const optionsSameYear = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true };
  const optionsDiffYear = { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true };

  const isToday = date.toDateString() === now.toDateString();
  const isSameYear = date.getFullYear() === now.getFullYear();

  if (isToday) return `Last seen: Today at ${date.toLocaleTimeString("en-US", optionsToday)}`;
  if (isSameYear) return `Last seen: ${date.toLocaleString("en-US", optionsSameYear)}`;
  return `Last seen: ${date.toLocaleString("en-US", optionsDiffYear)}`;
};

export default function ChatHeader({ chatInfo, friendInfo }) {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null); // Toast message
  const [showToast, setShowToast] = useState(false); // For animation
  const menuRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown with ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  // Show toast with animation
  useEffect(() => {
    if (toast) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 2000); // Hide after 2s
      const removeTimer = setTimeout(() => setToast(null), 2300); // Remove after animation
      return () => {
        clearTimeout(timer);
        clearTimeout(removeTimer);
      };
    }
  }, [toast]);

  const getInitials = (fullName) => {
    if (!fullName) return "NA";
    const names = fullName.trim().split(" ");
    return names.length === 1
      ? names[0][0].toUpperCase()
      : (names[0][0] + names[1][0]).toUpperCase();
  };

  const textColor = theme === "dark" ? "#eee" : "#fff";
  const mutedText = theme === "dark" ? "#aaa" : "#dbe7ff";
  const headerBg = "#1877F2";

  const dropdownItemStyle = {
    padding: 10,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s",
  };

  const dropdownHoverStyle = {
    background: theme === "dark" ? "#333" : "#f2f2f2",
    fontWeight: "600",
  };

  // Handle menu item click with popup
  const handleMenuItemClick = (action) => {
    setMenuOpen(false);
    let message = "";
    switch (action) {
      case "profile":
        navigate(`/UserProfilePage/${friendInfo?.id}`);
        return;
      case "clear":
        message = "Chat cleared!";
        break;
      case "block":
        message = chatInfo?.blockedBy?.includes(friendInfo?.id)
          ? `${friendInfo?.name} unblocked!`
          : `${friendInfo?.name} blocked!`;
        break;
      case "report":
        message = "User reported!";
        break;
      default:
        break;
    }
    if (message) setToast(message);
  };

  return (
    <div
      style={{
        height: 56,
        backgroundColor: headerBg,
        color: textColor,
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
          style={{ background: "transparent", border: "none", color: textColor, fontSize: 20 }}
        >
          ←
        </button>

        {friendInfo?.photoURL ? (
          <img
            src={friendInfo.photoURL}
            alt={friendInfo.name || "User"}
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#007bff",
              color: "#fff",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 14,
              fontWeight: "bold",
            }}
          >
            {getInitials(friendInfo?.name)}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{friendInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 11, color: mutedText }}>
            {friendInfo?.online ? "Online" : formatLastSeen(friendInfo?.lastSeen)}
          </div>
        </div>
      </div>

      {/* RIGHT: Voice & Video Call + 3-dot menu */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }} ref={menuRef}>
        <button
          onClick={() =>
            navigate("/voice-call", { state: { friendId: friendInfo?.id, chatId: chatInfo?.id } })
          }
          style={btnStyle}
          title="Voice Call"
        >
          📞
        </button>

        <button
          onClick={() =>
            navigate("/video-call", { state: { friendId: friendInfo?.id, chatId: chatInfo?.id } })
          }
          style={btnStyle}
          title="Video Call"
        >
          🎥
        </button>

        {/* 3-dot menu button */}
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          style={btnStyle}
          title="Menu"
        >
          ⋮
        </button>

        {/* Animated Dropdown menu */}
        <div
          style={{
            position: "absolute",
            top: 50,
            right: 0,
            minWidth: 140,
            borderRadius: 8,
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            background: theme === "dark" ? "#1e1e1e" : "#fff",
            color: theme === "dark" ? "#eee" : "#000",
            display: "flex",
            flexDirection: "column",
            opacity: menuOpen ? 1 : 0,
            transform: menuOpen ? "translateY(0)" : "translateY(-10px)",
            pointerEvents: menuOpen ? "auto" : "none",
            transition: "all 0.2s ease-in-out",
            zIndex: 100,
          }}
        >
          {[
            { label: "View Profile", action: "profile" },
            { label: "Clear Chat", action: "clear" },
            { label: chatInfo?.blockedBy?.includes(friendInfo?.id) ? "Unblock" : "Block", action: "block" },
            { label: "Report", action: "report" },
          ].map((item) => (
            <button
              key={item.action}
              style={dropdownItemStyle}
              onClick={() => handleMenuItemClick(item.action)}
              onMouseEnter={(e) => Object.assign(e.target.style, dropdownHoverStyle)}
              onMouseLeave={(e) => Object.assign(e.target.style, dropdownItemStyle)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast popup near top */}
      {toast && (
        <div
          style={{
            position: "absolute",
            top: showToast ? 65 : 50, // below header
            left: "50%",
            transform: "translateX(-50%)",
            background: theme === "dark" ? "#333" : "#222",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 20,
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            opacity: showToast ? 0.95 : 0,
            transition: "all 0.3s ease-in-out",
            zIndex: 999,
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}