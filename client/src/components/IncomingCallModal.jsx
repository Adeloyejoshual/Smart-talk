// /src/components/IncomingCallModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function IncomingCallModal({
  call,
  onAccept,
  onReject,
  timeout = 30, // seconds
}) {
  const audioRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(timeout);

  useEffect(() => {
    if (!call) return;

    // 🔊 Start ringtone
    audioRef.current = new Audio("/ringtone.mp3");
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {
      console.warn("Autoplay blocked: user interaction may be required.");
    });

    // 📳 Start vibration loop
    const vibrateInterval = setInterval(() => {
      if ("vibrate" in navigator) navigator.vibrate([300, 200, 300]);
    }, 2000);

    // ⏱️ Countdown + auto-reject after timeout
    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleReject(true); // auto reject
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      stopMedia(vibrateInterval, countdown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call]);

  const stopMedia = (vibrateInterval, countdown) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    clearInterval(vibrateInterval);
    clearInterval(countdown);
    if ("vibrate" in navigator) navigator.vibrate(0);
  };

  const handleAccept = () => {
    stopMedia();
    onAccept?.();
  };

  const handleReject = (auto = false) => {
    stopMedia();
    onReject?.({ auto });
  };

  if (!call) return null;

  const { fromUser, type } = call;

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
        <p>
          {type === "video" ? "📹 Video Call Incoming" : "📞 Voice Call Incoming"}
        </p>
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Auto-declining in {timeLeft}s...
        </p>

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
            onClick={() => handleReject(false)}
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