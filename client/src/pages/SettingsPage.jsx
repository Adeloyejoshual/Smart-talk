// /src/pages/SettingsPage.jsx
import React, { useState, useEffect } from "react";
import { auth, db, logout } from "../firebaseClient";
import { useTheme } from "../context/ThemeContext";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

export default function SettingsPage() {
  const user = auth.currentUser;
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    photoURL: "",
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  // Fetch user data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          name: data.name || "",
          email: data.email || "",
          photoURL: data.photoURL || "",
        });
        if (data.settings?.notifications !== undefined) {
          setNotificationsEnabled(data.settings.notifications);
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    await setDoc(
      ref,
      {
        name: profile.name,
        photoURL: profile.photoURL,
      },
      { merge: true }
    );
    alert("Profile updated ✅");
  };

  // Save notification toggle
  const handleToggleNotifications = async () => {
    if (!user) return;
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await updateDoc(doc(db, "users", user.uid), {
      "settings.notifications": newValue,
    });
  };

  // Save theme change
  const handleThemeChange = async (value) => {
    setTheme(value);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        "settings.theme": value,
      });
    }
  };

  if (loading) return <p>Loading settings...</p>;

  return (
    <div className="settings-page p-4">
      <h1 className="text-2xl font-semibold mb-4">Settings ⚙️</h1>

      {/* ---------------------------------------- */}
      {/* Profile Section */}
      {/* ---------------------------------------- */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-2">Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          <img
            src={profile.photoURL || "/default-avatar.png"}
            alt="Profile"
            className="w-16 h-16 rounded-full border"
          />
          <div>
            <input
              type="text"
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="Your name"
              className="border rounded-md p-2 mb-2 w-full"
            />
            <p className="text-sm text-gray-600">{profile.email}</p>
          </div>
        </div>
        <button
          onClick={handleSaveProfile}
          className="p-2 px-4 bg-blue-500 text-white rounded-md"
        >
          Save Profile
        </button>
      </section>

      {/* ---------------------------------------- */}
      {/* Theme Section */}
      {/* ---------------------------------------- */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-2">App Theme</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              checked={theme === "light"}
              onChange={() => handleThemeChange("light")}
            />
            <span>🌞 Light</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              checked={theme === "dark"}
              onChange={() => handleThemeChange("dark")}
            />
            <span>🌙 Dark</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              checked={theme === "system"}
              onChange={() => handleThemeChange("system")}
            />
            <span>⚙️ System Default</span>
          </label>
        </div>
      </section>

      {/* ---------------------------------------- */}
      {/* Notifications */}
      {/* ---------------------------------------- */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-2">Notifications</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={handleToggleNotifications}
          />
          <span>{notificationsEnabled ? "Enabled 🔔" : "Disabled 🔕"}</span>
        </label>
      </section>

      {/* ---------------------------------------- */}
      {/* Wallet Shortcut */}
      {/* ---------------------------------------- */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-2">Wallet</h2>
        <button
          onClick={() => (window.location.href = "/wallet")}
          className="p-2 px-4 bg-green-500 text-white rounded-md"
        >
          Open Wallet 💰
        </button>
      </section>

      {/* ---------------------------------------- */}
      {/* Logout */}
      {/* ---------------------------------------- */}
      <section>
        <button
          onClick={logout}
          className="p-2 px-4 bg-red-500 text-white rounded-md"
        >
          Logout 🚪
        </button>
      </section>
    </div>
  );
}