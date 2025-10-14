// src/components/CallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  doc,
  onSnapshot,
  setDoc,
  addDoc,
  collection,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

export default function CallPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const callType = searchParams.get("type"); // 'voice' or 'video'
  const chatId = searchParams.get("chatId");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);

  const [inCall, setInCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    initCall();
    return () => endCall();
  }, []);

  const initCall = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      localVideoRef.current.srcObject = localStream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      localStream.getTracks().forEach((track) =>
        pc.addTrack(track, localStream)
      );

      pc.ontrack = (event) => {
        remoteVideoRef.current.srcObject = event.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callDoc = doc(collection(db, "calls"));
      const offerCandidates = collection(callDoc, "offerCandidates");
      const answerCandidates = collection(callDoc, "answerCandidates");

      setDoc(callDoc, { offer, type: callType, chatId });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };

      // Listen for answer
      onSnapshot(callDoc, async (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
          setInCall(true);
        }
      });

      // Listen for remote ICE candidates
      onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });

      setLoading(false);
    } catch (err) {
      alert("Error starting call: " + err.message);
      navigate(-1);
    }
  };

  const endCall = async () => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
    }
    navigate("/chat");
  };

  const toggleMute = () => {
    const localStream = localVideoRef.current.srcObject;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((m) => !m);
  };

  const toggleCamera = () => {
    const localStream = localVideoRef.current.srcObject;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setCameraOff((c) => !c);
  };

  return (
    <div
      style={{
        background: "#000",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
      }}
    >
      <h2 style={{ marginBottom: "20px" }}>
        {callType === "video" ? "🎥 Video Call" : "🎧 Voice Call"}
      </h2>

      {/* Video containers */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          width: "100%",
          maxWidth: "900px",
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: callType === "video" ? "45%" : "0",
            borderRadius: "12px",
            background: "#222",
          }}
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: callType === "video" ? "45%" : "0",
            borderRadius: "12px",
            background: "#222",
          }}
        />
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: "30px",
          display: "flex",
          gap: "20px",
          justifyContent: "center",
        }}
      >
        {callType === "video" && (
          <button
            onClick={toggleCamera}
            style={buttonStyle(cameraOff ? "#555" : "#28a745")}
          >
            {cameraOff ? "📷 Off" : "📸 On"}
          </button>
        )}
        <button onClick={toggleMute} style={buttonStyle(isMuted ? "#555" : "#007bff")}>
          {isMuted ? "🔇 Muted" : "🎤 Mic On"}
        </button>
        <button onClick={endCall} style={buttonStyle("#dc3545")}>
          🔚 End Call
        </button>
      </div>

      {loading && <p style={{ marginTop: "20px" }}>Starting call...</p>}
    </div>
  );
}

const buttonStyle = (bg) => ({
  padding: "10px 20px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "16px",
});