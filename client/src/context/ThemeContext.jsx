import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseClient";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

// Create the Theme context
const ThemeContext = createContext();

// Custom hook for consuming the theme context
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("system"); // Current theme: "light" | "dark" | "system"
  const [loading, setLoading] = useState(true); // Loading flag to delay app render until theme applied

  // Apply theme by adding class and setting attribute on <html>
  const applyTheme = (mode) => {
    const root = document.documentElement;

    let finalTheme = mode;
    if (mode === "system") {
      finalTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    root.classList.remove("light", "dark");
    root.classList.add(finalTheme);
    root.setAttribute("data-theme", mode);
  };

  // On mount and on auth.currentUser change, load theme preference
  useEffect(() => {
    const loadThemePreference = async () => {
      let savedTheme = localStorage.getItem("appTheme") || "system";

      const user = auth.currentUser;
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const userTheme = snap.data()?.settings?.theme;
            if (userTheme) savedTheme = userTheme;
          }
        } catch (error) {
          console.warn("Error fetching theme from Firestore:", error);
        }
      }

      setTheme(savedTheme);
      applyTheme(savedTheme);
      setLoading(false);
    };

    // Slight delay to ensure user auth state is ready (optional)
    const timer = setTimeout(loadThemePreference, 600);
    return () => clearTimeout(timer);
  }, [auth.currentUser]);

  // When theme changes, persist to localStorage and Firestore (if user logged in)
  useEffect(() => {
    if (loading) return; // Skip while loading

    localStorage.setItem("appTheme", theme);
    applyTheme(theme);

    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      updateDoc(userRef, { "settings.theme": theme }).catch(() => {
        // If updateDoc fails (e.g. doc doesn't exist), setDoc with merge: true
        setDoc(userRef, { settings: { theme } }, { merge: true });
      });
    }
  }, [theme, loading]);

  // Cycle theme: light → dark → system → light ...
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : prev === "dark" ? "system" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
};