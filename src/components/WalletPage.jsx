// src/components/WalletPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function WalletPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [details, setDetails] = useState(null);
  const [loadingCheckIn, setLoadingCheckIn] = useState(false);
  const modalRef = useRef();
  const navigate = useNavigate();

  const backend = "https://smart-talk-dqit.onrender.com";

  // AUTH
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        loadWallet(u.uid);
      } else navigate("/");
    });
    return unsub;
  }, []);

  // FETCH WALLET + TRANSACTIONS
  const loadWallet = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance || 0);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error(err);
    }
  };

  // DAILY CHECK-IN
  const handleCheckIn = async () => {
    try {
      if (!user) return;
      setLoadingCheckIn(true);
      const token = await auth.currentUser.getIdToken(true);
      const amount = 1; // daily reward amount
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`Daily check-in success! +$${amount}`);
      setBalance(res.data.balance);
      setTransactions([res.data.txn, ...transactions]);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Check-in failed");
    } finally {
      setLoadingCheckIn(false);
    }
  };

  const formatMonth = (date) =>
    date.toLocaleString("en-US", { month: "long", year: "numeric" });

  const formatDate = (d) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColor = { Success: "#2ecc71", Pending: "#f1c40f", Failed: "#e74c3c" };

  const filteredTransactions = transactions.filter((t) => {
    const d = new Date(t.createdAt || t.date);
    return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
  });

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/settings")} style={styles.backBtn}>←</button>
      <h2 style={styles.title}>Wallet</h2>

      <div style={styles.walletCard}>
        <p style={styles.balanceLabel}>Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>

        <div style={styles.actionRow}>
          <button style={styles.roundBtn} onClick={() => navigate("/topup")}>Top-Up</button>
          <button style={styles.roundBtn} onClick={() => navigate("/withdraw")}>Withdraw</button>
          <button style={{ ...styles.roundBtn, background: "#ffd700" }} onClick={handleCheckIn} disabled={loadingCheckIn}>
            {loadingCheckIn ? "Checking in..." : "Daily Check-In"}
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div style={styles.monthHeader}>
        <span style={styles.monthText}>{formatMonth(selectedMonth)}</span>
        <button style={styles.monthArrow} onClick={() => setShowMonthPicker(!showMonthPicker)}>▼</button>
      </div>

      {showMonthPicker && (
        <div style={styles.monthPicker}>
          {Array.from({ length: 12 }).map((_, i) => {
            const d = new Date(selectedMonth.getFullYear(), i, 1);
            return (
              <div key={i} style={styles.monthItem} onClick={() => { setSelectedMonth(d); setShowMonthPicker(false); }}>
                {formatMonth(d)}
              </div>
            );
          })}
        </div>
      )}

      {/* Transactions */}
      <div style={styles.list}>
        {filteredTransactions.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.5 }}>No transactions this month.</p>
        ) : (
          filteredTransactions.map((tx) => (
            <div key={tx._id} style={styles.txRow} onClick={() => setDetails(tx)}>
              <div style={styles.txLeft}>
                <p style={styles.txType}>{tx.type}</p>
                <span style={styles.txDate}>{formatDate(tx.createdAt || tx.date)}</span>
              </div>
              <div style={styles.txRight}>
                <span style={{ ...styles.amount, color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
                  {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                </span>
                <span style={{ ...styles.statusBadge, background: statusColor[tx.status] || "#999" }}>{tx.status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {details && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            <h3 style={{ marginBottom: 10 }}>Transaction Details</h3>
            <p><b>Type:</b> {details.type}</p>
            <p><b>Amount:</b> ${details.amount.toFixed(2)}</p>
            <p><b>Date:</b> {formatDate(details.createdAt || details.date)}</p>
            <p><b>Status:</b> {details.status}</p>
            <p><b>Transaction ID:</b> {details._id}</p>
            <button style={styles.closeBtn} onClick={() => setDetails(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ======================================================
// STYLING
// ======================================================
const styles = {
  page: {
    background: "#eef6ff",
    minHeight: "100vh",
    padding: "25px",
    color: "#000",
  },
  backBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    padding: "10px 14px",
    borderRadius: "50%",
    background: "#dce9ff",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
  },
  title: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 26,
  },
  walletCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: 18,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    marginTop: 20,
    textAlign: "center",
  },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "10px 0" },
  actionRow: {
    display: "flex",
    justifyContent: "center",
    gap: 15,
    marginTop: 15,
  },
  roundBtn: {
    padding: "12px 20px",
    background: "#b3dcff",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
  },
  monthHeader: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    marginTop: 25,
  },
  monthText: { fontSize: 18, fontWeight: "bold" },
  monthArrow: {
    border: "none",
    background: "#cfe3ff",
    padding: "5px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  monthPicker: {
    background: "#fff",
    borderRadius: 14,
    marginTop: 10,
    padding: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  monthItem: {
    padding: 10,
    borderRadius: 10,
    cursor: "pointer",
  },
  list: {
    marginTop: 20,
    maxHeight: "50vh",
    overflowY: "auto",
    paddingRight: 5,
  },
  txRow: {
    background: "#fff",
    padding: "15px 12px",
    borderRadius: 12,
    marginBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  txLeft: {},
  txType: { fontSize: 16, fontWeight: "600" },
  txDate: { fontSize: 12, opacity: 0.6 },
  txRight: { textAlign: "right" },
  amount: { fontWeight: "600" },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
    marginLeft: 6,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    background: "#fff",
    padding: 25,
    borderRadius: 18,
    width: "85%",
    maxWidth: 380,
    boxShadow: "0 5px 18px rgba(0,0,0,0.15)",
  },
  closeBtn: {
    marginTop: 15,
    padding: "10px 15px",
    background: "#3498db",
    borderRadius: 10,
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
};