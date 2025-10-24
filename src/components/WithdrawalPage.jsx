import React, { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function WithdrawalPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [taskProgress, setTaskProgress] = useState({});
  const navigate = useNavigate();

  // 🔹 Watch user & wallet in real-time
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userAuth) => {
      if (userAuth) {
        setUser(userAuth);

        const userRef = doc(db, "users", userAuth.uid);
        const unsubUser = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setBalance(data.balance || 0);
            setTaskProgress(data.taskProgress || {});
          } else {
            await setDoc(userRef, { balance: 0, taskProgress: {} });
          }
        });

        return () => unsubUser();
      }
    });

    return () => unsubscribe();
  }, []);

  // 🔹 Update progress & balance
  const completeTask = async (taskName, reward) => {
    if (!user) return;
    if (taskProgress[taskName]) return alert("You’ve already done this task!");

    const userRef = doc(db, "users", user.uid);
    const newProgress = { ...taskProgress, [taskName]: true };

    await updateDoc(userRef, {
      taskProgress: newProgress,
      balance: (balance || 0) + reward,
      lastUpdated: serverTimestamp(),
    });

    alert(`✅ You earned $${reward.toFixed(2)} for completing ${taskName.replace(/([A-Z])/g, " $1")}`);
  };

  // 🔹 Daily check-in
  const handleDailyCheckIn = async () => {
    const today = new Date().toDateString();
    if (taskProgress.lastCheckIn === today)
      return alert("🕒 You’ve already checked in today!");

    const userRef = doc(db, "users", user.uid);
    const newProgress = { ...taskProgress, lastCheckIn: today };

    await updateDoc(userRef, {
      taskProgress: newProgress,
      balance: (balance || 0) + 0.25,
      lastUpdated: serverTimestamp(),
    });

    alert("🎉 Daily check-in complete! +$0.25");
  };

  // 🔹 Social & Video actions
  const handleWatchVideo = () => {
    window.open(
      "https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw",
      "_blank"
    );
    completeTask("watchVideo", 0.25);
  };

  const handleFollowInstagram = () => {
    window.open(
      "https://www.instagram.com/hahahala53?igsh=MTY2aGJhbHJpMHFxaQ==",
      "_blank"
    );
    completeTask("followInstagram", 0.5);
  };

  const handleInviteFriend = () => {
    alert("👥 Invite a friend feature coming soon!");
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div
      style={{
        padding: "20px",
        background: "#f4f4f4",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
        <button
          onClick={() => navigate("/settings")}
          style={{
            border: "none",
            background: "transparent",
            fontSize: "18px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          ←
        </button>
        <h2 style={{ margin: 0 }}>💸 Withdraw & Earn</h2>
      </div>

      {/* Balance Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "20px",
          textAlign: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <h3>Your Balance</h3>
        <p style={{ fontSize: "26px", fontWeight: "bold", color: "#007bff" }}>
          ${balance.toFixed(2)}
        </p>
      </div>

      {/* Tasks Section */}
      <h3 style={{ marginTop: "30px" }}>🎯 Complete Tasks to Earn</h3>

      <TaskButton
        label="🎬 Watch a video → +$0.25"
        done={taskProgress.watchVideo}
        onClick={handleWatchVideo}
      />
      <TaskButton
        label="📱 Follow us on Instagram → +$0.50"
        done={taskProgress.followInstagram}
        onClick={handleFollowInstagram}
      />
      <TaskButton
        label="👥 Invite a friend → +$0.50 per join"
        done={taskProgress.inviteFriend}
        onClick={handleInviteFriend}
      />
      <TaskButton
        label="🧩 Daily check-in → +$0.25"
        done={taskProgress.lastCheckIn === new Date().toDateString()}
        onClick={handleDailyCheckIn}
      />

      {/* Withdraw Button */}
      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <button
          onClick={() => alert("💵 Withdrawals coming soon!")}
          style={{
            background: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "12px 24px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          Withdraw Funds
        </button>
      </div>
    </div>
  );
}

// ✅ Task Button Component
const TaskButton = ({ label, done, onClick }) => (
  <button
    onClick={!done ? onClick : undefined}
    style={{
      width: "100%",
      textAlign: "left",
      padding: "15px 20px",
      margin: "10px 0",
      background: done ? "#d4edda" : "#fff",
      color: done ? "#155724" : "#000",
      border: "1px solid #ccc",
      borderRadius: "10px",
      cursor: done ? "not-allowed" : "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    }}
  >
    {label}
    {done ? "✅" : "→"}
  </button>
);