// src/components/WithdrawPage.jsx
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        setUser(userAuth);
        const userRef = doc(db, "users", userAuth.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          setCredits(docSnap.data().credits || 0);
        } else {
          await setDoc(userRef, { credits: 5 }); // new user bonus
          setCredits(5);
        }
      } else navigate("/");
    });
    return () => unsub();
  }, [navigate]);

  // TASK REWARDS
  const updateCredits = async (amount) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const newCredits = credits + amount;
    await updateDoc(userRef, { credits: newCredits });
    setCredits(newCredits);
  };

  const handleWatchVideo = () => {
    window.open(
      "https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw",
      "_blank"
    );
    updateCredits(0.25);
  };

  const handleFollowInstagram = () => {
    window.open("https://www.instagram.com/hahahala53", "_blank");
    updateCredits(0.5);
  };

  const handleInviteFriend = () => {
    navigator.clipboard.writeText(`https://yourapp.com/signup?ref=${user.uid}`);
    alert("🔗 Referral link copied! Share with friends.");
  };

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/wallet")} style={styles.backBtn}>←</button>
      <h2 style={styles.title}>💵 Withdraw Funds</h2>

      {/* Balance Card */}
      <div style={styles.walletCard}>
        <p style={styles.balanceLabel}>Your Balance</p>
        <h1 style={styles.balanceAmount}>${credits.toFixed(2)}</h1>

        <button
          disabled
          style={{ ...styles.roundBtn, background: "#888", cursor: "not-allowed" }}
        >
          🚧 Withdraw (Coming Soon)
        </button>
      </div>

      {/* Earn More Section */}
      <h3 style={{ marginTop: 20, marginBottom: 10, textAlign: "center" }}>
        🎯 Complete Tasks to Earn Credits
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <button style={styles.taskBtn} onClick={handleWatchVideo}>
          🎥 Watch a video → +$0.25
        </button>
        <button style={styles.taskBtn} onClick={handleFollowInstagram}>
          📱 Follow us on Instagram → +$0.50
        </button>
        <button style={styles.taskBtn} onClick={handleInviteFriend}>
          👥 Invite a friend → +$0.50 per join
        </button>
      </div>
    </div>
  );
}

// ======================================================
// STYLES MATCHING WalletPage
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
    display: "flex",
    flexDirection: "column",
    gap: 15,
    alignItems: "center",
  },
  balanceLabel: { opacity: 0.6 },
  balanceAmount: { fontSize: 36, margin: "5px 0" },
  roundBtn: {
    padding: "12px 20px",
    background: "#b3dcff",
    borderRadius: 30,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    marginTop: 10,
    width: "100%",
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
};