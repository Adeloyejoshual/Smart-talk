import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function EditProfilePage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [newTheme, setNewTheme] = useState("light");
  const [newWallpaper, setNewWallpaper] = useState(null);
  const wallpaperInputRef = useRef(null);
  const profileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);
      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        if (data.preferences) {
          setNewTheme(data.preferences.theme || "light");
          setNewWallpaper(data.preferences.wallpaper || null);
        }
      }
    });
    return () => unsub();
  }, []);

  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    return data.secure_url || data.url;
  };

  const handleProfileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setSelectedFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePic(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleWallpaperChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewWallpaper(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    let profileUrl = profilePic;

    if (selectedFile) {
      profileUrl = await uploadToCloudinary(selectedFile);
    } else if (profilePic?.startsWith("data:")) {
      const blob = await fetch(profilePic).then(r => r.blob());
      profileUrl = await uploadToCloudinary(blob);
    }

    await updateDoc(userRef, {
      name,
      bio,
      profilePic: profileUrl,
      preferences: {
        theme: newTheme,
        wallpaper: newWallpaper || null,
      },
    });

    alert("✅ Profile saved!");
    navigate("/settings"); // go back
  };

  if (!user) return <p>Loading...</p>;
  const isDark = newTheme === "dark";

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      <button onClick={() => navigate("/settings")} style={{ marginBottom: 20 }}>⬅ Back</button>
      <h2>Edit Profile</h2>

      <label>Full Name</label>
      <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6 }} />

      <label>Bio</label>
      <input value={bio} onChange={e => setBio(e.target.value)} style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6 }} />

      <label>Profile Photo</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 72, height: 72, borderRadius: 10, background: profilePic ? `url(${profilePic}) center/cover` : "#999" }} />
        <div>
          <button onClick={() => profileInputRef.current.click()}>Choose Photo</button>
          <button onClick={() => { setProfilePic(null); setSelectedFile(null); }}>Remove</button>
        </div>
      </div>
      <input type="file" ref={profileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleProfileChange} />

      <label>Wallpaper</label>
      <div style={{ width: "100%", height: 150, borderRadius: 10, border: "2px solid #555", backgroundSize: "cover", backgroundPosition: "center", marginBottom: 10, backgroundImage: newWallpaper ? `url(${newWallpaper})` : "none", display: "flex", justifyContent: "center", alignItems: "center" }}>
        {!newWallpaper && <span>Click to select wallpaper</span>}
      </div>
      <button onClick={() => wallpaperInputRef.current.click()}>Choose Wallpaper</button>
      <button onClick={() => setNewWallpaper(null)}>Remove Wallpaper</button>
      <input type="file" ref={wallpaperInputRef} style={{ display: "none" }} accept="image/*" onChange={handleWallpaperChange} />

      <label>Theme</label>
      <select value={newTheme} onChange={e => setNewTheme(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, marginBottom: 10 }}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>

      <button onClick={handleSave} style={{ padding: 12, background: "#007bff", color: "#fff", borderRadius: 50 }}>💾 Save Profile</button>
    </div>
  );
}