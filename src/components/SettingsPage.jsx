// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import axios from "axios";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const { showPopup, hidePopup } = usePopup();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // You can choose which backend to use
  const backends = [
    "https://smart-talk-zlxe.onrender.com",
    "https://www.loechat.com",
  ];
  const backend = backends[0]; // change index if needed

  // ===================== State =====================
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: "", bio: "", email: "", profilePic: "" });
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loadingReward, setLoadingReward] = useState(false);

  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

  // ===================== Load user & wallet =====================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/"); // redirect if not logged in
      setUser(u);

      try {
        const token = await u.getIdToken(true);
        const res = await axios.get(`${backend}/api/wallet/${u.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setBalance(res.data.balance || 0);
        setTransactions(res.data.transactions || []);

        // check daily reward
        const lastClaim = res.data.lastDailyClaim ? new Date(res.data.lastDailyClaim) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (lastClaim) {
          lastClaim.setHours(0, 0, 0, 0);
          setCheckedInToday(lastClaim.getTime() === today.getTime());
        }

        // load profile
        if (res.data.profile) {
          const p = res.data.profile;
          setProfile({
            name: p.name || "",
            bio: p.bio || "",
            email: p.email || u.email,
            profilePic: p.profilePic || "",
          });
          if (p.preferences) {
            setLanguage(p.preferences.language || "English");
            setFontSize(p.preferences.fontSize || "Medium");
            setLayout(p.preferences.layout || "Default");
            setNewTheme(p.preferences.theme || "light");
            setNewWallpaper(p.preferences.wallpaper || wallpaper || "");
          }
        }
      } catch (err) {
        console.error(err);
        showPopup("Failed to load wallet or profile.");
      }
    });
    return () => unsub();
  }, []);

  // ===================== Daily Reward =====================
  const handleDailyReward = async () => {
    if (!user) return;
    setLoadingReward(true);

    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        { amount: 0.25 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
        setCheckedInToday(true);
        showPopup("🎉 Daily reward claimed! +$0.25");
      } else if (res.data.error?.toLowerCase().includes("already claimed")) {
        setCheckedInToday(true);
        showPopup("✅ You already claimed today's reward!");
      } else {
        showPopup(res.data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ===================== Profile & Preferences =====================
  const handleWallpaperClick = () => fileInputRef.current.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setNewWallpaper(ev.target.result);
      reader.readAsDataURL(file);
    }
  };
  const removeWallpaper = () => setNewWallpaper("");

  const handleSavePreferences = async () => {
    if (!user) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `${backend}/api/preferences`,
        {
          language,
          fontSize,
          layout,
          theme: newTheme,
          wallpaper: newWallpaper || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateSettings(newTheme, newWallpaper);
      showPopup("✅ Preferences saved successfully!");
    } catch (err) {
      console.error(err);
      showPopup("Failed to save preferences.");
    }
  };

  const isDark = newTheme === "dark";
  const displayName = profile.name || "No Name";
  const getInitials = (name) => {
    if (!name) return "NA";
    const names = name.trim().split(" ").filter(Boolean);
    if (names.length === 0) return "NA";
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  if (!user) return null;

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate("/chat")}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: isDark ? "#555" : "#e0e0e0",
          border: "none",
          borderRadius: "50%",
          padding: 8,
          cursor: "pointer",
        }}
      >
        ⬅
      </button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div
        onClick={() => navigate("/edit-profile")}
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          background: isDark ? "#2b2b2b" : "#fff",
          padding: 15,
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        {profile.profilePic ? (
          <img
            src={profile.profilePic}
            alt="Profile"
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              objectFit: "cover",
              marginRight: 15,
            }}
          />
        ) : (
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: "#007bff",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 24,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginRight: 15,
            }}
          >
            {getInitials(displayName)}
          </div>
        )}
        <div>
          <p style={{ margin: 0, fontWeight: "600", fontSize: 16 }}>{displayName}</p>
          <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>
            {profile.bio || "No bio yet — click to edit"}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: isDark ? "#aaa" : "#888" }}>
            {profile.email}
          </p>
        </div>
      </div>

      {/* ================= Wallet Section ================= */}
      <Section title="Wallet" isDark={isDark}>
        <div onClick={() => navigate("/wallet")} style={{ cursor: "pointer", marginBottom: 10 }}>
          <p style={{ margin: 0 }}>
            Balance:{" "}
            <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
          </p>
        </div>

        <button
          onClick={handleDailyReward}
          disabled={loadingReward || checkedInToday}
          style={{
            ...btnStyle(checkedInToday ? "#666" : "#4CAF50"),
            opacity: checkedInToday ? 0.7 : 1,
            marginBottom: 15,
            width: "100%",
          }}
        >
          {loadingReward
            ? "Processing..."
            : checkedInToday
            ? "✅ Checked In Today"
            : "🧩 Daily Reward (+$0.25)"}
        </button>

        <div>
          <h4 style={{ marginBottom: 8 }}>Last 3 Transactions</h4>
          {transactions.length === 0 ? (
            <p style={{ fontSize: 14, opacity: 0.6 }}>No recent transactions.</p>
          ) : (
            transactions
              .slice(0, 3)
              .map((tx) => (
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
                        <button
                          onClick={hidePopup}
                          style={{ marginTop: 10, padding: 6, borderRadius: 6, cursor: "pointer" }}
                        >
                          Close
                        </button>
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
        </div>
      </Section>

      {/* ================= Preferences, Theme, Wallpaper, Notifications, About, Logout ================= */}
      {/* Same as previous SettingsPage code... */}
    </div>
  );
}

// ================= Section Wrapper =================
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

// ================= Reusable Styles =================
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

export const selectStyle = (isDark) => ({
  width: "100%",
  padding: 8,
  marginBottom: 10,
  borderRadius: 6,
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
  border: "1px solid #666",
});