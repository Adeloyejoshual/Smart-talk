// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ThemeContext } from "../context/ThemeContext";
import { auth, db } from "../firebaseConfig"; // <-- use auth from your config
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// ================= Cloudinary Config =================
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const navigate = useNavigate();

  // ---------------- State ----------------
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState({
    name: "",
    bio: "",
    profilePic: "",
    email: "",
  });

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

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loadingReward, setLoadingReward] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // ================= Load User & Wallet =================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;
      setUser(userAuth);

      try {
        const token = await userAuth.getIdToken(true);
        const res = await axios.get(`${import.meta.env.VITE_BACKEND}/api/wallet/${userAuth.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Wallet
        setBalance(res.data.balance || 0);
        setTransactions(res.data.transactions || []);

        // Daily Reward
        const lastClaim = res.data.lastDailyClaim ? new Date(res.data.lastDailyClaim) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (lastClaim) {
          lastClaim.setHours(0, 0, 0, 0);
          setCheckedInToday(lastClaim.getTime() === today.getTime());
        }

        // Profile
        if (res.data.profile) {
          const data = res.data.profile;
          setProfileData({
            name: data.name || "",
            bio: data.bio || "",
            profilePic: data.profilePic || "",
            email: data.email || userAuth.email,
          });

          if (data.preferences) {
            setLanguage(data.preferences.language || "English");
            setFontSize(data.preferences.fontSize || "Medium");
            setLayout(data.preferences.layout || "Default");
            setNewTheme(data.preferences.theme || "light");
            setNewWallpaper(data.preferences.wallpaper || wallpaper || "");
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
        `${import.meta.env.VITE_BACKEND}/api/wallet/daily`,
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
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new Error("Cloudinary environment not set");

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
    reader.onload = (ev) => setProfileData({ ...profileData, profilePic: ev.target.result });
    reader.readAsDataURL(f);
  };

  const handleSaveProfile = async () => {
    if (!user) return alert("Not signed in");

    let profileUrl = profileData.profilePic;

    try {
      if (selectedFile) profileUrl = await uploadToCloudinary(selectedFile);
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: profileData.name,
        bio: profileData.bio,
        profilePic: profileUrl,
        preferences: {
          theme: newTheme,
          wallpaper: newWallpaper || null,
          language,
          fontSize,
          layout,
          notifications,
        },
      });
      updateSettings(newTheme, newWallpaper || "");
      setSelectedFile(null);
      setEditing(false);
      alert("✅ Profile & preferences saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save profile: " + err.message);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  const isDark = newTheme === "dark";

  // ================= JSX =================
  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      {/* Back Button */}
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, borderRadius: "50%", padding: 8, cursor: "pointer" }}>⬅</button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        background: isDark ? "#2b2b2b" : "#fff", padding: 16,
        borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", marginBottom: 25,
      }}>
        <div onClick={() => profileInputRef.current?.click()} style={{
          width: 88, height: 88, borderRadius: 44,
          background: profileData.profilePic ? `url(${profileData.profilePic}) center/cover` : "#888",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, color: "#fff", fontWeight: "bold",
        }}>
          {!profileData.profilePic && (profileData.name?.[0] || "U")}
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{profileData.name || "Unnamed User"}</h3>
          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555" }}>{profileData.bio || "No bio yet"}</p>
          <p style={{ margin: 0, color: isDark ? "#bbb" : "#777", fontSize: 13 }}>{profileData.email}</p>
        </div>
      </div>

      <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onProfileFileChange} />

      {/* ================= Wallet Section ================= */}
      <Section title="Wallet" isDark={isDark}>
        <div onClick={() => navigate("/wallet")} style={{ cursor: "pointer", marginBottom: 10 }}>
          <p style={{ margin: 0 }}>
            Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
          </p>
        </div>

        <button
          onClick={handleDailyReward}
          disabled={loadingReward || checkedInToday}
          style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), opacity: checkedInToday ? 0.7 : 1, marginBottom: 15, width: "100%" }}
        >
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
                <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
                  {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>
    </div>
  );
}

// ================= Section Component =================
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// ================= Styles =================
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