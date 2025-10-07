import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster, toast } from "react-hot-toast";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import WalletPage from "./pages/WalletPage";
import AdminPanel from "./pages/AdminPanel";
import VoiceCall from "./pages/VoiceCall";
import VideoCall from "./pages/VideoCall";

export default function App() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const walletRef = doc(db, "wallets", u.uid);
        const snap = await getDoc(walletRef);
        if (!snap.exists()) {
          await setDoc(walletRef, { balance: 5.0, createdAt: Date.now() });
          toast.success("🎁 You’ve received a $5 wallet bonus!");
        }
      }
    });
    return unsubscribe;
  }, []);

  // Simple private route check returns element or redirect
  const PrivateRoute = ({ element }) => (user ? element : <Navigate to="/login" />);

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute element={<Home />} />} />
        <Route path="/chat/:id" element={<PrivateRoute element={<ChatPage />} />} />
        <Route path="/wallet" element={<PrivateRoute element={<WalletPage />} />} />
        <Route path="/admin" element={<PrivateRoute element={<AdminPanel />} />} />
        <Route path="/call/voice" element={<PrivateRoute element={<VoiceCall />} />} />
        <Route path="/call/video" element={<PrivateRoute element={<VideoCall />} />} />
      </Routes>
      <Toaster position="top-center" reverseOrder={false} />
    </ThemeProvider>
  );
}