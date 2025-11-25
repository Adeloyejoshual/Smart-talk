// src/components/ProtectedRoute.jsx
import React, { useEffect, useState, useContext } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setTimeout(() => {
        setUser(currentUser);
        setFadeOut(true);
        setTimeout(() => setChecking(false), 800);
      }, 800);
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
          alignItems: "center",
          justifyContent: "center",
          background: wallpaper
            ? `url(${wallpaper}) center/cover no-repeat`
            : isDark
            ? "#050505"
            : "#fafafa",
          opacity: fadeOut ? 0 : 1,
          transition: "opacity 0.8s ease",
          pointerEvents: fadeOut ? "none" : "auto",
        }}
      >
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: isDark
              ? "linear-gradient(135deg, #1E6FFB, #0047B3)"
              : "linear-gradient(135deg, #6BA8FF, #A3C7FF)",
            backgroundSize: "300% 300%",
            animation:
              "gradientShift 5s ease infinite, pulseGlow 2.2s ease-in-out infinite",
            boxShadow: isDark
              ? "0 0 40px 6px rgba(30,111,251,0.45)"
              : "0 0 35px 5px rgba(107,168,255,0.5)",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: "4px solid rgba(255,255,255,0.2)",
              borderTop: "4px solid rgba(255,255,255,0.9)",
              animation: "spin 1.4s linear infinite",
            }}
          />

          <img
            src={require("../assets/loechat-logo.png")}
            alt="LoeChat Logo"
            style={{
              width: 60,
              height: 60,
              objectFit: "contain",
              zIndex: 2,
              filter: isDark
                ? "drop-shadow(0 0 8px rgba(255,255,255,0.6))"
                : "brightness(0) saturate(100%) invert(0.1) drop-shadow(0 0 4px rgba(0,0,0,0.4))",
            }}
          />
        </div>

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes pulseGlow {
              0%, 100% { box-shadow: 0 0 30px 5px rgba(30,111,251,0.35); transform: scale(1); }
              50% { box-shadow: 0 0 55px 8px rgba(30,111,251,0.6); transform: scale(1.05); }
            }
          `}
        </style>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return children;
}