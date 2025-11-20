// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [previewWallpaper, setPreviewWallpaper] = useState(wallpaper);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Load user & listen to Firestore
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;
      setUser(userAuth);

      const userRef = doc(db, "users", userAuth.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          balance: 5.0,
          createdAt: serverTimestamp(),
          lastCheckin: null,
          preferences: { language: "English", fontSize: "Medium", layout: "Default", theme: "light", wallpaper: null },
        });
        alert("🎁 Welcome! You’ve received a $5 new user bonus!");
      } else {
        const data = userSnap.data();
        if (data.preferences) {
          setLanguage(data.preferences.language || "English");
          setFontSize(data.preferences.fontSize || "Medium");
          setLayout(data.preferences.layout || "Default");
          setNewTheme(data.preferences.theme || "light");
          setNewWallpaper(data.preferences.wallpaper || wallpaper);
          setPreviewWallpaper(data.preferences.wallpaper || wallpaper);
        }
      }

      const unsubBalance = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBalance(data.balance || 0);
          checkLastCheckin(data.lastCheckin);
        }
      });

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

  // Daily Check-in
  const checkLastCheckin = (lastCheckin) => {
    if (!lastCheckin) return setCheckedInToday(false);
    const lastDate = new Date(lastCheckin.seconds * 1000);
    const today = new Date();
    setCheckedInToday(lastDate.toDateString() === today.toDateString());
  };

  const handleDailyCheckin = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const lastCheckin = data.lastCheckin ? new Date(data.lastCheckin.seconds * 1000) : null;
      const today = new Date();
      if (lastCheckin && lastCheckin.toDateString() === today.toDateString()) {
        alert("✅ You already checked in today!");
        return;
      }
      const newBalance = (data.balance || 0) + 0.25;
      await updateDoc(userRef, { balance: newBalance, lastCheckin: serverTimestamp() });
      setCheckedInToday(true);
      alert("🎉 You earned +$0.25 for your daily check-in!");
    }
  };

  // Save user preferences
  const handleSavePreferences = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      preferences: { language, fontSize, layout, theme: newTheme, wallpaper: newWallpaper },
    });
    updateSettings(newTheme, newWallpaper);
    alert("✅ Preferences saved successfully!");
  };

  // Wallpaper
  const handleWallpaperClick = () => fileInputRef.current.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setNewWallpaper(event.target.result);
    reader.readAsDataURL(file);
  };
  const removeWallpaper = () => setNewWallpaper(null);

  // Logout
  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  return (
    <div style={{ padding: 20, background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000", minHeight: "100vh" }}>
      {/* Back */}
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, background: isDark ? "#555" : "#e0e0e0", border: "none", borderRadius: "50%", padding: 8, cursor: "pointer" }}>⬅</button>

      {/* Profile Card */}
      <div
        onClick={() => navigate("/profile/" + user.uid)}
        style={{ display: "flex", alignItems: "center", cursor: "pointer", marginBottom: 25 }}
      >
        {user.profilePic ? (
          <img src={user.profilePic} alt="Profile" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", marginRight: 15 }} />
        ) : (
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#888", color: "#fff", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 15 }}>
            {user.displayName ? user.displayName.split(" ").map((n) => n[0]).join("") : "U"}
          </div>
        )}
        <div>
          <p style={{ margin: 0, fontWeight: "bold", fontSize: 18 }}>{user.displayName || user.email}</p>
          <p style={{ margin: 0, fontSize: 14, color: "#999" }}>{user.bio || "No bio yet — click to edit"}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>{user.email}</p>
        </div>
      </div>

      {/* Wallet Section */}
      <Section title="Wallet" isDark={isDark}>
        <div style={{ cursor: "pointer" }} onClick={() => navigate("/wallet")}>
          <p>
            Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong>
          </p>
        </div>
        <button onClick={handleDailyCheckin} disabled={checkedInToday} style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), opacity: checkedInToday ? 0.7 : 1 }}>
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
      </Section>

      {/* Preferences */}
      <Section title="Preferences" isDark={isDark}>
        <label>Theme</label>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={selectStyle(isDark)}>
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
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

        <label>Wallpaper</label>
        <div onClick={handleWallpaperClick} style={{ ...previewBox, backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none" }}>
          <p>🌈 Wallpaper Preview</p>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={removeWallpaper} style={btnStyle("#999")}>Remove Wallpaper</button>
        </div>
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />

        <button onClick={handleSavePreferences} style={{ ...btnStyle("#007bff"), marginTop: 15 }}>💾 Save Preferences</button>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" isDark={isDark}>
        <label><input type="checkbox" checked={notifications.push} onChange={() => setNotifications({ ...notifications, push: !notifications.push })} /> Push Notifications</label>
        <label><input type="checkbox" checked={notifications.email} onChange={() => setNotifications({ ...notifications, email: !notifications.email })} /> Email Alerts</label>
        <label><input type="checkbox" checked={notifications.sound} onChange={() => setNotifications({ ...notifications, sound: !notifications.sound })} /> Sounds</label>
      </Section>

      {/* About */}
      <Section title="About" isDark={isDark}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>Terms of Service | Privacy Policy</p>
      </Section>

      {/* Logout */}
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button onClick={handleLogout} style={{ padding: "12px 25px", background: "#e53935", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontWeight: "bold", fontSize: 16 }}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

// Section wrapper
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// Styles
const btnStyle = (bg) => ({ marginRight: 8, padding: "10px 15px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });
const previewBox = { width: "100%", height: 150, borderRadius: 10, border: "2px solid #555", marginTop: 15, display: "flex", justifyContent: "center", alignItems: "center", backgroundSize: "cover", backgroundPosition: "center" };