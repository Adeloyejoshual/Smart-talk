import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db, storage } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings, updateProfilePic } =
    useContext(ThemeContext);

  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({
    push: true,
    email: true,
    sound: false,
  });

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const profileInputRef = useRef(null);

  // ✅ Load user & preferences
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        setUser(userAuth);
        setEmail(userAuth.email);

        const userRef = doc(db, "users", userAuth.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            balance: 5.0,
            createdAt: serverTimestamp(),
            lastCheckin: null,
            preferences: {
              language: "English",
              fontSize: "Medium",
              layout: "Default",
              theme: "light",
              wallpaper: null,
            },
            displayName: userAuth.displayName || "",
            profilePic: null,
          });
          alert("🎁 Welcome! You’ve received a $5 new user bonus!");
        } else {
          const data = userSnap.data();
          setDisplayName(data.displayName || "");
          setProfilePic(data.profilePic || null);
          if (data.preferences) {
            setLanguage(data.preferences.language || "English");
            setFontSize(data.preferences.fontSize || "Medium");
            setLayout(data.preferences.layout || "Default");
            setNewTheme(data.preferences.theme || "light");
            setNewWallpaper(data.preferences.wallpaper || wallpaper);
          }
        }

        // 💰 Wallet listener
        const unsubBalance = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setBalance(data.balance || 0);
            checkLastCheckin(data.lastCheckin);
            setDisplayName(data.displayName || "");
            setProfilePic(data.profilePic || null);
          }
        });

        // 🧾 Transactions listener
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
      }
    });
    return () => unsubscribe();
  }, []);

  // 🧩 Daily Check-in
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
    if (userSnap.exists()) {
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
    }
  };

  // 🎨 Save preferences
  const handleSavePreferences = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      preferences: {
        language,
        fontSize,
        layout,
        theme: newTheme,
        wallpaper: newWallpaper,
      },
    });
    updateSettings(newTheme, newWallpaper);
    alert("✅ Preferences saved successfully!");
  };

  // 🖼 Wallpaper
  const handleWallpaperClick = () => fileInputRef.current.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setNewWallpaper(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // 🖼 Profile picture
  const handleProfileClick = () => profileInputRef.current.click();
  const handleProfileChange = async (e) => {
    if (!user) return;
    const file = e.target.files[0];
    if (!file) return;

    const storageRef = ref(storage, `profiles/${user.uid}/${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { profilePic: downloadURL });
    setProfilePic(downloadURL);
    updateProfilePic(downloadURL);
  };

  // Update display name
  const handleSaveName = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { displayName });
    alert("✅ Name updated!");
  };

  // 🚪 Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;
  const isDark = newTheme === "dark";

  return (
    <div
      style={{
        padding: "20px",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
        minHeight: "100vh",
      }}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/chat")}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          background: isDark ? "#555" : "#e0e0e0",
          border: "none",
          borderRadius: "50%",
          padding: "8px",
          cursor: "pointer",
        }}
      >
        ⬅
      </button>

      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>⚙️ Settings</h2>

      {/* ===== Profile Section ===== */}
      <Section title="Profile" isDark={isDark}>
        <div style={{ textAlign: "center", marginBottom: "15px" }}>
          <div
            onClick={handleProfileClick}
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              overflow: "hidden",
              cursor: "pointer",
              margin: "0 auto",
              backgroundImage: profilePic
                ? `url(${profilePic})`
                : "url(https://i.ibb.co/ZYvPL4Z/default-avatar.png)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "2px solid #555",
            }}
          />
          <input
            type="file"
            accept="image/*"
            ref={profileInputRef}
            style={{ display: "none" }}
            onChange={handleProfileChange}
          />
          <p style={{ fontSize: "12px", color: "#888" }}>Click to change</p>
        </div>

        <label>Name:</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={inputStyle}
        />
        <button onClick={handleSaveName} style={btnStyle}>
          💾 Save Name
        </button>

        <label>Email:</label>
        <input type="email" value={email} readOnly style={inputStyle} />
      </Section>

      {/* ===== Wallet Section ===== */}
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

      {/* ===== Preferences Section ===== */}
      <Section title="Theme & Preferences" isDark={isDark}>
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

        <label>Theme:</label>
        <select
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div
          onClick={() => fileInputRef.current.click()}
          style={{
            ...previewBox,
            backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none",
          }}
        >
          <p>🌈 Wallpaper Preview</p>
        </div>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button onClick={handleSavePreferences} style={btnStyle}>
          💾 Save Preferences
        </button>
      </Section>

      {/* ===== Notifications Section ===== */}
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

      {/* Logout */}
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

// ===== Section Wrapper =====
function Section({ title, children, isDark }) {
  return (
    <div
      style={{
        background: isDark ? "#2b2b2b" : "#fff",
        padding: "20px",
        borderRadius: "12px",
        marginTop: "25px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// ===== Styles =====
const btnStyle = (bg = "#007bff") => ({
  marginRight: "8px",
  padding: "10px 15px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  marginTop: "5px",
});

const selectStyle = (isDark) => ({
  width: "100%",
  padding: "8px",
  marginBottom: "10px",
  borderRadius: "6px",
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
  border: "1px solid #666",
});

const previewBox = {
  width: "100%",
  height: "150px",
  borderRadius: "10px",
  border: "2px solid #555",
  marginTop: "15px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "6px",
  border: "1px solid #ccc",
};