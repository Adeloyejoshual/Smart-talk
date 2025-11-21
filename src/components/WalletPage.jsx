import React, { useState, useEffect } from "react";
import { auth } from "../firebaseConfig";
import { handleStripePayment, handleFlutterwavePayment } from "../payments";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [transactions, setTransactions] = useState([]);
  const user = auth.currentUser;
  const navigate = useNavigate();

  const fetchWallet = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/wallet/${user.uid}`);
      const data = await res.json();
      setBalance(data.balance || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [user]);

  const handleTopUp = async (method) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const topUpAmount = parseFloat(amount);

    try {
      if (method === "stripe") {
        await handleStripePayment(topUpAmount, user.uid);
      } else if (method === "flutterwave") {
        await handleFlutterwavePayment(topUpAmount, user.uid);
      }

      await fetchWallet();
      setAmount("");
    } catch (err) {
      console.error(err);
      alert("Payment failed. Try again.");
    }
  };

  return (
    <motion.div className="min-h-screen p-6 bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 text-white">
      <button onClick={() => navigate(-1)} className="text-white font-bold text-2xl mb-4">⬅ Back</button>

      <div className="bg-white/10 p-6 rounded-2xl mb-6">
        <p className="text-center mb-2">Current Balance: <span className="text-green-400 font-semibold">${balance.toFixed(2)}</span></p>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className="w-full p-3 rounded-lg mb-4 text-black"
        />

        <div className="flex gap-4">
          <button className="flex-1 py-3 bg-blue-500 rounded-lg" onClick={() => handleTopUp("stripe")}>💳 Stripe</button>
          <button className="flex-1 py-3 bg-yellow-500 rounded-lg text-black" onClick={() => handleTopUp("flutterwave")}>🌍 Flutterwave</button>
        </div>
      </div>

      <div className="bg-white/10 p-6 rounded-2xl">
        <h3 className="text-xl mb-3">📜 Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-300 text-center">No transactions yet.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {transactions.map(tx => (
              <div key={tx._id || tx.id} className="flex justify-between bg-white/10 p-2 rounded-lg text-sm">
                <span>{tx.description || tx.type}</span>
                <span className={tx.amount > 0 ? "text-green-400" : "text-red-400"}>{tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)}</span>
                <span className="text-gray-300 text-xs">{new Date(tx.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}