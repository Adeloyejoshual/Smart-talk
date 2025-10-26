// src/components/ProtectedRoute.jsx
import React, { useEffect, useState, useContext } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });
    return () => unsubscribe();
  }, []);

  if (checking) {
    return (
      <div
        style={{
          height: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: wallpaper
            ? `url(${wallpaper}) center/cover no-repeat`
            : isDark
            ? "#0b0b0b"
            : "#f9f9f9",
          color: isDark ? "#fff" : "#000",
          fontFamily: "system-ui, sans-serif",
          transition: "background 0.3s ease",
          textAlign: "center",
        }}
      >
        {/* SmartTalk Logo circle */}
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: isDark ? "#111" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isDark
              ? "0 0 15px rgba(0,0,0,0.5)"
              : "0 0 10px rgba(0,0,0,0.1)",
            position: "relative",
          }}
        >
          {/* Spinner ring */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: "4px solid rgba(255,255,255,0.15)",
              borderTop: `4px solid ${isDark ? "#4dabff" : "#007bff"}`,
              animation: "spin 1.3s linear infinite",
            }}
          />
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 0.5,
              zIndex: 2,
              color: isDark ? "#4dabff" : "#007bff",
            }}
          >
            ST
          </span>
        </div>

        {/* SmartTalk text animation */}
        <h2
          style={{
            marginTop: 28,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: 0.6,
            animation: "fadeSlide 1.2s ease-in-out infinite alternate",
          }}
        >
          Loading SmartTalk…
        </h2>

        <p style={{ opacity: 0.7, fontSize: 14, marginTop: 6 }}>
          Checking authentication
        </p>

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            @keyframes fadeSlide {
              0% { opacity: 0.5; transform: translateY(4px); }
              100% { opacity: 1; transform: translateY(-2px); }
            }
          `}
        </style>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return children;
}