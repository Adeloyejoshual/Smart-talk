// src/context/UserContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// Cloudinary configuration from .env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Firebase user
  const [profilePic, setProfilePic] = useState(null);
  const [profileName, setProfileName] = useState("");

  // Load user profile from Firestore
  const loadUserProfile = async (uid) => {
    if (!uid) return;
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfilePic(data.profilePic || null);
        setProfileName(data.name || "");
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  };

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        await loadUserProfile(u.uid);
      } else {
        setProfilePic(null);
        setProfileName("");
      }
    });
    return unsubscribe;
  }, []);

  // Upload profile picture to Cloudinary + update Firestore
  const uploadProfilePic = async (file) => {
    if (!user) throw new Error("User not authenticated");

    // Cloudinary upload
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      {
        method: "POST",
        body: fd,
      }
    );

    if (!res.ok) throw new Error("Cloudinary upload failed");

    const data = await res.json();
    const url = data.secure_url || data.url;

    // Update Firestore
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { profilePic: url, updatedAt: serverTimestamp() });

    // Update local state
    setProfilePic(url);
    return url;
  };

  // Update user name
  const updateUserName = async (name) => {
    if (!user) throw new Error("User not authenticated");
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { name, updatedAt: serverTimestamp() });
    setProfileName(name);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        profilePic,
        profileName,
        setProfilePic,
        setProfileName,
        loadUserProfile,
        uploadProfilePic,
        updateUserName,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};