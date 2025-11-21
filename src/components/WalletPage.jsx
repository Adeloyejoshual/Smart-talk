// src/components/WalletPage.jsx
import React, { useState, useEffect } from "react";
import { auth } from "../firebaseConfig";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { handleStripePayment, handleFlutterwavePayment } from "../payments";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const user = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Load wallet history from server
    const loadTransactions = async () => {
      try {
        const res = await axios.get(`/api/wallet/${user.uid}`);
        setTransactions(res.data);

        // Check if daily check-in exists today
        const todayStr = new Date().toISOString().split("T")[0];
        const dailyCheckin = res.data.find(
          (tx) =>
            tx.description === "Daily Check-In" &&
            new Date(tx.createdAt).toISOString().split("T")[0] === todayStr
        );
        setCheckedInToday(!!dailyCheckin);

        // Compute balance from transactions
        const bal = res.data.reduce((sum, tx) => {
          return tx.type === "credit" ? sum + tx.amount : sum - tx.amount;
        }, 0);
        setBalance(bal);
      } catch (err) {
        console.error(err);
      }
    };

    loadTransactions();
  }, [user]);

  // Handle top-up
  const handleTopUp = async (method) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    const topUpAmount = parseFloat(amount);

    if (method === "stripe") {
      await handleStripePayment(topUpAmount, user.uid);
    } else if (method === "flutterwave") {
      handleFlutterwavePayment(topUpAmount, user.uid);
    }

    setAmount("");
  };

  // Handle Daily Check-In
  const handleDailyCheckin = async () => {
    if (!user) return;
    if (checkedInToday) return alert("✅ Already checked in today!");

    try {
      const res = await axios.post("/api/wallet/daily", {
        uid: user.uid,
        amount: 0.25,
      });
      if (res.data.success) {
        setTransactions((prev) => [res.data.txn, ...prev]);
        setBalance((prev) => prev + 0.25);
        setCheckedInToday(true);
        alert("🎉 You earned +$0.25 for your daily check-in!");
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to claim daily check-in.");
    }
  };

  const getInitials = (name) => {
    if (!name) return "NA";
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 text-white p-6 relative"
    >
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 text-white font-bold text-2xl"
      >
        ⬅
      </button>

      {/* Wallet card */}
      <motion.div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6 w-full max-w-md mb-6">
        <p className="text-center text-lg mb-2">
          Current Balance:{" "}
          <span className="font-semibold text-green-400">
            ${balance.toFixed(2)}
          </span>
        </p>

        {/* Daily Check-In */}
        <button
          onClick={handleDailyCheckin}
          disabled={checkedInToday}
          className={`w-full py-3 rounded-lg font-semibold mb-4 ${
            checkedInToday
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-yellow-500 hover:bg-yellow-600 text-black"
          }`}
        >
          {checkedInToday ? "✅ Checked In Today" : "🧩 Daily Check-in (+$0.25)"}
        </button>

        {/* Amount Input */}
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount to add"
          className="w-full p-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
        />

        {/* Payment Buttons */}
        <div className="flex gap-4 justify-between mb-4">
          <button
            onClick={() => handleTopUp("stripe")}
            className="flex-1 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 transition font-semibold"
          >
            💳 Stripe
          </button>
          <button
            onClick={() => handleTopUp("flutterwave")}
            className="flex-1 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 transition font-semibold text-black"
          >
            🌍 Flutterwave
          </button>
        </div>
      </motion.div>

      {/* Transactions */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-xl font-semibold mb-3">📜 Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-300 text-center">No transactions yet.</p>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {transactions.map((tx) => (
              <div
                key={tx._id || tx.id}
                className="bg-white/10 p-3 rounded-lg flex justify-between items-center text-sm"
              >
                <span>
                  {tx.description || (tx.type === "credit" ? "Credit" : "Debit")}
                </span>
                <span
                  className={tx.amount > 0 ? "text-green-400" : "text-red-400"}
                >
                  {tx.amount > 0 ? "+" : ""}
                  ${tx.amount.toFixed(2)}
                </span>
                <span className="text-gray-300 text-xs">
                  {new Date(tx.createdAt || tx.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}