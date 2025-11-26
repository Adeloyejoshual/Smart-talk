import React, { useEffect, useState, useContext } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import ProfilePicture from "./ProfilePicture";

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [previewWallpaper, setPreviewWallpaper] = useState(wallpaper);
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const navigate = useNavigate();
  const backend = "https://smart-talk-zlxe.onrender.com";

  // -------------------- Load User + Wallet --------------------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return setUser(null);
      setUser(u);

      try {
        // Wallet from backend (MongoDB)
        const token = await u.getIdToken(true);
        const res = await fetch(`${backend}/api/wallet/${u.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setBalance(data.balance || 0);
          setTransactions(data.transactions || []);
        } else showPopup(data.error || "Failed to load wallet.");

        // User preferences & profile pic
        const userRes = await fetch(`${backend}/api/user/${u.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = await userRes.json();
        if (userData.preferences) {
          const p = userData.preferences;
          setLanguage(p.language || "English");
          setFontSize(p.fontSize || "Medium");
          setLayout(p.layout || "Default");
          setNewTheme(p.theme || "light");
          setNewWallpaper(p.wallpaper || wallpaper);
          setPreviewWallpaper(p.wallpaper || wallpaper);
        }
        setProfilePic(userData.profilePic || null);
      } catch (err) {
        console.error(err);
        showPopup("Failed to load user data. Check console.");
      }
    });

    return () => unsub();
  }, []);

  // -------------------- Daily Check-in --------------------
  const alreadyCheckedIn = transactions.some((t) => {
    if (t.type !== "checkin") return false;
    const txDate = new Date(t.createdAt || t.date);
    const today = new Date();
    return (
      txDate.getFullYear() === today.getFullYear() &&
      txDate.getMonth() === today.getMonth() &&
      txDate.getDate() === today.getDate()
    );
  });

  const handleDailyCheckin = async (e) => {
    e.stopPropagation();
    if (alreadyCheckedIn) return showPopup("✅ Already checked in today!");
    if (!user) return;

    try {
      const token = await user.getIdToken(true);
      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 0.25 }),
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setTransactions((prev) => [data.txn, ...prev]);
        showPopup("🎉 Daily reward claimed!");
      } else showPopup(data.error || "Failed to claim reward");
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim reward. Check console.");
    }
  };

  // -------------------- Cloudinary Upload --------------------
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET)
      throw new Error("Cloudinary environment not set");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: fd }
    );
    const data = await res.json();
    return data.secure_url || data.url;
  };

  // -------------------- Save Preferences --------------------
  const handleSavePreferences = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken(true);
      await fetch(`${backend}/api/user/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferences: { language, fontSize, layout, theme: newTheme, wallpaper: newWallpaper },
          notifications,
        }),
      });
      updateSettings(newTheme, newWallpaper);

      // If profile picture changed, upload it
      if (selectedFile) {
        const url = await uploadToCloudinary(selectedFile);
        setProfilePic(url);
        await fetch(`${backend}/api/user/profile-pic`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ profilePic: url }),
        });
      }

      showPopup("✅ Preferences saved!");
    } catch (err) {
      console.error(err);
      showPopup("Failed to save preferences");
    }
  };

  // -------------------- Logout --------------------
  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  return (
    <div
      style={{
        padding: 20,
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
        minHeight: "100vh",
      }}
    >
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

      {/* Profile Picture */}
      <Section title="Profile" isDark={isDark}>
        <ProfilePicture
          profilePic={profilePic}
          onChange={(file, previewUrl) => {
            setSelectedFile(file);
            setProfilePic(previewUrl);
          }}
        />
        <p style={{ textAlign: "center", marginTop: 10 }}>{user.email}</p>
      </Section>

      {/* Wallet Section */}
      <Section
        title="Wallet"
        isDark={isDark}
        onClick={() => navigate("/wallet")}
        style={{ cursor: "pointer" }}
      >
        <p>
          Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
        </p>
        <button
          onClick={handleDailyCheckin}
          disabled={alreadyCheckedIn}
          style={{ ...btnStyle(alreadyCheckedIn ? "#666" : "#4CAF50"), opacity: alreadyCheckedIn ? 0.7 : 1, marginBottom: 10 }}
        >
          {alreadyCheckedIn ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
      </Section>

      {/* Preferences */}
      <Section title="User Preferences" isDark={isDark}>
        <label>Language:</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle(isDark)}>
          <option>English</option>
          <option>French</option>
          <option>Spanish</option>
          <option>Arabic</option>
        </select>
        <label>Font Size:</label>
        <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={selectStyle(isDark)}>
          <option>Small</option>
          <option>Medium</option>
          <option>Large</option>
        </select>
        <label>Layout:</label>
        <select value={layout} onChange={(e) => setLayout(e.target.value)} style={selectStyle(isDark)}>
          <option>Default</option>
          <option>Compact</option>
          <option>Spacious</option>
        </select>
      </Section>

      {/* Theme & Wallpaper */}
      <Section title="Theme & Wallpaper" isDark={isDark}>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={selectStyle(isDark)}>
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>
        <div
          onClick={() => document.getElementById("wallpaperInput").click()}
          style={{ ...previewBox, backgroundImage: previewWallpaper ? `url(${previewWallpaper})` : "none" }}
        >
          <p>🌈 Wallpaper Preview</p>
        </div>
        <input
          type="file"
          id="wallpaperInput"
          accept="image/*"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => setPreviewWallpaper(ev.target.result);
            reader.readAsDataURL(file);
            const url = await uploadToCloudinary(file);
            setNewWallpaper(url);
            updateSettings(newTheme, url);
          }}
        />
        <button onClick={handleSavePreferences} style={btnStyle("#007bff")}>💾 Save Preferences</button>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" isDark={isDark}>
        <label><input type="checkbox" checked={notifications.push} onChange={() => setNotifications({ ...notifications, push: !notifications.push })}/> Push Notifications</label>
        <label><input type="checkbox" checked={notifications.email} onChange={() => setNotifications({ ...notifications, email: !notifications.email })}/> Email Alerts</label>
        <label><input type="checkbox" checked={notifications.sound} onChange={() => setNotifications({ ...notifications, sound: !notifications.sound })}/> Sounds</label>
      </Section>

      {/* About */}
      <Section title="About" isDark={isDark}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>Terms of Service | Privacy Policy</p>
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>
    </div>
  );
}

// -------------------- Section --------------------
function Section({ title, children, isDark, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: isDark ? "#2b2b2b" : "#fff",
        padding: 20,
        borderRadius: 12,
        marginTop: 25,
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        ...style,
      }}
    >
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// -------------------- Styles --------------------
const btnStyle = (bg) => ({ marginRight: 8, padding: "10px 15px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });
const previewBox = { width: "100%", height: 150, borderRadius: 10, border: "2px solid #555", marginTop: 15, display: "flex", justifyContent: "center", alignItems: "center", backgroundSize: "cover", backgroundPosition: "center" };