import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useCallSocket from "../hooks/useCallSocket";

export default function CallModal({ type = "voice", user, onClose }) {
  const [status, setStatus] = useState("connecting");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  const { socket, endCall } = useCallSocket({
    type,
    targetUser: user,
    onConnected: () => setStatus("active"),
    onEnded: () => {
      setStatus("ended");
      setTimeout(() => onClose?.(), 2000);
    },
  });

  // ⏱️ Duration timer
  useEffect(() => {
    if (status !== "active") return;
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

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
        <p>
          {status === "connecting" && "Connecting..."}
          {status === "active" && fmtTime(duration)}
          {status === "ended" && "Call Ended"}
        </p>

        {status === "active" && (
          <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
            {type === "video" && (
              <button onClick={() => setCameraOn(!cameraOn)} style={{ borderRadius: "50%", padding: 14 }}>
                {cameraOn ? "📷" : "🚫"}
              </button>
            )}
            <button onClick={() => setMuted(!muted)} style={{ borderRadius: "50%", padding: 14 }}>
              {muted ? "🔇" : "🎙️"}
            </button>
            <button
              onClick={endCall}
              style={{ borderRadius: "50%", padding: 14, background: "red", color: "#fff" }}
            >
              ⛔
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}