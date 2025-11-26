// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import axios from "axios";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Backend URL for wallet (MongoDB)
const BACKEND = "https://smart-talk-zlxe.onrender.com";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const navigate = useNavigate();

  // ================= States =================
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Wallet
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
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

  const profileInputRef = useRef(null);
  const isDark = theme === "dark";

  // ================= Load Profile & Wallet =================
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/"); 
      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);

      // Ensure Firestore doc exists
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          email: u.email || "",
          profilePic: null,
          preferences: { theme: "light" },
          createdAt: serverTimestamp(),
        });
      }

      // Live snapshot for Firestore profile
      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
      });

      // ---------- Load Wallet from backend ----------
      try {
        const token = await u.getIdToken(true);
        const res = await axios.get(`${BACKEND}/api/wallet/${u.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setBalance(res.data.balance || 0);
        setTransactions(res.data.transactions || []);

        // Check daily reward
        const lastClaim = res.data.lastDailyClaim ? new Date(res.data.lastDailyClaim) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (lastClaim) {
          lastClaim.setHours(0, 0, 0, 0);
          setCheckedInToday(lastClaim.getTime() === today.getTime());
        }

        // Load preferences from backend
        if (res.data.profile?.preferences) {
          const p = res.data.profile.preferences;
          setNewTheme(p.theme || "light");
          setNewWallpaper(p.wallpaper || wallpaper || "");
          setLanguage(p.language || "English");
          setFontSize(p.fontSize || "Medium");
          setLayout(p.layout || "Default");
        }
      } catch (err) {
        console.error("Wallet load failed:", err);
      }

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  // ================= Cloudinary uploader =================
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
    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url || data.url;
  };

  const onProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setProfilePic(URL.createObjectURL(file));

    try {
      const url = await uploadToCloudinary(file);
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { profilePic: url, updatedAt: serverTimestamp() });
      setProfilePic(url);
      setSelectedFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload profile picture.");
    }
  };

  // ================= Daily Reward =================
  const handleDailyReward = async () => {
    if (!user) return;
    setLoadingReward(true);
    try {
      const token = await user.getIdToken(true);
      const res = await axios.post(
        `${BACKEND}/api/wallet/daily`,
        { amount: 0.25 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
        setCheckedInToday(true);
        alert("🎉 Daily reward claimed!");
      } else if (res.data.error?.toLowerCase().includes("already claimed")) {
        setCheckedInToday(true);
        alert("✅ Already claimed today!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward.");
    } finally {
      setLoadingReward(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const displayName = name || "Unnamed User";
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.split(" ");
    return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0][0];
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
      }}
    >
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
        {/* Profile Picture */}
        <div
          onClick={() => navigate("/edit-profile")}
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
        >
          {!profilePic && getInitials(displayName)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{displayName}</h3>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button
                onClick={() => setMenuOpen((s) => !s)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: isDark ? "#fff" : "#222",
                  cursor: "pointer",
                  fontSize: 20,
                }}
              >
                ⋮
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 34,
                    background: isDark ? "#1a1a1a" : "#fff",
                    color: isDark ? "#fff" : "#000",
                    borderRadius: 8,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    zIndex: 60,
                    minWidth: 150,
                  }}
                >
                  <button
                    onClick={() => {
                      navigate("/edit-profile");
                      setMenuOpen(false);
                    }}
                    style={menuItemStyle}
                  >
                    Edit Info
                  </button>
                  <button onClick={handleLogout} style={menuItemStyle}>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>

          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555" }}>
            {bio || "No bio yet — click ⋮ → Edit Info to add one."}
          </p>
          <p style={{ margin: 0, color: isDark ? "#bbb" : "#777", fontSize: 13 }}>{email}</p>
        </div>
      </div>

      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onProfileFileChange}
      />

      {/* ================= Wallet Panel ================= */}
      <Section title="Wallet" isDark={isDark}>
        <p>
          Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
        </p>
        <button
          onClick={handleDailyReward}
          disabled={checkedInToday || loadingReward}
          style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), width: "100%", marginBottom: 10 }}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Reward (+$0.25)"}
        </button>

        <h4>Last 3 Transactions</h4>
        {transactions.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No recent transactions.</p>
        ) : (
          transactions.slice(0, 3).map((tx) => (
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
      </Section>
    </div>
  );
}

/* ================= Section Wrapper ================= */
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

/* ================= Reusable Styles ================= */
const btnStyle = (bg) => ({
  marginBottom: 8,
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