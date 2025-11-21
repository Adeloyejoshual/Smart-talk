// src/context/WalletContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebaseConfig";
import axios from "axios";

const WalletContext = createContext();
export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }) {
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const backend = "https://smart-talk-dqit.onrender.com";

  // Load balance from backend
  const loadBalance = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken(true);
      const uid = user.uid;

      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setBalance(res.data.balance || 0);
    } catch (err) {
      console.error("Balance load error:", err);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Add Task Reward
  const addCredits = async (amount) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken(true);

      await axios.post(
        `${backend}/api/wallet/daily`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadBalance();
    } catch (err) {
      console.error("Add credits error:", err);
      alert("Failed to update balance. Try again.");
    }
  };

  // Auto-load on login
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) loadBalance();
    });
    return unsub;
  }, []);

  return (
    <WalletContext.Provider value={{ balance, loadBalance, addCredits, loadingBalance }}>
      {children}
    </WalletContext.Provider>
  );
}