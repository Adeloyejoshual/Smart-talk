// src/components/WalletPage.jsx
import React, { useState, useEffect } from "react";
import { auth } from "../firebaseConfig";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const user = auth.currentUser;
  const navigate = useNavigate();

  // 🔹 Fetch Wallet History
  const fetchWallet = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`/api/wallet/${user.uid}`);
      const history = res.data || [];
      setTransactions(history);

      // Calculate balance
      const bal = history.reduce((sum, tx) => sum + tx.amount, 0);
      setBalance(bal);

      // Check if daily check-in was claimed today
      const today = new Date().toISOString().split("T")[0];
      const dailyTx = history.find(
        (tx) =>
          tx.description === "Daily Check-In" &&
          new Date(tx.createdAt).toISOString().split("T")[0] === today
      );
      setCheckedInToday(!!dailyTx);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [user]);

  // 🔹 Handle top-up
  const handleTopUp = async () => {
    if (!amount || isNaN(amount) || amount <= 0) return alert("Enter a valid amount");
    try {
      await axios.post("/api/wallet", {
        uid: user.uid,
        type: "credit",
        amount: parseFloat(amount),
        description: "Manual Top-Up",
      });
      setAmount("");
      fetchWallet();
    } catch (err) {
      console.error(err);
      alert("❌ Top-up failed");
    }
  };

  // 🔹 Handle Daily Check-in
  const handleDailyCheckin = async () => {
    if (!user) return;
    if (checkedInToday) return alert("✅ Already checked in today!");

    try {
      const reward = 0.25; // Daily reward
      await axios.post("/api/wallet/daily", { uid: user.uid, amount: reward });
      alert(`🎉 Daily Check-in! +$${reward}`);
      fetchWallet(); // Refresh transactions & balance
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Daily check-in failed");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 text-white p-6 flex flex-col items-center"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 text-white font-bold text-2xl"
      >
        ⬅
      </button>

      {/* Wallet Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 w-full max-w-md mb-6"
      >
        <h2 className="text-xl font-semibold mb-3 text-center">💼 Wallet Balance</h2>
        <p className="text-center text-3xl font-bold text-green-400 mb-4">${balance.toFixed(2)}</p>

        {/* Top-up Input */}
        <div className="flex gap-4 mb-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="flex-1 p-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleTopUp}
            className="py-3 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 transition font-semibold"
          >
            💳 Top-Up
          </button>
        </div>

        {/* Daily Check-in Button */}
        <button
          onClick={handleDailyCheckin}
          disabled={checkedInToday}
          className={`w-full py-3 rounded-lg font-semibold transition ${
            checkedInToday
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>
      </motion.div>

      {/* Transactions */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-xl font-semibold mb-4">📜 Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-300 text-center">No transactions yet.</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {transactions.map((tx) => (
              <motion.div
                key={tx._id || tx.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/20 p-3 rounded-lg flex justify-between items-center"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{tx.description}</span>
                  <span className="text-gray-300 text-xs">
                    {new Date(tx.createdAt).toLocaleString()}
                  </span>
                </div>
                <span
                  className={
                    tx.amount > 0
                      ? "text-green-400 font-semibold"
                      : "text-red-400 font-semibold"
                  }
                >
                  {tx.amount > 0 ? "+" : ""}
                  ${tx.amount.toFixed(2)}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}