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
  const [searchInput, setSearchInput] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [details, setDetails] = useState(null);
  const [loadingReward, setLoadingReward] = useState(false);
  const scrollRef = useRef();
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

  // DAILY REWARD
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
          (res.data.transactions || transactions).sort(
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

  // UNIQUE MONTHS FOR SUGGESTIONS
  const uniqueMonths = Array.from(
    new Set(
      transactions.map((t) => {
        const d = new Date(t.createdAt || t.date);
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      })
    )
  ).map((s) => new Date(s));

  // FILTER TRANSACTIONS
  const filteredTransactions = transactions.filter((t) => {
    const d = new Date(t.createdAt || t.date);
    const matchesMonth =
      d.getMonth() === selectedMonth.getMonth() &&
      d.getFullYear() === selectedMonth.getFullYear();
    const searchMatch = searchInput
      ? formatMonth(d).toLowerCase().includes(searchInput.toLowerCase())
      : true;
    return matchesMonth && searchMatch;
  });

  // UPDATE SUGGESTIONS AS USER TYPES
  useEffect(() => {
    if (!searchInput) return setSearchSuggestions([]);
    const suggestions = uniqueMonths
      .map((d) => formatMonth(d))
      .filter((m) => m.toLowerCase().includes(searchInput.toLowerCase()));
    setSearchSuggestions(suggestions);
  }, [searchInput]);

  // SCROLL HANDLER
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
      <button
        onClick={() => navigate("/settings")}
        style={{
          ...styles.backBtn,
          background: theme === "dark" ? "#333" : "#dce9ff",
          color: theme === "dark" ? "#fff" : "#000",
        }}
      >
        ←
      </button>

      <h2 style={styles.title}>Wallet</h2>

      <div
        style={{
          ...styles.walletCard,
          background: theme === "dark" ? "#1f1f1f" : "#fff",
          color: theme === "dark" ? "#fff" : "#000",
        }}
      >
        <p style={styles.balanceLabel}>Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>

        <div style={styles.actionRow}>
          <button
            style={{
              ...styles.roundBtn,
              background: theme === "dark"
                ? "linear-gradient(90deg, #4e54c8, #8f94fb)"
                : "#b3dcff",
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
                ? "linear-gradient(90deg, #ff512f, #dd2476)"
                : "#b3dcff",
              color: "#fff",
            }}
            onClick={() => navigate("/withdraw")}
          >
            Withdraw
          </button>

          <button
            style={{
              ...styles.roundBtn,
              background: loadingReward
                ? "#888"
                : theme === "dark"
                ? "linear-gradient(90deg, #ffd700, #ffbf00)"
                : "#ffd700",
              color: "#000",
            }}
            onClick={handleDailyReward}
            disabled={loadingReward}
          >
            {loadingReward ? "Processing..." : "Daily Reward"}
          </button>
        </div>
      </div>

      {/* Sticky Month Header */}
      <div
        style={{
          ...styles.monthHeader,
          background: theme === "dark" ? "#121212" : "#eef6ff",
          color: theme === "dark" ? "#fff" : "#000",
        }}
      >
        <span style={styles.monthText}>{formatMonth(selectedMonth)}</span>
      </div>

      {/* Month/Year Search with Suggestions */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          placeholder="Search month/year..."
          style={{
            ...styles.searchInput,
            background: theme === "dark" ? "#1f1f1f" : "#fff",
            color: theme === "dark" ? "#fff" : "#000",
            border: theme === "dark" ? "1px solid #444" : "1px solid #ccc",
          }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        {searchSuggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: theme === "dark" ? "#1f1f1f" : "#fff",
              border: theme === "dark" ? "1px solid #444" : "1px solid #ccc",
              borderRadius: 8,
              zIndex: 10,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {searchSuggestions.map((s, idx) => (
              <div
                key={idx}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: idx !== searchSuggestions.length - 1 ? "1px solid #8882" : "none",
                }}
                onClick={() => {
                  const matched = uniqueMonths.find((d) => formatMonth(d) === s);
                  if (matched) setSelectedMonth(matched);
                  setSearchInput("");
                  setSearchSuggestions([]);
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Transactions */}
      <div
        style={{
          ...styles.list,
          background: theme === "dark" ? "#1a1a1a" : "#f5faff",
        }}
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {filteredTransactions.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.5, marginTop: 10 }}>
            No transactions for this month/search.
          </p>
        ) : (
          filteredTransactions.map((tx) => (
            <div
              key={tx._id}
              style={{
                ...styles.txRowCompact,
                background: theme === "dark" ? "#2a2a2a" : "#fff",
                color: theme === "dark" ? "#fff" : "#000",
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
                    color:
                      tx.amount >= 0
                        ? theme === "dark"
                          ? "#2ecc71"
                          : "#2ecc71"
                        : "#e74c3c",
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
              background: theme === "dark" ? "#1f1f1f" : "#fff",
              color: theme === "dark" ? "#fff" : "#000",
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
            <button
              style={{
                ...styles.closeBtn,
                background: theme === "dark" ? "#4e54c8" : "#3498db",
              }}
              onClick={() => setDetails(null)}
            >
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
    position: "sticky",
    top: 0,
    padding: "10px 0",
    zIndex: 5,
    fontWeight: "bold",
    fontSize: 18,
  },
  monthText: {},
  searchInput: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
    outline: "none",
    fontSize: 14,
  },
  list: {
    marginTop: 10,
    maxHeight: "50vh",
    overflowY: "auto",
    borderRadius: 14,
    padding: 5,
  },
  txRowCompact: {
    padding: "10px 12px",
    borderRadius: 10,
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
    cursor: "pointer",
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
  modal: { padding: 25, borderRadius: 18, width: "85%", maxWidth: 380 },
  closeBtn: {
    marginTop: 15,
    padding: "10px 15px",
    borderRadius: 10,
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
};