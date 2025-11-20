// src/components/Settings.jsx
import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

/*
 Cloudinary environment variables:
 - Vite: VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET
 - CRA fallback: REACT_APP_CLOUDINARY_CLOUD, REACT_APP_CLOUDINARY_UPLOAD_PRESET
*/
const CLOUDINARY_CLOUD =
  import.meta?.env?.VITE_CLOUDINARY_CLOUD_NAME || process.env.REACT_APP_CLOUDINARY_CLOUD;
const CLOUDINARY_PRESET =
  import.meta?.env?.VITE_CLOUDINARY_UPLOAD_PRESET || process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

export default function Settings() {
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  const [profile, setProfile] = useState({ displayName: "", email: "", photoURL: "", bio: "" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!uid) return;
    const loadProfile = async () => {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setProfile(snap.data());
      setLoading(false);
    };
    loadProfile();
  }, [uid]);

  // -------------------- Cloudinary Upload --------------------
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new Error("Cloudinary env not set");

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);

    // preview locally
    const reader = new FileReader();
    reader.onload = (ev) => setProfile((prev) => ({ ...prev, photoURL: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const saveSettings = async () => {
    if (!uid) return alert("User not signed in");
    setUploading(true);
    try {
      let photoURL = profile.photoURL;

      // only upload if a file was selected
      if (selectedFile) {
        photoURL = await uploadToCloudinary(selectedFile);
      }

      await updateDoc(doc(db, "users", uid), {
        displayName: profile.displayName,
        email: profile.email,
        bio: profile.bio,
        photoURL,
      });

      alert("✅ Settings saved");
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save settings: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>

      <div className="flex flex-col items-center mb-6">
        <img
          src={profile.photoURL || "https://via.placeholder.com/120"}
          alt="Profile"
          className="w-32 h-32 rounded-full object-cover border border-gray-700 mb-2"
        />
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handlePhotoChange}
        />
        <button
          className="bg-blue-600 px-4 py-2 rounded-lg text-white"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Change Photo"}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-gray-400">Name</label>
          <input
            type="text"
            name="displayName"
            className="w-full p-2 rounded bg-gray-800 text-white mt-1"
            value={profile.displayName}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="text-gray-400">Email</label>
          <input
            type="email"
            name="email"
            className="w-full p-2 rounded bg-gray-800 text-white mt-1"
            value={profile.email}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="text-gray-400">Bio</label>
          <textarea
            name="bio"
            className="w-full p-2 rounded bg-gray-800 text-white mt-1"
            value={profile.bio}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <button
          onClick={saveSettings}
          className="w-full bg-green-600 py-2 rounded-lg text-white font-semibold"
          disabled={uploading}
        >
          {uploading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}