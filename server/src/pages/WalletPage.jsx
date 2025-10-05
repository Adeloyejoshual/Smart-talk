// /src/pages/WalletPage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const WalletPage = ({ userId }) => {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await axios.get(`/api/wallet/${userId}`);
        setBalance(res.data.balance);
      } catch (err) {
        console.error("Error loading wallet:", err);
      }
    };
    fetchWallet();
  }, [userId]);

  const handleAddCredit = async () => {
    const amount = prompt("Enter amount to add:");
    if (!amount) return;

    try {
      const res = await axios.post("/api/wallet/add", {
        userId,
        amount: Number(amount),
        currency: "NGN" // example: local currency
      });
      alert(res.data.message);
      setBalance(res.data.balance);
    } catch (err) {
      console.error("Add credit failed:", err);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "40px" }}>
      <h2>Wallet</h2>
      <p style={{ fontSize: "18px" }}>Balance: ${balance.toFixed(2)} USD</p>
      <button onClick={handleAddCredit}>Add Credit</button>
    </div>
  );
};

export default WalletPage;