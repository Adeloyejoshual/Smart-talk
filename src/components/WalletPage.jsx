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
  const [claimedToday, setClaimedToday] = useState(false);
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

  // FETCH WALLET + TRANSACTIONS FROM BACKEND
  const loadWallet = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setBalance(res.data.balance || 0);
      setTransactions(res.data.transactions || []);

      // Check if daily reward already claimed
      const today = new Date().toISOString().split("T")[0];
      const hasClaimed = res.data.transactions.some(
        (t) =>
          t.type === "checkin" &&
          new Date(t.createdAt).toISOString().split("T")[0] === today
      );
      setClaimedToday(hasClaimed);

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

  // CLAIM DAILY REWARD VIA BACKEND
  const handleDailyReward = async () => {
    if (!user || claimedToday) return;
    setLoadingReward(true);

    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        { amount: 0.25 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
        setTransactions(
          [res.data.txn, ...transactions].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          )
        );
        setClaimedToday(true);

        // Animate daily reward claim
        const rewardEl = document.createElement("div");
        rewardEl.innerText = "+$0.25 Daily Reward!";
        rewardEl.style.position = "fixed";
        rewardEl.style.top = "50%";
        rewardEl.style.left = "50%";
        rewardEl.style.transform = "translate(-50%, -50%)";
        rewardEl.style.padding = "20px 30px";
        rewardEl.style.background = "#ffd700";
        rewardEl.style.color = "#000";
        rewardEl.style.fontSize = "20px";
        rewardEl.style.borderRadius = "12px";
        rewardEl.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
        rewardEl.style.zIndex = 9999;
        rewardEl.style.opacity = 0;
        rewardEl.style.transition = "all 0.8s ease-out";
        document.body.appendChild(rewardEl);

        setTimeout(() => {
          rewardEl.style.opacity = 1;
          rewardEl.style.transform = "translate(-50%, -80%)";
        }, 100);
        setTimeout(() => {
          rewardEl.style.opacity = 0;
          rewardEl.style.transform = "translate(-50%, -120%)";
        }, 1200);
        setTimeout(() => document.body.removeChild(rewardEl), 2000);
      } else if (res.data.error?.toLowerCase().includes("already claimed")) {
        setClaimedToday(true);
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

  // UNIQUE MONTHS FOR PICKER
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

  // UPDATE MONTH HEADER ON SCROLL
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
        background: theme === "dark" ? "#121212" : "#eef6ff",
        color: theme === "dark" ? "#fff" : "#000",
      }}
    >
      <button onClick={() => navigate("/settings")} style={styles.backBtn}>
        ←
      </button>
      <h2 style={styles.title}>Wallet</h2>

      <div style={styles.walletCard}>
        <p style={styles.balanceLabel}>Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>

        <div style={styles.actionRow}>
          <button
            style={{
              ...styles.roundBtn,
              background: theme === "dark"
                ? "linear-gradient(135deg,#6b73ff,#000dff)"
                : "linear-gradient(135deg,#56ccf2,#2f80ed)",
              color: "#fff",
            }}
            onClick={() => navigate("/topup")}
          >
            Top-Up
          </button>
          <button
            style={{
              ...styles.roundBtn,
              background: theme === "dark"
                ? "linear-gradient(135deg,#ff416c,#ff4b2b)"
                : "linear-gradient(135deg,#ff7e5f,#feb47b)",
              color: "#fff",
            }}
            onClick={() => navigate("/withdraw")}
          >
            Withdraw
          </button>
        </div>

        <div style={{ marginTop: 15 }}>
          <button
            style={{
              ...styles.roundBtn,
              width: "100%",
              background: claimedToday
                ? "#ccc"
                : "linear-gradient(135deg,#fbd72b,#ffd700)",
              color: claimedToday ? "#555" : "#000",
            }}
            onClick={handleDailyReward}
            disabled={loadingReward || claimedToday}
          >
            {loadingReward
              ? "Processing..."
              : claimedToday
              ? "Already Claimed"
              : "Daily Reward"}
          </button>
        </div>
      </div>

      {/* Month/Year Header */}
      <div style={styles.monthHeaderSticky}>{formatMonth(selectedMonth)}</div>

      {/* Scrollable transactions */}
      <div
        style={styles.list}
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
              style={styles.txRowCompact}
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
          <div style={styles.modal} ref={modalRef}>
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
    background: "#fff",
    padding: 20,
    borderRadius: 18,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    marginTop: 20,
    textAlign: "center",
  },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "10px 0" },
  actionRow: { display: "flex", justifyContent: "center", gap: 15 },
  roundBtn: {
    padding: "12px 20px",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "all 0.3s",
  },
  monthHeaderSticky: {
    position: "sticky",
    top: 15,
    fontSize: 20,
    fontWeight: "bold",
    background: "transparent",
    textAlign: "center",
    marginTop: 25,
    zIndex: 2,
  },
  list: { marginTop: 10, maxHeight: "50vh", overflowY: "auto" },
  txRowCompact: {
    background: "#fff",
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