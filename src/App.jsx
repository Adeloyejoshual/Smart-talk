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
import VoiceCallPage from "./components/VoiceCallPage";
import VideoCallPage from "./components/VideoCallPage";
import SettingsPage from "./components/SettingsPage";
import EditProfilePage from "./components/EditProfilePage";
import CallHistoryPage from "./components/CallHistoryPage";
import WalletPage from "./components/WalletPage";
import TopUpPage from "./components/TopUpPage";
import WithdrawPage from "./components/WithdrawPage";
import UserProfile from "./components/UserProfile";

// Components
import ProtectedRoute from "./components/ProtectedRoute";

// Loading Screen Component
function LoadingScreen() {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: isDark ? "#000" : "#fafafa",
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
          background: isDark
            ? "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4, #2563eb)"
            : "linear-gradient(135deg, #f97316, #facc15, #22c55e, #3b82f6)",
          backgroundSize: "300% 300%",
          animation:
            "gradientShift 5s ease infinite, pulseGlow 2s ease-in-out infinite",
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
          LC
        </span>
      </div>

      <style>
        {`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes pulseGlow {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}
      </style>
    </div>
  );
}

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) setUserPresence(u.uid);

      setTimeout(() => setCheckingAuth(false), 800);
    });

    return () => unsubscribe();
  }, []);

  return (
    <ThemeProvider>
      {checkingAuth ? (
        <LoadingScreen />
      ) : (
        <WalletProvider>
          <PopupProvider>
            <Router>
              <Routes>
                {/* Public Route */}
                <Route
                  path="/"
                  element={user ? <ChatPage user={user} /> : <HomePage />}
                />

                {/* Protected Routes */}
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
      )}
    </ThemeProvider>
  );
}