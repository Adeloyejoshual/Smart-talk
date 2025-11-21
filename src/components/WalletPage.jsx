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
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [modalTx, setModalTx] = useState(null);
  const user = auth.currentUser;
  const navigate = useNavigate();

  // Month filter
  const monthOptions = [...Array(12)].map((_, i) => new Date(2025, i, 1));

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

  const handleTopUp = () => navigate("/topup");
  const handleWithdraw = () => navigate("/withdraw");

  const handleDailyCheckin = async () => {
    if (!user) return;
    if (checkedInToday) return alert("✅ Already checked in today!");

    try {
      const reward = 0.25;
      await axios.post("/api/wallet/daily", { uid: user.uid, amount: reward });
      alert(`🎉 Daily Check-in! +$${reward}`);
      fetchWallet();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Daily check-in failed");
    }
  };

  // Filter transactions by selected month
  const filteredTxs = transactions.filter((tx) => {
    const txDate = new Date(tx.createdAt);
    return (
      txDate.getMonth() === selectedMonth.getMonth() &&
      txDate.getFullYear() === selectedMonth.getFullYear()
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="min-h-screen bg-blue-50 p-6 flex flex-col items-center"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/settings")}
        className="absolute top-6 left-6 text-blue-800 font-bold text-2xl"
      >
        ⬅
      </button>

      {/* Wallet Card */}
      <motion.div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mb-6 flex flex-col items-center">
        <h2 className="text-xl font-semibold mb-3 text-blue-800">💼 Wallet Balance</h2>
        <p className="text-3xl font-bold text-blue-600 mb-4">${balance.toFixed(2)}</p>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={handleTopUp}
            className="flex-1 py-3 rounded-full bg-blue-200 hover:bg-blue-300 font-semibold"
          >
            💳 Top-Up
          </button>
          <button
            onClick={handleWithdraw}
            className="flex-1 py-3 rounded-full bg-blue-200 hover:bg-blue-300 font-semibold"
          >
            💸 Withdraw
          </button>
          <button
            onClick={handleDailyCheckin}
            disabled={checkedInToday}
            className={`flex-1 py-3 rounded-full font-semibold ${
              checkedInToday ? "bg-gray-200 cursor-not-allowed text-gray-400" : "bg-white hover:bg-gray-100"
            }`}
          >
            🧩 Daily Check-In
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm font-medium text-gray-600">
            {selectedMonth.toLocaleString("default", { month: "long", year: "numeric" })}
          </span>
          <select
            value={selectedMonth.getMonth()}
            onChange={(e) =>
              setSelectedMonth(new Date(2025, parseInt(e.target.value), 1))
            }
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            {monthOptions.map((m, idx) => (
              <option key={idx} value={idx}>
                {m.toLocaleString("default", { month: "long" })}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Transactions */}
      <div className="w-full max-w-md bg-white rounded-2xl p-4 shadow-md overflow-y-auto max-h-96">
        <h3 className="text-lg font-semibold mb-3 text-blue-800">📜 Transaction History</h3>
        {filteredTxs.length === 0 ? (
          <p className="text-gray-400 text-center">No transactions for this month.</p>
        ) : (
          <div className="space-y-2">
            {filteredTxs.map((tx) => {
              const statusColor =
                tx.amount > 0 ? "text-green-500" : tx.amount < 0 ? "text-red-500" : "text-yellow-500";
              return (
                <motion.div
                  key={tx._id || tx.id}
                  onClick={() => setModalTx(tx)}
                  className="flex justify-between items-center p-3 rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer shadow-sm"
                >
                  <span className="font-medium">{tx.description}</span>
                  <span className="text-gray-500 text-sm">{new Date(tx.createdAt).toLocaleDateString()}</span>
                  <span className={`font-semibold ${statusColor}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {modalTx && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl p-6 w-11/12 max-w-md shadow-lg relative"
          >
            <button
              onClick={() => setModalTx(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 font-bold text-lg"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-4 text-blue-800">Transaction Details</h3>
            <p><strong>Type:</strong> {modalTx.description}</p>
            <p><strong>Amount:</strong> {modalTx.amount > 0 ? `+${modalTx.amount}` : modalTx.amount}</p>
            <p><strong>Date:</strong> {new Date(modalTx.createdAt).toLocaleString()}</p>
            <p><strong>Status:</strong> {modalTx.amount > 0 ? "Success" : modalTx.amount < 0 ? "Failed" : "Pending"}</p>
            <p><strong>Transaction ID:</strong> {modalTx._id || "N/A"}</p>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}