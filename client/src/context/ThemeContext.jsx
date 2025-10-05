// /src/context/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseClient";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ---------------------------
// Create Context
// ---------------------------
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("system"); // default
  const [loading, setLoading] = useState(true);

  // Apply theme to <html> tag
  const applyTheme = (mode) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
  };

  // Load user theme from Firestore or localStorage
  useEffect(() => {
    const user = auth.currentUser;
    const loadTheme = async () => {
      let saved = localStorage.getItem("themeMode");
      if (user) {
        const ref = doc(db, "users", user.uid, "settings", "preferences");
        const snap = await getDoc(ref);
        if (snap.exists()) saved = snap.data()?.theme || saved;
      }
      setTheme(saved || "system");
      setLoading(false);
    };
    loadTheme();
  }, []);

  // Persist theme to Firestore + localStorage
  useEffect(() => {
    if (loading) return;
    const user = auth.currentUser;
    localStorage.setItem("themeMode", theme);
    if (user) {
      const ref = doc(db, "users", user.uid, "settings", "preferences");
      setDoc(ref, { theme }, { merge: true });
    }
    applyTheme(theme);
  }, [theme, loading]);

  const toggleTheme = () => {
    setTheme((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light"
    );
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {!loading && children}
    </ThemeContext.Provider>
  );
};

// ---------------------------
// Custom Hook
// ---------------------------
export const useTheme = () => useContext(ThemeContext);