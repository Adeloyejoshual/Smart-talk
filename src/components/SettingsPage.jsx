// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);

  const [user, setUser] = useState(null);
  const [name, setName] = useState("Unnamed");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState(null);

  const [balance, setBalance] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({
    push: true,
    email: true,
    sound: false,
  });

  const isDark = theme === "dark";

  // Load user info
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) return;
      setUser(u);

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setName(data.name || "Unnamed");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);

        if (data.preferences) {
          setLanguage(data.preferences.language || "English");
          setFontSize(data.preferences.fontSize || "Medium");
          setLayout(data.preferences.layout || "Default");
        }

        setBalance(data.balance || 0);
        checkLastCheckin(data.lastCheckin);
      }

      // Listen for live updates
      const unsub = onSnapshot(userRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        setBalance(data.balance || 0);
        setName(data.name || "Unnamed");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        if (data.preferences) {
          setLanguage(data.preferences.language || "English");
          setFontSize(data.preferences.fontSize || "Medium");
          setLayout(data.preferences.layout || "Default");
        }
        checkLastCheckin(data.lastCheckin);
      });

      return () => unsub();
    });

    return () => unsubscribe();
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
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const lastCheckin = data.lastCheckin
      ? new Date(data.lastCheckin.seconds * 1000)
      : null;
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
    await doc(db, "users", user.uid).update({
      balance: (data.balance || 0) + 0.25,
      lastCheckin: new Date(),
    });
    alert("🎉 You earned +$0.25 for your daily check-in!");
    setCheckedInToday(true);
  };

  const handleLogout = async () => {
    await auth.signOut();
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

      {/* Profile Card (clickable) */}
      <div
        onClick={() => navigate("/edit-profile")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: isDark ? "#111" : "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            background: profilePic
              ? `url(${profilePic}) center/cover`
              : "#8b8b8b",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </h2>
          <p
            style={{
              margin: "8px 0",
              color: isDark ? "#cfcfcf" : "#666",
              overflowWrap: "anywhere",
            }}
          >
            {bio || "No bio yet — click to edit"}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: isDark ? "#bdbdbd" : "#777" }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Wallet Section */}
      <Section title="Wallet" isDark={isDark}>
        <p>
          Balance:{" "}
          <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>
            ${balance.toFixed(2)}
          </strong>
        </p>
        <button
          onClick={handleDailyCheckin}
          disabled={checkedInToday}
          style={{
            ...btnStyle(checkedInToday ? "#666" : "#4CAF50"),
            opacity: checkedInToday ? 0.7 : 1,
          }}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
      </Section>

      {/* Preferences */}
      <Section title="User Preferences" isDark={isDark}>
        <label>Language:</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option>English</option>
          <option>French</option>
          <option>Spanish</option>
          <option>Arabic</option>
        </select>

        <label>Font Size:</label>
        <select
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option>Small</option>
          <option>Medium</option>
          <option>Large</option>
        </select>

        <label>Layout:</label>
        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option>Default</option>
          <option>Compact</option>
          <option>Spacious</option>
        </select>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" isDark={isDark}>
        <label>
          <input
            type="checkbox"
            checked={notifications.push}
            onChange={() =>
              setNotifications({ ...notifications, push: !notifications.push })
            }
          />
          Push Notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.email}
            onChange={() =>
              setNotifications({ ...notifications, email: !notifications.email })
            }
          />
          Email Alerts
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.sound}
            onChange={() =>
              setNotifications({ ...notifications, sound: !notifications.sound })
            }
          />
          Sounds
        </label>
      </Section>

      {/* About */}
      <Section title="About" isDark={isDark}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>Terms of Service | Privacy Policy</p>
      </Section>
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
  marginTop: 8,
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