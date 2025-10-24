// src/components/WithdrawPage.jsx
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        setUser(userAuth);
        const docRef = doc(db, "users", userAuth.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCredits(docSnap.data().credits || 0);
        } else {
          await setDoc(docRef, { credits: 5 }); // new user bonus
          setCredits(5);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Daily check-in logic
  const handleDailyCheckIn = async () => {
    if (!user) return;
    setCheckingIn(true);
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const data = userSnap.data();

    const today = new Date().toDateString();
    if (data?.lastCheckIn === today) {
      alert("You already checked in today!");
      setCheckingIn(false);
      return;
    }

    const newCredits = (data?.credits || 0) + 0.25;
    await updateDoc(userRef, { credits: newCredits, lastCheckIn: today });
    setCredits(newCredits);
    setCheckingIn(false);
    alert("✅ Daily check-in successful! +$0.25 added.");
  };

  // Reward actions
  const handleFollowInstagram = async () => {
    window.open("https://www.instagram.com/hahahala53", "_blank");
    updateCredits(0.5);
  };

  const handleWatchVideo = async () => {
    window.open("https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw", "_blank");
    updateCredits(0.25);
  };

  const handleInviteFriend = async () => {
    navigator.clipboard.writeText("https://yourapp.com/signup?ref=" + user.uid);
    alert("Referral link copied! Share it with friends.");
  };

  // Utility to update credit balance
  const updateCredits = async (amount) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const newCredits = credits + amount;
    await updateDoc(userRef, { credits: newCredits });
    setCredits(newCredits);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9f9f9",
        padding: "25px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "#111",
      }}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/settings")}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          padding: "8px 12px",
          background: "#ddd",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      {/* Title */}
      <h2 style={{ marginTop: "50px", color: "#333" }}>💵 Withdraw Funds</h2>
      <p style={{ color: "#555" }}>Withdrawals are coming soon!</p>

      {/* Wallet Info */}
      <div
        style={{
          margin: "20px 0",
          padding: "15px 25px",
          background: "#fff",
          borderRadius: "10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          width: "80%",
          maxWidth: "350px",
          textAlign: "center",
        }}
      >
        <h3>Your Balance</h3>
        <h1 style={{ color: "#2e7d32" }}>${credits.toFixed(2)}</h1>
      </div>

      {/* Coming soon */}
      <button
        disabled
        style={{
          padding: "12px 20px",
          background: "#ccc",
          border: "none",
          borderRadius: "10px",
          cursor: "not-allowed",
          fontSize: "16px",
          marginBottom: "25px",
        }}
      >
        🚧 Withdraw (Coming Soon)
      </button>

      {/* Earn More Section */}
      <h3>🎯 Complete Tasks to Earn Credits</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          width: "90%",
          maxWidth: "400px",
          marginTop: "20px",
        }}
      >
        <button
          onClick={handleWatchVideo}
          style={taskButtonStyle}
        >
          🎥 Watch a video → +$0.25
        </button>

        <button
          onClick={handleFollowInstagram}
          style={taskButtonStyle}
        >
          📱 Follow us on Instagram → +$0.5
        </button>

        <button
          onClick={handleInviteFriend}
          style={taskButtonStyle}
        >
          👥 Invite a friend → +$0.5 per join
        </button>

        <button
          disabled={checkingIn}
          onClick={handleDailyCheckIn}
          style={{
            ...taskButtonStyle,
            background: checkingIn ? "#bbb" : "#28a745",
          }}
        >
          🧩 Daily check-in → +$0.25/day
        </button>
      </div>
    </div>
  );
}

const taskButtonStyle = {
  background: "#007BFF",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "12px 18px",
  fontSize: "16px",
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  fontWeight: "bold",
};