// /src/context/SettingsContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseClient";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useTheme } from "./ThemeContext";

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    notifications: true,
    privacy: "public",
    language: "en",
    autoDownloadMedia: false,
    theme: "system",
  });

  const { setTheme } = useTheme();

  // ----------------------------------
  // 🧠 Load settings when user logs in
  // ----------------------------------
  useEffect(() => {
    const fetchUserSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const userData = snap.data();
          const userSettings = userData.settings || {};

          setSettings((prev) => ({ ...prev, ...userSettings }));

          // Sync theme instantly
          if (userSettings.theme) {
            setTheme(userSettings.theme);
          }

          // Save locally for speed
          localStorage.setItem("userSettings", JSON.stringify(userSettings));
        }
      } catch (err) {
        console.error("Error loading user settings:", err);
      }
    };

    const timer = setTimeout(fetchUserSettings, 600);
    return () => clearTimeout(timer);
  }, [auth.currentUser]);

  // ----------------------------------
  // 💾 Load from localStorage (faster)
  // ----------------------------------
  useEffect(() => {
    const stored = localStorage.getItem("userSettings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  // ----------------------------------
  // 🔄 Update user settings
  // ----------------------------------
  const updateSettings = async (newSettings) => {
    const user = auth.currentUser;
    if (!user) return;

    const updated = { ...settings, ...newSettings, updatedAt: serverTimestamp() };
    setSettings(updated);
    localStorage.setItem("userSettings", JSON.stringify(updated));

    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(ref, { settings: updated }, { merge: true });

      if (newSettings.theme) {
        setTheme(newSettings.theme);
      }
    } catch (err) {
      console.error("Error updating settings:", err);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};