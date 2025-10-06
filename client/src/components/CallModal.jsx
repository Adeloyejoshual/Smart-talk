// /src/components/CallModal.jsx
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import useCallSocket from "../hooks/useCallSocket";

export default function CallModal({ type = "voice", user, onClose, currentUser }) {
  const [status, setStatus] = useState("connecting"); // connecting | ringing | active | declined | missed | ended
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [ringing, setRinging] = useState(false);

  const durationRef = useRef(0);
  const timerRef = useRef(null);
  const missedTimeoutRef = useRef(null);

  const { socket, endCall } = useCallSocket({
    type,
    targetUser: user,
    onConnected: () => {
      setStatus("active");
      startTimer();
      clearTimeout(missedTimeoutRef.current);
    },
    onEnded: () => {
      stopTimer();
      saveCall("ended");
      setStatus("ended");
      setTimeout(() => onClose?.(), 1500);
    },
  });

  // ⏱️ Start counting duration
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  };

  // Stop timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // 💾 Save call to Firestore
  const saveCall = async (result) => {
    try {
      await addDoc(collection(db, "calls"), {
        callerId: currentUser?.uid,
        callerName: currentUser?.name || "You",
        calleeId: user.id,
        calleeName: user.name,
        type,
        status: result,
        duration: durationRef.current,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error saving call:", err);
    }
  };

  // 🚫 Decline manually
  const handleDecline = async () => {
    clearTimeout(missedTimeoutRef.current);
    stopTimer();
    await saveCall("declined");
    setStatus("declined");
    endCall();
    setTimeout(() => onClose?.(), 1500);
  };

  // 📴 Auto mark as missed after 25s if no connection
  useEffect(() => {
    if (status === "connecting") {
      setRinging(true);
      missedTimeoutRef.current = setTimeout(async () => {
        setStatus("missed");
        await saveCall("missed");
        endCall();
        setTimeout(() => onClose?.(), 1500);
      }, 25000);
    }
    return () => clearTimeout(missedTimeoutRef.current);
  }, [status]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleEndCall = async () => {
    stopTimer();
    await saveCall("ended");
    endCall();
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 2000,
        }}
      >
        <h2>{user.name}</h2>
        <p style={{ fontSize: 16, marginTop: 8 }}>
          {status === "connecting" && "Ringing..."}
          {status === "active" && fmtTime(duration)}
          {status === "declined" && "Call Declined"}
          {status === "missed" && "Missed Call"}
          {status === "ended" && "Call Ended"}
        </p>

        {status === "connecting" && (
          <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
            <button onClick={handleDecline} style={{ ...btnStyle, background: "red" }}>
              ❌ Decline
            </button>
          </div>
        )}

        {status === "active" && (
          <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
            {type === "video" && (
              <button onClick={() => setCameraOn(!cameraOn)} style={btnStyle}>
                {cameraOn ? "📷" : "🚫"}
              </button>
            )}
            <button onClick={() => setMuted(!muted)} style={btnStyle}>
              {muted ? "🔇" : "🎙️"}
            </button>
            <button onClick={handleEndCall} style={{ ...btnStyle, background: "red", color: "#fff" }}>
              ⛔ End
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

const btnStyle = {
  borderRadius: "50%",
  padding: 14,
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  fontSize: 16,
};