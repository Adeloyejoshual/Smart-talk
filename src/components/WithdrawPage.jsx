// src/components/WithdrawPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef();
  const navigate = useNavigate();

  // AUTH + LOAD BALANCE
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
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;
      const data = snap.data();
      setBalance(data.balance || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // TASK REWARD + TRANSACTION
  const performTask = async (type, amount) => {
    if (!user) return;
    setTasksLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;

      const currentBalance = snap.data().balance || 0;
      const newBalance = currentBalance + amount;

      // Update balance
      await updateDoc(userRef, { balance: newBalance });

      // Add transaction
      const txRef = collection(db, "transactions");
      await addDoc(txRef, {
        uid: user.uid,
        type,
        amount,
        status: "success",
        description: `${type} task reward`,
        createdAt: serverTimestamp(),
      });

      setBalance(newBalance);
      alert(`🎉 Task completed! +$${amount}`);
    } catch (err) {
      console.error(err);
      alert("Failed to update balance. Try again.");
    } finally {
      setTasksLoading(false);
    }
  };

  const handleWatchVideo = () => performTask("watch_video", 0.2);
  const handleFollowInstagram = () => performTask("follow_instagram", 0.15);
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

      {/* Modal */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            <h3 style={{ marginBottom: 15 }}>🚧 Coming Soon</h3>
            <p style={{ marginBottom: 20 }}>
              Withdraw is not yet available. Keep completing tasks to earn more credits!
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

// =======================
// STYLES
// =======================
const styles = {
  page: {
    background: "#eef6ff",
    minHeight: "100vh",
    padding: 25,
    color: "#000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
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
  title: { marginTop: 20, textAlign: "center", fontSize: 26 },
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
  balanceAmount: { fontSize: 36, margin: "10px 0" },
  centerContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "12vh",
    width: "100%",
    maxWidth: 380,
    gap: 12,
  },
  taskBtn: {
    padding: "12px 20px",
    background: "#b3dcff",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    width: "90%",
    textAlign: "center",
    fontSize: 16,
  },
  withdrawBtn: {
    padding: "14px 20px",
    background: "#f39c12",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    color: "#fff",
    fontWeight: "bold",
    width: "90%",
    marginTop: 10,
    fontSize: 16,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
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
    fontSize: 14,
  },
};