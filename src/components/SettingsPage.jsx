import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
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
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [balance, setBalance] = useState(0);
  const [walletHistory, setWalletHistory] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);

  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

  const navigate = useNavigate();
  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // ================= Load User & Preferences =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;
      setUser(userAuth);
      setEmail(userAuth.email);

      const userRef = doc(db, "users", userAuth.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: userAuth.displayName || "User",
          bio: "",
          profilePic: null,
          balance: 5.0,
          lastCheckin: null,
          preferences: { theme: "light", wallpaper: null, language: "English", fontSize: "Medium", layout: "Default" },
          createdAt: serverTimestamp(),
        });
        alert("🎁 Welcome! You’ve received a $5 new user bonus!");
        setName(userAuth.displayName || "User");
        setBio("");
      } else {
        const data = userSnap.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        setBalance(data.balance || 0);

        if (data.preferences) {
          setNewTheme(data.preferences.theme || "light");
          setNewWallpaper(data.preferences.wallpaper || wallpaper);
          setLanguage(data.preferences.language || "English");
          setFontSize(data.preferences.fontSize || "Medium");
          setLayout(data.preferences.layout || "Default");
        }
        checkLastCheckin(data.lastCheckin);
      }

      // Wallet history from Mongo
      fetch(`${process.env.REACT_APP_BACKEND_URL || ""}/api/wallet/${userAuth.uid}`)
        .then((res) => res.json())
        .then((data) => setWalletHistory(data))
        .catch((err) => console.error("Failed to fetch wallet history:", err));
    });

    return () => unsubscribe();
  }, []);

  // ================= Daily check-in =================
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
    const lastCheckin = data.lastCheckin ? new Date(data.lastCheckin.seconds * 1000) : null;
    const today = new Date();

    if (lastCheckin &&
        lastCheckin.getDate() === today.getDate() &&
        lastCheckin.getMonth() === today.getMonth() &&
        lastCheckin.getFullYear() === today.getFullYear()
    ) {
      alert("✅ Already checked in today!");
      return;
    }

    const newBalance = (data.balance || 0) + 0.25;
    await updateDoc(userRef, { balance: newBalance, lastCheckin: serverTimestamp() });
    setBalance(newBalance);
    setCheckedInToday(true);
    alert("🎉 Daily check-in +$0.25!");
  };

  // ================= Profile Picture =================
  const handleProfileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);

    let profileUrl = profilePic;

    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("upload_preset", process.env.REACT_APP_CLOUDINARY_PRESET);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD}/image/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        profileUrl = data.secure_url;
      } catch (err) {
        console.error(err);
        alert("❌ Failed to upload profile picture");
        return;
      }
    }

    await updateDoc(userRef, { name, bio, profilePic: profileUrl });
    setProfilePic(profileUrl);
    setSelectedFile(null);
    alert("✅ Profile updated successfully!");
  };

  // ================= Logout =================
  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  const isDark = newTheme === "dark";

  return (
    <div style={{ padding: "20px", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000", minHeight: "100vh" }}>
      <button onClick={() => navigate("/chat")} style={{ position: "absolute", top: "20px", left: "20px", background: isDark ? "#555" : "#e0e0e0", border: "none", borderRadius: "50%", padding: "8px", cursor: "pointer" }}>⬅</button>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>⚙️ Settings</h2>

      {/* === 1. Profile Section === */}
      <Section title="Profile" isDark={isDark}>
        <div style={{ textAlign: "center" }}>
          <div
            onClick={() => profileInputRef.current.click()}
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              margin: "0 auto 10px",
              background: profilePic ? `url(${profilePic})` : "#888",
              backgroundSize: "cover",
              backgroundPosition: "center",
              cursor: "pointer",
            }}
          />

          <input type="file" accept="image/*" ref={profileInputRef} style={{ display: "none" }} onChange={handleProfileChange} />

          <div style={{ marginTop: "10px" }}>
            <label>Name:</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={selectStyle(isDark)} />
            <label>Bio:</label>
            <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} style={selectStyle(isDark)} />
            <p><strong>Email:</strong> {email}</p>
            <button onClick={handleSaveProfile} style={btnStyle("#007bff")}>💾 Save Profile</button>
          </div>
        </div>
      </Section>

      {/* === 2. Wallet Section === */}
      <Section title="Wallet" isDark={isDark}>
        <p><strong>Balance:</strong> ${balance.toFixed(2)}</p>
        <button onClick={handleDailyCheckin} style={btnStyle("#28a745")} disabled={checkedInToday}>
          {checkedInToday ? "Checked-in ✅" : "Daily Check-in 💰"}
        </button>

        <div style={{ marginTop: "15px", maxHeight: "200px", overflowY: "auto", border: `1px solid ${isDark ? "#444" : "#ccc"}`, padding: "10px", borderRadius: "8px" }}>
          {walletHistory.length === 0 ? (
            <p>No wallet history yet.</p>
          ) : (
            walletHistory.map((txn) => (
              <div key={txn._id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>{txn.description || txn.type}</span>
                <span style={{ color: txn.type === "credit" ? "#28a745" : "#d32f2f" }}>
                  {txn.type === "credit" ? "+" : "-"}${txn.amount.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* === 3. Settings Section === */}
      <Section title="Settings" isDark={isDark}>
        {/* Theme, Wallpaper, Language, Notifications */}
        <p><strong>Theme:</strong> {newTheme}</p>
        <p><strong>Wallpaper:</strong> {newWallpaper ? "Custom" : "Default"}</p>
        <p><strong>Language:</strong> {language}</p>
        <p><strong>Font Size:</strong> {fontSize}</p>
        <p><strong>Layout:</strong> {layout}</p>
      </Section>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>
    </div>
  );
}

// Section Wrapper
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: "20px", borderRadius: "12px", marginTop: "25px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// Styles
const btnStyle = (bg) => ({ marginRight: "8px", padding: "10px 15px", background: bg, color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: "8px", marginBottom: "10px", borderRadius: "6px", background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });