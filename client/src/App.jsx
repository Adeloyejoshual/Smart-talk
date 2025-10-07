import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import WalletPage from "./pages/WalletPage";
import AdminPanel from "./pages/AdminPanel";
import VoiceCall from "./pages/VoiceCall";
import VideoCall from "./pages/VideoCall";
import { auth } from "./firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { ThemeProvider } from "./context/ThemeContext";

export default function App() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/chat/:id" element={user ? <ChatPage /> : <Navigate to="/login" />} />
        <Route path="/wallet" element={user ? <WalletPage /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user ? <AdminPanel /> : <Navigate to="/login" />} />
        <Route path="/call/voice" element={user ? <VoiceCall /> : <Navigate to="/login" />} />
        <Route path="/call/video" element={user ? <VideoCall /> : <Navigate to="/login" />} />
      </Routes>
    </ThemeProvider>
  );
}