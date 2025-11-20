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

// Cloudinary environment
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);

  // Profile
  const [name, setName] = useState("Ahah");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("adeloye1@gmail.com");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Settings
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

  // Wallet
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);

  // UI
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);

  const navigate = useNavigate();
  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // -------------------- Load User & Preferences --------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return setUser(null);
      setUser(userAuth);
      setEmail(userAuth.email || "adeloye1@gmail.com");

      const userRef = doc(db, "users", userAuth.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: userAuth.displayName || "Ahah",
          bio: "",
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
      } else {
        const data = snap.data();
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
        setBalance(data.balance || 0);
      }

      // Wallet updates
      const unsubBalance = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBalance(data.balance || 0);
          checkLastCheckin(data.lastCheckin);
        }
      });

      // Transactions
      const txRef = collection(db, "transactions");
      const txQuery = query(txRef, where("uid", "==", userAuth.uid), orderBy("createdAt", "desc"));
      const unsubTx = onSnapshot(txQuery, (snapshot) => {
        setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      return () => {
        unsubBalance();
        unsubTx();
      };
    });

    return () => unsubscribe();
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
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const data = userSnap.data();
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

  // -------------------- File Uploads --------------------
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

  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
      throw new Error("Cloudinary environment not set");
    }
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

  // -------------------- Save Profile & Settings --------------------
  const handleSaveAll = async () => {
    if (!user) return alert("Not signed in");
    setLoadingSave(true);
    try {
      const userRef = doc(db, "users", user.uid);
      let profileUrl = profilePic;
      if (selectedFile) profileUrl = await uploadToCloudinary(selectedFile);
      else if (profilePic?.startsWith("data:")) {
        const blob = await (await fetch(profilePic)).blob();
        profileUrl = await uploadToCloudinary(blob);
      }

      const prefs = { theme: newTheme, wallpaper: newWallpaper || null, language, fontSize, layout, notifications };

      await updateDoc(userRef, { name, bio, profilePic: profileUrl || null, preferences: prefs });
      updateSettings(newTheme, newWallpaper || "");
      setEditing(false);
      setSelectedFile(null);
      alert("✅ Profile & settings saved");
    } catch (err) {
      console.error(err);
      alert("Failed to save: " + (err.message || String(err)));
    } finally {
      setLoadingSave(false);
    }
  };

  // -------------------- Logout --------------------
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      {/* Back */}
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, border: "none", borderRadius: "50%", padding: 8, background: isDark ? "#555" : "#e0e0e0", cursor: "pointer" }}>⬅</button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Profile Card */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: isDark ? "#111" : "#fff", padding: 16, borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.06)", position: "relative", marginBottom: 20 }}>
        <div onClick={() => profileInputRef.current?.click()} style={{ width: 88, height: 88, borderRadius: 44, background: profilePic ? `url(${profilePic}) center/cover` : "#8b8b8b", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22, cursor: "pointer" }} title="Click to change profile photo" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</h2>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setMenuOpen(s => !s)} style={{ border: "none", background: "transparent", color: isDark ? "#fff" : "#222", cursor: "pointer", fontSize: 20, padding: 6 }}>⋮</button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 34, background: isDark ? "#1a1a1a" : "#fff", color: isDark ? "#fff" : "#000", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 60, minWidth: 180 }}>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={menuItemStyle}>Edit Info</button>
                  <button onClick={() => profileInputRef.current?.click()} style={menuItemStyle}>Set Profile Photo</button>
                  <button onClick={handleLogout} style={menuItemStyle}>Log Out</button>
                </div>
              )}
            </div>
          </div>
          <p style={{ margin: "8px 0", color: isDark ? "#cfcfcf" : "#666", overflowWrap: "anywhere" }}>{bio || "No bio yet — click ⋮ → Edit Info to add one."}</p>
          <p style={{ margin: 0, color: isDark ? "#bdbdbd" : "#777", fontSize: 13 }}>{email}</p>
        </div>
      </div>

      {/* Editable Profile Card */}
      {editing && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, background: isDark ? "#111" : "#fff", padding: 16, borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <div style={{ width: 88, height: 88, borderRadius: 44, background: profilePic ? `url(${profilePic}) center/cover` : "#8b8b8b", cursor: "pointer" }} onClick={() => profileInputRef.current?.click()} />
          <label style={labelStyle}>Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(isDark)} />
          <label style={labelStyle}>Bio</label>
          <input value={bio} onChange={(e) => setBio(e.target.value)} style={inputStyle(isDark)} />
          <label style={labelStyle}>Profile Photo (Preview)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 10, background: profilePic ? `url(${profilePic}) center/cover` : "#999" }} />
            <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
              <button onClick={() => profileInputRef.current?.click()} style={btnStyle("#007bff")}>Choose Photo</button>
              <button onClick={() => { setProfilePic(null); setSelectedFile(null); }} style={btnStyle("#d32f2f")}>Remove</button>
            </div>
          </div>

          {/* Theme & Wallpaper Editable */}
          <label style={labelStyle}>Theme</label>
          <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={inputStyle(isDark)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>

          <label style={labelStyle}>Wallpaper (Preview)</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 10, border: "1px solid #ccc", background: newWallpaper ? `url(${newWallpaper}) center/cover` : "#999" }} />
            <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
              <button onClick={() => wallpaperInputRef.current?.click()} style={btnStyle("#007bff")}>Choose Wallpaper</button>
              <button onClick={() => setNewWallpaper(null)} style={btnStyle("#d32f2f")}>Remove Wallpaper</button>
            </div>
          </div>

          <input type="file" accept="image/*" ref={profileInputRef} style={{ display: "none" }} onChange={onProfileFileChange} />
          <input type="file" accept="image/*" ref={wallpaperInputRef} style={{ display: "none" }} onChange={onWallpaperFileChange} />

          <button onClick={handleSaveAll} disabled={loadingSave} style={{ padding: "10px 25px", borderRadius: 50, background: "#007bff", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold", marginTop: 12 }}>
            Save
          </button>
        </div>
      )}

      {/* Wallet, Preferences, Notifications, About */}
      <Section title="Wallet" isDark={isDark}>
        <p>Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong></p>
        <button onClick={handleDailyCheckin} disabled={checkedInToday} style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), opacity: checkedInToday ? 0.7 : 1 }}>
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
        <div style={{ marginTop: 10 }}>
          <button onClick={() => navigate("/topup")} style={btnStyle("#007bff")}>💳 Top Up</button>
          <button onClick={() => navigate("/withdrawal")} style={btnStyle("#28a745")}>💸 Withdraw</button>
        </div>
      </Section>

      <Section title="User Preferences" isDark={isDark}>
        <label>Language:</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle(isDark)}>
          <option>English</option><option>French</option><option>Spanish</option><option>Arabic</option>
        </select>

        <label>Font Size:</label>
        <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={selectStyle(isDark)}>
          <option>Small</option><option>Medium</option><option>Large</option>
        </select>

        <label>Layout:</label>
        <select value={layout} onChange={(e) => setLayout(e.target.value)} style={selectStyle(isDark)}>
          <option>Default</option><option>Compact</option><option>Spacious</option>
        </select>
      </Section>

      <Section title="Notifications" isDark={isDark}>
        <label><input type="checkbox" checked={notifications.push} onChange={() => setNotifications({...notifications, push: !notifications.push})}/> Push Notifications</label>
        <label>
          <input
            type="checkbox"
            checked={notifications.email}
            onChange={() => setNotifications({ ...notifications, email: !notifications.email })}
          />{" "}
          Email Alerts
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.sound}
            onChange={() => setNotifications({ ...notifications, sound: !notifications.sound })}
          />{" "}
          Sounds
        </label>
      </Section>

      <Section title="About" isDark={isDark}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>Terms of Service | Privacy Policy</p>
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleLogout} style={{ ...btnStyle("#d32f2f"), borderRadius: 50 }}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

/* === Section Wrapper === */
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
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* === Reusable Styles === */
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

const inputStyle = (isDark) => ({
  width: "100%",
  padding: 8,
  marginBottom: 10,
  borderRadius: 6,
  border: "1px solid #666",
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
});

const labelStyle = {
  width: "100%",
  marginBottom: 4,
  fontWeight: 500,
};

const menuItemStyle = {
  width: "100%",
  padding: "10px 12px",
  textAlign: "left",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 500,
};