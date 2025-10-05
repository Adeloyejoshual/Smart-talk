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