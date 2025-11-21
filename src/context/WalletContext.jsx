// src/context/WalletContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebaseConfig";
import axios from "axios";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const backend = "https://smart-talk-dqit.onrender.com";

  const loadWallet = async (uid) => {
    if (!uid) return;
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance || 0);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error("Wallet load error:", err);
    }
  };

  const addTransaction = (txn) => {
    setTransactions((prev) => [txn, ...prev]);
    setBalance(txn.balanceAfter || balance + txn.amount);
  };

  return (
    <WalletContext.Provider
      value={{ balance, transactions, loadWallet, addTransaction }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);