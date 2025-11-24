// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";
import { auth, setUserPresence } from "./firebaseConfig";

// Global Popup
import { PopupProvider } from "./context/PopupContext";

// Pages
import HomePage from "./components/HomePage";
import ChatPage from "./components/ChatPage";
import ChatConversationPage from "./components/ChatConversationPage";
import CallPage from "./components/CallPage";
import SettingsPage from "./components/SettingsPage";
import CallHistoryPage from "./components/CallHistoryPage";
import WithdrawPage from "./components/WithdrawPage";
import TopUpPage from "./components/TopUpPage";
import UserProfile from "./components/UserProfile";
import VoiceCallPage from "./components/VoiceCallPage";
import VideoCallPage from "./components/VideoCallPage";
import EditProfilePage from "./components/EditProfilePage";
import WalletPage from "./components/WalletPage";

// Components
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setTimeout(() => setCheckingAuth(false), 800);

      if (u) {
        const cleanupPresence = setUserPresence(u.uid);
        return () => cleanupPresence && cleanupPresence();
      }
    });

    return () => unsubscribe();
  }, []);

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

  return (
    <ThemeProvider>
      <WalletProvider>
        <PopupProvider>
          <Router>
            <Routes>
              {/* Public Route */}
              <Route
                path="/"
                element={user ? <ChatPage user={user} /> : <HomePage />}
              />

              {/* Protected Pages */}
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat/:chatId"
                element={
                  <ProtectedRoute>
                    <ChatConversationPage user={user} />
                  </ProtectedRoute>
                }
              />

              {/* Calls */}
              <Route
                path="/voicecall/:uid"
                element={
                  <ProtectedRoute>
                    <VoiceCallPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/videocall/:uid"
                element={
                  <ProtectedRoute>
                    <VideoCallPage user={user} />
                  </ProtectedRoute>
                }
              />

              {/* Settings / Profile / Wallet */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/edit-profile"
                element={
                  <ProtectedRoute>
                    <EditProfilePage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <CallHistoryPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wallet"
                element={
                  <ProtectedRoute>
                    <WalletPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/topup"
                element={
                  <ProtectedRoute>
                    <TopUpPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/withdraw"
                element={
                  <ProtectedRoute>
                    <WithdrawPage user={user} />
                  </ProtectedRoute>
                }
              />

              {/* User Profile */}
              <Route
                path="/profile/:uid"
                element={
                  <ProtectedRoute>
                    <UserProfile currentUser={user} />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </PopupProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}