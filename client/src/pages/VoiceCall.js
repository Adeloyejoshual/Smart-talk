// 📁 src/pages/VoiceCall.js
import React, { useEffect, useRef, useState } from "react";
import { auth } from "../firebaseClient";
import { useTheme } from "../context/ThemeContext";
import { PhoneOff, Mic } from "lucide-react";
import useBillingSocket from "../hooks/useBillingSocket";

export default function VoiceCall({ callId, isCaller, onEnd }) {
  const { theme } = useTheme();
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [peer, setPeer] = useState(null);
  const [duration, setDuration] = useState(0);
  const [cost, setCost] = useState(0);
  const [forceEnd, setForceEnd] = useState(false);

  const me = auth.currentUser;

  // ✅ Connect to billing server
  const { startBilling, stopBilling, billingActive } = useBillingSocket({
    idToken: me?.accessToken,
    callId,
    isCaller,
    onForceEnd: () => {
      setForceEnd(true);
      alert("Call ended: Insufficient wallet balance 💸");
      handleEndCall();
    },
    onBillingUpdate: ({ seconds, charged }) => {
      setDuration(seconds);
      setCost(charged);
    },
  });

  // 🎙️ Start local audio stream
  useEffect(() => {
    const startAudio = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        setStream(media);
        if (localAudioRef.current) {
          localAudioRef.current.srcObject = media;
        }
      } catch (err) {
        console.error("Audio error:", err);
      }
    };
    startAudio();
  }, []);

  // 🔗 Setup Peer Connection (simplified)
  useEffect(() => {
    if (!stream) return;
    const pc = new RTCPeerConnection();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    setPeer(pc);

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected" && isCaller) {
        startBilling();
      }
    };

    return () => pc.close();
  }, [stream, isCaller, startBilling]);

  // 🧩 End call manually or by billing event
  const handleEndCall = () => {
    stopBilling(me.uid);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (peer) peer.close();
    onEnd();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: theme === "dark" ? "#000" : "#f9f9f9",
        color: theme === "dark" ? "#fff" : "#000",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Audio Elements */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {/* Call Info */}
      <div style={{ textAlign: "center" }}>
        <Mic size={48} color={theme === "dark" ? "#0af" : "#007aff"} />
        <h2 style={{ marginTop: 12, fontSize: 20 }}>Voice Call</h2>
        <div style={{ fontSize: 14, marginTop: 6 }}>
          Duration: {duration}s | Cost: ${cost.toFixed(4)}
        </div>
        {billingActive && (
          <div
            style={{
              marginTop: 4,
              color: "#0f0",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Billing Active 🔄
          </div>
        )}
        {forceEnd && (
          <div
            style={{
              marginTop: 4,
              color: "#ff3b30",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Call ended (low balance)
          </div>
        )}
      </div>

      {/* End Call Button */}
      <button
        onClick={handleEndCall}
        style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#ff3b30",
          border: "none",
          borderRadius: "50%",
          width: 70,
          height: 70,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          boxShadow: "0 0 12px rgba(0,0,0,0.3)",
        }}
      >
        <PhoneOff size={30} color="#fff" />
      </button>
    </div>
  );
}