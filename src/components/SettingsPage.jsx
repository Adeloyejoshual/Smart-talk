import React, { useEffect, useState, useRef, useContext } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { updateSettings } = useContext(ThemeContext);

  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  const [userData, setUserData] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);

  // Settings
  const [theme, setTheme] = useState("light");
  const [wallpaper, setWallpaper] = useState("");
  const [newWallpaperFile, setNewWallpaperFile] = useState(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/");

      const ref = doc(db, "users", user.uid);

      // Live user data
      onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);

          setTheme(data.preferences?.theme || "light");
          setWallpaper(data.preferences?.wallpaper || "");
        }
      });
    };

    load();
  }, []);

  // Upload to Cloudinary
  const uploadToCloudinary = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", preset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: "POST", body: form }
    );

    const data = await res.json();
    return data.secure_url;
  };

  // Save settings (Theme + Wallpaper)
  const saveSettings = async () => {
    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      let finalWallpaper = wallpaper;

      if (newWallpaperFile) {
        finalWallpaper = await uploadToCloudinary(newWallpaperFile);
      }

      await updateDoc(ref, {
        preferences: {
          theme,
          wallpaper: finalWallpaper,
        },
        updatedAt: serverTimestamp(),
      });

      updateSettings(theme, finalWallpaper);
      setNewWallpaperFile(null);
    } finally {
      setSaving(false);
    }
  };

  const removeWallpaper = () => {
    setWallpaper("");
    setNewWallpaperFile(null);
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* HEADER */}
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "25px" }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            fontSize: "22px",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          ←
        </button>

        <h2 style={{ flex: 1, fontSize: "20px", fontWeight: "bold" }}>
          Settings
        </h2>

        {/* 3 DOT MENU */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ fontSize: "24px", cursor: "pointer" }}
          >
            ⋮
          </div>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "30px",
                background: "#fff",
                borderRadius: "10px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                width: "150px",
                zIndex: 20,
                padding: "8px 0",
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/edit-profile");
                }}
                style={menuBtn}
              >
                Edit Info
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  profileInputRef.current.click();
                }}
                style={menuBtn}
              >
                Set Profile Photo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for profile photo */}
      <input
        type="file"
        accept="image/*"
        ref={profileInputRef}
        style={{ display: "none" }}
        onChange={() => navigate("/edit-profile")}
      />

      {/* Profile Card */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 25 }}>
        <img
          src={userData.profilePic || "/default-avatar.png"}
          style={{
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            objectFit: "cover",
            marginRight: "15px",
          }}
        />

        <div>
          <div style={{ fontSize: "18px", fontWeight: "bold" }}>
            {userData.name}
          </div>
          <div style={{ color: "#666", fontSize: "14px" }}>
            {userData.bio || "No bio added"}
          </div>
          <div style={{ color: "#888", fontSize: "13px" }}>
            {userData.email}
          </div>
        </div>
      </div>

      {/* Wallpaper File Input */}
      <input
        type="file"
        accept="image/*"
        ref={wallpaperInputRef}
        style={{ display: "none" }}
        onChange={(e) => {
          setNewWallpaperFile(e.target.files[0]);
          setWallpaper(URL.createObjectURL(e.target.files[0]));
        }}
      />

      {/* THEME */}
      <Section title="Theme">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={selectStyle}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Section>

      {/* WALLPAPER */}
      <Section title="Wallpaper">
        {wallpaper ? (
          <img
            src={wallpaper}
            style={{
              width: "100%",
              height: "140px",
              borderRadius: "10px",
              objectFit: "cover",
              marginBottom: "10px",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "140px",
              background: "#ddd",
              borderRadius: "10px",
              marginBottom: "10px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#666",
            }}
          >
            No wallpaper selected
          </div>
        )}

        <button
          style={linkBtn}
          onClick={() => wallpaperInputRef.current.click()}
        >
          Choose Wallpaper
        </button>

        {wallpaper && (
          <button style={{ ...linkBtn, color: "red" }} onClick={removeWallpaper}>
            Remove Wallpaper
          </button>
        )}
      </Section>

      {/* SAVE SETTINGS */}
      <button
        onClick={saveSettings}
        disabled={saving}
        style={{
          width: "100%",
          padding: "12px",
          background: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "30px",
          marginTop: "20px",
          fontSize: "16px",
          fontWeight: "bold",
        }}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {/* ABOUT */}
      <div style={{ textAlign: "center", marginTop: "30px", color: "#777" }}>
        <p>Version 1.0.0</p>
        <p>© 2025 Hahala App</p>
        <p style={{ textDecoration: "underline" }}>Terms of Service</p>
        <p style={{ textDecoration: "underline" }}>Privacy Policy</p>
      </div>
    </div>
  );
}

/* ---------------------------- COMPONENTS ---------------------------- */

function Section({ title, children }) {
  return (
    <div
      style={{
        background: "#fff",
        padding: "15px",
        borderRadius: "12px",
        marginBottom: "20px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ marginBottom: "10px" }}>{title}</h3>
      {children}
    </div>
  );
}

/* ---------------------------- STYLES ---------------------------- */

const menuBtn = {
  width: "100%",
  padding: "10px 15px",
  border: "none",
  background: "none",
  textAlign: "left",
  fontSize: "15px",
  cursor: "pointer",
};

const selectStyle = {
  width: "100%",
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #ccc",
};

const linkBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#007bff",
  fontSize: "15px",
  marginRight: "10px",
};