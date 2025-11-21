// src/components/TopUpPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { handleStripePayment, handleFlutterwavePayment } from "../payments";
import { motion } from "framer-motion";

export default function TopUpPage() {
  const [amount, setAmount] = useState(10);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userAuth) => {
      if (userAuth) setUser(userAuth);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  if (!user) return <p>Loading...</p>;

  const handleTopUp = async (method) => {
    if (!amount || amount < 1) return alert("Please enter a valid amount.");
    setLoading(true);
    try {
      if (method === "stripe") await handleStripePayment(amount, user.uid);
      else if (method === "flutterwave") await handleFlutterwavePayment(amount, user.uid);
    } catch (err) {
      console.error("Top-up error:", err);
      alert("Payment failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 p-6 flex flex-col items-center text-white"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/wallet")}
        className="absolute top-6 left-6 text-white font-bold text-2xl"
      >
        ⬅
      </button>

      {/* Page Header */}
      <h2 className="mt-12 text-3xl font-bold mb-2">💳 Wallet Top-Up</h2>
      <p className="text-gray-200 mb-6 text-center max-w-md">
        Add funds to your wallet quickly and securely using Stripe or Flutterwave.
      </p>

      {/* Amount Input */}
      <motion.input
        whileFocus={{ scale: 1.02 }}
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Enter amount (USD)"
        className="p-3 w-full max-w-md rounded-xl text-black font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
      />

      {/* Quick Amount Buttons */}
      <div className="flex flex-wrap gap-3 justify-center mb-6">
        {[5, 10, 20, 50].map((amt) => (
          <button
            key={amt}
            onClick={() => setAmount(amt)}
            className="bg-blue-500 hover:bg-blue-600 transition px-4 py-2 rounded-lg font-semibold"
          >
            ${amt}
          </button>
        ))}
      </div>

      {/* Payment Options */}
      <h3 className="text-xl font-semibold mb-3">Select Payment Method</h3>
      <div className="flex flex-col gap-4 items-center w-full max-w-md">
        <button
          disabled={loading}
          onClick={() => handleTopUp("stripe")}
          className={`w-full py-3 rounded-xl text-white font-bold transition ${
            loading ? "bg-gray-600 cursor-not-allowed" : "bg-purple-500 hover:bg-purple-600"
          }`}
        >
          {loading ? "Processing..." : "💳 Pay with Stripe"}
        </button>

        <button
          disabled={loading}
          onClick={() => handleTopUp("flutterwave")}
          className={`w-full py-3 rounded-xl text-white font-bold transition ${
            loading ? "bg-gray-600 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-600"
          }`}
        >
          {loading ? "Processing..." : "🌍 Pay with Flutterwave"}
        </button>
      </div>
    </motion.div>
  );
}