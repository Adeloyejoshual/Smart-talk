// /src/pages/CallScreen.jsx
import React, { useEffect, useRef, useState } from "react";

export default function CallScreen({ callId, isCaller, onHangup, localStreamRef, remoteElRef }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef?.current) localVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && remoteElRef?.current) remoteVideoRef.current.srcObject = remoteElRef.current.srcObject || null;
  }, [localStreamRef, remoteElRef]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000", zIndex: 3000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff"
    }}>
      <div style={{ position: "relative", width: "90%", maxWidth: 900, height: "70%", display: "flex", gap: 12 }}>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ flex: 1, background: "#111", borderRadius: 12 }} />
        <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 160, height: 120, borderRadius: 12, position: "absolute", right: 24, top: 24, background: "#222" }} />
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 18 }}>{fmt(seconds)}</div>
        <button onClick={() => setMuted((m) => !m)} style={callControlBtn}>{muted ? "Unmute" : "Mute"}</button>
        <button onClick={() => setVideoOff((v) => !v)} style={callControlBtn}>{videoOff ? "Enable Video" : "Disable Video"}</button>
        <button onClick={onHangup} style={{ ...callControlBtn, background: "#ff3b30", color: "#fff" }}>End Call</button>
      </div>
    </div>
  );
}

const callControlBtn = {
  padding: "10px 14px",
  borderRadius: 10,
  background: "#333",
  color: "#fff",
  border: "none",
  cursor: "pointer"
};