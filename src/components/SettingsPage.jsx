// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "../firebaseConfig";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [loadingReward, setLoadingReward] = useState(false);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");

  const [profileData, setProfileData] = useState({
    name: "",
    bio: "",
    profilePic: "",
    email: "",
  });

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const backend = "https://smart-talk-dqit.onrender.com";

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return navigate("/");

      setUser(userAuth);

      try {
        const token = await auth.currentUser.getIdToken(true);

        // Fetch wallet and transactions from backend
        const res = await axios.get(`${backend}/api/wallet/${userAuth.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setBalance(res.data.balance || 0);
        setTransactions(
          (res.data.transactions || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3)
        );

        // Check if daily reward already claimed
        setDailyClaimed(res.data.dailyClaimed || false);

        // Set profile info from backend if available
        if (res.data.profile) {
          setProfileData({
            name: res.data.profile.name || "",
            bio: res.data.profile.bio || "",
            profilePic: res.data.profile.profilePic || "",
            email: res.data.profile.email || userAuth.email,
          });
        }
      } catch (err) {
        console.error("Failed to load wallet:", err);
      }
    });

    return () => unsub();
  }, []);

  // Daily reward handler
  const handleDailyReward = async () => {
    if (!user) return;
    setLoadingReward(true);

    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
        setTransactions(
          (res.data.transactions || transactions)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3)
        );
        setDailyClaimed(true);
        alert("🎉 Daily reward claimed!");
      } else if (res.data.error) {
        if (res.data.error.toLowerCase().includes("already claimed")) {
          setDailyClaimed(true);
          alert("✅ You already claimed today's reward!");
        } else {
          alert(res.data.error);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
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
        { theme: newTheme, wallpaper: newWallpaper || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateSettings(newTheme, newWallpaper);
      alert("✅ Preferences saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save preferences. Check console.");
    }
  };

  const isDark = newTheme === "dark";

  if (!user) return <p>Loading user...</p>;

  const getInitials = (name) => {
    if (!name) return "NA";
    const names = name.trim().split(" ");
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate("/chat")}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: isDark ? "#555" : "#e0e0e0",
          border: "none",
          borderRadius: "50%",
          padding: 8,
          cursor: "pointer",
        }}
      >
        ⬅
      </button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div
        onClick={() => navigate("/edit-profile")}
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          background: isDark ? "#2b2b2b" : "#fff",
          padding: 15,
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        {profileData.profilePic ? (
          <img
            src={profileData.profilePic}
            alt="Profile"
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              objectFit: "cover",
              marginRight: 15,
            }}
          />
        ) : (
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: "#007bff",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 24,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginRight: 15,
            }}
          >
            {getInitials(profileData.name)}
          </div>
        )}
        <div>
          <p style={{ margin: 0, fontWeight: "600", fontSize: 16 }}>
            {profileData.name || "No Name"}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>
            {profileData.bio || "No bio yet — click to edit"}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: isDark ? "#aaa" : "#888" }}>
            {profileData.email}
          </p>
        </div>
      </div>

      {/* ================= Wallet Section ================= */}
      <Section title="Wallet" isDark={isDark}>
        <div
          onClick={() => navigate("/wallet")}
          style={{ cursor: "pointer", marginBottom: 10 }}
        >
          <p style={{ margin: 0 }}>
            Balance:{" "}
            <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>
              ${balance.toFixed(2)}
            </strong>
          </p>
        </div>

        <button
          onClick={handleDailyReward}
          disabled={dailyClaimed || loadingReward}
          style={{
            ...btnStyle(dailyClaimed ? "#666" : "#FFD700"),
            opacity: dailyClaimed ? 0.7 : 1,
            marginBottom: 15,
            width: "100%",
          }}
        >
          {loadingReward
            ? "Processing..."
            : dailyClaimed
            ? "✅ Daily Reward Claimed"
            : "🧩 Daily Reward (+$0.25)"}
        </button>

        <div>
          <h4 style={{ marginBottom: 8 }}>Last 3 Transactions</h4>
          {transactions.length === 0 ? (
            <p style={{ fontSize: 14, opacity: 0.6 }}>No recent transactions.</p>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx._id || tx.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  marginBottom: 6,
                  background: isDark ? "#3b3b3b" : "#f0f0f0",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <span>{tx.type}</span>
                <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
                  {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* ================= Theme & Wallpaper ================= */}
      <Section title="Theme & Wallpaper" isDark={isDark}>
        <select
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div
          onClick={handleWallpaperClick}
          style={{
            ...previewBox,
            backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none",
            cursor: "pointer",
          }}
        >
          <p>{newWallpaper ? "Wallpaper Selected" : "🌈 Wallpaper Preview"}</p>
        </div>
        {newWallpaper && (
          <button onClick={removeWallpaper} style={{ ...btnStyle("#d32f2f"), marginTop: 10 }}>
            Remove Wallpaper
          </button>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          onClick={handleSavePreferences}
          style={{ ...btnStyle("#007bff"), marginTop: 15, borderRadius: 20 }}
        >
          💾 Save Preferences
        </button>
      </Section>

      {/* ================= Logout ================= */}
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button
          onClick={async () => {
            await auth.signOut();
            navigate("/");
          }}
          style={{
            padding: "12px 25px",
            background: "#e53935",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: 16,
          }}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

// ================= Section Wrapper =================
function Section({ title, children, isDark }) {
  return (
    <div
      style={{
        background: isDark ? "#2b2b2b" : "#fff",
        padding: 20,
        borderRadius: 12,
        marginTop: 25,
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

// ================= Reusable Styles =================
const btnStyle = (bg) => ({
  marginRight: 8,
  padding: "10px 15px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: "bold",
});

const selectStyle = (isDark) => ({
  width: "100%",
  padding: 8,
  marginBottom: 10,
  borderRadius: 6,
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
  border: "1px solid #666",
});

const previewBox = {
  width: "100%",
  height: 150,
  borderRadius: 10,
  border: "2px solid #555",
  marginTop: 15,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundSize: "cover",
  backgroundPosition: "center",
};