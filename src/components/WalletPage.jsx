// src/components/WalletPage.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function WalletPage({ user }) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [modalTxn, setModalTxn] = useState(null);
  const [monthYear, setMonthYear] = useState(new Date());
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const modalRef = useRef();
  const navigate = useNavigate();

  // Fetch wallet data
  useEffect(() => {
    if (!user) return;

    const fetchWallet = async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await axios.get(`/api/wallet/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setBalance(res.data.balance || 0);
        setTransactions(res.data.transactions || []);

        // Check today's daily check-in
        const today = new Date().toISOString().split("T")[0];
        const claimed = res.data.transactions?.some(
          (t) => t.type === "checkin" && t.createdAt.startsWith(today)
        ) || false;
        setDailyClaimed(claimed);
      } catch (err) {
        console.error("Wallet fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, [user, monthYear]);

  // Daily check-in
  const handleDailyCheckIn = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const amount = 2; // Daily reward
      const res = await axios.post(
        "/api/wallet/daily",
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalance(res.data.balance || balance);
      setTransactions([res.data.txn, ...(transactions || [])]);
      setDailyClaimed(true);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Error claiming daily reward");
    }
  };

  // Transaction modal
  const openModal = (txn) => setModalTxn(txn);
  const closeModal = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      setModalTxn(null);
    }
  };

  // Date formatting
  const formatDate = (d) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Month navigation
  const prevMonth = () =>
    setMonthYear((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () =>
    setMonthYear((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  // Filter transactions by selected month
  const filteredTxns = (transactions || []).filter((txn) => {
    const d = new Date(txn.createdAt);
    return d.getMonth() === monthYear.getMonth() && d.getFullYear() === monthYear.getFullYear();
  });

  if (!user) return <div style={{ padding: 20 }}>Loading wallet...</div>;
  if (loading) return <div style={{ padding: 20 }}>Loading transactions...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#e0f2ff", padding: 20, fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => window.history.back()} style={{ marginRight: 10, fontSize: 24 }}>←</button>
        <h2 style={{ fontSize: 24, fontWeight: "bold" }}>Wallet</h2>
      </div>

      {/* Balance & Actions */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <div style={{
          flex: 1, background: "#fff", borderRadius: 16, padding: 20, textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: 14, color: "#555" }}>Balance</div>
          <div style={{ fontSize: 28, fontWeight: "bold", marginTop: 8 }}>${balance.toFixed(2)}</div>
        </div>

        <button onClick={() => navigate("/wallet/topup")} style={{
          flex: 1, background: "#6ee7b7", borderRadius: 16, padding: 20,
          fontWeight: "bold", fontSize: 16
        }}>Top Up</button>

        <button onClick={() => navigate("/wallet/withdraw")} style={{
          flex: 1, background: "#6ee7b7", borderRadius: 16, padding: 20,
          fontWeight: "bold", fontSize: 16
        }}>Withdraw</button>
      </div>

      {/* Daily Check-In */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button onClick={handleDailyCheckIn} disabled={dailyClaimed} style={{
          background: dailyClaimed ? "#ccc" : "#facc15",
          color: dailyClaimed ? "#888" : "#000",
          padding: "12px 24px",
          borderRadius: 16,
          fontWeight: "bold",
          fontSize: 16,
          cursor: dailyClaimed ? "not-allowed" : "pointer"
        }}>
          {dailyClaimed ? "Already Claimed Today" : "Daily Check-In +2"}
        </button>
      </div>

      {/* Month Selector */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ marginRight: 10 }}>◀</button>
        <span style={{ fontWeight: "bold" }}>
          {monthYear.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <button onClick={nextMonth} style={{ marginLeft: 10 }}>▶</button>
      </div>

      {/* Transactions Table */}
      <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th style={{ padding: 8 }}>Type</th>
              <th style={{ padding: 8 }}>Date</th>
              <th style={{ padding: 8 }}>Amount</th>
              <th style={{ padding: 8 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTxns.map((t) => {
              const color = t.status === "Success" ? "green" : t.status === "Pending" ? "orange" : "red";
              return (
                <tr key={t.txnId} onClick={() => openModal(t)} style={{ cursor: "pointer", borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{t.type}</td>
                  <td style={{ padding: 8 }}>{formatDate(t.createdAt)}</td>
                  <td style={{ padding: 8, color: t.amount >= 0 ? "green" : "red" }}>
                    {t.amount >= 0 ? `+${t.amount}` : t.amount}
                  </td>
                  <td style={{ padding: 8, color }}>{t.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredTxns.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#555" }}>No transactions this month.</div>}
      </div>

      {/* Transaction Modal */}
      {modalTxn && (
        <div onClick={closeModal} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex",
          justifyContent: "center", alignItems: "center", zIndex: 1000
        }}>
          <div ref={modalRef} style={{ background: "#fff", padding: 20, borderRadius: 16, width: "90%", maxWidth: 400 }}>
            <h3 style={{ fontWeight: "bold", marginBottom: 10 }}>Transaction Details</h3>
            <p><strong>Type:</strong> {modalTxn.type}</p>
            <p><strong>Amount:</strong> {modalTxn.amount}</p>
            <p><strong>Status:</strong> {modalTxn.status}</p>
            <p><strong>Date:</strong> {formatDate(modalTxn.createdAt)}</p>
            <p><strong>Description:</strong> {modalTxn.description}</p>
            <p><strong>Txn ID:</strong> {modalTxn.txnId}</p>
            <button onClick={() => setModalTxn(null)} style={{
              marginTop: 10, padding: 10, borderRadius: 8, background: "#6ee7b7",
              fontWeight: "bold", width: "100%"
            }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}