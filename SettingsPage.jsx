import React, { useContext, useState } from "react";
import { ThemeContext } from "./ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);

  const applySettings = () => {
    updateSettings(newTheme, newWallpaper);
    alert("Settings updated!");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Settings</h2>

      {/* Theme Selector */}
      <label>Theme: </label>
      <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>

      <br /><br />

      {/* Wallpaper URL */}
      <label>Wallpaper URL: </label>
      <input
        type="text"
        placeholder="Enter image URL"
        value={newWallpaper}
        onChange={(e) => setNewWallpaper(e.target.value)}
      />
      <br /><br />

      <button onClick={applySettings}>Apply Settings</button>
    </div>
  );
}