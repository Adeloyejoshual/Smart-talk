// src/components/CallPage.jsx
import React, { useState, useEffect, useRef } from "react";
import Peer from "simple-peer";
import { db, auth } from "../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export default function CallPage({ receiverId }) {
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [calling, setCalling] = useState(false);
  const [duration, setDuration] = useState(0);
  const [balance, setBalance] = useState(0);
  const [peer, setPeer] = useState(null);
  const callTimer = useRef(null);

  const RATE_PER_SECOND = 0.0033;

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    const loadBalance = async () => {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) setBalance(snap.data().balance || 0);
    };
    loadBalance();
  }, []);

  // ✅ Start Call
  const startCall = async () => {
    if (balance <= 0) {
      alert("Insufficient balance!");
      return;
    }

    setCalling(true);
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setStream(localStream);
    localVideoRef.current.srcObject = localStream;

    const initiatorPeer = new Peer({ initiator: true, trickle: false, stream: localStream });
    setPeer(initiatorPeer);

    const callId = `${auth.currentUser.uid}_${receiverId}`;
    const callRef = doc(db, "calls", callId);

    // Create offer
    initiatorPeer.on("signal", async (data) => {
      await setDoc(callRef, { offer: data });
    });

    // Handle remote stream
    initiatorPeer.on("stream", (remoteStream) => {
      setRemoteStream(remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
    });

    // Listen for answer
    onSnapshot(callRef, (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && !initiatorPeer.destroyed) {
        initiatorPeer.signal(data.answer);
      }
    });

    // Start billing timer
    callTimer.current = setInterval(async () => {
      setDuration((prev) => prev + 1);
      const totalCost = (duration + 1) * RATE_PER_SECOND;
      const remaining = balance - totalCost;

      if (remaining <= 0) stopCall();
    }, 1000);
  };

  // ✅ Join Call
  const joinCall = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setStream(localStream);
    localVideoRef.current.srcObject = localStream;

    const callId = `${receiverId}_${auth.currentUser.uid}`;
    const callRef = doc(db, "calls", callId);
    const callSnap = await getDoc(callRef);
    const callData = callSnap.data();

    const answerPeer = new Peer({ initiator: false, trickle: false, stream: localStream });
    setPeer(answerPeer);

    answerPeer.on("signal", async (data) => {
      await updateDoc(callRef, { answer: data });
    });

    answerPeer.signal(callData.offer);

    answerPeer.on("stream", (remoteStream) => {
      setRemoteStream(remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
    });
  };

  // ✅ Stop Call + Deduct
  const stopCall = async () => {
    clearInterval(callTimer.current);
    setCalling(false);
    if (peer) peer.destroy();

    const totalCost = duration * RATE_PER_SECOND;
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const currentBalance = userSnap.data().balance || 0;
      const newBalance = Math.max(currentBalance - totalCost, 0);

      await updateDoc(userRef, { balance: newBalance });

      await addDoc(collection(db, "transactions"), {
        uid: auth.currentUser.uid,
        type: "Video Call",
        duration: formatDuration(duration),
        cost: parseFloat(totalCost.toFixed(2)),
        createdAt: serverTimestamp(),
      });
    }

    alert(`Call ended. Duration: ${formatDuration(duration)}`);
    setDuration(0);
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2>Video Call</h2>
      <p>Balance: ${balance.toFixed(2)}</p>
      <p>Duration: {formatDuration(duration)}</p>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
        <video ref={localVideoRef} autoPlay playsInline muted width="300" />
        <video ref={remoteVideoRef} autoPlay playsInline width="300" />
      </div>

      <div style={{ marginTop: "20px" }}>
        {!calling ? (
          <>
            <button onClick={startCall} style={btnStyle("green")}>
              Start Call
            </button>
            <button onClick={joinCall} style={btnStyle("blue")}>
              Join Call
            </button>
          </>
        ) : (
          <button onClick={stopCall} style={btnStyle("red")}>
            End Call
          </button>
        )}
      </div>
    </div>
  );
}

const btnStyle = (color) => ({
  background: color,
  color: "#fff",
  padding: "10px 20px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  margin: "5px",
});