// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Cloudinary env --------------------
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);

  const [user, setUser] = useState(null);

  // profile
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  const [selectedProfileFile, setSelectedProfileFile] = useState(null);
  const [selectedWallpaperFile, setSelectedWallpaperFile] = useState(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState(null);

  // preferences
  const [newTheme, setNewTheme] = useState(theme);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({
    push: true,
    email: true,
    sound: false,
  });

  // wallet
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);

  const navigate = useNavigate();
  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const audioInputRef = useRef(null);

  const [loadingSave, setLoadingSave] = useState(false);
  const [editing, setEditing] = useState(false);
  const isDark = newTheme === "dark";

  // -------------------- Load user & Firestore --------------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return setUser(null);
      setUser(u);
      setEmail(u.email || "");
      const userRef = doc(db, "users", u.uid);

      // ensure doc exists
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          profilePic: null,
          wallpaper: null,
          audio: null,
          balance: 5.0,
          lastCheckin: null,
          preferences: {
            theme: "light",
            language: "English",
            fontSize: "Medium",
            layout: "Default",
            notifications: { push: true, email: true, sound: false },
          },
          createdAt: serverTimestamp(),
        });
        alert("🎁 Welcome! You’ve received a $5 new user bonus!");
      }

      // live user snapshot
      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        setWallpaperUrl(data.wallpaper || "");
        setAudioUrl(data.audio || null);

        if (data.preferences) {
          const p = data.preferences;
          setNewTheme(p.theme || "light");
          setLanguage(p.language || "English");
          setFontSize(p.fontSize || "Medium");
          setLayout(p.layout || "Default");
          setNotifications(p.notifications || { push: true, email: true, sound: false });
          updateSettings(p.theme || "light", p.wallpaper || wallpaper || "");
        }

        setBalance(data.balance || 0);
        checkLastCheckin(data.lastCheckin);
      });

      // transactions
      const txRef = collection(db, "transactions");
      const txQuery = query(
        txRef,
        where("uid", "==", u.uid),
        orderBy("createdAt", "desc")
      );
      const unsubTx = onSnapshot(txQuery, (snap) =>
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      );

      return () => {
        unsubSnap();
        unsubTx();
      };
    });

    return () => unsubAuth();
  }, []);

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
      return alert("✅ Already checked in today!");
    }

    await updateDoc(userRef, {
      balance: (data.balance || 0) + 0.25,
      lastCheckin: serverTimestamp(),
    });
    setCheckedInToday(true);
    alert("🎉 +$0.25 for daily check-in!");
  };

  // -------------------- Cloudinary Upload --------------------
  const uploadToCloudinary = async (file, type = "image") => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
      throw new Error(
        "Cloudinary env not set. Define VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET"
      );
    }
    const resourceType = type === "audio" ? "raw" : type === "video" ? "video" : "image";

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`,
      { method: "POST", body: fd }
    );

    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url || data.url;
  };

  // -------------------- File Handlers --------------------
  const handleProfileFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedProfileFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleWallpaperFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedWallpaperFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setWallpaperUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAudioFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedAudioFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAudioUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  // -------------------- Save All --------------------
  const handleSaveAll = async () => {
    if (!user) return alert("Not signed in");
    setLoadingSave(true);

    try {
      const userRef = doc(db, "users", user.uid);
      let profileUrl = profilePic;
      let wallUrl = wallpaperUrl;
      let audUrl = audioUrl;

      if (selectedProfileFile) profileUrl = await uploadToCloudinary(selectedProfileFile, "image");
      if (selectedWallpaperFile) wallUrl = await uploadToCloudinary(selectedWallpaperFile, "image");
      if (selectedAudioFile) audUrl = await uploadToCloudinary(selectedAudioFile, "audio");

      await updateDoc(userRef, {
        name: name || null,
        bio: bio || "",
        profilePic: profileUrl || null,
        wallpaper: wallUrl || null,
        audio: audUrl || null,
        preferences: {
          theme: newTheme,
          language,
          fontSize,
          layout,
          notifications,
        },
      });

      updateSettings(newTheme, wallUrl);
      setSelectedProfileFile(null);
      setSelectedWallpaperFile(null);
      setSelectedAudioFile(null);
      setEditing(false);
      alert("✅ Profile & preferences saved!");
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

  if (!user) return <p>Loading user...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, padding: 8, borderRadius: "50%", border: "none", background: isDark ? "#555" : "#e0e0e0", cursor: "pointer" }}>⬅</button>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Profile & Media */}
      <Section title="Profile" isDark={isDark}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            onClick={() => profileInputRef.current.click()}
            style={{
              width: 88, height: 88, borderRadius: "50%",
              background: profilePic ? `url(${profilePic}) center/cover` : "#888",
              cursor: "pointer",
            }}
          />
          <div>
            <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfileFile} />
            <input ref={wallpaperInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleWallpaperFile} />
            <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleAudioFile} />
            <p>{name || "Unnamed"}</p>
            <p>{bio || "No bio"}</p>
            <p>{email}</p>
          </div>
        </div>

        <button onClick={() => wallpaperInputRef.current.click()} style={btnStyle("#007bff")}>Change Wallpaper</button>
        {wallpaperUrl && <div style={{ marginTop: 10, width: "100%", height: 120, background: `url(${wallpaperUrl}) center/cover`, borderRadius: 8 }} />}
        <button onClick={() => audioInputRef.current.click()} style={{ marginTop: 10, ...btnStyle("#28a745") }}>Upload Audio</button>
        {audioUrl && <audio controls src={audioUrl} style={{ marginTop: 10, width: "100%" }} />}
      </Section>

      {/* Preferences */}
      <Section title="Preferences" isDark={isDark}>
        <label>Theme</label>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={selectStyle(isDark)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <label>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle(isDark)}>
          <option>English</option>
          <option>French</option>
          <option>Spanish</option>
          <option>Arabic</option>
        </select>

        <label>Font Size</label>
        <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={selectStyle(isDark)}>
          <option>Small</option>
          <option>Medium</option>
          <option>Large</option>
        </select>

        <label>Layout</label>
        <select value={layout} onChange={(e) => setLayout(e.target.value)} style={selectStyle(isDark)}>
          <option>Default</option>
          <option>Compact</option>
          <option>Spacious</option>
        </select>

        <label>Notifications</label>
        {["push", "email", "sound"].map((n) => (
          <label key={n} style={{ display: "block" }}>
            <input type="checkbox" checked={notifications[n]} onChange={() => setNotifications({ ...notifications, [n]: !notifications[n] })} />
            {n.charAt(0).toUpperCase() + n.slice(1)}
          </label>
        ))}

        <button onClick={handleSaveAll} style={btnStyle("#007bff")} disabled={loadingSave}>
          {loadingSave ? "Saving…" : "💾 Save All"}
        </button>
      </Section>

      {/* Wallet */}
      <Section title="Wallet" isDark={isDark}>
        <p>Balance: <strong>${balance.toFixed(2)}</strong></p>
        <button onClick={handleDailyCheckin} disabled={checkedInToday} style={{ ...btnStyle("#4CAF50"), opacity: checkedInToday ? 0.7 : 1 }}>
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>
    </div>
  );
}

/* Section Wrapper */
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25 }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* Styles */
const btnStyle = (bg) => ({
  padding: "10px 15px",
  marginTop: 10,
  marginRight: 8,
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