// src/App.jsx
import React, { useEffect, useState, useContext } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, ThemeContext } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";
import { auth, setUserPresence } from "./firebaseConfig";
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
  const [fadeOut, setFadeOut] = useState(false);

  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) setUserPresence(u.uid);

      // Fade out splash
      setTimeout(() => setFadeOut(true), 500);
      setTimeout(() => setCheckingAuth(false), 1300);
    });

    return () => unsubscribe();
  }, []);

  if (checkingAuth) {
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
        {/* LoeChat Logo Circle */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: "linear-gradient(135deg, #1E6FFB, #0047B3)",
            backgroundSize: "300% 300%",
            animation:
              "gradientShift 5s ease infinite, pulseGlow 2.2s ease-in-out infinite",
            boxShadow: "0 0 40px 6px rgba(30,111,251,0.45)",
          }}
        >
          {/* Spinner */}
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

          {/* Logo */}
          <img
            src={require("./assets/loechat-logo.png")}
            alt="LoeChat Logo"
            style={{
              width: 70,
              height: 70,
              objectFit: "contain",
              zIndex: 2,
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

  return (
    <ThemeProvider>
      <WalletProvider>
        <PopupProvider>
          <Router>
            <Routes>
              <Route
                path="/"
                element={user ? <ChatPage user={user} /> : <HomePage />}
              />

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