// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");
  const [checkedInToday, setCheckedInToday] = useState(false);

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const backend = "https://smart-talk-dqit.onrender.com";

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);

      await loadWallet(u.uid);
    });
    return () => unsub();
  }, []);

  // Fetch wallet + transactions from backend
  const loadWallet = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setBalance(res.data.balance || 0);
      setTransactions(res.data.transactions || []);

      // check if user already claimed daily reward
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastClaim = res.data.lastDailyClaim
        ? new Date(res.data.lastDailyClaim)
        : null;
      if (lastClaim) {
        lastClaim.setHours(0, 0, 0, 0);
        setCheckedInToday(lastClaim.getTime() === today.getTime());
      }
    } catch (err) {
      console.error("Error loading wallet:", err);
    }
  };

  const handleDailyCheckin = async () => {
    if (!user || checkedInToday) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `${backend}/api/wallet/daily`,
        { uid: user.uid, amount: 0.25 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadWallet(user.uid);
      alert("🎉 You earned +$0.25 for daily check-in!");
    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward.");
    }
  };

  const handleWallpaperClick = () => fileInputRef.current.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewWallpaper(ev.target.result);
    reader.readAsDataURL(file);
  };
  const removeWallpaper = () => setNewWallpaper("");

  const handleSavePreferences = async () => {
    if (!user) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `${backend}/api/users/preferences`,
        { uid: user.uid, theme: newTheme, wallpaper: newWallpaper || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateSettings(newTheme, newWallpaper);
      alert("✅ Preferences saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save preferences.");
    }
  };

  const isDark = newTheme === "dark";

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, background: isDark ? "#555" : "#e0e0e0", border: "none", borderRadius: "50%", padding: 8, cursor: "pointer" }}>⬅</button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Wallet ================= */}
      <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
        <p>Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong></p>
        <button
          onClick={handleDailyCheckin}
          disabled={checkedInToday}
          style={{ padding: 10, marginTop: 10, width: "100%", borderRadius: 8, background: checkedInToday ? "#666" : "#4CAF50", color: "#fff", cursor: checkedInToday ? "not-allowed" : "pointer" }}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>

        <h4 style={{ marginTop: 15 }}>Last 3 Transactions</h4>
        {transactions.slice(0, 3).map((tx) => (
          <div key={tx._id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ccc" }}>
            <span>{tx.type}</span>
            <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
              {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
            </span>
          </div>
        ))}
        {transactions.length === 0 && <p style={{ opacity: 0.6 }}>No transactions yet.</p>}
      </div>

      {/* ================= Theme & Wallpaper ================= */}
      <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 10 }}>
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div onClick={handleWallpaperClick} style={{ width: "100%", height: 150, border: "2px solid #555", borderRadius: 10, marginTop: 15, display: "flex", justifyContent: "center", alignItems: "center", backgroundSize: "cover", backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none", cursor: "pointer" }}>
          {newWallpaper ? "Wallpaper Selected" : "🌈 Wallpaper Preview"}
        </div>
        {newWallpaper && <button onClick={removeWallpaper} style={{ marginTop: 10, padding: 10, width: "100%", borderRadius: 8, background: "#d32f2f", color: "#fff" }}>Remove Wallpaper</button>}

        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />

        <button onClick={handleSavePreferences} style={{ marginTop: 15, padding: 12, width: "100%", borderRadius: 20, background: "#007bff", color: "#fff" }}>💾 Save Preferences</button>
      </div>
    </div>
  );
}