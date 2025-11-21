// src/components/TopUpPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import axios from "axios";

export default function TopUpPage() {
  const [amount, setAmount] = useState(10);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();

  // Listen for auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userAuth) => {
      if (userAuth) setUser(userAuth);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  if (!user) return <p>Loading...</p>;

  const generateTxRef = () => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const handleFlutterwaveTopUp = async () => {
    if (!amount || amount < 1) {
      alert("Please enter a valid amount.");
      return;
    }

    setLoading(true);
    try {
      const tx_ref = generateTxRef();

      // Create a pending transaction on server
      const token = await user.getIdToken();
      await axios.post(
        "/api/wallet",
        {
          uid: user.uid,
          type: "deposit",
          amount,
          description: "Flutterwave Payment",
          txnId: tx_ref,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Redirect user to Flutterwave payment
      const flutterwaveURL = `https://checkout.flutterwave.com/v3/hosted/pay?tx_ref=${tx_ref}&amount=${amount}&currency=USD&customer[email]=${user.email}`;
      window.location.href = flutterwaveURL;

    } catch (err) {
      console.error(err);
      alert("Payment initialization failed");
    } finally {
      setLoading(false);
    }
  };

  // Optional: verify after redirect (if you detect query params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tx_ref = params.get("tx_ref");
    if (tx_ref) {
      verifyFlutterwave(tx_ref);
    }
  }, []);

  const verifyFlutterwave = async (tx_ref) => {
    if (!user) return;
    setVerifying(true);
    try {
      const token = await user.getIdToken();
      const res = await axios.get(`/api/flutterwave/verify/${tx_ref}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        alert(`Top-up successful! New balance: $${res.data.balance.toFixed(2)}`);
        // Remove query param from URL
        window.history.replaceState({}, document.title, "/topup");
      }
    } catch (err) {
      console.error(err);
      alert("Top-up verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "30px 20px",
        background: "#e0f0ff",
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

      <h2 style={{ marginTop: "50px" }}>💳 Wallet Top-Up</h2>
      <p>Choose how much you want to add to your wallet.</p>

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

      <h3>Select Payment Method</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "15px" }}>
        <button
          disabled={loading || verifying}
          onClick={() => handleFlutterwaveTopUp()}
          style={{
            background: "#FF9A00",
            color: "#fff",
            padding: "12px 20px",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: loading || verifying ? "not-allowed" : "pointer",
            width: "250px",
          }}
        >
          {loading || verifying ? "Processing..." : "🌍 Pay with Flutterwave"}
        </button>
      </div>
    </div>
  );
}