// src/components/CallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

export default function CallPage() {
  const [callType, setCallType] = useState("voice");
  const [status, setStatus] = useState("Connecting...");
  const [isRinging, setIsRinging] = useState(true);
  const [duration, setDuration] = useState(0);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callerName, setCallerName] = useState("");
  const [callerPhoto, setCallerPhoto] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const timerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const callerId = params.get("callerId");
  const callId = params.get("callId");
  const type = params.get("type") || "voice";

  // 🎥 Initialize
  useEffect(() => {
    setCallType(type);
    initCall();
    return () => endCall();
  }, []);

  // ⏱ Duration Timer
  useEffect(() => {
    if (isOnCall) {
      timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isOnCall]);

  const initCall = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    pcRef.current = pc;

    // Get mic (and camera if video)
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: type === "video",
      audio: true,
    });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      setIsRinging(false);
      setStatus("On Call");
      setIsOnCall(true);
    };

    const callDoc = doc(db, "calls", callId);
    const candidatesRef = doc(db, "calls", `${callId}_candidates`);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await setDoc(
          candidatesRef,
          { [auth.currentUser.uid]: event.candidate.toJSON() },
          { merge: true }
        );
      }
    };

    // Listen for ICE and call state
    onSnapshot(candidatesRef, (snapshot) => {
      const data = snapshot.data();
      if (data) {
        Object.entries(data).forEach(([uid, candidate]) => {
          if (uid !== auth.currentUser.uid) {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });
      }
    });

    // Listen for offer/answer changes
    onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (!data) {
        setStatus("Call Ended");
        setIsRinging(false);
        setIsOnCall(false);
        setTimeout(() => navigate("/chat"), 1500);
        return;
      }

      // Load caller info for ringing UI
      if (data.callerName) setCallerName(data.callerName);
      if (data.callerPhoto) setCallerPhoto(data.callerPhoto);

      if (data.offer && !data.answered && data.receiverId === auth.currentUser.uid) {
        setStatus("Ringing...");
        setIsRinging(true);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(callDoc, {
          answer,
          answered: true,
        });
      } else if (data.answer && callerId === auth.currentUser.uid) {
        setStatus("Call Connected ✅");
        setIsRinging(false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        setIsOnCall(true);
      }
    });
  };

  const endCall = async () => {
    try {
      pcRef.current?.close();
      pcRef.current = null;
      await deleteDoc(doc(db, "calls", callId));
      await deleteDoc(doc(db, "calls", `${callId}_candidates`));
    } catch (err) {
      console.error(err);
    }
    setIsRinging(false);
    setIsOnCall(false);
    setStatus("Call Ended");
    setTimeout(() => navigate("/chat"), 1000);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isRinging ? (
        <div style={{ textAlign: "center" }}>
          <img
            src={callerPhoto || "/default-avatar.png"}
            alt="Caller"
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: "3px solid #00FF88",
              marginBottom: 20,
              objectFit: "cover",
              animation: "pulse 1.2s infinite",
            }}
          />
          <h2>{callerName || "Unknown Caller"}</h2>
          <p style={{ fontSize: 18, marginBottom: 15 }}>
            {callType === "video" ? "🎥 Video Call" : "📞 Voice Call"}
          </p>
          <p
            style={{
              color: "#0f0",
              fontWeight: "bold",
              animation: "blink 1s infinite",
            }}
          >
            {status}
          </p>
          <button
            onClick={endCall}
            style={{
              marginTop: "25px",
              background: "red",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: 70,
              height: 70,
              fontSize: 22,
            }}
          >
            ❌
          </button>
        </div>
      ) : (
        <>
          <h2>{callType === "video" ? "🎥 Video Call" : "🎤 Voice Call"}</h2>
          <p>{status}</p>
          {isOnCall && <p>Duration: {formatTime(duration)}</p>}

          {callType === "video" && (
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: "200px",
                  height: "150px",
                  borderRadius: "10px",
                  border: "2px solid #333",
                }}
              />
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: "300px",
                  height: "200px",
                  borderRadius: "10px",
                  border: "2px solid #333",
                }}
              />
            </div>
          )}

          <button
            onClick={endCall}
            style={{
              marginTop: "30px",
              background: "red",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "70px",
              height: "70px",
              fontSize: "22px",
              cursor: "pointer",
            }}
          >
            ❌
          </button>
        </>
      )}
    </div>
  );
}

// 💫 animations
const style = document.createElement("style");
style.innerHTML = `
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 5px #00FF88; }
  50% { transform: scale(1.05); box-shadow: 0 0 20px #00FF88; }
  100% { transform: scale(1); box-shadow: 0 0 5px #00FF88; }
}
@keyframes blink {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0.4; }
}`;
document.head.appendChild(style);