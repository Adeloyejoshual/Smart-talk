// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const navigate = useNavigate();

  // -------------------- State --------------------
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);

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

  // -------------------- Load user + live snapshot --------------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return setUser(null);
      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);

      // Ensure user doc exists
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          email: u.email || "",
          profilePic: null,
          balance: 5.0,
          lastCheckin: null,
          preferences: {
            theme: "light",
            wallpaper: null,
            language: "English",
            fontSize: "Medium",
            layout: "Default",
            notifications: { push: true, email: true, sound: false },
          },
          createdAt: serverTimestamp(),
        });
        alert("🎁 Welcome! You’ve received a $5 new user bonus!");
      }

      // Live updates for profile & preferences
      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();

        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        setBalance(data.balance || 0);
        checkLastCheckin(data.lastCheckin);

        if (data.preferences) {
          const p = data.preferences;
          setNewTheme(p.theme || "light");
          setNewWallpaper(p.wallpaper || wallpaper || "");
          setLanguage(p.language || "English");
          setFontSize(p.fontSize || "Medium");
          setLayout(p.layout || "Default");
          setNotifications(p.notifications || { push: true, email: true, sound: false });
          updateSettings(p.theme || "light", p.wallpaper || wallpaper || "");
        }
      });

      // Transactions
      const txRef = collection(db, "transactions");
      const txQuery = query(txRef, where("uid", "==", u.uid), orderBy("createdAt", "desc"));
      const unsubTx = onSnapshot(txQuery, (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      return () => {
        unsubSnap();
        unsubTx();
      };
    });

    return () => unsubAuth();
  }, []);

  // -------------------- Daily Check-in --------------------
  const checkLastCheckin = (lastCheckin) => {
    if (!lastCheckin) return setCheckedInToday(false);
    const lastDate = new Date(lastCheckin.seconds * 1000);
    const today = new Date();
    setCheckedInToday(
      lastDate.getDate() === today.getDate() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getFullYear() === today.getFullYear()
    );
  };

  const handleDailyCheckin = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const lastCheckin = data.lastCheckin ? new Date(data.lastCheckin.seconds * 1000) : null;
    const today = new Date();

    if (
      lastCheckin &&
      lastCheckin.getDate() === today.getDate() &&
      lastCheckin.getMonth() === today.getMonth() &&
      lastCheckin.getFullYear() === today.getFullYear()
    ) {
      alert("✅ You already checked in today!");
      return;
    }

    const newBalance = (data.balance || 0) + 0.25;
    await updateDoc(userRef, { balance: newBalance, lastCheckin: serverTimestamp() });
    setCheckedInToday(true);
    alert("🎉 You earned +$0.25 for your daily check-in!");
  };

  // -------------------- Cloudinary Upload --------------------
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

  // -------------------- Handlers --------------------
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
      const userRef = doc(db, "users", user.uid);
      let profileUrl = profilePic;

      if (selectedFile) {
        profileUrl = await uploadToCloudinary(selectedFile);
      } else if (profilePic && profilePic.startsWith("data:")) {
        const blob = await (await fetch(profilePic)).blob();
        profileUrl = await uploadToCloudinary(blob);
      }

      const prefs = {
        theme: newTheme,
        wallpaper: newWallpaper || null,
        language,
        fontSize,
        layout,
        notifications,
      };

      await updateDoc(userRef, {
        name: name || null,
        bio: bio || "",
        profilePic: profileUrl || null,
        preferences: prefs,
      });

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

  const handleSavePreferences = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      preferences: { theme: newTheme, wallpaper: newWallpaper, language, fontSize, layout, notifications },
    });
    updateSettings(newTheme, newWallpaper);
    alert("✅ Preferences saved successfully!");
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const onKeySave = (e) => { if (e.key === "Enter") handleSaveAll(); };
  const handleWallpaperClick = () => wallpaperInputRef.current.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewWallpaper(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // ===================== JSX =====================
  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      {/* Back Button */}
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, background: isDark ? "#555" : "#e0e0e0", border: "none", borderRadius: "50%", padding: 8, cursor: "pointer" }}>
        ⬅
      </button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: isDark ? "#2b2b2b" : "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          marginBottom: 25,
          position: "relative",
        }}
      >
        <div
          onClick={() => profileInputRef.current?.click()}
          style={{
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
          }}
          title="Click to change profile photo"
        >
          {!profilePic && getInitials(name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name || "Unnamed User"}
            </h3>

            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setMenuOpen((s) => !s)} style={{ border: "none", background: "transparent", color: isDark ? "#fff" : "#222", cursor: "pointer", fontSize: 20, padding: 6 }}>
                ⋮
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 34, background: isDark ? "#1a1a1a" : "#fff", color: isDark ? "#fff" : "#000", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 60, minWidth: 180 }}>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={{ ...menuItemStyle, color: isDark ? "#fff" : "#000" }}>Edit Info</button>
                  <button onClick={() => { profileInputRef.current?.click(); setMenuOpen(false); }} style={{ ...menuItemStyle, color: isDark ? "#fff" : "#000" }}>Set Profile Photo</button>
                  <button onClick={handleLogout} style={{ ...menuItemStyle, color: isDark ? "#fff" : "#000" }}>Log Out</button>
                </div>
              )}
            </div>
          </div>

          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555", overflowWrap: "anywhere" }}>
            {bio || "No bio yet — click ⋮ → Edit Info to add one."}
          </p>
          <p style={{ margin: 0, color: isDark ? "#bbb" : "#777", fontSize: 13 }}>{email}</p>
        </div>
      </div>

      <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onProfileFileChange} />

      {/* ================= Wallet Card ================= */}
      <Section title="Wallet" isDark={isDark}>
        <p>
          Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
        </p>
        <button onClick={handleDailyCheckin} disabled={checkedInToday} style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), opacity: checkedInToday ? 0.7 : 1 }}>
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>

        <div style={{ marginTop: 12 }}>
          <button onClick={() => navigate("/topup")} style={btnStyle(isDark ? "#3399ff" : "#007bff")}>💳 Top Up</button>
          <button onClick={() => navigate("/withdrawal")} style={btnStyle(isDark ? "#33cc66" : "#28a745")}>💸 Withdraw</button>
        </div>

        {/* Recent Transactions */}
        <div style={{ marginTop: 15 }}>
          <h4 style={{ marginBottom: 8 }}>Last 3 Transactions</h4>
          {transactions.length === 0 ? (
            <p style={{ fontSize: 14, opacity: 0.6 }}>No recent transactions.</p>
          ) : (
            transactions.slice(0, 3).map((tx) => (
              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", marginBottom: 6, background: isDark ? "#3b3b3b" : "#f0f0f0", borderRadius: 8, fontSize: 14 }}>
                <span>{tx.type}</span>
                <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
                  {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* ================= Preferences ================= */}
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

      {/* ================= Theme & Wallpaper ================= */}
      <Section title="Theme & Wallpaper" isDark={isDark}>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={selectStyle(isDark)}>
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div onClick={handleWallpaperClick} style={{ ...previewBox, backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none" }}>
          <p style={{ color: isDark ? "#ddd" : "#555" }}>{newWallpaper ? "Wallpaper Selected" : "🌈 Wallpaper Preview"}</p>
        </div>
        <input type="file" accept="image/*" ref={wallpaperInputRef} style={{ display: "none"onChange={handleFileChange} />

        <button onClick={handleSavePreferences} style={btnStyle("#007bff")}>💾 Save Preferences</button>
      </Section>

      {/* ================= Notifications ================= */}
      <Section title="Notifications" isDark={isDark}>
        <label>
          <input
            type="checkbox"
            checked={notifications.push}
            onChange={() => setNotifications({ ...notifications, push: !notifications.push })}
          /> Push Notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.email}
            onChange={() => setNotifications({ ...notifications, email: !notifications.email })}
          /> Email Alerts
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.sound}
            onChange={() => setNotifications({ ...notifications, sound: !notifications.sound })}
          /> Sounds
        </label>
      </Section>

      {/* ================= About ================= */}
      <Section title="About" isDark={isDark}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>Terms of Service | Privacy Policy</p>
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>

      {/* ================= Editing Panel ================= */}
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

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Theme</label>
            <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={inputStyle(isDark)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>

            <label style={labelStyle}>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle(isDark)}>
              <option>English</option>
              <option>French</option>
              <option>Spanish</option>
              <option>Arabic</option>
            </select>
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

/* =================== Section Wrapper =================== */
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* =================== Styles =================== */
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