// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import ChatPage from "./components/ChatPage";
import CallPage from "./components/CallPage";
import SettingsPage from "./components/SettingsPage";
import IncomingCallListener from "./components/IncomingCallListener";

export default function App() {
  return (
    <Router>
      <IncomingCallListener />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat/:userId" element={<ChatPage />} />
        <Route path="/call/:receiverId" element={<CallPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Router>
  );
}