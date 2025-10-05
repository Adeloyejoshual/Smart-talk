import React from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import ChatPage from "./ChatPage";
import CallsPage from "./CallsPage";
import WalletPage from "./WalletPage";
import SettingsPage from "./SettingsPage";
import { SettingsContext } from "../context/SettingsContext";

export default function HomePage() {
  const [activeTab, setActiveTab] = React.useState("chat");
  const { theme } = React.useContext(SettingsContext) || { theme: "light" };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: theme === "dark" ? "#121212" : "#fff",
        color: theme === "dark" ? "#fff" : "#000",
        transition: "background 0.3s",
      }}
    >
      <Header setActiveTab={setActiveTab} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "chat" && <ChatPage />}
        {activeTab === "calls" && <CallsPage />}
        {activeTab === "wallet" && <WalletPage />}
        {activeTab === "settings" && <SettingsPage />}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}