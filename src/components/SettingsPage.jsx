// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import axios from "axios";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const navigate = useNavigate();
  const fileInputRef = useRef();

  // ------------------ States ------------------
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);

  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");
  const [newTheme, setNewTheme] = useState(theme);

  // ------------------ Load User ------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) return navigate("/login");
      setUser(currentUser);
      setUsername(currentUser.displayName || "");
      setProfilePic(currentUser.photoURL || "");
    });
    return unsubscribe;
  }, [navigate]);

  // ------------------ MongoDB Wallet Fetch ------------------
  useEffect(() => {
    if (!user) return;

    const fetchWallet = async () => {
      try {
        const res = await fetch(
          `https://smart-talk-zlxe.onrender.com/api/wallet/${user.uid}`
        );
        const data = await res.json();

        setBalance(data.balance || 0);
        setTransactions(data.transactions?.slice(0, 3) || []);
        setCheckedInToday(data.checkedInToday || false);
      } catch (err) {
        console.error("Failed to load wallet:", err);
      }
    };

    fetchWallet();
  }, [user]);

  // ------------------ Daily Check-in ------------------
  const handleDailyCheckin = async () => {
    if (!user) return;

    try {
      const res = await fetch(
        "https://smart-talk-zlxe.onrender.com/api/wallet/daily",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid }),
        }
      );

      const data = await res.json();

      if (!res.ok) return alert(data.message);

      setBalance(data.balance);
      setCheckedInToday(true);
      alert("🎉 Daily Check-in Success! +$0.25 awarded");
    } catch (err) {
      console.error(err);
      alert("Check-in failed");
    }
  };

  // ------------------ Upload Profile Picture ------------------
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setProfilePic(URL.createObjectURL(file));
  };

  const uploadProfilePic = async () => {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("upload_preset", "ml_default");

    const uploadRes = await fetch(
      "https://api.cloudinary.com/v1_1/dnjakvpbw/image/upload",
      { method: "POST", body: formData }
    );

    const data = await uploadRes.json();
    return data.secure_url;
  };

  // ------------------ Save Settings ------------------
  const saveSettings = async () => {
    try {
      let newPicUrl = profilePic;

      if (selectedFile) {
        newPicUrl = await uploadProfilePic();
        await auth.currentUser.updateProfile({ photoURL: newPicUrl });
      }

      await auth.currentUser.updateProfile({ displayName: username });

      setProfilePic(newPicUrl);

      updateSettings({
        theme: newTheme,
        wallpaper: newWallpaper,
      });

      await axios.post(
        "https://smart-talk-zlxe.onrender.com/api/preferences",
        {
          uid: user.uid,
          theme: newTheme,
          wallpaper: newWallpaper,
        }
      );

      alert("Settings Saved Successfully!");
    } catch (err) {
      console.error(err);
      alert("Error saving settings");
    }
  };

  // ------------------ UI Components ------------------
  const btnStyle = (color) => ({
    width: "100%",
    padding: 12,
    borderRadius: 10,
    background: color,
    color: "white",
    fontSize: 16,
    border: "none",
    marginTop: 10,
  });

  const Section = ({ title, children }) => (
    <div
      style={{
        background: newTheme === "dark" ? "#1c1c1c" : "#ffffff",
        padding: 16,
        borderRadius: 12,
        marginBottom: 25,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  );

  // ------------------ Render ------------------
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        background: newWallpaper
          ? `url(${newWallpaper}) center/cover`
          : newTheme === "dark"
          ? "#121212"
          : "#f5f5f5",
      }}
    >
      {/* Profile Section */}
      <Section title="Profile">
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <img
            src={profilePic || "/default-avatar.png"}
            alt="profile"
            style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <button onClick={() => fileInputRef.current.click()}>Change</button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            hidden
          />
        </div>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ marginTop: 20, width: "100%", padding: 10 }}
          placeholder="Username"
        />
      </Section>

      {/* Wallet Section */}
      <Section title="Wallet">
        <p>
          Balance:{" "}
          <strong style={{ color: "#00e676" }}>
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
          {checkedInToday ? "✅ Checked-in Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>

        <button
          onClick={() => navigate("/topup")}
          style={btnStyle("#007bff")}
        >
          💳 Top Up
        </button>

        <button
          onClick={() => navigate("/withdrawal")}
          style={btnStyle("#28a745")}
        >
          💸 Withdraw
        </button>

        <h4 style={{ marginTop: 20 }}>Recent Transactions</h4>

        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          transactions.map((t, i) => (
            <div
              key={i}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #444",
              }}
            >
              <p style={{ margin: 0 }}>{t.type}</p>
              <strong style={{ color: t.amount > 0 ? "#4CAF50" : "#d32f2f" }}>
                {t.amount > 0 ? "+" : ""}
                ${t.amount.toFixed(2)}
              </strong>
            </div>
          ))
        )}
      </Section>

      {/* Preferences Section */}
      <Section title="Appearance">
        <select
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          style={{ width: "100%", padding: 12 }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <input
          value={newWallpaper}
          onChange={(e) => setNewWallpaper(e.target.value)}
          placeholder="Wallpaper Image URL"
          style={{ marginTop: 10, width: "100%", padding: 12 }}
        />
      </Section>

      {/* Save Button */}
      <button onClick={saveSettings} style={btnStyle("#6200ea")}>
        Save Settings
      </button>
    </div>
  );
}