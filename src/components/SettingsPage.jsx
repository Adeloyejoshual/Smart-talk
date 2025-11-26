// src/components/SettingsPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, orderBy, serverTimestamp } from "firebase/firestore";
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
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

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

  const handleSaveAll = async () => {
    if (!user) return alert("Not signed in");
    setLoadingSave(true);

    try {
      const userRef = doc(db, "users", user.uid);
      let profileUrl = profilePic;

      if (selectedFile) {
        profileUrl = await uploadToCloudinary(selectedFile);
      } else if (profilePic?.startsWith("data:")) {
        const res = await fetch(profilePic);
        const blob = await res.blob();
        profileUrl = await uploadToCloudinary(blob);
      }

      const prefs = { theme: newTheme, wallpaper: newWallpaper || null, language, fontSize, layout, notifications };

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

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const isDark = newTheme === "dark";

  // ===================== JSX =====================
  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: isDark ? "#2b2b2b" : "#fff", padding: 16, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", marginBottom: 25, position: "relative" }}>
        <div onClick={() => profileInputRef.current?.click()} style={{ width: 88, height: 88, borderRadius: 44, background: profilePic ? `url(${profilePic}) center/cover` : "#888", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", fontWeight: "bold" }} title="Click to change profile photo">
          {!profilePic && (name?.[0] || "U")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name || "Unnamed User"}</h3>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setMenuOpen((s) => !s)} style={{ border: "none", background: "transparent", color: isDark ? "#fff" : "#222", cursor: "pointer", fontSize: 20, padding: 6 }}>⋮</button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 34, background: isDark ? "#1a1a1a" : "#fff", color: isDark ? "#fff" : "#000", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 60, minWidth: 180 }}>
                  <button onClick={() => setEditing(true)} style={menuItemStyle}>Edit Info</button>
                  <button onClick={() => profileInputRef.current?.click()} style={menuItemStyle}>Set Profile Photo</button>
                  <button onClick={handleLogout} style={menuItemStyle}>Log Out</button>
                </div>
              )}
            </div>
          </div>
          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555", overflowWrap: "anywhere" }}>{bio || "No bio yet — click ⋮ → Edit Info to add one."}</p>
          <p style={{ margin: 0, color: isDark ? "#bbb" : "#777", fontSize: 13 }}>{email}</p>
        </div>
      </div>

      <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onProfileFileChange} />

      {/* Editing Panel */}
      {editing && (
        <div style={{ marginTop: 18, background: isDark ? "#1f1f1f" : "#fff", padding: 16, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginTop: 0 }}>Edit Profile</h3>
          <label style={labelStyle}>Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(isDark)} />
          <label style={labelStyle}>Bio</label>
          <input value={bio} onChange={(e) => setBio(e.target.value)} style={inputStyle(isDark)} />

          <label style={labelStyle}>Profile Photo (Preview)</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 10, background: profilePic ? `url(${profilePic}) center/cover` : "#999" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => profileInputRef.current?.click()} style={btnStyle("#007bff")}>Choose Photo</button>
              <button onClick={() => { setProfilePic(null); setSelectedFile(null); }} style={btnStyle("#d32f2f")}>Remove</button>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={handleSaveAll} disabled={loadingSave} style={btnStyle("#007bff")}>{loadingSave ? "Saving…" : "💾 Save Profile & Settings"}</button>
            <button onClick={() => { setEditing(false); setSelectedFile(null); }} style={btnStyle("#888")}>Cancel</button>
          </div>
        </div>
      )}
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
});