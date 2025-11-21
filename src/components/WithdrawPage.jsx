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
  const modalRef = useRef();
  const navigate = useNavigate();

  const backend = "https://smart-talk-dqit.onrender.com";

  // AUTH & LOAD BALANCE
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        loadBalance(u.uid);
      } else navigate("/");
    });
    return unsub;
  }, []);

  const loadBalance = async (uid) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.get(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(res.data.balance || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // TASKS
  const updateBalance = async (amount) => {
    if (!user) return;
    setTasksLoading(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `${backend}/api/wallet/daily`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadBalance(user.uid);
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleWatchVideo = () => {
    window.open(
      "https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw",
      "_blank"
    );
    updateBalance(0.25);
  };

  const handleFollowInstagram = () => {
    window.open("https://www.instagram.com/hahahala53", "_blank");
    updateBalance(0.5);
  };

  const handleInviteFriend = () => {
    navigator.clipboard.writeText(`https://yourapp.com/signup?ref=${user.uid}`);
    alert("🔗 Referral link copied! Share with friends.");
  };

  // CLOSE MODAL WHEN CLICK OUTSIDE
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalOpen && modalRef.current && !modalRef.current.contains(e.target)) {
        setModalOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modalOpen]);

  return (
    <div style={styles.page}>
      {/* Back Button */}
      <button onClick={() => navigate("/wallet")} style={styles.backBtn}>←</button>
      <h2 style={styles.title}>💵 Withdraw Funds</h2>

      {/* Balance Card */}
      <div style={styles.walletCard}>
        <p style={styles.balanceLabel}>Your Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>
      </div>

      {/* Task Buttons */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <button style={styles.taskBtn} onClick={handleWatchVideo} disabled={tasksLoading}>
          🎥 Watch a video → +$0.25
        </button>
        <button style={styles.taskBtn} onClick={handleFollowInstagram} disabled={tasksLoading}>
          📱 Follow us on Instagram → +$0.50
        </button>
        <button style={styles.taskBtn} onClick={handleInviteFriend}>
          👥 Invite a friend → +$0.50 per join
        </button>
      </div>

      {/* Withdraw Button at Bottom */}
      <button
        style={{ ...styles.roundBtn, background: "#f39c12", marginTop: "auto", width: "90%", maxWidth: 360 }}
        onClick={() => setModalOpen(true)}
      >
        🚧 Withdraw
      </button>

      {/* Modal */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            <h3 style={{ marginBottom: 15 }}>🚧 Coming Soon</h3>
            <p style={{ marginBottom: 20 }}>
              Withdraw is not yet available. Continue using the app to chat and earn more credits!
            </p>
            <button style={styles.closeBtn} onClick={() => setModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================
// STYLES
// ======================================================
const styles = {
  page: {
    background: "#eef6ff",
    minHeight: "100vh",
    padding: 25,
    color: "#000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
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
    padding: 20,
    borderRadius: 18,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    marginTop: 20,
    textAlign: "center",
    width: "90%",
    maxWidth: 380,
  },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "5px 0" },
  roundBtn: {
    padding: "14px 20px",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
  },
  taskBtn: {
    padding: "12px 20px",
    background: "#b3dcff",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    width: "90%",
    maxWidth: 320,
    textAlign: "center",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  modal: {
    background: "#fff",
    padding: 25,
    borderRadius: 18,
    width: "85%",
    maxWidth: 360,
    textAlign: "center",
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