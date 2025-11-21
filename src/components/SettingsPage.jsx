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

  // AUTH + Load Wallet from backend
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return navigate("/");
      setUser(userAuth);
      loadWallet(userAuth.uid);
    });
    return unsub;
  }, []);

  const loadWallet = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance || 0);

      // last 3 transactions
      setTransactions(
        (res.data.transactions || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3)
      );

      // check last daily claim
      const lastClaim = res.data.lastDailyClaim ? new Date(res.data.lastDailyClaim) : null;
      if (lastClaim) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastClaim.setHours(0, 0, 0, 0);
        setCheckedInToday(lastClaim.getTime() === today.getTime());
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load wallet. Check console.");
    }
  };

  // DAILY REWARD
  const handleDailyCheckin = async () => {
    if (!user) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalance(res.data.balance || balance);
      setCheckedInToday(true);
      alert("🎉 You claimed your daily reward!");
    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward. Check console.");
    }
  };

  const handleWallpaperClick = () => fileInputRef.current.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewWallpaper(ev.target.result);
      reader.readAsDataURL(file);
    }
  };
  const removeWallpaper = () => setNewWallpaper("");

  const handleSavePreferences = async () => {
    if (!user) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `${backend}/api/user/preferences`,
        { theme: newTheme, wallpaper: newWallpaper },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateSettings(newTheme, newWallpaper);
      alert("✅ Preferences saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save preferences.");
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: "#f8f8f8" }}>
      <button onClick={() => navigate("/wallet")} style={styles.backBtn}>←</button>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Wallet Section */}
      <div style={styles.section}>
        <h3>Wallet</h3>
        <p>Balance: <strong>${balance.toFixed(2)}</strong></p>
        <button
          onClick={handleDailyCheckin}
          disabled={checkedInToday}
          style={{
            ...styles.btn,
            background: checkedInToday ? "#666" : "#4CAF50",
            opacity: checkedInToday ? 0.7 : 1,
          }}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Reward (+$0.25)"}
        </button>

        <h4 style={{ marginTop: 15 }}>Last Transactions</h4>
        {transactions.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No recent transactions</p>
        ) : (
          transactions.map((tx) => (
            <div key={tx._id} style={styles.txRow}>
              <span>{tx.type}</span>
              <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
                {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Theme & Wallpaper Section */}
      <div style={styles.section}>
        <h3>Theme & Wallpaper</h3>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={styles.select}>
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div
          onClick={handleWallpaperClick}
          style={{
            width: "100%",
            height: 150,
            marginTop: 10,
            background: newWallpaper ? `url(${newWallpaper}) center/cover` : "#ddd",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          {newWallpaper ? "Wallpaper Selected" : "🌈 Click to select wallpaper"}
        </div>

        {newWallpaper && (
          <button onClick={removeWallpaper} style={{ ...styles.btn, background: "#d32f2f", marginTop: 10 }}>
            Remove Wallpaper
          </button>
        )}

        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />

        <button onClick={handleSavePreferences} style={{ ...styles.btn, background: "#007bff", marginTop: 15 }}>
          💾 Save Preferences
        </button>
      </div>
    </div>
  );
}

// ==================== Styles ====================
const styles = {
  backBtn: { position: "absolute", top: 20, left: 20, padding: 8, borderRadius: "50%", border: "none", cursor: "pointer", background: "#e0e0e0" },
  section: { background: "#fff", padding: 15, borderRadius: 12, marginBottom: 20, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" },
  btn: { padding: "10px 15px", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: "bold" },
  select: { width: "100%", padding: 8, borderRadius: 6, marginTop: 10, marginBottom: 10 },
  txRow: { display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eee" },
};