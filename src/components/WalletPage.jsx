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
  const scrollRef = useRef();
  
  const backend = "https://smart-talk-dqit.onrender.com";

  // AUTH & load wallet
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
      setBalance(data.balance || 0);
      setTransactions(data.transactions || []);

      // Check if daily reward already claimed
      const today = new Date().toISOString().split("T")[0];
      if (data.transactions.some(t => t.type === "checkin" && (new Date(t.createdAt).toISOString().split("T")[0] === today))) {
        setDailyClaimed(true);
      }
    } catch (err) {
      console.error("Failed to load wallet:", err);
    }
  };

  // CLAIM DAILY REWARD
  const handleDailyReward = async () => {
    if (!user || dailyClaimed) return;
    setLoadingReward(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const rewardAmount = 0.25;

      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: rewardAmount }),
      });

      const data = await res.json();

      if (data.balance !== undefined) {
        setBalance(data.balance);
        setTransactions(prev => [data.txn, ...prev]);
        setDailyClaimed(true);
        alert(`🎉 Daily reward $${rewardAmount} claimed!`);
      } else if (data.error && data.error.toLowerCase().includes("already claimed")) {
        setDailyClaimed(true);
        alert("✅ You already claimed today's reward!");
      } else {
        alert(data.error || "Failed to claim daily reward.");
      }

    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward.");
    } finally {
      setLoadingReward(false);
    }
  };

  return (
    <div style={{ padding: 25 }}>
      <button onClick={() => navigate("/settings")}>← Back</button>
      <h2>Wallet</h2>

      <div style={{ marginTop: 20, padding: 20, background: "#fff", borderRadius: 12 }}>
        <p>Balance</p>
        <h1>${balance.toFixed(2)}</h1>

        <button onClick={() => navigate("/topup")}>Top-Up</button>
        <button onClick={() => navigate("/withdraw")}>Withdraw</button>
        <button onClick={handleDailyReward} disabled={dailyClaimed || loadingReward}>
          {dailyClaimed ? "✅ Daily Reward Claimed" : "Daily Reward"}
        </button>
      </div>

      <h3 style={{ marginTop: 25 }}>Recent Transactions</h3>
      <div ref={scrollRef} style={{ maxHeight: 300, overflowY: "auto" }}>
        {transactions.length === 0 ? <p>No transactions yet.</p> :
          transactions.map(tx => (
            <div key={tx._id || tx.txnId} style={{ display: "flex", justifyContent: "space-between", padding: 8, borderBottom: "1px solid #ddd" }}>
              <span>{tx.type}</span>
              <span style={{ color: tx.amount >= 0 ? "green" : "red" }}>
                {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  );
}