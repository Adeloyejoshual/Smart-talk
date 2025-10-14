// src/context/ThemeContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { db, auth } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");
  const [wallpaper, setWallpaper] = useState("");

  // Load user settings when logged in
  useEffect(() => {
    const loadSettings = async () => {
      if (!auth.currentUser) return;
      const userRef = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.theme) setTheme(data.theme);
        if (data.wallpaper) setWallpaper(data.wallpaper);
      }
    };
    loadSettings();
  }, [auth.currentUser]);

  // Save new settings to Firebase
  const updateSettings = async (newTheme, newWallpaper) => {
    setTheme(newTheme);
    setWallpaper(newWallpaper);
    if (auth.currentUser) {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(
        userRef,
        { theme: newTheme, wallpaper: newWallpaper },
        { merge: true }
      );
    }
  };

  // Apply theme + wallpaper to body
  useEffect(() => {
    document.body.style.backgroundColor = theme === "dark" ? "#000" : "#fff";
    document.body.style.color = theme === "dark" ? "#fff" : "#000";
    document.body.style.backgroundImage = wallpaper
      ? `url(${wallpaper})`
      : "none";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundRepeat = "no-repeat";
  }, [theme, wallpaper]);

  return (
    <ThemeContext.Provider value={{ theme, wallpaper, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};