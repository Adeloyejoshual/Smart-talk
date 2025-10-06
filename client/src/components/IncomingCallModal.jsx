import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function IncomingCallModal({ call, onAccept, onReject }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!call) return;

    // 🔊 Play ringtone
    audioRef.current = new Audio("/ringtone.mp3");
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {
      console.warn("Autoplay prevented. User interaction may be required.");
    });

    // 📳 Vibrate phone every 2 seconds (if supported)
    const vibrateInterval = setInterval(() => {
      if ("vibrate" in navigator) navigator.vibrate([300, 200, 300]);
    }, 2000);

    // 🧹 Cleanup when modal unmounts
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      clearInterval(vibrateInterval);
      if ("vibrate" in navigator) navigator.vibrate(0); // stop vibration
    };
  }, [call]);

  if (!call) return null;

  const { fromUser, type } = call;

  const handleAccept = () => {
    audioRef.current?.pause();
    if ("vibrate" in navigator) navigator.vibrate(0);
    onAccept?.();
  };

  const handleReject = () => {
    audioRef.current?.pause();
    if ("vibrate" in navigator) navigator.vibrate(0);
    onReject?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 4000,
          padding: 20,
          textAlign: "center",
        }}
      >
        <h2>{fromUser.name}</h2>
        <p>{type === "video" ? "📹 Incoming Video Call" : "📞 Incoming Voice Call"}</p>

        <div style={{ display: "flex", gap: 30, marginTop: 30 }}>
          <button
            onClick={handleAccept}
            style={{
              background: "green",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 50,
              border: "none",
              fontSize: 16,
            }}
          >
            ✅ Accept
          </button>
          <button
            onClick={handleReject}
            style={{
              background: "red",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 50,
              border: "none",
              fontSize: 16,
            }}
          >
            ❌ Reject
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}