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
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({
    push: true,
    email: true,
    sound: false,
  });

  const [profileData, setProfileData] = useState({
    name: "",
    bio: "",
    profilePic: "",
    email: "",
  });

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;
      setUser(userAuth);

      const userRef = doc(db, "users", userAuth.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          balance: 5.0,
          createdAt: serverTimestamp(),
          lastCheckin: null,
          name: userAuth.displayName || "",
          bio: "",
          email: userAuth.email,
          profilePic: userAuth.photoURL || "",
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
        const data = snap.data();
        setProfileData({
          name: data.name || "",
          bio: data.bio || "",
          profilePic: data.profilePic || userAuth.photoURL || "",
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

      // Wallet balance live updates
      const unsubBalance = onSnapshot(userRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        setBalance(data.balance || 0);
        checkLastCheckin(data.lastCheckin);
      });

      // Transactions live updates
      const txRef = collection(db, "transactions");
      const txQuery = query(
        txRef,
        where("uid", "==", userAuth.uid),
        orderBy("createdAt", "desc")
      );
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

    const newBalance = (data.balance || 0) + 0.25;
    await updateDoc(userRef, {
      balance: newBalance,
      lastCheckin: serverTimestamp(),
    });
    setCheckedInToday(true);
    alert("🎉 You earned +$0.25 for your daily check-in!");
  };

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
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      preferences: {
        language,
        fontSize,
        layout,
        theme: newTheme,
        wallpaper: newWallpaper || null,
      },
    });
    updateSettings(newTheme, newWallpaper);
    alert("✅ Preferences saved successfully!");
  };

  const isDark = newTheme === "dark";

  if (!user) return <p>Loading user...</p>;

  const getInitials = (name) => {
    if (!name || typeof name !== "string") return "NA";
    const names = name.trim().split(" ").filter(Boolean);
    if (names.length === 0) return "NA";
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  const displayName = profileData.name || "No Name";

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
        {profileData.profilePic ? (
          <img
            src={profileData.profilePic}
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
          <p style={{ margin: 0, fontWeight: "600", fontSize: 16 }}>
            {displayName}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>
            {profileData.bio || "No bio yet — click to edit"}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: isDark ? "#aaa" : "#888" }}>
            {profileData.email}
          </p>
        </div>
      </div>

      {/* ================= Wallet ================= */}
      <Section title="Wallet" isDark={isDark}>
        {/* Balance */}
        <div
          onClick={() => navigate("/wallet")}
          style={{ cursor: "pointer", marginBottom: 10 }}
        >
          <p style={{ margin: 0 }}>
            Balance:{" "}
            <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>
              ${balance.toFixed(2)}
            </strong>
          </p>
        </div>

        {/* Daily check-in */}
        <button
          onClick={handleDailyCheckin}
          disabled={checkedInToday}
          style={{
            ...btnStyle(checkedInToday ? "#666" : "#4CAF50"),
            opacity: checkedInToday ? 0.7 : 1,
            marginBottom: 15,
            width: "100%",
          }}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>

        {/* Last 3 transactions */}
        <div>
          <h4 style={{ marginBottom: 8 }}>Last 3 Transactions</h4>
          {transactions.length === 0 ? (
            <p style={{ fontSize: 14, opacity: 0.6 }}>No recent transactions.</p>
          ) : (
            transactions
              .slice(0, 3)
              .map((tx) => (
                <div
                  key={tx.id}
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
        </div>
      </Section>

      {/* ================= Preferences ================= */}
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

      {/* ================= Theme & Wallpaper ================= */}
      <Section title="Theme & Wallpaper" isDark={isDark}>
        <select
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div
          onClick={handleWallpaperClick}
          style={{
            ...previewBox,
            backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none",
            cursor: "pointer",
          }}
        >
          <p>{newWallpaper ? "Wallpaper Selected" : "🌈 Wallpaper Preview"}</p>
        </div>
        {newWallpaper && (
          <button
            onClick={removeWallpaper}
            style={{ ...btnStyle("#d32f2f"), marginTop: 10 }}
          >
            Remove Wallpaper
          </button>
        )}

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button
          onClick={handleSavePreferences}
          style={{ ...btnStyle("#007bff"), marginTop: 15, borderRadius: 20 }}
        >
          💾 Save Preferences
        </button>
      </Section>

      {/* ================= Notifications ================= */}
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

      {/* ================= About ================= */}
      <Section title="About" isDark={isDark}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p>Terms of Service | Privacy Policy</p>
      </Section>

      {/* ================= Logout ================= */}
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button
          onClick={async () => {
            await auth.signOut();
            navigate("/");
          }}
          style={{
            padding: "12px 25px",
            background: "#e53935",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: 16,
          }}
        >
          🚪 Logout
        </button>
      </div>
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

const selectStyle = (isDark) => ({
  width: "100%",
  padding: 8,
  marginBottom: 10,
  borderRadius: 6,
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
  border: "1px solid #666",
});

const previewBox = {
  width: "100%",
  height: 150,
  borderRadius: 10,
  border: "2px solid #555",
  marginTop: 15,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundSize: "cover",
  backgroundPosition: "center",
};