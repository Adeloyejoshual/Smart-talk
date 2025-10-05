// /src/pages/SettingsPage.jsx
import React from "react";
import { useSettings } from "../context/SettingsContext";
import { useTheme } from "../context/ThemeContext";
import { logout } from "../firebaseClient";

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    updateSettings({ theme: newTheme });
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: theme === "dark" ? "#121212" : "#fafafa",
        color: theme === "dark" ? "#fff" : "#000",
        padding: 20,
      }}
    >
      <h2 style={{ marginBottom: 16 }}>⚙️ Settings</h2>

      {/* Notifications */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          <span>Notifications</span>
          <p style={subLabelStyle}>Enable or disable app notifications</p>
        </div>
        <label style={toggleContainer}>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => updateSettings({ notifications: e.target.checked })}
          />
        </label>
      </div>

      {/* Auto Download */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          <span>Auto Download Media</span>
          <p style={subLabelStyle}>Automatically download received media</p>
        </div>
        <label style={toggleContainer}>
          <input
            type="checkbox"
            checked={settings.autoDownloadMedia}
            onChange={(e) => updateSettings({ autoDownloadMedia: e.target.checked })}
          />
        </label>
      </div>

      {/* Privacy */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          <span>Privacy</span>
          <p style={subLabelStyle}>Control who can see your profile</p>
        </div>
        <select
          style={selectStyle(theme)}
          value={settings.privacy}
          onChange={(e) => updateSettings({ privacy: e.target.value })}
        >
          <option value="public">Public</option>
          <option value="contacts">Contacts Only</option>
          <option value="private">Private</option>
        </select>
      </div>

      {/* Theme */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          <span>Theme</span>
          <p style={subLabelStyle}>Switch between Light / Dark / System</p>
        </div>
        <select
          style={selectStyle(theme)}
          value={settings.theme || theme}
          onChange={(e) => handleThemeChange(e.target.value)}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      {/* Language */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          <span>Language</span>
          <p style={subLabelStyle}>Choose your app language</p>
        </div>
        <select
          style={selectStyle(theme)}
          value={settings.language}
          onChange={(e) => updateSettings({ language: e.target.value })}
        >
          <option value="en">English</option>
          <option value="fr">French</option>
          <option value="es">Spanish</option>
          <option value="pt">Portuguese</option>
        </select>
      </div>

      {/* Logout */}
      <div style={{ marginTop: "auto", textAlign: "center" }}>
        <button
          onClick={logout}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "#ff3b30",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
        <p style={{ fontSize: 13, color: theme === "dark" ? "#ccc" : "#777", marginTop: 10 }}>
          Signed in as {settings?.email || "current user"}
        </p>
      </div>
    </div>
  );
}

// --- Inline Styles ---
const sectionStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 0",
  borderBottom: "1px solid #ddd",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
};

const subLabelStyle = {
  margin: 0,
  fontSize: 12,
  color: "#777",
};

const toggleContainer = {
  display: "flex",
  alignItems: "center",
};

const selectStyle = (theme) => ({
  padding: 8,
  borderRadius: 8,
  border: "1px solid #ccc",
  background: theme === "dark" ? "#1f1f1f" : "#fff",
  color: theme === "dark" ? "#fff" : "#000",
  fontSize: 14,
});