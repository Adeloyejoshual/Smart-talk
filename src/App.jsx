// App Name: Loechat
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";
import { UserProvider } from "./context/UserContext"; // <-- Added
import { auth, setUserPresence, db } from "./firebaseConfig";
import { doc, updateDoc, increment } from "firebase/firestore";

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
import AdGateway, { useAd } from "./components/AdGateway";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  // ----------------------------
  // Firebase Auth + Presence
  // ----------------------------
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

  // ----------------------------
  // Reward Coins Helper
  // ----------------------------
  const rewardCoins = async (uid, amount) => {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      coins: increment(amount),
    });
  };

  // ----------------------------
  // Loading Screen
  // ----------------------------
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
            LC
          </span>
        </div>
        <p style={{ marginTop: 16, fontSize: 15, opacity: 0.8 }}>
          loechat is starting…
        </p>
      </div>
    );
  }

  // ----------------------------
  // App Routes
  // ----------------------------
  return (
    <ThemeProvider>
      <WalletProvider>
        <UserProvider> {/* <-- Wrap with UserProvider */}
          <PopupProvider>
            <AdGateway>
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
                    path="/wallet"
                    element={
                      <ProtectedRoute>
                        <WalletPage
                          user={user}
                          rewardCoins={rewardCoins}
                        />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/daily-bonus"
                    element={
                      <ProtectedRoute>
                        <HomePage
                          user={user}
                          rewardCoins={rewardCoins}
                        />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/withdraw"
                    element={
                      <ProtectedRoute>
                        <WithdrawPage
                          user={user}
                          rewardCoins={rewardCoins}
                        />
                      </ProtectedRoute>
                    }
                  />

                  {/* Other Pages */}
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
                    path="/topup"
                    element={
                      <ProtectedRoute>
                        <TopUpPage user={user} />
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
            </AdGateway>
          </PopupProvider>
        </UserProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}