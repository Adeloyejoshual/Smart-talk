
// src/components/WalletPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

export default function WalletPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const navigate = useNavigate();
  const backend = "https://smart-talk-dqit.onrender.com";

  // Load user and wallet
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
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
      if (res.ok) {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
        setDailyClaimed(data.dailyClaimed || false);
      } else {
        console.error("Wallet fetch error:", data);
        alert("Failed to load wallet. Check console.");
      }
    } catch (err) {
      console.error("Wallet fetch failed:", err);
      alert("Failed to load wallet. Check console.");
    }
  };

  const handleDailyReward = async () => {
    if (!user || dailyClaimed) return;
    setLoadingReward(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const amount = 0.25;
      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();

      if (res.ok && data.balance !== undefined) {
        setBalance(data.balance);
        setTransactions((prev) => [data.txn, ...prev]);
        setDailyClaimed(true);
        alert(`🎉 Daily reward claimed! +$${amount}`);
      } else if (data.error?.toLowerCase().includes("already claimed")) {
        setDailyClaimed(true);
        alert("✅ You already claimed today's reward!");
      } else {
        console.error("Daily reward error:", data);
        alert("Failed to claim daily reward. Check console.");
      }
    } catch (err) {
      console.error("Daily reward failed:", err);
      alert("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: "#eef6ff" }}>
      <button onClick={() => navigate("/settings")}>← Back</button>
      <h2>Wallet</h2>
      <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
        <p>Balance</p>
        <h1>${balance.toFixed(2)}</h1>
        <button onClick={handleDailyReward} disabled={loadingReward || dailyClaimed}>
          {loadingReward
            ? "Processing..."
            : dailyClaimed
            ? "✅ Daily Reward Claimed"
            : "🧩 Daily Reward (+$0.25)"}
        </button>
      </div>

      <h3>Recent Transactions</h3>
      {transactions.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        transactions.map((tx) => (
          <div key={tx.txnId || tx._id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>{tx.type}</span>
            <span style={{ color: tx.amount >= 0 ? "green" : "red" }}>
              {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}