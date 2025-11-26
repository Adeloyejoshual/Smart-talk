// src/components/SettingsPage.jsx

import React, { useEffect, useState, useContext } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import axios from "axios";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);

  const [profilePic, setProfilePic] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [sound, setSound] = useState(false);

  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loadingWallet, setLoadingWallet] = useState(true);

  const [selectedFile, setSelectedFile] = useState(null);
  const isDark = theme === "dark";

  const API_BASE = "https://smart-talk-zlxe.onrender.com";

  /* ===============================
     FETCH USER DATA FROM BACKEND
  =============================== */
  const fetchUserPreferences = async (uid) => {
    try {
      const res = await axios.get(`${API_BASE}/api/users/${uid}`);
      const data = res.data;

      setName(data.name || "");
      setUsername(data.username || "");
      setBio(data.bio || "");
      setProfilePic(data.profilePic || "");
      setSound(data.sound || false);
    } catch (err) {
      console.error("Error fetching preferences:", err);
    }
  };

  /* ===============================
     FETCH USER WALLET
  =============================== */
  const fetchWallet = async (uid) => {
    try {
      const res = await axios.get(`${API_BASE}/api/wallet/${uid}`);

      setWallet({
        balance: res.data.balance || 0,
        transactions: res.data.transactions || [],
      });

    } catch (err) {
      console.error("Wallet fetch error:", err);
    } finally {
      setLoadingWallet(false);
    }
  };

  /* ===============================
     HANDLE PROFILE PIC UPLOAD
  =============================== */
  const uploadProfilePic = async (file) => {
    if (!file) return profilePic;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ml_default");

    const uploadRes = await axios.post(
      `https://api.cloudinary.com/v1_1/dtdatsmuq/image/upload`,
      formData
    );

    return uploadRes.data.secure_url;
  };

  /* ===============================
     SAVE UPDATED PROFILE SETTINGS
  =============================== */
  const savePreferences = async () => {
    if (!auth.currentUser) return;

    try {
      let uploadedPic = profilePic;

      if (selectedFile) {
        uploadedPic = await uploadProfilePic(selectedFile);
        setProfilePic(uploadedPic);
      }

      await axios.post(`${API_BASE}/api/preferences`, {
        uid: auth.currentUser.uid,
        name,
        username,
        bio,
        sound,
        profilePic: uploadedPic,
      });

      updateSettings({ wallpaper, theme });
      alert("Profile updated successfully!");

    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving changes.");
    }
  };

  /* ===============================
     SIGN OUT
  =============================== */
  const logout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  /* ===============================
     LOAD DATA ON MOUNT
  =============================== */
  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    fetchUserPreferences(uid);
    fetchWallet(uid);
  }, []);

  /* ===============================
     UI
  =============================== */
  return (
    <div
      style={{
        padding: 20,
        background: isDark ? "#0d0d0d" : "#f4f4f4",
        minHeight: "100vh",
      }}
    >
      {/* PROFILE CARD */}
      <div
        style={{
          background: isDark ? "#1e1e1e" : "#fff",
          padding: 20,
          borderRadius: 12,
          marginBottom: 25,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <h2 style={{ marginBottom: 12 }}>Profile</h2>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ cursor: "pointer" }}>
            <img
              src={profilePic || "/default-avatar.png"}
              alt="Profile"
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid #3b82f6",
              }}
            />
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files[0];
                setSelectedFile(file);
                setProfilePic(URL.createObjectURL(file));
              }}
            />
          </label>

          <div style={{ flex: 1 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              style={{
                width: "100%",
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            />
          </div>
        </div>

        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Write a short bio..."
          style={{
            width: "100%",
            marginTop: 15,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ccc",
            height: 80,
            resize: "none",
          }}
        ></textarea>

        <button
          onClick={savePreferences}
          style={{
            marginTop: 20,
            width: "100%",
            padding: 12,
            background: "#3b82f6",
            color: "#fff",
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
          }}
        >
          Save Changes
        </button>
      </div>

      {/* WALLET SECTION */}
      <div
        style={{
          background: isDark ? "#1e1e1e" : "#fff",
          padding: 20,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <h2>Wallet</h2>

        {loadingWallet ? (
          <p>Loading wallet…</p>
        ) : (
          <>
            <h3 style={{ fontSize: 28, marginTop: 10 }}>
              ₦{wallet.balance.toLocaleString()}
            </h3>

            <h4 style={{ marginTop: 20 }}>Last Transactions</h4>
            {wallet.transactions.slice(0, 3).map((t, i) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  background: isDark ? "#2b2b2b" : "#f1f1f1",
                  borderRadius: 8,
                  marginTop: 10,
                }}
              >
                <strong>{t.type}</strong> — ₦{t.amount}
                <div style={{ fontSize: 12, opacity: 0.7 }}>{t.date}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* LOGOUT */}
      <button
        onClick={logout}
        style={{
          marginTop: 30,
          width: "100%",
          padding: 12,
          background: "red",
          color: "white",
          borderRadius: 10,
          border: "none",
        }}
      >
        Logout
      </button>
    </div>
  );
}