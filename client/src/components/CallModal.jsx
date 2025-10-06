import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useCallSocket from "../hooks/useCallSocket";

export default function CallModal({ type = "voice", user, onClose }) {
  const [status, setStatus] = useState("connecting");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [endReason, setEndReason] = useState("");

  const { socket, endCall } = useCallSocket({
    type,
    targetUser: user,
    onConnected: () => setStatus("active"),
    onEnded: (reason) => {
      setStatus("ended");
      setEndReason(reason);
      setTimeout(() => onClose?.(), 2500);
    },
  });

  // ⏱️ Duration Timer
  useEffect(() => {
    if (status !== "active") return;
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // 🧠 Listen for call:end events (e.g. low balance)
  useEffect(() => {
    if (!socket) return;
    socket.on("call:end", ({ reason }) => {
      setStatus("ended");
      setEndReason(reason);
      setTimeout(() => onClose?.(), 2500);
    });
    return () => socket.off("call:end");
  }, [socket, onClose]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const getStatusText = () => {
    if (status === "connecting") return "Connecting...";
    if (status === "active") return fmtTime(duration);
    if (status === "ended") {
      if (endReason === "Low balance") return "⚠️ Call ended — Low balance";
      if (endReason === "disconnect") return "📴 Call ended — Disconnected";
      return "Call Ended";
    }
    return "";
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
          background: "rgba(0,0,0,0.88)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 2000,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>{user.name}</h2>
        <p style={{ fontSize: 16, opacity: 0.8 }}>{getStatusText()}</p>

        {status === "active" && (
          <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
            {type === "video" && (
              <button
                onClick={() => setCameraOn(!cameraOn)}
                style={{
                  borderRadius: "50%",
                  padding: 14,
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                }}
              >
                {cameraOn ? "📷" : "🚫"}
              </button>
            )}
            <button
              onClick={() => setMuted(!muted)}
              style={{
                borderRadius: "50%",
                padding: 14,
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#fff",
              }}
            >
              {muted ? "🔇" : "🎙️"}
            </button>
            <button
              onClick={endCall}
              style={{
                borderRadius: "50%",
                padding: 14,
                background: "red",
                color: "#fff",
                border: "none",
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