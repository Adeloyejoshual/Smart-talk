// src/components/WalletPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ThemeContext } from "../context/ThemeContext";

export default function WalletPage() {
  const { theme } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [details, setDetails] = useState(null);
  const [loadingReward, setLoadingReward] = useState(false);
  const scrollRef = useRef();
  const modalRef = useRef();
  const navigate = useNavigate();

  const backend = "https://smart-talk-zlxe.onrender.com";

  // AUTH + LOAD WALLET
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
      if (res.data.transactions?.length) {
        setSelectedMonth(
          new Date(res.data.transactions[0].createdAt || res.data.transactions[0].date)
        );
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load wallet. Check console.");
    }
  };

  // CLAIM DAILY REWARD
  const handleDailyReward = async () => {
    if (!user) return;
    setLoadingReward(true);

    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
        setTransactions(
          [res.data.txn, ...transactions].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          )
        );
        alert("🎉 Daily reward claimed!");
      } else if (res.data.error?.toLowerCase().includes("already claimed")) {
        alert("✅ You already claimed today's reward!");
      } else {
        alert(res.data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // FORMATTERS
  const formatMonth = (date) =>
    date.toLocaleString("en-US", { month: "long", year: "numeric" });

  const formatDate = (d) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // FILTER TRANSACTIONS BY MONTH
  const filteredTransactions = transactions.filter((t) => {
    const d = new Date(t.createdAt || t.date);
    return (
      d.getMonth() === selectedMonth.getMonth() &&
      d.getFullYear() === selectedMonth.getFullYear()
    );
  });

  // UNIQUE MONTHS
  const activeMonths = Array.from(
    new Set(
      transactions.map((t) => {
        const d = new Date(t.createdAt || t.date);
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      })
    )
  ).map((s) => new Date(s));

  // CLOSE MONTH PICKER ON OUTSIDE CLICK
  useEffect(() => {
    const handleClick = (e) => {
      if (showMonthPicker && modalRef.current && !modalRef.current.contains(e.target)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMonthPicker]);

  // DAILY REWARD CHECK
  const todayStr = new Date().toISOString().split("T")[0];
  const claimedToday = transactions.some(
    (tx) =>
      tx.type === "checkin" &&
      new Date(tx.createdAt).toISOString().split("T")[0] === todayStr
  );

  // UPDATE MONTH ON SCROLL
  const handleScroll = () => {
    const scrollTop = scrollRef.current.scrollTop;
    const items = Array.from(scrollRef.current.children);
    for (let i = 0; i < items.length; i++) {
      if (items[i].offsetTop - scrollTop >= 0) {
        const tx = filteredTransactions[i];
        if (tx) setSelectedMonth(new Date(tx.createdAt || tx.date));
        break;
      }
    }
  };

  return (
    <div
      style={{
        ...styles.page,
        backgroundColor: theme === "dark" ? "#000" : "#eef6ff",
        color: theme === "dark" ? "#fff" : "#000",
      }}
    >
      <button onClick={() => navigate("/settings")} style={styles.backBtn}>
        ←
      </button>
      <h2 style={styles.title}>Wallet</h2>

      {/* Wallet Card */}
      <div
        style={{
          ...styles.walletCard,
          backgroundColor: theme === "dark" ? "#111" : "#fff",
        }}
      >
        <p style={styles.balanceLabel}>Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>

        <div style={styles.actionRow}>
          <button style={styles.roundBtn} onClick={() => navigate("/topup")}>
            Top-Up
          </button>
          <button style={styles.roundBtn} onClick={() => navigate("/withdraw")}>
            Withdraw
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            style={{
              ...styles.roundBtn,
              background: claimedToday ? "#ccc" : "#ffd700",
            }}
            onClick={handleDailyReward}
            disabled={claimedToday || loadingReward}
          >
            {claimedToday
              ? "✅ Claimed Today"
              : loadingReward
              ? "Processing..."
              : "Daily Reward"}
          </button>
        </div>

        {/* Month-Year */}
        <div style={styles.monthHeader}>
          <span style={styles.monthText}>{formatMonth(selectedMonth)}</span>
          <button
            style={styles.monthArrow}
            onClick={() => setShowMonthPicker(!showMonthPicker)}
          >
            ▼
          </button>
        </div>

        {showMonthPicker && (
          <div style={styles.monthPicker} ref={modalRef}>
            {activeMonths.map((d, i) => (
              <div
                key={i}
                style={styles.monthItem}
                onClick={() => {
                  setSelectedMonth(d);
                  setShowMonthPicker(false);
                }}
              >
                {formatMonth(d)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div
        style={{
          ...styles.list,
          backgroundColor: theme === "dark" ? "#111" : "#fff",
        }}
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {filteredTransactions.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.5, marginTop: 10 }}>
            No transactions this month.
          </p>
        ) : (
          filteredTransactions.map((tx) => (
            <div
              key={tx._id}
              style={{
                ...styles.txRowCompact,
                backgroundColor: theme === "dark" ? "#222" : "#fff",
              }}
              onClick={() => setDetails(tx)}
            >
              <div style={styles.txLeftCompact}>
                <p style={styles.txTypeCompact}>{tx.type}</p>
                <span style={styles.txDateCompact}>
                  {formatDate(tx.createdAt || tx.date)}
                </span>
              </div>
              <div style={styles.txRightCompact}>
                <span
                  style={{
                    ...styles.amount,
                    color: tx.amount >= 0 ? "#2ecc71" : "#e74c3c",
                  }}
                >
                  {tx.amount >= 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transaction Details Modal */}
      {details && (
        <div style={styles.modalOverlay}>
          <div
            style={{
              ...styles.modal,
              backgroundColor: theme === "dark" ? "#111" : "#fff",
            }}
            ref={modalRef}
          >
            <h3 style={{ marginBottom: 10 }}>Transaction Details</h3>
            <p>
              <b>Type:</b> {details.type}
            </p>
            <p>
              <b>Amount:</b> ${details.amount.toFixed(2)}
            </p>
            <p>
              <b>Date:</b> {formatDate(details.createdAt || details.date)}
            </p>
            <p>
              <b>Status:</b> {details.status}
            </p>
            <p>
              <b>Transaction ID:</b> {details._id}
            </p>
            <button style={styles.closeBtn} onClick={() => setDetails(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= STYLES =================
const styles = {
  page: { minHeight: "100vh", padding: 25 },
  backBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    padding: "10px 14px",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
  },
  title: { marginTop: 20, textAlign: "center", fontSize: 26 },
  walletCard: {
    padding: 20,
    borderRadius: 18,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    marginTop: 20,
    textAlign: "center",
  },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "10px 0" },
  actionRow: { display: "flex", justifyContent: "center", gap: 15, marginTop: 15 },
  roundBtn: {
    padding: "12px 20px",
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
    backgroundColor: "transparent",
    padding: "5px 0",
    position: "sticky",
    top: 0,
    zIndex: 5,
  },
  monthText: { fontSize: 18, fontWeight: "bold" },
  monthArrow: {
    border: "none",
    padding: "5px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  monthPicker: {
    background: "#fff",
    borderRadius: 14,
    padding: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    position: "absolute",
    top: 80,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 10,
  },
  monthItem: { padding: 10, borderRadius: 10, cursor: "pointer" },
  list: {
    marginTop: 10,
    maxHeight: "50vh",
    overflowY: "auto",
    borderRadius: 14,
    padding: 10,
  },
  txRowCompact: {
    padding: "10px 12px",
    borderRadius: 10,
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  },
  txLeftCompact: {},
  txTypeCompact: { fontSize: 14, fontWeight: 600 },
  txDateCompact: { fontSize: 12, opacity: 0.6 },
  txRightCompact: { textAlign: "right" },
  amount: { fontWeight: 600 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    padding: 25,
    borderRadius: 18,
    width: "85%",
    maxWidth: 380,
    boxShadow: "0 5px 18px rgba(0,0,0,0.15)",
  },
  closeBtn: {
    marginTop: 15,
    padding: "10px 15px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: "#3498db",
  },
};