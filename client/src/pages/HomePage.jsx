import React from "react";
import ChatPage from "./ChatPage";
import CallsPage from "./CallsPage";
import WalletPage from "./WalletPage";
import SettingsPage from "./SettingsPage";
import { auth } from "../firebaseClient";
import axios from "axios";

// Contexts (if you already have SettingsContext)
import { SettingsContext } from "../context/SettingsContext";

export default function HomePage() {
  const [activeTab, setActiveTab] = React.useState("chat");
  const [wallet, setWallet] = React.useState({ balance: 0 });
  const [user, setUser] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { theme } = React.useContext(SettingsContext) || { theme: "light" };
  const API = import.meta.env.VITE_API_URL || "/api";

  React.useEffect(() => {
    if (!auth.currentUser) return;
    setUser(auth.currentUser);
    fetchWallet();
  }, [auth.currentUser]);

  const fetchWallet = async () => {
    try {
      const uid = auth.currentUser.uid;
      const r = await axios.get(`${API}/wallet/${uid}`);
      setWallet(r.data.wallet || { balance: 0 });
    } catch (err) {
      console.error("Wallet fetch failed:", err);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    window.location.href = "/login";
  };

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
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: theme === "dark" ? "#1c1c1c" : "#f9f9f9",
        }}
      >
        {/* Left: Profile */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          onClick={() => setActiveTab("settings")}
        >
          <img
            src={user?.photoURL || "/assets/default-avatar.png"}
            alt="Profile"
            style={{ width: 35, height: 35, borderRadius: "50%" }}
          />
          <span style={{ fontWeight: "500" }}>{user?.displayName || "User"}</span>
        </div>

        {/* Center: Logo */}
        <h3 style={{ margin: 0, fontWeight: "bold" }}>wLlet 💬</h3>

        {/* Right: Balance + Menu */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            onClick={() => setActiveTab("wallet")}
            style={{
              fontSize: 15,
              background: "#007bff",
              color: "#fff",
              borderRadius: 8,
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            ${wallet.balance?.toFixed(2) || "0.00"}
          </span>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: theme === "dark" ? "#fff" : "#000",
              }}
            >
              ⋮
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 5,
                  background: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                  zIndex: 100,
                }}
              >
                <button
                  onClick={() => {
                    setActiveTab("settings");
                    setMenuOpen(false);
                  }}
                  style={menuItemStyle}
                >
                  Edit Profile
                </button>
                <button onClick={handleLogout} style={menuItemStyle}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "chat" && <ChatPage />}
        {activeTab === "calls" && <CallsPage />}
        {activeTab === "wallet" && <WalletPage />}
        {activeTab === "settings" && <SettingsPage />}
      </div>

      {/* Bottom Navigation */}
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
    </div>
  );
}

const TabButton = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: "transparent",
      border: "none",
      fontSize: 16,
      color: active ? "#007bff" : "#666",
      fontWeight: active ? "600" : "400",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
    }}
  >
    <span>{icon}</span>
    <small>{label}</small>
  </button>
);

const menuItemStyle = {
  background: "transparent",
  border: "none",
  padding: "10px 16px",
  textAlign: "left",
  width: "100%",
  cursor: "pointer",
  fontSize: 14,
};