// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { auth, setUserPresence } from "./firebaseConfig";

import HomePage from "./components/HomePage";
import ChatPage from "./components/ChatPage";
import ChatConversationPage from "./components/ChatConversationPage";
import CallPage from "./components/CallPage";
import SettingsPage from "./components/SettingsPage";
import CallHistoryPage from "./components/CallHistoryPage";
import WithdrawalPage from "./components/WithdrawalPage";
import ProtectedRoute from "./components/ProtectedRoute";

// 🟣 Added PhotoUpload
import PhotoUpload from "./components/PhotoUpload";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setTimeout(() => setCheckingAuth(false), 800);

      if (u) {
        // Automatically handle online/offline + lastSeen
        const cleanupPresence = setUserPresence(u.uid);
        return () => cleanupPresence && cleanupPresence();
      }
    });

    return () => unsubscribe();
  }, []);

  /* -----------------------------
     🟢 Splash Screen while loading
  ------------------------------ */
  if (checkingAuth) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#000",
          flexDirection: "column",
          color: "#fff",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4, #2563eb)",
            animation:
              "gradientShift 5s ease infinite, pulseGlow 2s ease-in-out infinite",
            backgroundSize: "300% 300%",
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: "bold",
              color: "#fff",
              textShadow: "0 0 12px rgba(255,255,255,0.8)",
            }}
          >
            ST
          </span>
        </div>
        <p style={{ marginTop: 16, fontSize: 15, opacity: 0.8 }}>
          SmartTalk is starting…
        </p>
        <style>
          {`
            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes pulseGlow {
              0%, 100% { transform: scale(1); filter: brightness(1); }
              50% { transform: scale(1.05); filter: brightness(1.3); }
            }
          `}
        </style>
      </div>
    );
  }

  /* -----------------------------
     🟢 Routes
  ------------------------------ */
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={user ? <ChatPage /> : <HomePage />} />

          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:chatId"
            element={
              <ProtectedRoute>
                <ChatConversationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/call"
            element={
              <ProtectedRoute>
                <CallPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <CallHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/withdrawal"
            element={
              <ProtectedRoute>
                <WithdrawalPage />
              </ProtectedRoute>
            }
          />

          {/* 🟣 New route for Photo Upload */}
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <PhotoUpload />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}