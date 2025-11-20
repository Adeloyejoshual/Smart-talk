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

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);

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

  // Profile picture
  const [photoURL, setPhotoURL] = useState(null);

  const fileInputRef = useRef(null);
  const profilePicInputRef = useRef(null);
  const navigate = useNavigate();

  // -------------------- Load user + preferences --------------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return setUser(null);
      setUser(userAuth);
      const userRef = doc(db, "users", userAuth.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          balance: 5.0,
          createdAt: serverTimestamp(),
          lastCheckin: null,
          photoURL: null,
          preferences: {
            language: "English",
            fontSize: "Medium",
            layout: "Default",
            theme: "light",
            wallpaper: null,
          },
        });
        alert("🎁 Welcome! You’ve received a $5 new user bonus!");
      } else {
        const data = userSnap.data();
        setPhotoURL(data.photoURL || null);
        const p = data.preferences || {};
        setLanguage(p.language || "English");
        setFontSize(p.fontSize || "Medium");
        setLayout(p.layout || "Default");
        setNewTheme(p.theme || "light");
        setNewWallpaper(p.wallpaper || wallpaper);
        setPreviewWallpaper(p.wallpaper || wallpaper);
      }

      // Listen for balance updates
      const unsubBalance = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setBalance(data.balance || 0);
        checkLastCheckin(data.lastCheckin);
      });

      // Listen for transactions
      const txRef = collection(db, "transactions");
      const txQuery = query(
        txRef,
        where("uid", "==", userAuth.uid),
        orderBy("createdAt", "desc")
      );
      const unsubTx = onSnapshot(txQuery, (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      return () => {
        unsubBalance();
        unsubTx();
      };
    });

    return () => unsubAuth();
  }, []);

  // -------------------- Daily check-in --------------------
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

    const newBalance = (data.balance || 0) + 0.25;
    await updateDoc(userRef, {
      balance: newBalance,
      lastCheckin: serverTimestamp(),
    });
    setCheckedInToday(true);
    alert("🎉 You earned +$0.25 for your daily check-in!");
  };

  // -------------------- Cloudinary upload --------------------
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

  // -------------------- Profile picture --------------------
  const handleProfilePicClick = () => profilePicInputRef.current.click();

  const handleProfilePicChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => setPhotoURL(event.target.result);
    reader.readAsDataURL(file);

    try {
      const url = await uploadToCloudinary(file);
      setPhotoURL(url);
      if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { photoURL: url });
        alert("✅ Profile picture updated!");
      }
    } catch (err) {
      console.error("Profile picture upload failed:", err);
      alert("Failed to upload profile picture");
    }
  };

  // -------------------- Wallpaper --------------------
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

  // -------------------- Save preferences --------------------
  const handleSavePreferences = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      preferences: { language, fontSize, layout, theme: newTheme, wallpaper: newWallpaper },
      notifications,
    });
    updateSettings(newTheme, newWallpaper);
    alert("✅ Preferences saved successfully!");
  };

  // -------------------- Logout --------------------
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  return (
    <div style={{ padding: 20, background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000", minHeight: "100vh" }}>
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: 20, left: 20, background: isDark ? "#555" : "#e0e0e0", border: "none", borderRadius: "50%", padding: 8, cursor: "pointer" }}>⬅</button>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Profile Picture */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          onClick={handleProfilePicClick}
          style={{
            width: 100,
            height: 100,
            margin: "0 auto 10px",
            borderRadius: "50%",
            overflow: "hidden",
            cursor: "pointer",
            border: "3px solid #007bff",
            backgroundColor: "#ccc",
          }}
        >
          <img
            src={photoURL || "/default-avatar.png"}
            alt="Profile"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <p>Click to change profile picture</p>
        <input
          type="file"
          accept="image/*"
          ref={profilePicInputRef}
          style={{ display: "none" }}
          onChange={handleProfilePicChange}
        />
      </div>

      {/* Wallet */}
      <Section title="Wallet" isDark={isDark}>
        <p>Balance: <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>${balance.toFixed(2)}</strong></p>
        <button onClick={handleDailyCheckin} disabled={checkedInToday} style={{ ...btnStyle(checkedInToday ? "#666" : "#4CAF50"), opacity: checkedInToday ? 0.7 : 1 }}>
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
        <div style={{ marginTop: 10 }}>
          <button onClick={() => navigate("/topup")} style={btnStyle("#007bff")}>💳 Top Up</button>
          <button onClick={() => navigate("/withdrawal")} style={btnStyle("#28a745")}>💸 Withdraw</button>
        </div>
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
        <div onClick={() => fileInputRef.current.click()} style={{ ...previewBox, backgroundImage: previewWallpaper ? `url(${previewWallpaper})` : "none" }}>
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

/* === Section Wrapper === */
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* === Reusable Styles === */
const btnStyle = (bg) => ({ marginRight: 8, padding: "10px 15px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });
const previewBox = { width: "100%", height: 150, borderRadius: 10, border: "2px solid #555", marginTop: 15, display: "flex", justifyContent: "center", alignItems: "center", backgroundSize: "cover", backgroundPosition: "center" };