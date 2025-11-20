// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Cloudinary env --------------------
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);

  // profile fields
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null); // URL shown
  const [selectedFile, setSelectedFile] = useState(null); // File to upload

  // settings live-edit
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper || "");
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);

  const navigate = useNavigate();
  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // -------------------- Load user + live snapshot --------------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setUser(null);
        return;
      }
      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);

      // ensure doc exists
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          profilePic: null,
          preferences: {
            theme: "light",
            wallpaper: null,
            language: "English",
            fontSize: "Medium",
            layout: "Default",
            notifications: { push: true, email: true, sound: false },
          },
          createdAt: serverTimestamp(),
        });
      }

      // live updates
      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);

        if (data.preferences) {
          const p = data.preferences;
          setNewTheme(p.theme || "light");
          setNewWallpaper(p.wallpaper || "");
          setLanguage(p.language || "English");
          setFontSize(p.fontSize || "Medium");
          setLayout(p.layout || "Default");
          setNotifications(p.notifications || { push: true, email: true, sound: false });
          updateSettings(p.theme || "light", p.wallpaper || wallpaper || "");
        }
      });

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  // -------------------- Cloudinary upload --------------------
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
      throw new Error(
        "Cloudinary environment not set. Make sure VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET are defined"
      );
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("Cloudinary upload failed: " + text);
    }

    const data = await res.json();
    return data.secure_url || data.url;
  };

  // -------------------- Handlers --------------------
  const onProfileFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target.result);
    reader.readAsDataURL(f);
  };

  const onWallpaperFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewWallpaper(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSaveAll = async () => {
    if (!user) return alert("Not signed in");
    setLoadingSave(true);

    try {
      const userRef = doc(db, "users", user.uid);
      let profileUrl = profilePic;

      if (selectedFile) {
        profileUrl = await uploadToCloudinary(selectedFile);
      } else if (profilePic?.startsWith("data:")) {
        const res = await fetch(profilePic);
        const blob = await res.blob();
        profileUrl = await uploadToCloudinary(blob);
      }

      const prefs = {
        theme: newTheme,
        wallpaper: newWallpaper || null,
        language,
        fontSize,
        layout,
        notifications,
      };

      await updateDoc(userRef, {
        name: name || null,
        bio: bio || "",
        profilePic: profileUrl || null,
        preferences: prefs,
      });

      updateSettings(newTheme, newWallpaper || "");
      setSelectedFile(null);
      setMenuOpen(false);
      setEditing(false);
      alert("✅ Profile & settings saved");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save profile/settings: " + (err.message || String(err)));
    } finally {
      setLoadingSave(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const onKeySave = (e) => {
    if (e.key === "Enter") handleSaveAll();
  };

  const isDark = newTheme === "dark";

  // -------------------- UI --------------------
  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#0b0b0b" : "#f6f7fb", color: isDark ? "#fff" : "#111" }}>
      <button
        onClick={() => navigate("/chat")}
        style={{ position: "absolute", left: 18, top: 18, width: 36, height: 36, borderRadius: 18, border: "none", background: isDark ? "#333" : "#eee", cursor: "pointer" }}
      >
        ←
      </button>

      <div style={{ maxWidth: 900, margin: "18px auto 40px", padding: 18 }}>
        {/* Profile card */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: isDark ? "#111" : "#fff", padding: 16, borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.06)", position: "relative" }}>
          <div
            onClick={() => profileInputRef.current?.click()}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              background: profilePic ? `url(${profilePic}) center/cover` : "#8b8b8b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 22,
              cursor: "pointer",
              flexShrink: 0,
            }}
            title="Click to change profile photo"
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {name || "Unnamed"}
              </h2>

              <div style={{ marginLeft: "auto", position: "relative" }}>
                <button onClick={() => setMenuOpen((s) => !s)} style={{ border: "none", background: "transparent", color: isDark ? "#fff" : "#222", cursor: "pointer", fontSize: 20, padding: 6 }}>
                  ⋮
                </button>
                {menuOpen && (
                  <div style={{ position: "absolute", right: 0, top: 34, background: isDark ? "#1a1a1a" : "#fff", color: isDark ? "#fff" : "#000", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 60, minWidth: 180 }}>
                    <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={menuItemStyle}>Edit Info</button>
                    <button onClick={() => { profileInputRef.current?.click(); setMenuOpen(false); }} style={menuItemStyle}>Set Profile Photo</button>
                    <button onClick={handleLogout} style={menuItemStyle}>Log Out</button>
                  </div>
                )}
              </div>
            </div>

            <p style={{ margin: "8px 0", color: isDark ? "#cfcfcf" : "#666", overflowWrap: "anywhere" }}>
              {bio || "No bio yet — click ⋮ → Edit Info to add one."}
            </p>
            <p style={{ margin: 0, color: isDark ? "#bdbdbd" : "#777", fontSize: 13 }}>{email}</p>
          </div>
        </div>

        <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onProfileFileChange} />

        {/* Editing panel */}
        {editing && (
          <div style={{ marginTop: 18, background: isDark ? "#0f0f0f" : "#fff", padding: 16, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
            <h3 style={{ marginTop: 0 }}>Edit Profile</h3>
            <label style={labelStyle}>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeySave} style={inputStyle(isDark)} />

            <label style={labelStyle}>Bio</label>
            <input value={bio} onChange={(e) => setBio(e.target.value)} onKeyDown={onKeySave} style={inputStyle(isDark)} />

            <label style={labelStyle}>Profile photo (preview)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: 10, background: profilePic ? `url(${profilePic}) center/cover` : "#999" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => profileInputRef.current?.click()} style={btnStyle("#007bff")}>Choose Photo</button>
                <button onClick={() => { setProfilePic(null); setSelectedFile(null); }} style={btnStyle("#d32f2f")}>Remove</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Theme</label>
              <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)} style={inputStyle(isDark)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>

              <label style={labelStyle}>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle(isDark)}>
                <option>English</option>
                <option>French</option>
                <option>Spanish</option>
                <option>Arabic</option>
              </select>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button onClick={handleSaveAll} disabled={loadingSave} style={btnStyle("#007bff")}>
                {loadingSave ? "Saving…" : "💾 Save Profile & Settings"}
              </button>
              <button onClick={() => { setEditing(false); setSelectedFile(null); }} style={btnStyle("#888")}>Cancel</button>
            </div>
          </div>
        )}

        {/* Logout */}
        <div style={{ textAlign: "center", marginTop: 22 }}>
          <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Log out</button>
        </div>
      </div>
    </div>
  );
}

/* Styles */
const btnStyle = (bg) => ({ padding: "8px 12px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 });
const menuItemStyle = { display: "block", width: "100%", padding: "10px 12px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer" };
const labelStyle = { display: "block", marginTop: 8, marginBottom: 6, fontSize: 13, color: "#666" };
const inputStyle = (isDark) => ({ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: isDark ? "#121212" : "#fff", color: isDark ? "#fff" : "#111", boxSizing: "border-box" });