// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { auth, db } from "./firebaseConfig";
import { doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

// ✅ Main pages
import HomePage from "./components/HomePage"; // login/register
import ChatPage from "./components/ChatPage";
import ChatConversationPage from "./components/ChatConversationPage";
import CallPage from "./components/CallPage";
import SettingsPage from "./components/SettingsPage";
import CallHistoryPage from "./components/CallHistoryPage";
import WithdrawalPage from "./components/WithdrawalPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  useEffect(() => {
    // Watch auth user
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);

        // Mark user online
        const setOnline = async () => {
          await updateDoc(userRef, {
            isOnline: true,
            lastSeen: serverTimestamp(),
          });
        };

        // Mark user offline
        const setOffline = async () => {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp(),
          });
        };

        // When connected
        await setOnline();

        // Detect app close or tab refresh
        window.addEventListener("beforeunload", setOffline);

        // Keep connection alive every 30 seconds
        const interval = setInterval(setOnline, 30000);

        // Clean up when user logs out or component unmounts
        return () => {
          setOffline();
          clearInterval(interval);
          window.removeEventListener("beforeunload", setOffline);
        };
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Default route — login/register */}
          <Route path="/" element={<HomePage />} />

          {/* Protected routes */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          {/* 🆕 Single chat view */}
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

          {/* 🆕 Withdrawal page */}
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