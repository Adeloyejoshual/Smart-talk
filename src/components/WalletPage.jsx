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
  const [tasksLoading, setTasksLoading] = useState(false);
  const scrollRef = useRef();
  const modalRef = useRef();
  const navigate = useNavigate();
  const backend = "https://smart-talk-dqit.onrender.com";

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
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
      setTransactions(res.data.transactions || []);
      if (res.data.transactions.length)
        setSelectedMonth(new Date(res.data.transactions[0].createdAt));
    } catch (err) {
      console.error(err);
    }
  };

  const performTask = async (type, amount) => {
    if (!user) return;
    setTasksLoading(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/task`,
        { type, amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalance(res.data.balance);
      setTransactions(res.data.transactions);
      alert(`🎉 ${type} completed! +$${amount}`);
    } catch (err) {
      console.error(err);
      alert("Failed to update balance. Try again.");
    } finally {
      setTasksLoading(false);
    }
  };

  const handleWatchVideo = () => {
    window.open("https://youtube.com/shorts/mQOV18vpAu4");
    performTask("watch_video", 0.2);
  };

  const handleFollowInstagram = () => {
    window.open("https://www.instagram.com/hahahala53");
    performTask("follow_instagram", 0.15);
  };

  const handleInviteFriend = () => {
    navigator.clipboard.writeText(`https://yourapp.com/signup?ref=${user.uid}`);
    alert("🔗 Referral link copied!");
    performTask("referral", 0.25);
  };

  // Formatters
  const formatMonth = (date) =>
    date.toLocaleString("en-US", { month: "long", year: "numeric" });
  const formatDate = (d) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const filteredTransactions = transactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
  });

  const activeMonths = Array.from(new Set(transactions.map((t) => {
    const d = new Date(t.createdAt);
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }))).map((s) => new Date(s));

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/settings")} style={styles.backBtn}>←</button>
      <h2 style={styles.title}>Wallet</h2>

      <div style={styles.walletCard}>
        <p style={styles.balanceLabel}>Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>
        <div style={styles.actionRow}>
          <button style={styles.roundBtn} onClick={() => navigate("/withdraw")}>
            Withdraw
          </button>
          <button style={styles.roundBtn} onClick={handleWatchVideo} disabled={tasksLoading}>
            🎥 Watch Video
          </button>
          <button style={styles.roundBtn} onClick={handleFollowInstagram} disabled={tasksLoading}>
            📱 Follow IG
          </button>
          <button style={styles.roundBtn} onClick={handleInviteFriend}>
            👥 Invite Friend
          </button>
        </div>
      </div>

      {/* Month Header */}
      <div style={styles.monthHeader}>
        <span style={styles.monthText}>{formatMonth(selectedMonth)}</span>
        <button style={styles.monthArrow} onClick={() => setShowMonthPicker(!showMonthPicker)}>▼</button>
      </div>

      {showMonthPicker && (
        <div style={styles.monthPicker} ref={modalRef}>
          {activeMonths.map((d, i) => (
            <div key={i} style={styles.monthItem} onClick={() => { setSelectedMonth(d); setShowMonthPicker(false); }}>
              {formatMonth(d)}
            </div>
          ))}
        </div>
      )}

      <div style={styles.list}>
        {filteredTransactions.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.5, marginTop: 10 }}>No transactions this month.</p>
        ) : filteredTransactions.map((tx) => (
          <div key={tx._id} style={styles.txRowCompact}>
            <div>
              <p style={styles.txTypeCompact}>{tx.type}</p>
              <span style={styles.txDateCompact}>{formatDate(tx.createdAt)}</span>
            </div>
            <div>
              <span style={{ color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c" }}>
                {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Styles (same as before)
const styles = {
  page: { background: "#eef6ff", minHeight: "100vh", padding: 25, color: "#000", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" },
  backBtn: { position: "absolute", top: 20, left: 20, padding: "10px 14px", borderRadius: "50%", background: "#dce9ff", border: "none", cursor: "pointer", fontSize: 18 },
  title: { marginTop: 20, textAlign: "center", fontSize: 26 },
  walletCard: { background: "#fff", padding: 20, borderRadius: 18, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginTop: 20, textAlign: "center", width: "90%", maxWidth: 380 },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "10px 0" },
  actionRow: { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 15 },
  roundBtn: { padding: "10px 14px", background: "#b3dcff", borderRadius: 30, border: "none", cursor: "pointer", fontWeight: "bold", fontSize: 14 },
  monthHeader: { display: "flex", justifyContent: "center", gap: 6, marginTop: 25, position: "sticky", top: 0, background: "#eef6ff", padding: "10px 0", zIndex: 5 },
  monthText: { fontSize: 18, fontWeight: "bold" },
  monthArrow: { border: "none", background: "#cfe3ff", padding: "5px 10px", borderRadius: 8, cursor: "pointer" },
  monthPicker: { background: "#fff", borderRadius: 14, padding: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.1)", position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 10 },
  monthItem: { padding: 10, borderRadius: 10, cursor: "pointer" },
  list: { marginTop: 10, maxHeight: "50vh", overflowY: "auto", width: "100%", maxWidth: 380 },
  txRowCompact: { background: "#fff", padding: "10px 12px", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" },
  txTypeCompact: { fontSize: 14, fontWeight: 600 },
  txDateCompact: { fontSize: 12, opacity: 0.6 },
};