// src/components/TopUpPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { handleStripePayment, handleFlutterwavePayment } from "../payments";

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
    if (!amount || amount < 1) {
      alert("Please enter a valid amount.");
      return;
    }
    setLoading(true);
    try {
      if (method === "stripe") {
        await handleStripePayment(amount, user.uid);
      } else if (method === "flutterwave") {
        await handleFlutterwavePayment(amount, user.uid);
      }
    } catch (err) {
      console.error("Top-up error:", err);
      alert("Payment failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "30px 20px",
        background: "#f5f5f5",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/settings")}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          padding: "8px 12px",
          background: "#ddd",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      {/* Page Title */}
      <h2 style={{ marginTop: "50px" }}>💳 Wallet Top-Up</h2>
      <p>Choose how much you want to add to your wallet.</p>

      {/* Amount Input */}
      <input
        type="number"
        placeholder="Enter amount (USD)"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          margin: "15px 0",
          width: "80%",
          maxWidth: "300px",
          fontSize: "16px",
          textAlign: "center",
        }}
      />

      {/* Quick Amount Buttons */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {[5, 10, 20, 50].map((amt) => (
          <button
            key={amt}
            onClick={() => setAmount(amt)}
            style={{
              padding: "10px 15px",
              background: "#007BFF",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ${amt}
          </button>
        ))}
      </div>

      {/* Payment Options */}
      <h3>Select Payment Method</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "15px" }}>
        <button
          disabled={loading}
          onClick={() => handleTopUp("stripe")}
          style={{
            background: "#635BFF",
            color: "#fff",
            padding: "12px 20px",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: loading ? "not-allowed" : "pointer",
            width: "250px",
          }}
        >
          {loading ? "Processing..." : "💳 Pay with Stripe"}
        </button>

        <button
          disabled={loading}
          onClick={() => handleTopUp("flutterwave")}
          style={{
            background: "#FF9A00",
            color: "#fff",
            padding: "12px 20px",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: loading ? "not-allowed" : "pointer",
            width: "250px",
          }}
        >
          {loading ? "Processing..." : "🌍 Pay with Flutterwave"}
        </button>
      </div>
    </div>
  );
}