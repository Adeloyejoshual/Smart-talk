// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import axios from "axios";

export default function SettingsPage() {
  const backend = "https://smart-talk-zlxe.onrender.com";

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const { showPopup, hidePopup } = usePopup();

  // ===================== State =====================
  const [user, setUser] = useState(null);

  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    email: "",
    profilePic: "",
  });

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loadingReward, setLoadingReward] = useState(false);

  // Preferences
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({
    push: true,
    email: true,
    sound: false,
  });

  // ===================================================================
  //                        Load User & Wallet Data
  // ===================================================================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);

      try {
        const token = await u.getIdToken(true);

        const res = await axios.get(`${backend}/api/wallet/${u.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setBalance(res.data.balance || 0);
        setTransactions(res.data.transactions || []);

        // Daily reward check
        const lastClaim = res.data.lastDailyClaim
          ? new Date(res.data.lastDailyClaim)
          : null;

        const today = new Date().setHours(0, 0, 0, 0);
        const claimDate = lastClaim?.setHours(0, 0, 0, 0);

        setCheckedInToday(claimDate === today);

        // Load profile
        if (res.data.profile) {
          const p = res.data.profile;
          setProfile({
            name: p.name || "",
            bio: p.bio || "",
            email: p.email || u.email,
            profilePic: p.profilePic || "",
          });

          if (p.preferences) {
            const pref = p.preferences;
            setLanguage(pref.language || "English");
            setFontSize(pref.fontSize || "Medium");
            setLayout(pref.layout || "Default");
            setNewTheme(pref.theme || theme);
            setNewWallpaper(pref.wallpaper || wallpaper || "");
          }
        }
      } catch (err) {
        console.error("Failed loading settings:", err);
      }
    });
    return () => unsub();
  }, []);

  // ===================================================================
  //                          Daily Reward
  // ===================================================================
  const handleDailyReward = async () => {
    if (!user) return;
    setLoadingReward(true);

    try {
      const token = await user.getIdToken(true);

      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
        setCheckedInToday(true);
        alert("🎉 Daily reward claimed! +$0.25");
      } else {
        alert(res.data.error || "Reward already claimed today.");
        setCheckedInToday(true);
      }
    } catch (err) {
      console.error(err);
      alert("Error claiming daily reward.");
    }

    setLoadingReward(false);
  };

  // ===================================================================
  //                        Preferences Saving
  // ===================================================================
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
      const token = await user.getIdToken(true);

      await axios.post(
        `${backend}/api/preferences`,
        {
          language,
          fontSize,
          layout,
          theme: newTheme,
          wallpaper: newWallpaper || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      updateSettings(newTheme, newWallpaper);
      alert("Preferences saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save preferences.");
    }
  };

  // ===================================================================
  //                          Helpers
  // ===================================================================
  const isDark = newTheme === "dark";

  const getInitials = (name) => {
    if (!name) return "NA";
    const n = name.trim().split(" ");
    if (n.length === 1) return n[0][0].toUpperCase();
    return (n[0][0] + n[1][0]).toUpperCase();
  };

  if (!user) return <p>Loading...</p>;

  // ===================================================================
  //                          JSX
  // ===================================================================
  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f2f2f2",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/chat")}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          borderRadius: "50%",
          padding: 8,
          cursor: "pointer",
          background: isDark ? "#444" : "#ddd",
          border: "none",
        }}
      >
        ⬅
      </button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ===================== Profile Card ===================== */}
      <div
        onClick={() => navigate("/edit-profile")}
        style={{
          display: "flex",
          alignItems: "center",
          padding: 15,
          background: isDark ? "#2b2b2b" : "#fff",
          borderRadius: 12,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        {profile.profilePic ? (
          <img
            src={profile.profilePic}
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              objectFit: "cover",
              marginRight: 12,
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
              fontSize: 26,
              fontWeight: "bold",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginRight: 12,
            }}
          >
            {getInitials(profile.name)}
          </div>
        )}

        <div>
          <p style={{ margin: 0, fontWeight: "bold", fontSize: 17 }}>
            {profile.name}
          </p>
          <p style={{ margin: 0, color: isDark ? "#ccc" : "#555" }}>
            {profile.bio || "No bio — tap to edit"}
          </p>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
            {profile.email}
          </p>
        </div>
      </div>

      {/* ===================== Wallet ===================== */}
      <Section title="Wallet" isDark={isDark}>
        <div
          onClick={() => navigate("/wallet")}
          style={{
            cursor: "pointer",
            padding: 10,
            borderRadius: 8,
            background: isDark ? "#333" : "#efefef",
          }}
        >
          <p style={{ margin: 0 }}>
            Balance:{" "}
            <strong style={{ color: "#00e676" }}>
              ${balance.toFixed(2)}
            </strong>
          </p>
          <small>Tap to view transactions</small>
        </div>

        <button
          onClick={handleDailyReward}
          disabled={checkedInToday || loadingReward}
          style={{
            ...btnStyle(checkedInToday ? "#555" : "#4caf50"),
            opacity: checkedInToday ? 0.6 : 1,
            marginTop: 12,
            width: "100%",
          }}
        >
          {loadingReward
            ? "Processing..."
            : checkedInToday
            ? "✔ Already Claimed Today"
            : "🧩 Daily Reward (+$0.25)"}
        </button>

        {/* Last 3 Transactions */}
        <h4 style={{ marginTop: 15 }}>Last 3 Transactions</h4>

        {transactions.slice(0, 3).map((tx) => (
          <div
            key={tx._id}
            onClick={() =>
              showPopup(
                <div>
                  <h3>Transaction Details</h3>
                  <p><b>Type:</b> {tx.type}</p>
                  <p><b>Amount:</b> ${tx.amount.toFixed(2)}</p>
                  <p><b>Date:</b> {new Date(tx.createdAt).toLocaleString()}</p>
                  <button onClick={hidePopup}>Close</button>
                </div>
              )
            }
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 10px",
              background: isDark ? "#333" : "#efefef",
              borderRadius: 8,
              marginBottom: 6,
              cursor: "pointer",
            }}
          >
            <span>{tx.type}</span>
            <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
              {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
            </span>
          </div>
        ))}
      </Section>

      {/* ===================== Preferences ===================== */}
      <Section title="Preferences" isDark={isDark}>
        <label>Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option>English</option>
          <option>French</option>
          <option>Spanish</option>
          <option>Arabic</option>
        </select>

        <label>Font Size</label>
        <select
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option>Small</option>
          <option>Medium</option>
          <option>Large</option>
        </select>

        <label>Layout</label>
        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option>Default</option>
          <option>Compact</option>
          <option>Spacious</option>
        </select>
      </Section>

      {/* ===================== Theme & Wallpaper ===================== */}
      <Section title="Theme & Wallpaper" isDark={isDark}>
        <label>Theme</label>
        <select
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <div
          onClick={handleWallpaperClick}
          style={{
            ...previewBox,
            backgroundImage: newWallpaper
              ? `url(${newWallpaper})`
              : "none",
          }}
        >
          {newWallpaper ? "" : "Tap to select wallpaper"}
        </div>

        {newWallpaper && (
          <button
            style={{ ...btnStyle("#e53935"), marginTop: 10 }}
            onClick={removeWallpaper}
          >
            Remove Wallpaper
          </button>
        )}

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleFileChange}
        />

        <button
          onClick={handleSavePreferences}
          style={{
            ...btnStyle("#007bff"),
            marginTop: 15,
            width: "100%",
            borderRadius: 20,
          }}
        >
          Save Preferences
        </button>
      </Section>

      {/* ===================== Notifications ===================== */}
      <Section title="Notifications" isDark={isDark}>
        <label>
          <input
            type="checkbox"
            checked={notifications.push}
            onChange={() =>
              setNotifications({ ...notifications, push: !notifications.push })
            }
          />{" "}
          Push Notifications
        </label>

        <label>
          <input
            type="checkbox"
            checked={notifications.email}
            onChange={() =>
              setNotifications({
                ...notifications,
                email: !notifications.email,
              })
            }
          />{" "}
          Email Alerts
        </label>

        <label>
          <input
            type="checkbox"
            checked={notifications.sound}
            onChange={() =>
              setNotifications({
                ...notifications,
                sound: !notifications.sound,
              })
            }
          />{" "}
          Sound Effects
        </label>
      </Section>

      {/* ===================== About ===================== */}
      <Section title="About App" isDark={isDark}>
        <p>Version: 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>
          Website:{" "}
          <a
            href="https://www.loechat.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#4a90e2" }}
          >
            www.loechat.com
          </a>
        </p>
      </Section>

      {/* ===================== Logout ===================== */}
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button
          onClick={async () => {
            await auth.signOut();
            navigate("/");
          }}
          style={{
            ...btnStyle("#d32f2f"),
            padding: "12px 25px",
            borderRadius: 12,
            fontSize: 16,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

/* ===================================================================
                         Shared Components & Styles
=================================================================== */

function Section({ title, children, isDark }) {
  return (
    <div
      style={{
        background: isDark ? "#2b2b2b" : "#fff",
        padding: 18,
        borderRadius: 12,
        marginTop: 22,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  );
}

const btnStyle = (bg) => ({
  background: bg,
  color: "#fff",
  padding: "10px 14px",
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
  height: 140,
  marginTop: 10,
  borderRadius: 12,
  border: "2px dashed #666",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundSize: "cover",
  backgroundPosition: "center",
  cursor: "pointer",
};