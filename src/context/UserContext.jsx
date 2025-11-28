// src/context/UserContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { auth, db, setUserPresence } from "../firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export const UserContext = createContext();

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading] = useState(true);

  // ================= AUTH & PRESENCE =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(u);

      // Fetch profile info from Firestore
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfilePic(data.profilePic || null);
        setProfileName(data.name || "");
      }

      // Presence tracking
      const cleanupPresence = setUserPresence(u.uid);
      setLoading(false);
      return () => cleanupPresence && cleanupPresence();
    });

    return () => unsubscribe();
  }, []);

  // ================= CLOUDINARY UPLOAD =================
  const uploadToCloudinary = async (file) => {
    if (!file) throw new Error("No file provided");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: fd }
    );

    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url || data.url;
  };

  // ================= UPDATE PROFILE PICTURE =================
  const updateProfilePic = async (file) => {
    if (!user || !file) return;

    try {
      // Optimistic update
      const localUrl = URL.createObjectURL(file);
      setProfilePic(localUrl);

      // Upload to Cloudinary
      const url = await uploadToCloudinary(file);

      // Save URL to Firestore
      await updateDoc(doc(db, "users", user.uid), {
        profilePic: url,
        updatedAt: serverTimestamp(),
      });

      setProfilePic(url);
      return url;
    } catch (err) {
      console.error("Failed to update profile picture:", err);
      throw err;
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        profilePic,
        setProfilePic,
        profileName,
        setProfileName,
        loading,
        uploadToCloudinary,
        updateProfilePic,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};