// src/components/WithdrawPage.jsx
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { auth } from "../firebaseConfig";

export default function WithdrawPage() {
  const navigate = useNavigate();
  const { balance, addCredits } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef();

  const handleWatchVideo = () => {
    window.open("https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw", "_blank");
    addCredits(0.2);
  };

  const handleFollowInstagram = () => {
    window.open("https://www.instagram.com/hahahala53", "_blank");
    addCredits(0.15);
  };

  const handleInviteFriend = () => {
    navigator.clipboard.writeText(`https://yourapp.com/signup?ref=${auth.currentUser.uid}`);
    alert("Referral link copied!");
    addCredits(0.25);
  };

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/wallet")} style={styles.backBtn}>←</button>

      <h2 style={styles.title}>💵 Withdraw Funds</h2>

      {/* Balance Card */}
      <div style={styles.card}>
        <p style={styles.label}>Your Balance</p>
        <h1 style={styles.amount}>${balance.toFixed(2)}</h1>
      </div>

      {/* Centered interactive area */}
      <div style={styles.centerBox}>
        <button style={styles.taskBtn} onClick={handleWatchVideo}>
          🎥 Watch a video → +$0.20
        </button>
        <button style={styles.taskBtn} onClick={handleFollowInstagram}>
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
        <div style={styles.overlay}>
          <div style={styles.modal} ref={modalRef}>
            <h3>🚧 Coming Soon</h3>
            <p>Withdraw is not yet available.  
            Continue chatting and earning more credits!</p>

            <button style={styles.closeBtn} onClick={() => setModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    background: "#eef6ff",
    minHeight: "100vh",
    padding: 25,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  backBtn: {
    position: "absolute",
    left: 20,
    top: 20,
    background: "#dce9ff",
    padding: 10,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
  },
  title: { marginTop: 40, fontSize: 26 },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 18,
    width: "90%",
    maxWidth: 380,
    textAlign: "center",
    marginTop: 20,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  label: { opacity: 0.6 },
  amount: { fontSize: 36, marginTop: 5 },
  centerBox: {
    marginTop: 40,
    display: "flex",
    flexDirection: "column",
    gap: 15,
    width: "100%",
    alignItems: "center",
  },
  taskBtn: {
    width: "90%",
    maxWidth: 330,
    background: "#b3dcff",
    border: "none",
    padding: "12px 20px",
    borderRadius: 30,
    fontWeight: "bold",
    cursor: "pointer",
  },
  withdrawBtn: {
    width: "90%",
    maxWidth: 330,
    background: "#f39c12",
    border: "none",
    padding: "14px 20px",
    borderRadius: 30,
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 10,
  },
  overlay: {
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
    maxWidth: 360,
    textAlign: "center",
  },
  closeBtn: {
    marginTop: 15,
    padding: "10px 15px",
    background: "#3498db",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },
};