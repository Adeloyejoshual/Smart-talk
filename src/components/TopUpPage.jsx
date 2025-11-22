import React, { useState, useContext } from "react";
import axios from "axios";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function TopUpPage() {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  const handleStripeTopUp = async () => {
    try {
      if (!amount || Number(amount) <= 0) return alert("Enter a valid amount");
      setLoading(true);
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${process.env.REACT_APP_API}/payment/stripe`,
        { amount: Number(amount) * 100 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const txnId = res.data.txnId;
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
        { amount: Number(amount), email: auth.currentUser.email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      window.location.href = res.data.link;
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Flutterwave payment failed");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic styles based on theme
  const styles = {
    page: {
      padding: 20,
      minHeight: "100vh",
      background: theme === "dark" ? "#121212" : "#f0f9ff",
      color: theme === "dark" ? "#fff" : "#000",
    },
    backBtn: {
      position: "absolute",
      top: 20,
      left: 20,
      padding: "10px 14px",
      borderRadius: "50%",
      border: "none",
      background: theme === "dark" ? "#333" : "#dce9ff",
      color: theme === "dark" ? "#fff" : "#000",
      cursor: "pointer",
      fontSize: 18,
    },
    input: {
      padding: "12px",
      borderRadius: 16,
      border: `1px solid ${theme === "dark" ? "#555" : "#ccc"}`,
      width: "200px",
      marginBottom: 16,
      background: theme === "dark" ? "#1e1e1e" : "#fff",
      color: theme === "dark" ? "#fff" : "#000",
    },
    button: (gradient) => ({
      background: gradient,
      color: "#fff",
      padding: "12px 24px",
      borderRadius: 20,
      fontWeight: "bold",
      cursor: loading ? "not-allowed" : "pointer",
      opacity: loading ? 0.7 : 1,
      transition: "transform 0.2s, box-shadow 0.2s",
      boxShadow:
        theme === "dark"
          ? "0 4px 14px rgba(255,255,255,0.2)"
          : "0 4px 14px rgba(0,0,0,0.2)",
    }),
    container: { display: "flex", justifyContent: "center", gap: 16 },
    title: { textAlign: "center", marginBottom: 20, marginTop: 20 },
  };

  return (
    <div style={styles.page}>
      {/* Back Arrow */}
      <button style={styles.backBtn} onClick={() => navigate("/wallet")}>
        ←
      </button>

      <h2 style={styles.title}>💳 Top Up Wallet</h2>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.container}>
        <button
          onClick={handleStripeTopUp}
          disabled={loading}
          style={styles.button(
            theme === "dark"
              ? "linear-gradient(90deg, #00b09b, #96c93d)"
              : "linear-gradient(90deg, #34d399, #059669)"
          )}
        >
          Pay with Stripe
        </button>
        <button
          onClick={handleFlutterwaveTopUp}
          disabled={loading}
          style={styles.button(
            theme === "dark"
              ? "linear-gradient(90deg, #3b82f6, #0ea5e9)"
              : "linear-gradient(90deg, #3b82f6, #60a5fa)"
          )}
        >
          Pay with Flutterwave
        </button>
      </div>
    </div>
  );
}