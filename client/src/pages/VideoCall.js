import React, { useEffect, useRef, useState } from "react";
import { auth, db } from "../firebaseClient";
import { updateDoc, doc } from "firebase/firestore";
import { deductPerSecond } from "../utils/billing";
import { useTheme } from "../context/ThemeContext";
import { PhoneOff } from "lucide-react";
import useBillingSocket from "../hooks/useBillingSocket";

export default function VideoCall({ callId, isCaller, onEnd }) {
  const { theme } = useTheme();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [peer, setPeer] = useState(null);
  const [duration, setDuration] = useState(0);
  const [cost, setCost] = useState(0);
  const [forceEnd, setForceEnd] = useState(false);
  const [callStatus, setCallStatus] = useState("connecting"); // e.g., "accepted", "ended", etc.

  const me = auth.currentUser;
  const billingTimerRef = useRef(null);

  // Connect to billing server via socket
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

  // Start local video stream
  useEffect(() => {
    async function startVideo() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(media);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
        }
      } catch (err) {
        console.error("Media error:", err);
      }
    }
    startVideo();
  }, []);

  // Setup PeerConnection and start billing if caller connected
  useEffect(() => {
    if (!stream) return;
    const pc = new RTCPeerConnection();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    setPeer(pc);

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallStatus("accepted");
        if (isCaller) startBilling();
      }
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setCallStatus("ended");
      }
    };

    return () => pc.close();
  }, [stream, isCaller, startBilling]);

  // Per-second billing deduction using useEffect and interval
  useEffect(() => {
    if (callStatus !== "accepted") return;

    billingTimerRef.current = setInterval(async () => {
      const success = await deductPerSecond(me.uid);
      if (!success) {
        clearInterval(billingTimerRef.current);
        await updateDoc(doc(db, "calls", callId), { status: "ended", reason: "insufficient_funds" });
        alert("Your balance is too low. Call ended.");
        setForceEnd(true);
        handleEndCall();
      }
    }, 1000);

    return () => {
      clearInterval(billingTimerRef.current);
    };
  }, [callStatus, callId, me.uid]);

  // End call handler
  const handleEndCall = () => {
    stopBilling(me.uid);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (peer) peer.close();
    setCallStatus("ended");
    onEnd();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: theme === "dark" ? "#000" : "#f8f8f8",
        color: theme === "dark" ? "#fff" : "#000",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
      />
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          width: 140,
          height: 100,
          borderRadius: 12,
          border: "2px solid #fff",
          objectFit: "cover",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Video Call</div>
        <div style={{ fontSize: 14, marginTop: 6 }}>
          Duration: {duration}s | Cost: ${cost.toFixed(4)}
        </div>
        {billingActive && (
          <div style={{ marginTop: 4, color: "#0f0", fontSize: 12, fontWeight: 500 }}>
            Billing Active 🔄
          </div>
        )}
        {forceEnd && (
          <div style={{ marginTop: 4, color: "#ff3b30", fontSize: 12, fontWeight: 500 }}>
            Call ended (low balance)
          </div>
        )}
      </div>

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