// src/components/VoiceCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  collection,
  setDoc,
  addDoc,
  onSnapshot,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

/**
 * VoiceCallPage.jsx
 * - WebRTC audio-only call using Firestore signaling
 * - Route: /voicecall/:uid  where :uid is callee's user id
 *
 * Usage: caller navigates here (caller is current user). The component creates a call doc,
 * listens for answer/ice, and establishes peer connection.
 *
 * NOTE: in production consider adding auth checks and call permissions.
 */

const ICE_CONFIG = () => {
  const iceServers = [{ urls: ["stun:stun.l.google.com:19302"] }];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnPass = import.meta.env.VITE_TURN_PASSWORD;
  if (turnUrl && turnUser && turnPass) {
    iceServers.push({
      urls: [turnUrl],
      username: turnUser,
      credential: turnPass,
    });
  }
  return { iceServers };
};

export default function VoiceCallPage() {
  const { uid: calleeUid } = useParams(); // callee's user id
  const navigate = useNavigate();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callDocRef = useRef(null);
  const [callState, setCallState] = useState("starting"); // starting | ringing | connected | ended
  const [muted, setMuted] = useState(false);
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef(null);

  const callerUid = auth.currentUser?.uid;
  if (!callerUid) {
    // not authenticated
    navigate("/");
  }

  useEffect(() => {
    let unsubCall = null;
    let unsubOfferCandidates = null;
    let unsubAnswerCandidates = null;

    (async () => {
      try {
        // 1) get local audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        // 2) prepare remote stream
        remoteStreamRef.current = new MediaStream();

        // 3) create peer connection
        const pc = new RTCPeerConnection(ICE_CONFIG());
        pcRef.current = pc;

        // add local tracks
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // when remote tracks arrive
        pc.ontrack = (event) => {
          event.streams[0]?.getTracks().forEach(t => remoteStreamRef.current.addTrack(t));
        };

        // ICE candidate -> upload to Firestore later
        // We'll create call doc now (caller creates)
        const callId = `${callerUid}_${calleeUid}_${Date.now()}`;
        const callRef = doc(collection(db, "calls"), callId);
        callDocRef.current = callRef;

        // create call doc with metadata
        await setDoc(callRef, {
          caller: callerUid,
          callee: calleeUid,
          createdAt: serverTimestamp(),
          type: "voice",
          status: "calling",
        });

        // create candidates subcollections
        const offerCandidatesRef = collection(callRef, "offerCandidates");
        const answerCandidatesRef = collection(callRef, "answerCandidates");

        // onicecandidate => store in offerCandidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try {
              await addDoc(offerCandidatesRef, JSON.parse(JSON.stringify(event.candidate)));
            } catch (e) {
              console.error("add offer candidate failed", e);
            }
          }
        };

        // create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // store offer in call doc
        await updateDoc(callRef, {
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });

        setCallState("ringing");

        // watch call doc for answer + status changes
        unsubCall = onSnapshot(callRef, async (snap) => {
          const data = snap.data();
          if (!data) return;
          // if callee answered
          if (data.answer && !pc.currentRemoteDescription) {
            const answerDesc = new RTCSessionDescription(data.answer);
            await pc.setRemoteDescription(answerDesc);
            setCallState("connected");
            // start timer
            intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
          }
          if (data.status === "ended" && callState !== "ended") {
            setCallState("ended");
            cleanup();
          }
        });

        // listen for answerCandidates (callee to caller)
        unsubAnswerCandidates = onSnapshot(answerCandidatesRef, (snap) => {
          snap.docChanges().forEach(change => {
            if (change.type === "added") {
              const cand = change.doc.data();
              const ice = new RTCIceCandidate(cand);
              pc.addIceCandidate(ice).catch(e => console.warn("addIceCandidate error", e));
            }
          });
        });

      } catch (err) {
        console.error("voice call init error", err);
        alert("Could not start call: " + (err.message || err));
        navigate(-1);
      }
    })();

    // cleanup
    const cleanup = async () => {
      try {
        // stop timer
        if (intervalRef.current) clearInterval(intervalRef.current);
        // stop tracks
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        // close pc
        pcRef.current?.close();
        // remove call doc
        if (callDocRef.current) {
          const snap = await getDoc(callDocRef.current);
          if (snap.exists()) {
            // try to delete doc (and subcollections) — Firestore doesn't cascade; keep simple: set status
            await updateDoc(callDocRef.current, { status: "ended", endedAt: serverTimestamp() }).catch(()=>{});
          }
        }
      } catch (e) { console.error("cleanup error", e); }
    };

    return () => {
      if (unsubCall) unsubCall();
      if (unsubOfferCandidates) unsubOfferCandidates();
      if (unsubAnswerCandidates) unsubAnswerCandidates();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calleeUid]);

  // hang up
  const hangup = async () => {
    try {
      // set status ended
      if (callDocRef.current) {
        await updateDoc(callDocRef.current, { status: "ended", endedAt: serverTimestamp() });
      }
    } catch (e) { console.error(e); }
    // cleanup local
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    setCallState("ended");
    if (intervalRef.current) clearInterval(intervalRef.current);
    // go back after tiny delay
    setTimeout(() => navigate(-1), 600);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
    setMuted(prev => !prev);
  };

  const formatTimer = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>← Back</button>

      <h3>Voice Call</h3>
      <p>Calling {calleeUid}</p>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {callState === "ringing" && "Ringing..."}
          {callState === "connected" && `Connected — ${formatTimer(timer)}`}
          {callState === "ended" && "Call ended"}
          {callState === "starting" && "Starting..."}
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
        <button onClick={hangup} style={{ background: "#ff4d4f", color: "#fff" }}>Hang up</button>
      </div>
    </div>
  );
}