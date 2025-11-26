// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);

  const profileInputRef = useRef(null);
  const isDark = theme === "dark";

  // Load user + live snapshot
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
          preferences: { theme: "light" },
          createdAt: serverTimestamp(),
        });
      }

      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        setBalance(data.balance || 0);
        checkLastCheckin(data.lastCheckin);
      });

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  // Daily check-in logic
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
    setBalance(newBalance);
    setCheckedInToday(true);
    alert("🎉 You earned +$0.25 for your daily check-in!");
  };

  // Cloudinary uploader
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

  // Handle selecting a new profile picture
  const onProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setProfilePic(URL.createObjectURL(file));

    // Automatically upload to Cloudinary
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

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
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

      {/* Profile Card */}
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
          title="Click to edit profile"
        >
          {!profilePic && (name?.[0] || "U")}
        </div>

        {/* User Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{name || "Unnamed User"}</h3>

            {/* Menu */}
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

      {/* Wallet Section */}
      <Section title="Wallet" isDark={isDark}>
        <p>
          Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
        </p>
        <button
          onClick={handleDailyCheckin}
          disabled={checkedInToday}
          style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), opacity: checkedInToday ? 0.7 : 1 }}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
      </Section>

      {/* Hidden file input for Cloudinary */}
      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onProfileFileChange}
      />
    </div>
  );
}

/* Section Wrapper */
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

/* Styles */
const btnStyle = (bg) => ({
  marginTop: 8,
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