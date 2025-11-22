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

// ================= STYLES =================
const styles = {
  page: { background: "#eef6ff", minHeight: "100vh", padding: 25, color: "#000" },
  backBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    padding: "10px 14px",
    borderRadius: "50%",
    background: "#dce9ff",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
  },
  title: { marginTop: 20, textAlign: "center", fontSize: 26 },
  walletCard: {
    background: "#fff",
    padding: 20,
    borderRadius: 18,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    marginTop: 20,
    textAlign: "center",
  },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "10px 0" },
  actionRow: { display: "flex", justifyContent: "center", gap: 15, marginTop: 15 },
  roundBtn: {
    padding: "12px 20px",
    background: "#b3dcff",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
  },
  monthHeader: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    marginTop: 25,
    position: "sticky",
    top: 0,
    background: "#eef6ff",
    padding: "10px 0",
    zIndex: 5,
  },
  monthText: { fontSize: 18, fontWeight: "bold" },
  monthArrow: { border: "none", background: "#cfe3ff", padding: "5px 10px", borderRadius: 8, cursor: "pointer" },
  monthPicker: {
    background: "#fff",
    borderRadius: 14,
    padding: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    position: "absolute",
    top: 80,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 10,
  },
  monthItem: { padding: 10, borderRadius: 10, cursor: "pointer" },
  list: { marginTop: 10, maxHeight: "50vh", overflowY: "auto" },
  txRowCompact: {
    background: "#fff",
    padding: "10px 12px",
    borderRadius: 10,
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  },
  txLeftCompact: {},
  txTypeCompact: { fontSize: 14, fontWeight: 600 },
  txDateCompact: { fontSize: 12, opacity: 0.6 },
  txRightCompact: { textAlign: "right" },
  amount: { fontWeight: 600 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    background: "#fff",
    padding: 25,
    borderRadius: 18,
    width: "85%",
    maxWidth: 380,
    boxShadow: "0 5px 18px rgba(0,0,0,0.15)",
  },
  closeBtn: {
    marginTop: 15,
    padding: "10px 15px",
    background: "#3498db",
    borderRadius: 10,
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
};