// /src/components/CallModal.jsx
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import useCallSocket from "../hooks/useCallSocket";

export default function CallModal({ type = "voice", user, onClose, currentUser }) {
  const [status, setStatus] = useState("connecting");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const durationRef = useRef(0);
  const timerRef = useRef(null);

  const { socket, endCall } = useCallSocket({
    type,
    targetUser: user,
    onConnected: () => {
      setStatus("active");
      startTimer();
    },
    onEnded: () => {
      stopTimer();
      saveCall("ended");
      setStatus("ended");
      setTimeout(() => onClose?.(), 1500);
    },
  });

  // Start duration counter
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  };

  // Stop counter
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Save call record to Firestore
  const saveCall = async (status) => {
    await addDoc(collection(db, "calls"), {
      caller: currentUser?.name || "You",
      callee: user.name,
      type,
      status,
      duration: durationRef.current,
      timestamp: serverTimestamp(),
    });
  };

  // Manual call end
  const handleEndCall = async () => {
    stopTimer();
    await saveCall("ended");
    endCall();
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

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
          {status === "connecting" && "Connecting..."}
          {status === "active" && fmtTime(duration)}
          {status === "ended" && "Call Ended"}
        </p>

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
              ⛔
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
  fontSize: 20,
};