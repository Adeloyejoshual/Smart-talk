// src/context/WalletContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { auth } from "../firebaseConfig";
import axios from "axios";

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const backend = "https://smart-talk-dqit.onrender.com";

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        loadWallet(u.uid);
      } else {
        setUser(null);
        setBalance(0);
        setTransactions([]);
      }
    });
    return unsub;
  }, []);

  const loadWallet = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance || 0);
      setTransactions(
        (res.data.transactions || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      );
    } catch (err) {
      console.error("Failed to load wallet:", err);
    }
  };

  const claimDailyReward = async () => {
    if (!user) return null;
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalance(res.data.balance || balance);
      setTransactions(
        (res.data.transactions || transactions).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      );
      return res.data.balance;
    } catch (err) {
      console.error("Failed to claim daily reward:", err);
      return null;
    }
  };

  return (
    <WalletContext.Provider
      value={{ user, balance, transactions, loadWallet, claimDailyReward }}
    >
      {children}
    </WalletContext.Provider>
  );
};