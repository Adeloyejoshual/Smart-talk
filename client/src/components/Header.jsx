import React from "react";
import { auth } from "../firebaseClient";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";

export default function Header({ setActiveTab }) {
  const [user, setUser] = React.useState(null);
  const [wallet, setWallet] = React.useState({ balance: 0 });
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

      {/* Center: App name */}
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
  );
}

const menuItemStyle = {
  background: "transparent",
  border: "none",
  padding: "10px 16px",
  textAlign: "left",
  width: "100%",
  cursor: "pointer",
  fontSize: 14,
};