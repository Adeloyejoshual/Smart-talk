// src/components/WithdrawPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);
  const modalRef = useRef();
  const navigate = useNavigate();

  // AUTH
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else navigate("/");
    });
    return unsub;
  }, []);

  // MARK TASK AS COMPLETED
  const completeTask = (taskId) => {
    if (!completedTasks.includes(taskId)) {
      setCompletedTasks((prev) => [...prev, taskId]);
    }
  };

  // TASK HANDLERS
  const handleWatchVideo = () => {
    window.open("https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw");
    completeTask("watchVideo");
  };

  const handleFollowInstagram = () => {
    window.open("https://www.instagram.com/hahahala53");
    completeTask("followInstagram");
  };

  const handleInviteFriend = () => {
    if (user) {
      navigator.clipboard.writeText(`https://yourapp.com/signup?ref=${user.uid}`);
      alert("🔗 Referral link copied!");
      completeTask("inviteFriend");
    }
  };

  return (
    <div style={styles.page}>
      {/* Back Button */}
      <button onClick={() => navigate("/wallet")} style={styles.backBtn}>←</button>

      {/* Title */}
      <h2 style={styles.title}>💵 Withdraw Funds</h2>

      {/* Center Content */}
      <div style={styles.centerContent}>
        <button
          style={{
            ...styles.taskBtn,
            background: completedTasks.includes("watchVideo") ? "#ccc" : "#b3dcff",
            cursor: completedTasks.includes("watchVideo") ? "not-allowed" : "pointer",
          }}
          onClick={handleWatchVideo}
          disabled={completedTasks.includes("watchVideo")}
        >
          🎥 Watch a video {completedTasks.includes("watchVideo") && "✅"}
        </button>

        <button
          style={{
            ...styles.taskBtn,
            background: completedTasks.includes("followInstagram") ? "#ccc" : "#b3dcff",
            cursor: completedTasks.includes("followInstagram") ? "not-allowed" : "pointer",
          }}
          onClick={handleFollowInstagram}
          disabled={completedTasks.includes("followInstagram")}
        >
          📱 Follow us on Instagram {completedTasks.includes("followInstagram") && "✅"}
        </button>

        <button
          style={{
            ...styles.taskBtn,
            background: completedTasks.includes("inviteFriend") ? "#ccc" : "#b3dcff",
            cursor: completedTasks.includes("inviteFriend") ? "not-allowed" : "pointer",
          }}
          onClick={handleInviteFriend}
          disabled={completedTasks.includes("inviteFriend")}
        >
          👥 Invite a friend {completedTasks.includes("inviteFriend") && "✅"}
        </button>

        <button
          style={styles.withdrawBtn}
          onClick={() => setModalOpen(true)}
        >
          🚧 Withdraw
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            <h3 style={{ marginBottom: 15 }}>🚧 Withdraw Locked</h3>
            <p style={{ marginBottom: 20 }}>
              Complete tasks, chat, and make calls to stay active and unlock withdrawals.
            </p>
            <button style={styles.closeBtn} onClick={() => setModalOpen(false)}>
              OK
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
  title: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 26,
  },
  centerContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "15vh",
    width: "100%",
    maxWidth: 380,
    gap: 12,
  },
  taskBtn: {
    padding: "12px 20px",
    borderRadius: 30,
    border: "none",
    fontWeight: "bold",
    width: "90%",
    textAlign: "center",
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
  },
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