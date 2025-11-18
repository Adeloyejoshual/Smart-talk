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
  const [registrationName, setRegistrationName] = useState(""); // original
  const [displayName, setDisplayName] = useState(""); // edited
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [walletHistory, setWalletHistory] = useState([]);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");

  const navigate = useNavigate();
  const profileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;
      setUser(userAuth);
      setRegistrationName(userAuth.displayName || "");

      const userRef = doc(db, "users", userAuth.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: userAuth.email,
          balance: 5.0,
          createdAt: serverTimestamp(),
          lastCheckin: null,
          profilePic: null,
          displayName: "",
          bio: "",
          preferences: { language: "English", fontSize: "Medium", layout: "Default", theme: "light", wallpaper: null },
        });
      } else {
        const data = userSnap.data();
        setDisplayName(data.displayName || "");
        setProfilePic(data.profilePic || null);
        setBio(data.bio || "");
        if (data.preferences) {
          setLanguage(data.preferences.language || "English");
          setFontSize(data.preferences.fontSize || "Medium");
          setLayout(data.preferences.layout || "Default");
          setNewTheme(data.preferences.theme || "light");
          setNewWallpaper(data.preferences.wallpaper || wallpaper);
        }
      }

      // Wallet live
      const unsubBalance = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBalance(data.balance || 0);
          checkLastCheckin(data.lastCheckin);
        }
      });

      // Transactions live
      const txRef = collection(db, "transactions");
      const txQuery = query(txRef, where("uid", "==", userAuth.uid), orderBy("createdAt", "desc"));
      const unsubTx = onSnapshot(txQuery, (snapshot) =>
        setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      );

      // Wallet history from Mongo
      fetch(`${process.env.REACT_APP_BACKEND_URL || ""}/api/wallet/${userAuth.uid}`)
        .then((res) => res.json())
        .then((data) => setWalletHistory(data))
        .catch((err) => console.error("Failed to fetch wallet history:", err));

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
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const lastCheckin = data.lastCheckin ? new Date(data.lastCheckin.seconds * 1000) : null;
      const today = new Date();
      if (lastCheckin &&
          lastCheckin.getDate() === today.getDate() &&
          lastCheckin.getMonth() === today.getMonth() &&
          lastCheckin.getFullYear() === today.getFullYear()
      ) return alert("✅ Already checked in today!");

      const newBalance = (data.balance || 0) + 0.25;
      await updateDoc(userRef, { balance: newBalance, lastCheckin: serverTimestamp() });
      setCheckedInToday(true);
      alert("🎉 You earned +$0.25 for your daily check-in!");
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);

    // Profile pic upload skipped (or can add Cloudinary logic)

    await updateDoc(userRef, { displayName, bio });
    alert("✅ Profile updated!");
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { preferences: { language, fontSize, layout, theme: newTheme, wallpaper: newWallpaper } });
    updateSettings(newTheme, newWallpaper);
    alert("✅ Preferences saved!");
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const getInitials = () => {
    const name = registrationName || "??";
    const parts = name.trim().split(" ");
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const isDark = newTheme === "dark";

  return (
    <div style={{ padding: 20, background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Profile */}
      <Section title="Profile" isDark={isDark}>
        <div style={{ textAlign: "center" }}>
          <div
            onClick={() => profileInputRef.current.click()}
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              margin: "0 auto 10px",
              background: profilePic ? `url(${profilePic})` : "#888",
              backgroundSize: "cover",
              backgroundPosition: "center",
              cursor: "pointer",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 36,
              color: "#fff",
              fontWeight: "bold"
            }}
          >
            {!profilePic && getInitials()}
          </div>

          <input
            type="file"
            accept="image/*"
            ref={profileInputRef}
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              setSelectedFile(file);
              const reader = new FileReader();
              reader.onload = (event) => setProfilePic(event.target.result);
              reader.readAsDataURL(file);
            }}
          />

          <p><strong>Full Name (Registered):</strong> {registrationName}</p>
          <label>Edited Name:</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={selectStyle(isDark)} />

          <label>Bio:</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} style={{...selectStyle(isDark), height: "60px"}} />

          <button onClick={handleSaveProfile} style={btnStyle("#007bff")}>💾 Save Profile</button>
        </div>
      </Section>

      {/* Wallet */}
      <Section title="Wallet" isDark={isDark}>
        <p><strong>Balance:</strong> ${balance.toFixed(2)}</p>
        <button onClick={handleDailyCheckin} style={btnStyle("#28a745")} disabled={checkedInToday}>
          {checkedInToday ? "Checked-in ✅" : "Daily Check-in 💰"}
        </button>

        <div style={{ marginTop: 15, maxHeight: 200, overflowY: "auto", border: `1px solid ${isDark ? "#444" : "#ccc"}`, padding: 10, borderRadius: 8 }}>
          {walletHistory.length === 0 ? (
            <p>No wallet history yet.</p>
          ) : walletHistory.map(txn => (
            <div key={txn._id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>{txn.description || txn.type}</span>
              <span style={{ color: txn.type === "credit" ? "#28a745" : "#d32f2f" }}>
                {txn.type === "credit" ? "+" : "-"}${txn.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Preferences" isDark={isDark}>
        <label>Theme:</label>
        <select value={newTheme} onChange={e => setNewTheme(e.target.value)} style={selectStyle(isDark)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <label>Wallpaper URL:</label>
        <input type="text" value={newWallpaper} onChange={e => setNewWallpaper(e.target.value)} style={selectStyle(isDark)} />

        <button onClick={handleSavePreferences} style={btnStyle("#007bff")}>💾 Save Preferences</button>
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>
    </div>
  );
}

/* Section Wrapper */
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* Styles */
const btnStyle = (bg) => ({ marginRight: 8, padding: "10px 15px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });