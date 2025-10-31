// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { auth, db } from "./firebaseConfig";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import HomePage from "./components/HomePage";
import ChatPage from "./components/ChatPage";
import ChatConversationPage from "./components/ChatConversationPage";
import CallPage from "./components/CallPage";
import SettingsPage from "./components/SettingsPage";
import CallHistoryPage from "./components/CallHistoryPage";
import WithdrawalPage from "./components/WithdrawalPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      setTimeout(() => setCheckingAuth(false), 800);

      if (u) {
        const userRef = doc(db, "users", u.uid);

        const setOnline = async () =>
          await updateDoc(userRef, {
            isOnline: true,
            lastSeen: serverTimestamp(),
          });

        const setOffline = async () =>
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp(),
          });

        await setOnline();

        window.addEventListener("beforeunload", setOffline);
        const interval = setInterval(setOnline, 30000);

        return () => {
          setOffline();
          clearInterval(interval);
          window.removeEventListener("beforeunload", setOffline);
        };
      }
    });

    return () => unsubscribe();
  }, []);

  // 🟢 Step 1: Show SmartTalk splash while checking auth
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
          gap: "10px",
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

  // 🟢 Step 2: Go straight to chat if logged in, else to login
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
        </Routes>
      </Router>
    </ThemeProvider>
  );
}