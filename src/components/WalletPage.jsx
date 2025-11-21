// src/components/WalletPage.jsx
import React, { useState, useEffect } from "react";
import { auth } from "../firebaseConfig";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const user = auth.currentUser;
  const navigate = useNavigate();

  const fetchWallet = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`/api/wallet/${user.uid}`);
      const history = res.data || [];
      setTransactions(history);

      // Calculate balance
      const bal = history.reduce((sum, tx) => sum + tx.amount, 0);
      setBalance(bal);

      // Check daily check-in
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

  const handleDailyCheckin = async () => {
    if (!user || checkedInToday) return;
    try {
      const reward = 0.25;
      await axios.post("/api/wallet/daily", { uid: user.uid, amount: reward });
      fetchWallet();
      alert(`🎉 Daily Check-in! +$${reward}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Daily check-in failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Wallet Card */}
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 flex flex-col items-center">
        <h2 className="text-xl font-semibold mb-2">💼 Wallet Balance</h2>
        <p className="text-4xl font-bold text-green-500 mb-4">${balance.toFixed(2)}</p>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/topup")}
            className="w-16 h-16 rounded-full bg-green-200 flex items-center justify-center font-semibold text-green-800 hover:bg-green-300 transition"
          >
            💳<br />Top-Up
          </button>
          <button
            onClick={() => navigate("/withdraw")}
            className="w-16 h-16 rounded-full bg-green-200 flex items-center justify-center font-semibold text-green-800 hover:bg-green-300 transition"
          >
            💸<br />Withdraw
          </button>
          <button
            onClick={handleDailyCheckin}
            disabled={checkedInToday}
            className={`w-16 h-16 rounded-full flex items-center justify-center font-semibold text-gray-800 transition ${
              checkedInToday ? "bg-gray-300 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            🧩<br />Check-In
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="max-w-3xl mx-auto mt-10 bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">📜 Transaction History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 font-medium">Type</th>
                <th className="py-2 px-4 font-medium">Amount</th>
                <th className="py-2 px-4 font-medium">Date</th>
                <th className="py-2 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const statusClass =
                  tx.status === "Success"
                    ? "text-green-500"
                    : tx.status === "Pending"
                    ? "text-yellow-500"
                    : "text-red-500";

                return (
                  <tr
                    key={tx._id || tx.id}
                    className="cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td className="py-2 px-4">{tx.type}</td>
                    <td className={`py-2 px-4 ${tx.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                      {tx.amount > 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                    </td>
                    <td className="py-2 px-4">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className={`py-2 px-4 font-semibold ${statusClass}`}>{tx.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="bg-white p-6 rounded-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">Transaction Details</h3>
            <p><strong>Type:</strong> {selectedTx.type}</p>
            <p><strong>Amount:</strong> ${selectedTx.amount.toFixed(2)}</p>
            <p><strong>Date:</strong> {new Date(selectedTx.createdAt).toLocaleString()}</p>
            <p><strong>Status:</strong> {selectedTx.status}</p>
            {selectedTx.transactionId && <p><strong>Transaction ID:</strong> {selectedTx.transactionId}</p>}
            {selectedTx.description && <p><strong>Description:</strong> {selectedTx.description}</p>}
            {selectedTx.balanceAfter !== undefined && <p><strong>Balance After:</strong> ${selectedTx.balanceAfter.toFixed(2)}</p>}
            <button
              onClick={() => setSelectedTx(null)}
              className="mt-4 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}