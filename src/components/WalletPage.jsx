// src/components/WalletPage.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../firebaseConfig";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(false);

  const user = auth.currentUser;
  const navigate = useNavigate();

  // Load wallet data
  useEffect(() => {
    if (!user) return;
    const fetchWallet = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/wallet/${user.uid}`);
        const data = res.data;
        let totalBalance = 0;
        data.forEach((tx) => {
          totalBalance += tx.type === "credit" ? tx.amount : -tx.amount;
        });
        setBalance(totalBalance);
        setTransactions(data);
      } catch (err) {
        console.error("Wallet fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWallet();
  }, [user]);

  // Handle daily check-in
  const handleDailyCheckin = async () => {
    if (!user) return;
    setDailyLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/wallet/daily`, {
        uid: user.uid,
        amount: 0.25,
      });
      // Add transaction to state dynamically
      setTransactions((prev) => [res.data.txn, ...prev]);
      setBalance((prev) => prev + 0.25);
      alert("🎉 Daily Check-in added +$0.25!");
    } catch (err) {
      alert(err.response?.data?.error || "Error during daily check-in");
    } finally {
      setDailyLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-6 flex flex-col items-center"
    >
      {/* Header */}
      <div className="w-full max-w-xl flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">💰 Wallet</h1>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
          onClick={() => navigate(-1)}
        >
          ⬅ Back
        </button>
      </div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-6 mb-6 flex flex-col items-center"
      >
        <p className="text-gray-500 dark:text-gray-300">Current Balance</p>
        <p className="text-3xl font-bold text-green-500">${balance.toFixed(2)}</p>

        {/* Actions */}
        <div className="flex mt-4 gap-4 w-full">
          <button
            onClick={() => navigate("/topup")}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
          >
            💳 Top-Up
          </button>
          <button
            onClick={() => navigate("/withdraw")}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
          >
            💵 Withdraw
          </button>
        </div>

        {/* Daily Check-in */}
        <button
          onClick={handleDailyCheckin}
          disabled={dailyLoading}
          className={`mt-4 w-full py-3 rounded-lg font-semibold ${
            dailyLoading
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-yellow-500 hover:bg-yellow-600"
          } transition`}
        >
          🧩 Daily Check-in (+$0.25)
        </button>
      </motion.div>

      {/* Transactions */}
      <div className="w-full max-w-xl bg-white dark:bg-gray-800 shadow-md rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4">📜 Recent Transactions</h2>
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-center">Loading...</p>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center">No transactions yet.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {transactions.map((tx) => (
              <motion.div
                key={tx._id || tx.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex justify-between items-center p-3 rounded-lg bg-gray-100 dark:bg-gray-700"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {tx.description || tx.type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(tx.createdAt)}
                  </span>
                </div>
                <span
                  className={`font-semibold ${
                    tx.type === "credit" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {tx.type === "credit" ? "+" : "-"}${tx.amount.toFixed(2)}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}