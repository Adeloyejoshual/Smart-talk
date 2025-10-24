import React, { useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { handleStripePayment, handleFlutterwavePayment } from "../payments";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [transactions, setTransactions] = useState([]);
  const user = auth.currentUser;
  const navigate = useNavigate();

  // 🔹 Listen for real-time wallet balance
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "wallets", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setBalance(docSnap.data().balance || 0);
      } else {
        setBalance(0);
      }
    });
    return () => unsub();
  }, [user]);

  // 🔹 Load recent transactions
  useEffect(() => {
    if (!user) return;
    const loadTransactions = async () => {
      const q = query(
        collection(db, "wallets", user.uid, "transactions"),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      const tx = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTransactions(tx);
    };
    loadTransactions();
  }, [user]);

  // 🔹 Handle top-up
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
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 text-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/20"
      >
        <h1 className="text-3xl font-bold text-center mb-4">💰 My Wallet</h1>
        <p className="text-center text-lg mb-6">
          Current Balance:{" "}
          <span className="font-semibold text-green-400">
            ${balance.toFixed(2)}
          </span>
        </p>

        {/* 🔹 Amount Input */}
        <div className="space-y-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount to add"
            className="w-full p-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* 🔹 Payment Buttons */}
          <div className="flex gap-4 justify-between">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTopUp("stripe")}
              className="flex-1 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 transition font-semibold"
            >
              💳 Pay with Stripe
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTopUp("flutterwave")}
              className="flex-1 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 transition font-semibold text-black"
            >
              🌍 Pay with Flutterwave
            </motion.button>
          </div>

          {/* 🔹 Withdraw Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/withdraw")}
            className="w-full mt-4 py-3 rounded-lg bg-green-500 hover:bg-green-600 transition font-semibold"
          >
            💵 Withdraw Funds
          </motion.button>
        </div>

        {/* 🔹 Transaction History */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-3">📜 Recent Transactions</h3>
          {transactions.length === 0 ? (
            <p className="text-gray-300 text-center">No transactions yet.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {transactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/10 p-3 rounded-lg flex justify-between items-center text-sm"
                >
                  <span>{tx.type === "topup" ? "Top-Up" : "Reward"}</span>
                  <span
                    className={
                      tx.amount > 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {tx.amount > 0 ? "+" : ""}
                    ${tx.amount.toFixed(2)}
                  </span>
                  <span className="text-gray-300 text-xs">
                    {new Date(tx.timestamp?.toDate?.() || tx.timestamp).toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}