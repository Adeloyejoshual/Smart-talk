import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CallModal({ type = "voice", user, socket, onClose }) {
  const [status, setStatus] = useState("connecting"); // connecting | active | ended
  const [duration, setDuration] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  // --- Simulate call lifecycle events from server
  useEffect(() => {
    if (!socket) return;

    socket.on("call:connected", () => {
      setStatus("active");
      const id = setInterval(() => setDuration((d) => d + 1), 1000);
      setIntervalId(id);
    });

    socket.on("call:end", () => {
      clearInterval(intervalId);
      setStatus("ended");
      setTimeout(() => onClose?.(), 3000); // auto-close
    });

    return () => {
      socket.off("call:connected");
      socket.off("call:end");
      clearInterval(intervalId);
    };
  }, [socket]);

  // --- Manual end call
  const handleEnd = () => {
    socket.emit("call:end", { reason: "user_hangup" });
    setStatus("ended");
    setTimeout(() => onClose?.(), 1000);
  };

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
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          zIndex: 2000,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2>{user.name}</h2>
          <p style={{ opacity: 0.8 }}>
            {status === "connecting" && "Connecting..."}
            {status === "active" && fmtTime(duration)}
            {status === "ended" && "Call Ended"}
          </p>
        </div>

        {/* Controls */}
        {status === "active" && (
          <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
            {type === "video" && (
              <button
                onClick={() => setCameraOn(!cameraOn)}
                style={{
                  background: cameraOn ? "#4caf50" : "#888",
                  borderRadius: "50%",
                  padding: 14,
                }}
              >
                📷
              </button>
            )}
            <button
              onClick={() => setMuted(!muted)}
              style={{
                background: muted ? "#888" : "#4caf50",
                borderRadius: "50%",
                padding: 14,
              }}
            >
              {muted ? "🔇" : "🎙️"}
            </button>
            <button
              onClick={handleEnd}
              style={{
                background: "red",
                borderRadius: "50%",
                padding: 14,
              }}
            >
              ⛔
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}