import React, { useState } from "react";
import axios from "axios";
import { auth } from "../firebaseConfig";

export default function TopUpPage() {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStripeTopUp = async () => {
    try {
      if (!amount || Number(amount) <= 0) return alert("Enter a valid amount");
      setLoading(true);
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${process.env.REACT_APP_API}/payment/stripe`,
        { amount: Number(amount) * 100 }, // Stripe expects cents
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const clientSecret = res.data.clientSecret;
      const txnId = res.data.txnId;
      // TODO: Implement Stripe.js frontend payment confirmation
      alert(`Stripe payment created! Transaction ID: ${txnId}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Stripe payment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFlutterwaveTopUp = async () => {
    try {
      if (!amount || Number(amount) <= 0) return alert("Enter a valid amount");
      setLoading(true);
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${process.env.REACT_APP_API}/payment/flutterwave`,
        {
          amount: Number(amount),
          email: auth.currentUser.email,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      window.location.href = res.data.link; // redirect user to Flutterwave payment
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Flutterwave payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, background: "#f0f9ff", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>💳 Top Up Wallet</h2>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: 16,
            border: "1px solid #ccc",
            width: "200px",
            marginBottom: 16,
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
        <button
          onClick={handleStripeTopUp}
          disabled={loading}
          style={{
            background: "#6ee7b7",
            padding: "12px 24px",
            borderRadius: 20,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Pay with Stripe
        </button>
        <button
          onClick={handleFlutterwaveTopUp}
          disabled={loading}
          style={{
            background: "#3b82f6",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 20,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Pay with Flutterwave
        </button>
      </div>
    </div>
  );
}