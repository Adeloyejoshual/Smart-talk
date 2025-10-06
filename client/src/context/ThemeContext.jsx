// /src/context/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

/**
 * ThemeProvider manages `theme` and `accentColor` globally.
 * it persists preferences to localStorage and applies them on <html>.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [accentColor, setAccentColor] = useState(
    localStorage.getItem("accentColor") || "#007bff" // default blue
  );

  useEffect(() => {
    // Apply theme and accent color to document
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--theme-color", accentColor);

    // Save preferences to localStorage
    localStorage.setItem("theme", theme);
    localStorage.setItem("accentColor", accentColor);
  }, [theme, accentColor]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook for consuming ThemeContext.
 * Returns { theme, toggleTheme, accentColor, setAccentColor }
 */
export const useTheme = () => useContext(ThemeContext);