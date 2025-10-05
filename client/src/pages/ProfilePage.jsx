// /src/pages/ProfilePage.jsx
import React from "react";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../firebaseClient";

export default function ProfilePage() {
  const { theme } = useTheme();
  const user = auth.currentUser;

  return (
    <div
      style={{
        padding: 20,
        textAlign: "center",
        background: theme === "dark" ? "#121212" : "#fff",
        height: "100%",
      }}
    >
      <img
        src={user?.photoURL || "https://via.placeholder.com/100"}
        alt="Profile"
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          objectFit: "cover",
          marginBottom: 16,
        }}
      />
      <h3>{user?.displayName || "User"}</h3>
      <p style={{ color: theme === "dark" ? "#ccc" : "#555" }}>{user?.email}</p>
    </div>
  );
}