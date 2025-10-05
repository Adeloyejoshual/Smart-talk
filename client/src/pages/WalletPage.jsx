import React, { useState, useEffect } from "react";
import axios from "axios";
import { auth } from "../firebaseClient";

export default function WalletPage() {
  const [wallet, setWallet] = useState({ balance: 0 });
  const [amount, setAmount] = useState(5);
  const [method, setMethod] = useState("stripe");
  const API = import.meta.env.VITE_API_URL || "/api";

  // 🪙 Load user wallet balance
  useEffect(() => {
    async function loadWallet() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const res = await axios.get(`${API}/wallet/${uid}`);
        setWallet(res.data.wallet || { balance: 0 });
      } catch (err) {
        console.error("Error loading wallet:", err);
      }
    }
    loadWallet();
  }, []);

  // 💳 Handle add credit
  const addCredit = async () => {
    try {
      if (!auth.currentUser) return alert("Please log in first");
      const uid = auth.currentUser.uid;
      const res = await axios.post(`${API}/payment/session`, {
        amount,
        uid,
        method,
      });
      window.location.href = res.data.url; // redirect to payment page
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // 🏦 Withdraw (coming soon)
  const withdraw = () => {
    alert("Withdraw coming soon 🚀");
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: 16 }}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>Wallet</h2>

      <div
        style={{
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: "bold" }}>
            ${(wallet.balance || 0).toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: "#666" }}>
            Bonus credits expire in 3 months
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <input
            type="number"
            value={amount}
            min="1"
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: 8,
              width: 100,
            }}
          />

          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: 8,
            }}
          >
            <option value="stripe">Stripe (USD)</option>
            <option value="paystack">Paystack (Local)</option>
            <option value="flutterwave">Flutterwave (Local)</option>
          </select>

          <button
            onClick={addCredit}
            style={{
              padding: "8px 16px",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Add Credit
          </button>
        </div>

        <hr />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={withdraw}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}