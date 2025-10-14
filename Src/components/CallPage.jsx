// src/components/CallPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebaseConfig";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function CallPage({ receiverId }) {
  const [duration, setDuration] = useState(0);
  const [calling, setCalling] = useState(false);
  const [balance, setBalance] = useState(0);
  const callTimer = useRef(null);

  const RATE_PER_SECOND = 0.0033; // USD per second

  useEffect(() => {
    const checkBalance = async () => {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) setBalance(userSnap.data().balance || 0);
    };
    checkBalance();
  }, []);

  // Start Call
  const startCall = async () => {
    if (balance <= 0) {
      alert("Insufficient balance! Please add funds first.");
      return;
    }

    setCalling(true);
    setDuration(0);

    // Start counting seconds
    callTimer.current = setInterval(async () => {
      setDuration((prev) => prev + 1);

      const newCost = (duration + 1) * RATE_PER_SECOND;
      const remaining = balance - newCost;

      // Stop call when balance finishes
      if (remaining <= 0) {
        stopCall();
      }
    }, 1000);
  };

  // Stop Call
  const stopCall = async () => {
    if (callTimer.current) clearInterval(callTimer.current);
    setCalling(false);

    const totalCost = duration * RATE_PER_SECOND;
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const oldBalance = userSnap.data().balance || 0;
      const newBalance = Math.max(oldBalance - totalCost, 0);

      await updateDoc(userRef, { balance: newBalance });

      // Save transaction record
      await addDoc(collection(db, "transactions"), {
        uid: auth.currentUser.uid,
        type: "Call",
        duration: formatDuration(duration),
        cost: parseFloat(totalCost.toFixed(2)),
        createdAt: serverTimestamp(),
      });
    }

    alert(`Call ended. Duration: ${formatDuration(duration)}`);
    setDuration(0);
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  };

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>Call Page</h2>
      <p>Receiver: <strong>{receiverId}</strong></p>
      <p>Balance: ${balance.toFixed(2)}</p>
      <p>Duration: {formatDuration(duration)}</p>

      {!calling ? (
        <button
          onClick={startCall}
          style={{
            background: "green",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Start Call
        </button>
      ) : (
        <button
          onClick={stopCall}
          style={{
            background: "red",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          End Call
        </button>
      )}
    </div>
  );
}