import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const { showPopup, hidePopup } = usePopup();
  const [user, setUser] = useState(null);

  // Wallet
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);

  // Preferences
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [previewWallpaper, setPreviewWallpaper] = useState(wallpaper);
  const [notifications, setNotifications] = useState({
    push: true,
    email: true,
    sound: false,
  });

  // Profile Picture
  const [profilePic, setProfilePic] = useState(null);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const backend = "https://smart-talk-zlxe.onrender.com";

  // ---------------- AUTH + LOAD USER ----------------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) return navigate("/");
      setUser(u);
      loadWallet(u.uid);
      if (u.photoURL) setProfilePic(u.photoURL);
    });
    return unsub;
  }, []);

  const getToken = async () => auth.currentUser.getIdToken(true);

  // ---------------- WALLET ----------------
  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      } else {
        showPopup(data.error || "Failed to load wallet.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to load wallet. Check console.");
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
      } else if (data.error?.toLowerCase().includes("already claimed")) {
        showPopup("✅ You already claimed today's reward!");
      } else {
        showPopup(data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ---------------- PROFILE PIC / WALLPAPER ----------------
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET)
      throw new Error(
        "Cloudinary environment not set. Ensure VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET are defined"
      );

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

  const handleWallpaperClick = () => fileInputRef.current.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => setPreviewWallpaper(event.target.result);
    reader.readAsDataURL(file);

    try {
      const url = await uploadToCloudinary(file);
      setNewWallpaper(url);
      updateSettings(newTheme, url);
    } catch (err) {
      console.error("Wallpaper upload failed:", err);
      alert("Failed to upload wallpaper");
    }
  };

  const handleProfilePicChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadToCloudinary(file);
      setProfilePic(url);
      await auth.currentUser.updateProfile({ photoURL: url });
      showPopup("✅ Profile picture updated!");
    } catch (err) {
      console.error(err);
      showPopup("Failed to upload profile picture");
    }
  };

  // ---------------- SAVE PREFERENCES ----------------
  const handleSavePreferences = async () => {
    if (!user) return;
    const token = await getToken();
    try {
      await fetch(`${backend}/api/users/preferences/${user.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language, fontSize, layout, theme: newTheme, wallpaper: newWallpaper, notifications }),
      });
      updateSettings(newTheme, newWallpaper);
      showPopup("✅ Preferences saved successfully!");
    } catch (err) {
      console.error(err);
      showPopup("Failed to save preferences");
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  return (
    <div style={{ padding: 20, background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000", minHeight: "100vh" }}>
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, background: isDark ? "#555" : "#e0e0e0", border: "none", borderRadius: "50%", padding: 8, cursor: "pointer" }}>⬅</button>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Profile Picture */}
      <Section title="Profile" isDark={isDark}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <img src={profilePic || "/default-avatar.png"} alt="Profile" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
          <input type="file" accept="image/*" onChange={handleProfilePicChange} />
        </div>
      </Section>

      {/* Wallet */}
      <Section title="Wallet" isDark={isDark}>
        <p>Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong></p>
        <button style={{ ...btnStyle(alreadyClaimed ? "#555" : "#4CAF50"), marginBottom: 10 }} disabled={alreadyClaimed || loadingReward} onClick={handleDailyReward}>
          {loadingReward ? "Processing..." : alreadyClaimed ? "✅ Already Claimed" : "🧩 Daily Reward (+$0.25)"}
        </button>
        <div style={{ marginTop: 10 }}>
          <button onClick={() => navigate("/topup")} style={btnStyle("#007bff")}>💳 Top Up</button>
          <button onClick={() => navigate("/withdrawal")} style={btnStyle("#28a745")}>💸 Withdraw</button>
        </div>
        {transactions.length > 0 && (
          <div style={{ marginTop: 15 }}>
            <h4>Recent Transactions</h4>
            {transactions.slice(0, 3).map((tx) => (
              <div key={tx._id} style={{ ...styles.txRowCompact, backgroundColor: isDark ? "#222" : "#fff" }} onClick={() => showPopup(
                <div>
                  <h3 style={{ marginBottom: 10 }}>Transaction Details</h3>
                  <p><b>Type:</b> {tx.type}</p>
                  <p><b>Amount:</b> ${tx.amount.toFixed(2)}</p>
                  <p><b>Date:</b> {new Date(tx.createdAt || tx.date).toLocaleString()}</p>
                  <p><b>Status:</b> {tx.status}</p>
                  <p><b>Transaction ID:</b> {tx._id}</p>
                  <button onClick={hidePopup} style={{ marginTop: 10, padding: 6, borderRadius: 6, cursor: "pointer" }}>Close</button>
                </div>, { autoHide: false })}>
                <div style={styles.txLeftCompact}>
                  <p style={styles.txTypeCompact}>{tx.type}</p>
                  <span style={styles.txDateCompact}>{new Date(tx.createdAt || tx.date).toLocaleString()}</span>
                </div>
                <div style={styles.txRightCompact}>
                  <span style={{ ...styles.amount, color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>{tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
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
        <div onClick={handleWallpaperClick} style={{ ...previewBox, backgroundImage: previewWallpaper ? `url(${previewWallpaper})` : "none" }}>
          <p>🌈 Wallpaper Preview</p>
        </div>
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
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

// ------------------ Section Wrapper ------------------
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// ------------------ Styles ------------------
const btnStyle = (bg) => ({ marginRight: 8, padding: "10px 15px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });
const previewBox = { width: "100%", height: 150, borderRadius: 10, border: "2px solid #555", marginTop: 15, display: "flex", justifyContent: "center", alignItems: "center", backgroundSize: "cover", backgroundPosition: "center" };
const styles = {
  txRowCompact: { padding: "10px 12px", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" },
  txLeftCompact: {},
  txTypeCompact: { fontSize: 14, fontWeight: 600 },
  txDateCompact: { fontSize: 12, opacity: 0.6 },
  txRightCompact: { textAlign: "right" },
  amount: { fontWeight: 600 },
};