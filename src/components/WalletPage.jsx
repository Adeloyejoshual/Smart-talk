// src/components/WalletPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import confetti from "canvas-confetti";
import { useAd } from "./AdGateway"; // <-- hook to trigger ads

// Animated balance hook
function useAnimatedNumber(target, duration = 800) {
  const [display, setDisplay] = useState(target);
  const raf = useRef();

  useEffect(() => {
    const start = display;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      setDisplay(start + diff * progress);
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };

    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return display;
}

export default function WalletPage() {
  const { theme } = useContext(ThemeContext);
  const { showPopup, hidePopup } = usePopup();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const animatedBalance = useAnimatedNumber(balance);
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loadingReward, setLoadingReward] = useState(false);
  const [flashReward, setFlashReward] = useState(false);
  const navigate = useNavigate();
  const { showRewardAd } = useAd(); // hook to trigger ads

  const backend = "https://smart-talk-zlxe.onrender.com";

  // ---------------- AUTH + LOAD WALLET ----------------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        loadWallet(u.uid);
      } else navigate("/");
    });
    return unsub;
  }, []);

  const getToken = async () => auth.currentUser.getIdToken(true);

  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      } else {
        showPopup(data.error || "Failed to load wallet.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to load wallet. Check console.");
    }
  };

  // ---------------- DAILY REWARD ----------------
  const handleDailyReward = async () => {
    if (!user || loadingReward) return;
    setLoadingReward(true);

    try {
      // Show Rewarded Ad first
      const adSuccess = await showRewardAd(); // resolves true when ad completes
      if (!adSuccess) {
        showPopup("Ad was skipped or failed. Reward not credited.");
        setLoadingReward(false);
        return;
      }

      // After ad completes, claim daily reward
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 0.25 }),
      });
      const data = await res.json();

      if (res.ok) {
        setBalance(data.balance);
        setTransactions((prev) => [data.txn, ...prev]);
        showPopup("🎉 Daily reward claimed!");

        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 },
          colors: ["#ffd700", "#ff9800", "#00e676", "#007bff"],
        });

        setFlashReward(true);
        setTimeout(() => setFlashReward(false), 600);
      } else if (data.error?.toLowerCase().includes("already claimed")) {
        showPopup("✅ You already claimed today's reward!");
      } else {
        showPopup(data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ---------------- HELPERS ----------------
  const formatDate = (d) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const filteredTransactions = transactions.filter((t) => {
    const d = new Date(t.createdAt || t.date);
    return (
      d.getMonth() === selectedMonth.getMonth() &&
      d.getFullYear() === selectedMonth.getFullYear()
    );
  });

  const alreadyClaimed = transactions.some((t) => {
    if (t.type !== "checkin") return false;
    const txDate = new Date(t.createdAt || t.date);
    const today = new Date();
    return (
      txDate.getFullYear() === today.getFullYear() &&
      txDate.getMonth() === today.getMonth() &&
      txDate.getDate() === today.getDate()
    );
  });

  const prevMonth = () =>
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1)
    );
  const nextMonth = () =>
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1)
    );

  return (
    <div
      style={{
        ...styles.page,
        backgroundColor: theme === "dark" ? "#111" : "#eef6ff",
        color: theme === "dark" ? "#fff" : "#000",
      }}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/settings")}
        style={{
          ...styles.backBtn,
          backgroundColor: theme === "dark" ? "#333" : "#dce9ff",
          color: theme === "dark" ? "#fff" : "#000",
        }}
      >
        ←
      </button>

      <h2 style={styles.title}>Wallet</h2>

      {/* Wallet Card */}
      <div
        style={{
          ...styles.walletCard,
          backgroundColor: theme === "dark" ? "#1a1a1a" : "#fff",
        }}
      >
        <p style={styles.balanceLabel}>Balance</p>
        <h1 style={styles.balanceAmount}>${animatedBalance.toFixed(2)}</h1>

        <div style={styles.actionRow}>
          <button
            style={{
              ...styles.roundBtn,
              background: theme === "dark" ? "#3b82f6" : "#34d399",
            }}
            onClick={() => navigate("/topup")}
          >
            Top-Up
          </button>
          <button
            style={{
              ...styles.roundBtn,
              background: theme === "dark" ? "#f97316" : "#f59e0b",
            }}
            onClick={() => navigate("/withdraw")}
          >
            Withdraw
          </button>
        </div>

        {/* Daily Reward */}
        <div style={{ marginTop: 15 }}>
          <button
            style={{
              ...styles.roundBtn,
              background: flashReward
                ? "#ffd700"
                : alreadyClaimed
                ? "#555"
                : "#ffd700",
              cursor: alreadyClaimed ? "not-allowed" : "pointer",
              boxShadow: flashReward
                ? "0 0 15px 5px #ffd700"
                : "0 4px 8px rgba(255,215,0,0.3)",
              transition: "all 0.3s",
            }}
            disabled={alreadyClaimed || loadingReward}
            onClick={handleDailyReward}
          >
            {loadingReward
              ? "Processing..."
              : alreadyClaimed
              ? "Already Claimed"
              : "🧩 Daily Reward (+$0.25)"}
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div style={styles.monthSelector}>
        <button onClick={prevMonth}>◀</button>
        <span style={{ fontWeight: "bold" }}>
          {selectedMonth.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button onClick={nextMonth}>▶</button>
        <button
          onClick={() => setSelectedMonth(new Date())}
          style={{
            marginLeft: 10,
            padding: "4px 10px",
            borderRadius: 6,
            border: "none",
            backgroundColor: theme === "dark" ? "#3b82f6" : "#34d399",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Today
        </button>
      </div>

      {/* Transactions List */}
      <div style={styles.list}>
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
              onClick={() =>
                showPopup(
                  <div>
                    <h3 style={{ marginBottom: 10 }}>Transaction Details</h3>
                    <p>
                      <b>Type:</b> {tx.type}
                    </p>
                    <p>
                      <b>Amount:</b> ${tx.amount.toFixed(2)}
                    </p>
                    <p>
                      <b>Date:</b> {formatDate(tx.createdAt || tx.date)}
                    </p>
                    <p>
                      <b>Status:</b> {tx.status}
                    </p>
                    <p>
                      <b>Transaction ID:</b> {tx._id}
                    </p>
                    <button
                      onClick={hidePopup}
                      style={{
                        marginTop: 10,
                        padding: 6,
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>,
                  { autoHide: false }
                )
              }
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
    </div>
  );
}

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
  walletCard: { padding: 20, borderRadius: 18, marginTop: 20, textAlign: "center", position: "relative" },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "10px 0" },
  actionRow: { display: "flex", justifyContent: "center", gap: 15, marginTop: 15 },
  roundBtn: { padding: "12px 20px", borderRadius: 30, border: "none", fontWeight: "bold", color: "#fff" },
  monthSelector: { display: "flex", justifyContent: "center", alignItems: "center", gap: 15, marginTop: 20, marginBottom: 10 },
  list: { marginTop: 10, maxHeight: "60vh", overflowY: "auto" },
  txRowCompact: { padding: "10px 12px", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" },
  txLeftCompact: {},
  txTypeCompact: { fontSize: 14, fontWeight: 600 },
  txDateCompact: { fontSize: 12, opacity: 0.6 },
  txRightCompact: { textAlign: "right" },
  amount: { fontWeight: 600 },
};