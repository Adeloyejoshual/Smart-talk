// src/components/SettingsPage.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../firebaseConfig";

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const backend = "https://smart-talk-dqit.onrender.com";

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async u => {
      if (!u) return;
      setUser(u);
      await loadWallet(u.uid);
    });
    return unsub;
  }, []);

  const loadWallet = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBalance(data.balance || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: 25 }}>
      <h2>Settings</h2>
      <p>Balance: ${balance.toFixed(2)}</p>
      <h3>Recent Transactions</h3>
      {transactions.map(tx => (
        <div key={tx._id || tx.txnId}>
          <span>{tx.type}</span> - <span>${tx.amount.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}