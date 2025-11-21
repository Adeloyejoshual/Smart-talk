// src/components/WithdrawPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import axios from "axios";

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef();
  const navigate = useNavigate();
  const { balance, addTransaction, loadWallet } = useWallet();

  const backend = "https://smart-talk-dqit.onrender.com";

  // AUTH + LOAD WALLET
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        await loadWallet(u.uid);
      } else navigate("/");
    });
    return unsub;
  }, []);

  // TASK REWARD
  const performTask = async (amount) => {
    if (!user) return;
    setTasksLoading(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const res = await axios.post(
        `${backend}/api/wallet/daily`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add to context
      addTransaction(res.data.txn);
    } catch (err) {
      console.error(err);
      alert("Failed to update balance. Try again.");
    } finally {
      setTasksLoading(false);
    }
  };

  const handleWatchVideo = () => {
    window.open("https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw");
    performTask(0.2);
  };

  const handleFollowInstagram = () => {
    window.open("https://www.instagram.com/hahahala53");
    performTask(0.15);
  };

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
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [modalOpen]);

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/wallet")} style={styles.backBtn}>←</button>
      <h2 style={styles.title}>💵 Withdraw Funds</h2>

      <div style={styles.walletCard}>
        <p style={styles.balanceLabel}>Your Balance</p>
        <h1 style={styles.balanceAmount}>${balance.toFixed(2)}</h1>
      </div>

      <div style={styles.centerContent}>
        <button style={styles.taskBtn} onClick={handleWatchVideo} disabled={tasksLoading}>
          🎥 Watch a video → +$0.20
        </button>
        <button style={styles.taskBtn} onClick={handleFollowInstagram} disabled={tasksLoading}>
          📱 Follow us on Instagram → +$0.15
        </button>
        <button style={styles.taskBtn} onClick={handleInviteFriend}>
          👥 Invite a friend → +$0.25 per join
        </button>

        <button style={styles.withdrawBtn} onClick={() => setModalOpen(true)}>
          🚧 Withdraw
        </button>
      </div>

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
    </div>
  );
}

// Styles remain unchanged (same as your original code)