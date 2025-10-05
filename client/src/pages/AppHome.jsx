// /src/pages/AppHome.jsx
import React, { useState } from "react";
import ChatPage from "./ChatPage";
import SettingsPage from "./SettingsPage";
import ProfilePage from "./ProfilePage"; // we’ll create this next
import BottomNav from "../components/BottomNav";
import { useTheme } from "../context/ThemeContext";

export default function AppHome() {
  const [tab, setTab] = useState("chats");
  const { theme } = useTheme();

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: theme === "dark" ? "#000" : "#f5f5f5",
        color: theme === "dark" ? "#fff" : "#000",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 60 }}>
        {tab === "chats" && <ChatPage />}
        {tab === "settings" && <SettingsPage />}
        {tab === "profile" && <ProfilePage />}
      </div>
      <BottomNav current={tab} onChange={setTab} />
    </div>
  );
}