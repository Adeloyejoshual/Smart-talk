// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";

// ✅ Main pages
import HomePage from "./components/HomePage"; // login/register
import ChatPage from "./components/ChatPage";
import ChatConversationPage from "./components/ChatConversationPage"; // 🆕 Single chat
import CallPage from "./components/CallPage";
import SettingsPage from "./components/SettingsPage";
import CallHistoryPage from "./components/CallHistoryPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
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
        </Routes>
      </Router>
    </ThemeProvider>
  );
}