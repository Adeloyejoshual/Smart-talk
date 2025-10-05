import React from "react";
import TabButton from "./TabButton";
import { SettingsContext } from "../context/SettingsContext";

export default function BottomNav({ activeTab, setActiveTab }) {
  const { theme } = React.useContext(SettingsContext) || { theme: "light" };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-around",
        borderTop: "1px solid #eee",
        padding: "10px 0",
        background: theme === "dark" ? "#1a1a1a" : "#f9f9f9",
      }}
    >
      <TabButton label="Chat" icon="💬" active={activeTab === "chat"} onClick={() => setActiveTab("chat")} />
      <TabButton label="Calls" icon="📞" active={activeTab === "calls"} onClick={() => setActiveTab("calls")} />
      <TabButton label="Wallet" icon="💰" active={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} />
      <TabButton label="Settings" icon="⚙️" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
    </nav>
  );
}

Add 
I// /src/components/BottomNav.jsx
import React from "react";
import { useTheme } from "../context/ThemeContext";
import { Home, Settings, User } from "lucide-react";

export default function BottomNav({ current, onChange }) {
  const { theme } = useTheme();

  const tabs = [
    { id: "chats", label: "Chats", icon: <Home size={20} /> },
    { id: "settings", label: "Settings", icon: <Settings size={20} /> },
    { id: "profile", label: "Profile", icon: <User size={20} /> },
  ];

  return (
    <div
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
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive = current === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
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
            }}
          >
            {tab.icon}
            <span style={{ marginTop: 4 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}  give me one full one no explanation

```jsx
// /src/components/BottomNav.jsx
import React from "react";
import { useTheme } from "../context/ThemeContext";
import { Home, Settings, User } from "lucide-react";

export default function BottomNav({ current, onChange }) {
  const { theme } = useTheme();

  const tabs = [
    { id: "chats", label: "Chats", icon: <Home size={20} /> },
    { id: "settings", label: "Settings", icon: <Settings size={20} /> },
    { id: "profile", label: "Profile", icon: <User size={20} /> },
  ];

  return (
    <div
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
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive = current === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
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
            }}
          >
            {tab.icon}
            <span style={{ marginTop: 4 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

