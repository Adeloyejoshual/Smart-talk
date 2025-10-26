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
        setTimeout(() => setChecking(false), 800); // Wait for fade animation
      }, 800); // Small buffer for smoother UX
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
            ? "#050505"
            : "#fafafa",
          color: isDark ? "#fff" : "#000",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          opacity: fadeOut ? 0 : 1,
          transition: "opacity 0.8s ease",
        }}
      >
        {/* Neon Gradient Circle */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background:
              "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4, #2563eb)",
            backgroundSize: "300% 300%",
            animation:
              "gradientShift 5s ease infinite, pulseGlow 2.2s ease-in-out infinite",
            boxShadow: "0 0 40px 6px rgba(37,99,235,0.45)",
          }}
        >
          {/* Spinner border */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: "4px solid rgba(255,255,255,0.2)",
              borderTop: "4px solid rgba(255,255,255,0.8)",
              animation: "spin 1.4s linear infinite",
            }}
          />
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              zIndex: 2,
              textShadow: "0 0 12px rgba(255,255,255,0.9)",
              letterSpacing: 1.5,
            }}
          >
            ST
          </span>
        </div>

        {/* SmartTalk Text */}
        <h2
          style={{
            marginTop: 30,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: 0.6,
            animation:
              "fadeSlide 1.2s ease-in-out infinite alternate, gradientShift 5s ease infinite",
            background:
              "linear-gradient(90deg, #60a5fa, #8b5cf6, #06b6d4, #2563eb)",
            backgroundSize: "300% 300%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Loading SmartTalk…
        </h2>

        <p
          style={{
            opacity: 0.75,
            fontSize: 14,
            marginTop: 6,
            letterSpacing: 0.3,
          }}
        >
          Checking authentication
        </p>

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
            @keyframes fadeSlide {
              0% { opacity: 0.5; transform: translateY(4px); }
              100% { opacity: 1; transform: translateY(-2px); }
            }
            @keyframes pulseGlow {
              0%, 100% { box-shadow: 0 0 30px 5px rgba(37,99,235,0.35); transform: scale(1); }
              50% { box-shadow: 0 0 55px 8px rgba(139,92,246,0.6); transform: scale(1.05); }
            }
          `}
        </style>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return children;
}