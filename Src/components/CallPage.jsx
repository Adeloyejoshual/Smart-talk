import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function CallPage() {
  const { id } = useParams(); // receiver id
  const navigate = useNavigate();
  const [receiver, setReceiver] = useState(null);
  const [duration, setDuration] = useState(0);
  const [calling, setCalling] = useState(false);
  const [intervalId, setIntervalId] = useState(null);

  const CALL_RATE = 0.0033; // dollars per second

  // Fetch receiver info
  useEffect(() => {
    const fetchReceiver = async () => {
      const userDoc = await getDoc(doc(db, "users", id));
      if (userDoc.exists()) setReceiver(userDoc.data());
    };
    fetchReceiver();
  }, [id]);

  // Start call
  const startCall = async () => {
    setCalling(true);
    setDuration(0);

    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    setIntervalId(timer);
  };

  // End call and charge the caller
  const endCall = async () => {
    clearInterval(intervalId);
    setCalling(false);

    const totalCost = duration * CALL_RATE;

    const callerRef = doc(db, "users", auth.currentUser.uid);
    const callerSnap = await getDoc(callerRef);

    if (callerSnap.exists()) {
      const callerData = callerSnap.data();
      const newBalance = (callerData.balance || 0) - totalCost;

      await updateDoc(callerRef, { balance: newBalance >= 0 ? newBalance : 0 });
    }

    alert(`Call ended. Duration: ${duration}s`);
    navigate("/"); // back to home
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#f2f2f2",
      }}
    >
      <h2>Voice Call</h2>

      {receiver ? (
        <>
          <h3>{receiver.displayName || receiver.email}</h3>
          <p>Duration: {duration} sec</p>

          {!calling ? (
            <button
              onClick={startCall}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                background: "green",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Start Call
            </button>
          ) : (
            <button
              onClick={endCall}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                background: "red",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              End Call
            </button>
          )}
        </>
      ) : (
        <p>Loading call info...</p>
      )}
    </div>
  );
}