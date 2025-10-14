// src/components/CallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { saveCallHistory } from "../utils/saveCallHistory";

export default function CallPage() {
  const { id: receiverId } = useParams(); // Receiver's UID from route
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);

  const [callActive, setCallActive] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [remoteUserName, setRemoteUserName] = useState("User");

  // 🟢 Setup WebRTC
  useEffect(() => {
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pcRef.current.onconnectionstatechange = () => {
      if (pcRef.current.connectionState === "connected") {
        console.log("✅ Call connected");
        setCallActive(true);
        setCallStartTime(Date.now());

        // ✅ Save "answered" call
        saveCallHistory({
          callerId: auth.currentUser.uid,
          callerName: auth.currentUser.displayName || "You",
          receiverId,
          receiverName: remoteUserName,
          status: "answered",
          startTime: Date.now(),
        });
      } else if (pcRef.current.connectionState === "disconnected") {
        endCall();
      }
    };

    return () => {
      pcRef.current?.close();
    };
  }, []);

  // 🎥 Get local video & audio
  useEffect(() => {
    const getMedia = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, stream);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    };
    getMedia();
  }, []);

  // 📞 Create an offer and send to Firestore
  const startCall = async () => {
    if (!receiverId) return alert("No receiver specified!");

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    const callRef = doc(db, "calls", receiverId);
    await setDoc(callRef, {
      offer,
      callerId: auth.currentUser.uid,
      callerName: auth.currentUser.displayName || "You",
      receiverId,
      createdAt: serverTimestamp(),
    });

    alert("📤 Calling...");

    // 🟩 Save outgoing log
    await saveCallHistory({
      callerId: auth.currentUser.uid,
      callerName: auth.currentUser.displayName || "You",
      receiverId,
      receiverName: remoteUserName,
      status: "outgoing",
      startTime: Date.now(),
    });

    // 👂 Listen for answer
    const unsub = onSnapshot(callRef, async (snapshot) => {
      const data = snapshot.data();
      if (data?.answer) {
        const answer = new RTCSessionDescription(data.answer);
        await pcRef.current.setRemoteDescription(answer);
        unsub();
      }
    });
  };

  // 📲 Answer incoming call
  const answerCall = async (callData) => {
    await pcRef.current.setRemoteDescription(
      new RTCSessionDescription(callData.offer)
    );
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);

    await setDoc(doc(db, "calls", auth.currentUser.uid), {
      ...callData,
      answer,
      answered: true,
    });

    alert("✅ Call connected!");
    setCallActive(true);
    setCallStartTime(Date.now());

    // ✅ Log answered call
    await saveCallHistory({
      callerId: callData.callerId,
      callerName: callData.callerName,
      receiverId: auth.currentUser.uid,
      receiverName: auth.currentUser.displayName || "You",
      status: "answered",
      startTime: Date.now(),
    });
  };

  // 🔴 End call
  const endCall = async () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => sender.track.stop());
      pcRef.current.close();
    }

    const callEndTime = Date.now();
    const duration = callStartTime
      ? Math.floor((callEndTime - callStartTime) / 1000)
      : 0;

    // 📝 Save ended call info
    await saveCallHistory({
      callerId: auth.currentUser.uid,
      callerName: auth.currentUser.displayName || "You",
      receiverId,
      receiverName: remoteUserName,
      status: "ended",
      startTime: callStartTime,
      endTime: callEndTime,
      duration,
    });

    // 🧹 Cleanup call doc
    await deleteDoc(doc(db, "calls", receiverId));
    setCallActive(false);
    navigate("/chat");
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>
        {callActive ? "In Call with" : "Calling"} {remoteUserName}
      </h2>

      <div style={styles.videoContainer}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={styles.videoLocal}
        ></video>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={styles.videoRemote}
        ></video>
      </div>

      <div style={styles.controls}>
        {!callActive && (
          <button style={styles.callBtn} onClick={startCall}>
            📞 Start Call
          </button>
        )}
        {callActive && (
          <button style={styles.endBtn} onClick={endCall}>
            ❌ End Call
          </button>
        )}
      </div>
    </div>
  );
}

// 💅 Styles
const styles = {
  container: {
    textAlign: "center",
    background: "#0d1117",
    color: "#fff",
    minHeight: "100vh",
    padding: "20px",
  },
  header: { fontSize: "22px", marginBottom: "15px" },
  videoContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginBottom: "20px",
  },
  videoLocal: {
    width: "40%",
    borderRadius: "12px",
    border: "2px solid #444",
  },
  videoRemote: {
    width: "40%",
    borderRadius: "12px",
    border: "2px solid #00bfa5",
  },
  controls: { marginTop: "20px" },
  callBtn: {
    background: "#00bfa5",
    padding: "10px 25px",
    borderRadius: "10px",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
  },
  endBtn: {
    background: "#f44336",
    padding: "10px 25px",
    borderRadius: "10px",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
  },
};