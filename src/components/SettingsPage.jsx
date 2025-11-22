// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "firebase/auth";
import { ThemeContext } from "../context/ThemeContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Backend URL
const backend = import.meta.env.VITE_BACKEND_URL;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const navigate = useNavigate();

  // -------------------- State --------------------
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState({});
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loadingReward, setLoadingReward] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

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

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);

  // -------------------- Refs --------------------
  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // ================= Load user & wallet =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;
      setUser(userAuth);

      try {
        const token = await userAuth.getIdToken(true);
        const res = await axios.get(`${backend}/api/wallet/${userAuth.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setBalance(res.data.balance || 0);
        setTransactions(res.data.transactions || []);

        // last daily reward
        const lastClaim = res.data.lastDailyClaim ? new Date(res.data.lastDailyClaim) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (lastClaim) {
          lastClaim.setHours(0, 0, 0, 0);
          setCheckedInToday(lastClaim.getTime() === today.getTime());
        }

        // Profile data
        if (res.data.profile) {
          const data = res.data.profile;
          setProfileData({
            name: data.name || "",
            bio: data.bio || "",
            profilePic: data.profilePic || "",
            email: data.email || userAuth.email,
          });
          setName(data.name || "");
          setBio(data.bio || "");
          setProfilePic(data.profilePic || null);

          if (data.preferences) {
            const p = data.preferences;
            setLanguage(p.language || "English");
            setFontSize(p.fontSize || "Medium");
            setLayout(p.layout || "Default");
            setNewTheme(p.theme || "light");
            setNewWallpaper(p.wallpaper || wallpaper || "");
          }
        }
      } catch (err) {
        console.error(err);
      }
    });
    return () => unsub();
  }, []);

  // ================= Daily Reward =================
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
        setCheckedInToday(true);
        alert("🎉 Daily reward claimed! +$0.25");
      } else if (res.data.error?.toLowerCase().includes("already claimed")) {
        setCheckedInToday(true);
        alert("✅ You already claimed today's reward!");
      } else {
        alert(res.data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ================= Cloudinary Upload =================
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET)
      throw new Error("Cloudinary environment not set");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error("Cloudinary upload failed");

    const data = await res.json();
    return data.secure_url || data.url;
  };

  // ================= Handlers =================
  const onProfileFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target.result);
    reader.readAsDataURL(f);
  };

  const onWallpaperFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewWallpaper(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSaveAll = async () => {
    if (!user) return alert("Not signed in");
    setLoadingSave(true);

    try {
      let profileUrl = profilePic;

      if (selectedFile) {
        profileUrl = await uploadToCloudinary(selectedFile);
      } else if (profilePic?.startsWith("data:")) {
        const res = await fetch(profilePic);
        const blob = await res.blob();
        profileUrl = await uploadToCloudinary(blob);
      }

      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `${backend}/api/profile/update`,
        {
          name,
          bio,
          profilePic: profileUrl,
          preferences: { theme: newTheme, wallpaper: newWallpaper, language, fontSize, layout, notifications },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      updateSettings(newTheme, newWallpaper || "");
      setSelectedFile(null);
      setMenuOpen(false);
      setEditing(false);
      alert("✅ Profile & settings saved");
    } catch (err) {
      console.error(err);
      alert("Failed to save: " + err.message);
    } finally {
      setLoadingSave(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  const onKeySave = (e) => { if (e.key === "Enter") handleSaveAll(); };
  const handleWallpaperClick = () => wallpaperInputRef.current.click();

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  // ================= JSX =================
  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      <button onClick={() => navigate("/chat")} style={backBtnStyle(isDark)}>⬅</button>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Profile Card */}
      <div style={profileCardStyle(isDark)}>
        <div
          onClick={() => profileInputRef.current?.click()}
          style={profilePicStyle(profilePic, name)}
          title="Click to change profile photo"
        >
          {!profilePic && (name?.[0] || "U")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name || "Unnamed User"}
            </h3>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setMenuOpen((s) => !s)} style={menuBtnStyle(isDark)}>⋮</button>
              {menuOpen && (
                <div style={menuDropdownStyle(isDark)}>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={menuItemStyle}>Edit Info</button>
                  <button onClick={() => { profileInputRef.current?.click(); setMenuOpen(false); }} style={menuItemStyle}>Set Profile Photo</button>
                  <button onClick={handleLogout} style={menuItemStyle}>Log Out</button>
                </div>
              )}
            </div>
          </div>
          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555", overflowWrap: "anywhere" }}>{bio || "No bio yet — click ⋮ → Edit Info to add one."}</p>
          <p style={{ margin: 0, color: isDark ? "#bbb" : "#777", fontSize: 13 }}>{profileData.email}</p>
        </div>
      </div>

      <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onProfileFileChange} />

      {/* Wallet Section */}
      <Section title="Wallet" isDark={isDark}>
        <div onClick={() => navigate("/wallet")} style={{ cursor: "pointer", marginBottom: 10 }}>
          <p style={{ margin: 0 }}>
            Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
          </p>
        </div>
        <button onClick={handleDailyReward} disabled={loadingReward || checkedInToday} style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), opacity: checkedInToday ? 0.7 : 1, marginBottom: 15, width: "100%" }}>
          {loadingReward ? "Processing..." : checkedInToday ? "✅ Checked In Today" : "🧩 Daily Reward (+$0.25)"}
        </button>
        <div>
          <h4 style={{ marginBottom: 8 }}>Last 3 Transactions</h4>
          {transactions.length === 0 ? (
            <p style={{ fontSize: 14, opacity: 0.6 }}>No recent transactions.</p>
          ) : (
            transactions.slice(0, 3).map((tx) => (
              <div key={tx._id || tx.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", marginBottom: 6, background: isDark ? "#3b3b3b" : "#f0f0f0", borderRadius: 8, fontSize: 14 }}>
                <span>{tx.type}</span>
                <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>{tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* User Preferences */}
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
        <div onClick={handleWallpaperClick} style={{ ...previewBox, backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none" }}>
          <p>🌈 Wallpaper Preview</p>
        </div>
        <input type="file" accept="image/*" ref={wallpaperInputRef} style={{ display: "none" }} onChange={onWallpaperFileChange} />
      </Section>

      {/* Notifications */}
      <Section title="Notifications" isDark={isDark}>
        <label><input type="checkbox" checked={notifications.push} onChange={() => setNotifications({ ...notifications, push: !notifications.push })}/> Push Notifications</label>
        <label><input type="checkbox" checked={notifications.email} onChange={() => setNotifications({ ...notifications, email: !notifications.email })}/> Email Alerts</label>
        <label><input type="checkbox" checked={notifications.sound} onChange={() => setNotifications({ ...notifications, sound: !notifications.sound })}/> Sounds</label>
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>

      {/* Editing Panel */}
      {editing && (
        <div style={{ marginTop: 18, background: isDark ? "#1f1f1f" : "#fff", padding: 16, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginTop: 0 }}>Edit Profile</h3>
          <label style={labelStyle}>Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeySave} style={inputStyle(isDark)} />
          <label style={labelStyle}>Bio</label>
          <input value={bio} onChange={(e) => setBio(e.target.value)} onKeyDown={onKeySave} style={inputStyle(isDark)} />
          <label style={labelStyle}>Profile Photo (Preview)</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 10, background: profilePic ? `url(${profilePic}) center/cover` : "#999" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => profileInputRef.current?.click()} style={btnStyle("#007bff")}>Choose Photo</button>
              <button onClick={() => { setProfilePic(null); setSelectedFile(null); }} style={btnStyle("#d32f2f")}>Remove</button>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={handleSaveAll} disabled={loadingSave} style={btnStyle("#007bff")}>
              {loadingSave ? "Saving…" : "💾 Save Profile & Settings"}
            </button>
            <button onClick={() => { setEditing(false); setSelectedFile(null); }} style={btnStyle("#888")}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== Section Wrapper ===================
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// =================== Styles ===================
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

const backBtnStyle = (isDark) => ({
  position: "absolute",
  top: 20,
  left: 20,
  background: isDark ? "#555" : "#e0e0e0",
  border: "none",
  borderRadius: "50%",
  padding: 8,
  cursor: "pointer",
});

const profileCardStyle = (isDark) => ({
  display: "flex",
  alignItems: "center",
  gap: 16,
  background: isDark ? "#2b2b2b" : "#fff",
  padding: 16,
  borderRadius: 12,
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  marginBottom: 25,
  position: "relative",
});

const profilePicStyle = (profilePic, name) => ({
  width: 88,
  height: 88,
  borderRadius: 44,
  background: profilePic ? `url(${profilePic}) center/cover` : "#888",
  cursor: "pointer",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  color: "#fff",
  fontWeight: "bold",
});

const menuBtnStyle = (isDark) => ({
  border: "none",
  background: "transparent",
  color: isDark ? "#fff" : "#222",
  cursor: "pointer",
  fontSize: 20,
  padding: 6,
});

const menuDropdownStyle = (isDark) => ({
  position: "absolute",
  right: 0,
  top: 34,
  background: isDark ? "#1a1a1a" : "#fff",
  color: isDark ? "#fff" : "#000",
  borderRadius: 8,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
  overflow: "hidden",
  zIndex: 60,
  minWidth: 180,
});

const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
};

const labelStyle = {
  display: "block",
  marginTop: 8,
  marginBottom: 6,
  fontSize: 13,
  color: "#666",
};

const inputStyle = (isDark) => ({
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: isDark ? "#121212" : "#fff",
  color: isDark ? "#fff" : "#111",
  boxSizing: "border-box",
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