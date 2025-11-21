import React, { useState, useEffect } from "react";
import axios from "axios";
import { auth } from "../firebaseConfig";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${process.env.REACT_APP_API}/wallet/${auth.currentUser.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance);
      setTransactions(res.data.transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleDailyCheckIn = async () => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${process.env.REACT_APP_API}/wallet/daily`,
        { amount: 2 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalance(res.data.balance);
      setTransactions([res.data.txn, ...transactions]);
    } catch (err) {
      alert(err.response?.data?.error || "Error claiming daily reward");
    }
  };

  return (
    <div style={{ padding: 20, background: "#f0f9ff", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>💰 My Wallet</h2>

      {/* Balance */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 20,
          padding: 20,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ fontSize: 14, color: "#555" }}>Balance</div>
        <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 8 }}>
          ${balance.toFixed(2)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20 }}>
        <button
          onClick={() => (window.location.href = "/topup")}
          style={{
            background: "#6ee7b7",
            borderRadius: 20,
            padding: "12px 24px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Top Up
        </button>
        <button
          onClick={() => (window.location.href = "/withdraw")}
          style={{
            background: "#f87171",
            borderRadius: 20,
            padding: "12px 24px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Withdraw
        </button>
      </div>

      {/* Daily Check-in */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          onClick={handleDailyCheckIn}
          style={{
            background: "#3b82f6",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 16,
            cursor: "pointer",
          }}
        >
          Daily Check-In (+$2)
        </button>
      </div>

      {/* Transaction History */}
      <div style={{ maxHeight: "50vh", overflowY: "auto", padding: "0 10px" }}>
        {transactions.map((t) => (
          <div
            key={t.txnId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 16px",
              marginBottom: 8,
              borderRadius: 12,
              background:
                t.status === "Success"
                  ? "#d1fae5"
                  : t.status === "Pending"
                  ? "#fef3c7"
                  : "#fee2e2",
            }}
          >
            <div>{t.type}</div>
            <div>{new Date(t.createdAt).toLocaleDateString()}</div>
            <div>${t.amount.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}