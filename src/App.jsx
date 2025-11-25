// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";
import { PopupProvider } from "./context/PopupContext";
import { auth, setUserPresence } from "./firebaseConfig";

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
import LoadingScreen from "./components/LoadingScreen"; // New reusable component

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);

      if (u) {
        const cleanupPresence = setUserPresence(u.uid);
        return () => cleanupPresence && cleanupPresence();
      }

      setTimeout(() => setCheckingAuth(false), 800);
    });

    return () => unsubscribe();
  }, []);

  if (checkingAuth) return <LoadingScreen />; // Use the same loading screen as ProtectedRoute

  return (
    <ThemeProvider>
      <WalletProvider>
        <PopupProvider>
          <Router>
            <Routes>
              {/* Public Route */}
              <Route path="/" element={user ? <ChatPage user={user} /> : <HomePage />} />

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
    </ThemeProvider>
  );
}