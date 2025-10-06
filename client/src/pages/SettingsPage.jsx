import React, { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { Home, Phone, Wallet, Settings } from "lucide-react";

const pulseKeyframes = `
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.25); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
`;

// Inject pulse animation CSS once globally
if (!document.getElementById("bottom-nav-pulse-style")) {
  const style = document.createElement("style");
  style.id = "bottom-nav-pulse-style";
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
}

export default function BottomNav({ current, onChange, unreadCount = 0 }) {
  const { theme } = useTheme();
  const [prevUnread, setPrevUnread] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (unreadCount > prevUnread) {
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }
    setPrevUnread(unreadCount);
  }, [unreadCount, prevUnread]);

  const tabs = [
    { id: "chats", label: "Chats", icon: <Home size={22} /> },
    { id: "wallet", label: "Wallet", icon: <Wallet size={22} /> },
    { id: "calls", label: "Calls", icon: <Phone size={22} /> },
    { id: "settings", label: "Settings", icon: <Settings size={22} /> },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main Bottom Navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        background: theme === "dark" ? "#1c1c1e" : "#fff",
        borderTop: theme === "dark" ? "1px solid #333" : "1px solid #ddd",
        zIndex: 1000,
        userSelect: "none",
      }}
    >
      {tabs.map((tab) => {
        const isActive = current === tab.id;
        const isChats = tab.id === "chats";

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: isActive
                ? theme === "dark"
                  ? "#0a84ff"
                  : "#007aff"
                : theme === "dark"
                ? "#bbb"
                : "#666",
              cursor: "pointer",
              flex: 1,
              fontSize: 12,
              outline: "none",
              padding: 4,
            }}
          >
            <div style={{ position: "relative" }}>
              {tab.icon}

              {isChats && unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread messages`}
                  role="status"
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -8,
                    background: "#ff3b30",
                    color: "#fff",
                    borderRadius: "50%",
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: "bold",
                    animation: pulse ? "pulse 0.7s ease-in-out" : "none",
                    userSelect: "none",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <span style={{ marginTop: 4 }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}