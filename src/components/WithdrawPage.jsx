// src/components/WithdrawPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [details, setDetails] = useState(null);
  const modalRef = useRef();
  const navigate = useNavigate();

  const backend = "https://smart-talk-dqit.onrender.com";

  // AUTH + LOAD BALANCE + TRANSACTIONS
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        loadWallet(u.uid);
      } else navigate("/");
    });
    return unsub;
  }, []);

  const loadWallet = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance || 0);
      setCompletedTasks(res.data.completedTasks || []);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error(err);
    }
  };

  // TASK REWARD
  const performTask = async (amount, taskId) => {
    if (!user) return;
    if (completedTasks.includes(taskId)) {
      alert("✅ You already completed this task!");
      return;
    }

    setTasksLoading(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        { amount, taskId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update balance, completed tasks, and transactions
      setBalance(res.data.balance);
      setCompletedTasks(res.data.completedTasks || []);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error(err);
      alert("Failed to update balance. Try again.");
    } finally {
      setTasksLoading(false);
    }
  };

  const handleWatchVideo = () => performTask(0.2, "watchVideo");
  const handleFollowInstagram = () => performTask(0.15, "followInstagram");
  const handleInviteFriend = () => {
    navigator.clipboard.writeText(`https://yourapp.com/signup?ref=${user.uid}`);
    alert("🔗 Referral link copied!");
  };

  // CLOSE MODAL WHEN CLICK OUTSIDE
  useEffect(() => {
    const clickOutside = (e) => {
      if (modalOpen && modalRef.current && !modalRef.current.contains(e.target)) {
        setModalOpen(false);
      }
      if (details && modalRef.current && !modalRef.current.contains(e.target)) {
        setDetails(null);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [modalOpen, details]);

  const formatDate = (d) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div style={styles.page}>
      {/* Back Button */}
      <button onClick={() => navigate("/wallet")} style={styles.backBtn}>←</button>

      {/* Title */}
      <h2 style={styles.title}>💵 Withdraw Funds</h2>

      {/* Balance Card */}
      <div style={styles.walletCard}>
        <p style={styles.balanceLabel}>Your Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>
      </div>

      {/* Center Content */}
      <div style={styles.centerContent}>
        <button
          style={styles.taskBtn}
          onClick={handleWatchVideo}
          disabled={tasksLoading || completedTasks.includes("watchVideo")}
        >
          🎥 Watch a video → +$0.20
        </button>

        <button
          style={styles.taskBtn}
          onClick={handleFollowInstagram}
          disabled={tasksLoading || completedTasks.includes("followInstagram")}
        >
          📱 Follow us on Instagram → +$0.15
        </button>

        <button style={styles.taskBtn} onClick={handleInviteFriend}>
          👥 Invite a friend → +$0.25 per join
        </button>

        <button
          style={{
            ...styles.withdrawBtn,
            background: completedTasks.includes("withdraw") ? "#ccc" : "#f39c12",
            cursor: completedTasks.includes("withdraw") ? "not-allowed" : "pointer",
          }}
          onClick={() => setModalOpen(true)}
          disabled={completedTasks.includes("withdraw")}
        >
          🚧 Withdraw
        </button>
      </div>

      {/* Transaction History */}
      <div style={{ marginTop: 20, width: "90%", maxWidth: 380, maxHeight: 300, overflowY: "auto" }}>
        {transactions.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.5 }}>No transactions yet.</p>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx._id}
              style={styles.txRow}
              onClick={() => setDetails(tx)}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{tx.type}</p>
                <span style={{ fontSize: 12, opacity: 0.6 }}>{formatDate(tx.createdAt || tx.date)}</span>
              </div>
              <div>
                <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c", fontWeight: 600 }}>
                  {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Withdraw Modal */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            <h3 style={{ marginBottom: 15 }}>🚧 Coming Soon</h3>
            <p style={{ marginBottom: 20 }}>
              Withdraw is not yet available. Keep chatting to earn more credits!
            </p>
            <button style={styles.closeBtn} onClick={() => setModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {details && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            <h3 style={{ marginBottom: 10 }}>Transaction Details</h3>
            <p><b>Type:</b> {details.type}</p>
            <p><b>Amount:</b> ${details.amount.toFixed(2)}</p>
            <p><b>Date:</b> {formatDate(details.createdAt || details.date)}</p>
            <p><b>Status:</b> {details.status}</p>
            <p><b>ID:</b> {details._id}</p>
            <button style={styles.closeBtn} onClick={() => setDetails(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// =======================
// STYLES
// =======================
const styles = {
  page: { background: "#eef6ff", minHeight: "100vh", padding: 25, color: "#000", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" },
  backBtn: { position: "absolute", top: 20, left: 20, padding: "10px 14px", borderRadius: "50%", background: "#dce9ff", border: "none", cursor: "pointer", fontSize: 18 },
  title: { marginTop: 20, textAlign: "center", fontSize: 26 },
  walletCard: { background: "#fff", padding: 20, borderRadius: 18, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginTop: 20, textAlign: "center", width: "90%", maxWidth: 380 },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "5px 0" },
  centerContent: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "12vh", width: "100%", maxWidth: 380, gap: 12 },
  taskBtn: { padding: "12px 20px", background: "#b3dcff", borderRadius: 30, border: "none", cursor: "pointer", fontWeight: "bold", width: "90%", textAlign: "center" },
  withdrawBtn: { padding: "14px 20px", borderRadius: 30, border: "none", color: "#fff", fontWeight: "bold", width: "90%", marginTop: 10 },
  txRow: { display: "flex", justifyContent: "space-between", padding: 10, marginBottom: 8, background: "#fff", borderRadius: 10, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center" },
  modal: { background: "#fff", padding: 25, borderRadius: 18, width: "85%", maxWidth: 360, textAlign: "center", boxShadow: "0 5px 18px rgba(0,0,0,0.15)" },
  closeBtn: { marginTop: 15, padding: "10px 15px", background: "#3498db", borderRadius: 10, border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" },
};