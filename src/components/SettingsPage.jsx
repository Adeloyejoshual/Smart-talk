// src/components/SettingsPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

const launchConfetti = () => {
  const duration = 1.5 * 1000;
  const animationEnd = Date.now() + duration;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    const particleCount = 30 * (timeLeft / duration);
    for (let i = 0; i < particleCount; i++) {
      const el = document.createElement("div");
      el.style.position = "fixed";
      el.style.width = "6px";
      el.style.height = "6px";
      el.style.background = ["#FFD700", "#FF69B4", "#00e676", "#00b0ff"][Math.floor(Math.random() * 4)];
      el.style.borderRadius = "50%";
      el.style.left = Math.random() * window.innerWidth + "px";
      el.style.top = "0px";
      el.style.pointerEvents = "none";
      el.style.transition = "all 1.5s linear";
      document.body.appendChild(el);

      requestAnimationFrame(() => {
        el.style.transform = `translateY(${window.innerHeight}px) rotate(${Math.random() * 720}deg)`;
        el.style.opacity = 0;
      });

      setTimeout(() => document.body.removeChild(el), duration);
    }
  }, 250);
};

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: "", bio: "", profilePic: "", email: "" });
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [loadingReward, setLoadingReward] = useState(false);

  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");

  const fileInputRef = useRef();
  const navigate = useNavigate();
  const backend = "https://smart-talk-dqit.onrender.com";

  // Fetch user info and wallet
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);

      try {
        const token = await auth.currentUser.getIdToken(true);
        const res = await fetch(`${backend}/api/wallet/${u.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        setBalance(data.balance || 0);
        setTransactions(data.transactions?.slice(0, 5) || []);

        // Check if daily reward claimed today
        const today = new Date().toISOString().split("T")[0];
        if (data.transactions?.some(t => t.type === "checkin" && (new Date(t.createdAt).toISOString().split("T")[0] === today))) {
          setDailyClaimed(true);
        }

        if (data.profile) setProfile(data.profile);
        else setProfile({ name: "", bio: "", profilePic: "", email: u.email });

      } catch (err) {
        console.error("Failed to load wallet:", err);
      }
    });

    return () => unsub();
  }, []);

  // Daily reward
  const handleDailyReward = async () => {
    if (!user || dailyClaimed) return;
    setLoadingReward(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const amount = 0.25;

      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();

      if (data.balance !== undefined) {
        setBalance(data.balance);
        setTransactions(prev => [data.txn, ...prev].slice(0, 5));
        setDailyClaimed(true);
        launchConfetti();
        alert(`🎉 Daily reward $${amount} claimed!`);
      } else if (data.error && data.error.toLowerCase().includes("already claimed")) {
        setDailyClaimed(true);
        alert("✅ You already claimed today's reward!");
      } else {
        alert(data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward.");
    } finally {
      setLoadingReward(false);
    }
  };

  // Theme & wallpaper handlers
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
      await fetch(`${backend}/api/user/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ theme: newTheme, wallpaper: newWallpaper || null }),
      });
      updateSettings(newTheme, newWallpaper);
      alert("✅ Preferences saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save preferences.");
    }
  };

  const getInitials = (name) => {
    if (!name) return "NA";
    const parts = name.trim().split(" ");
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const isDark = newTheme === "dark";
  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20 }}>⬅</button>
      <h2>⚙️ Settings</h2>

      {/* Profile */}
      <div style={{ display: "flex", alignItems: "center", padding: 15, background: isDark ? "#2b2b2b" : "#fff", borderRadius: 12, marginBottom: 20 }}>
        {profile.profilePic ? (
          <img src={profile.profilePic} alt="Profile" style={{ width: 70, height: 70, borderRadius: "50%", marginRight: 15 }} />
        ) : (
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#007bff", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 24, fontWeight: "bold", marginRight: 15 }}>
            {getInitials(profile.name)}
          </div>
        )}
        <div>
          <p style={{ margin: 0, fontWeight: "600" }}>{profile.name || "No Name"}</p>
          <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>{profile.bio || "No bio yet"}</p>
          <p style={{ margin: 0, fontSize: 12, color: isDark ? "#aaa" : "#888" }}>{profile.email}</p>
        </div>
      </div>

      {/* Wallet */}
      <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginBottom: 20 }}>
        <p>Balance: <strong>${balance.toFixed(2)}</strong></p>
        <button onClick={handleDailyReward} disabled={dailyClaimed || loadingReward}>
          {dailyClaimed ? "✅ Daily Reward Claimed" : "🧩 Daily Reward (+$0.25)"}
        </button>

        <h4>Recent Transactions</h4>
        {transactions.length === 0 ? <p>No transactions yet</p> :
          transactions.map(tx => (
            <div key={tx._id || tx.txnId} style={{ display: "flex", justifyContent: "space-between", padding: 5, borderBottom: "1px solid #888" }}>
              <span>{tx.type}</span>
              <span style={{ color: tx.amount >= 0 ? "green" : "red" }}>{tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}</span>
            </div>
          ))
        }
      </div>

      {/* Theme & Wallpaper */}
      <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12 }}>
        <h3>Theme & Wallpaper</h3>
        <select value={newTheme} onChange={e => setNewTheme(e.target.value)}>
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div onClick={handleWallpaperClick} style={{ width: "100%", height: 150, marginTop: 10, border: "2px solid #555", borderRadius: 10, backgroundSize: "cover", backgroundPosition: "center", backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
          {newWallpaper ? "Wallpaper Selected" : "🌈 Wallpaper Preview"}
        </div>
        {newWallpaper && <button onClick={removeWallpaper} style={{ marginTop: 10, background: "#d32f2f", color: "#fff", padding: 8 }}>Remove Wallpaper</button>}
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
        <button onClick={handleSavePreferences} style={{ marginTop: 10, background: "#007bff", color: "#fff", padding: 10 }}>💾 Save Preferences</button>
      </div>

      {/* Logout */}
      <button onClick={async () => { await auth.signOut(); navigate("/"); }} style={{ marginTop: 20, background: "#e53935", color: "#fff", padding: 12, borderRadius: 12 }}>🚪 Logout</button>
    </div>
  );
}