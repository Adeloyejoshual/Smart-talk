// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import axios from "axios";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const { showPopup, hidePopup } = usePopup();
  const navigate = useNavigate();

  const profileInputRef = useRef(null);
  const isDark = theme === "dark";

  // ---------------- STATES ----------------
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);

  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");

  const backend = "https://smart-talk-zlxe.onrender.com";

  // ---------------- LOAD USER + PROFILE ----------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");

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
          preferences: { theme: "light", wallpaper: "" },
          createdAt: serverTimestamp(),
        });
      }

      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        setNewTheme(data.preferences?.theme || theme);
        setNewWallpaper(data.preferences?.wallpaper || wallpaper || "");
      });

      // Load wallet from backend
      loadWallet(u.uid);

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  // ---------------- WALLET ----------------
  const getToken = async () => auth.currentUser.getIdToken(true);

  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance || 0);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error(err);
      showPopup("Failed to load wallet.");
    }
  };

  const alreadyClaimed = transactions.some((t) => {
    if (t.type !== "checkin") return false;
    const txDate = new Date(t.createdAt || t.date);
    const today = new Date();
    return (
      txDate.getFullYear() === today.getFullYear() &&
      txDate.getMonth() === today.getMonth() &&
      txDate.getDate() === today.getDate()
    );
  });

  const handleDailyReward = async () => {
    if (!user) return;
    setLoadingReward(true);

    try {
      const token = await getToken();
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        { amount: 0.25 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
        setTransactions((prev) => [res.data.txn, ...prev]);
        showPopup("🎉 Daily reward claimed!");
      } else if (res.data.error?.toLowerCase().includes("already claimed")) {
        showPopup("✅ You already claimed today's reward!");
      } else {
        showPopup(res.data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ---------------- PREFERENCES ----------------
  const handleSavePreferences = async () => {
    if (!user) return;
    try {
      const token = await getToken();
      await axios.post(
        `${backend}/api/preferences`,
        {
          theme: newTheme,
          wallpaper: newWallpaper || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateSettings(newTheme, newWallpaper);
      showPopup("✅ Preferences saved!");
    } catch (err) {
      console.error(err);
      showPopup("Failed to save preferences.");
    }
  };

  // ---------------- PROFILE PIC ----------------
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new Error("Cloudinary not configured");
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
      console.error(err);
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

      {/* ---------------- Profile Card ---------------- */}
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
          title="Click to change profile picture"
        >
          {!profilePic && (name?.[0] || "U")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{name || "Unnamed User"}</h3>

            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button
                onClick={() => showPopup(
                  <div>
                    <button onClick={() => { navigate("/edit-profile"); hidePopup(); }} style={menuItemStyle}>Edit Info</button>
                    <button onClick={handleLogout} style={menuItemStyle}>Log Out</button>
                  </div>
                )}
                style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: isDark ? "#fff" : "#222" }}
              >
                ⋮
              </button>
            </div>
          </div>
          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555" }}>{bio || "No bio yet"}</p>
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

      {/* ---------------- Wallet Panel ---------------- */}
      <Section title="Wallet" isDark={isDark}>
        <p>
          Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
        </p>

        <button
          onClick={handleDailyReward}
          disabled={loadingReward || alreadyClaimed}
          style={{
            ...btnStyle(alreadyClaimed ? "#666" : "#ffd700"),
            width: "100%",
            marginBottom: 10,
            cursor: alreadyClaimed ? "not-allowed" : "pointer",
          }}
        >
          {loadingReward
            ? "Processing..."
            : alreadyClaimed
            ? "Already Claimed"
            : "🧩 Daily Reward (+$0.25)"}
        </button>

        <h4>Last 3 Transactions</h4>
        {transactions.slice(0, 3).length === 0 ? (
          <p style={{ opacity: 0.6 }}>No recent transactions.</p>
        ) : (
          transactions.slice(0, 3).map((tx) => (
            <div
              key={tx._id || tx.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 12px",
                marginBottom: 6,
                background: isDark ? "#222" : "#f8f8f8",
                borderRadius: 8,
                cursor: "pointer",
              }}
              onClick={() =>
                showPopup(
                  <div>
                    <h3 style={{ marginBottom: 10 }}>Transaction Details</h3>
                    <p><b>Type:</b> {tx.type}</p>
                    <p><b>Amount:</b> ${tx.amount.toFixed(2)}</p>
                    <p><b>Date:</b> {new Date(tx.createdAt || tx.date).toLocaleString()}</p>
                    <p><b>Status:</b> {tx.status}</p>
                    <p><b>Transaction ID:</b> {tx._id || tx.id}</p>
                    <button onClick={hidePopup} style={{ marginTop: 10, padding: 6, borderRadius: 6, cursor: "pointer" }}>Close</button>
                  </div>,
                  { autoHide: false }
                )
              }
            >
              <span>{tx.type}</span>
              <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
                {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </Section>

      {/* ---------------- Preferences ---------------- */}
      <Section title="Preferences" isDark={isDark}>
        <label>Theme</label>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={selectStyle(isDark)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <label>Wallpaper</label>
        <input
          type="text"
          placeholder="Wallpaper URL"
          value={newWallpaper}
          onChange={(e) => setNewWallpaper(e.target.value)}
          style={selectStyle(isDark)}
        />

        <button onClick={handleSavePreferences} style={{ ...btnStyle("#007bff"), width: "100%" }}>
          Save Preferences
        </button>
      </Section>
    </div>
  );
}

// ---------------- Section ----------------
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

// ---------------- Styles ----------------
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

const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
};