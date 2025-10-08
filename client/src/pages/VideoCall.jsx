// pages/VideoCallPage.jsx
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebaseClient";
import { doc, updateDoc } from "firebase/firestore";
import { deductCallCost } from "../utils/wallet";
import { calculateCost } from "../utils/billing";

export default function VideoCallPage({ callId, onCallEnd }) {
  const [duration, setDuration] = useState(0);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    let interval;
    if (!isEnded) {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isEnded]);

  const handleEndCall = async () => {
    setIsEnded(true);
    const userId = auth.currentUser?.uid;
    const cost = await deductCallCost(userId, duration);

    await updateDoc(doc(db, "calls", callId), {
      status: "ended",
      duration,
      cost,
      endedAt: new Date(),
    });

    alert(`📞 Call ended.\nDuration: ${duration}s\nCharged: $${cost.toFixed(3)}`);
    onCallEnd?.();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h1 className="text-xl font-bold">Video Call Active</h1>
      <p className="mt-3">⏱ Duration: {duration}s</p>
      {!isEnded && (
        <button
          onClick={handleEndCall}
          className="mt-6 bg-red-500 text-white px-6 py-2 rounded-xl"
        >
          End Call
        </button>
      )}
    </div>
  );
}
