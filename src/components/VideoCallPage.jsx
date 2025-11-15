// src/components/VideoCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  updateDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

/**
 * VideoCallPage.jsx
 * - WebRTC video + audio
 * - Route: /videocall/:uid  where :uid is callee's uid
 *
 * Very similar flow to VoiceCallPage but creates <video> elements for local/remote.
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

export default function VideoCallPage() {
  const { uid: calleeUid } = useParams();
  const navigate = useNavigate();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callDocRef = useRef(null);

  const [callState, setCallState] = useState("starting");
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef(null);

  const callerUid = auth.currentUser?.uid;
  if (!callerUid) navigate("/");

  useEffect(() => {
    let unsubCall = null;
    let unsubAnswerCandidates = null;

    (async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStreamRef.current = localStream;
        localVideoRef.current.srcObject = localStream;

        remoteStreamRef.current = new MediaStream();

        const pc = new RTCPeerConnection(ICE_CONFIG());
        pcRef.current = pc;

        // add tracks
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        pc.ontrack = (event) => { event.streams[0]?.getTracks().forEach(t => remoteStreamRef.current.addTrack(t)); remoteVideoRef.current.srcObject = remoteStreamRef.current; };

        // create call doc
        const callId = `${callerUid}_${calleeUid}_${Date.now()}`;
        const callRef = doc(collection(db, "calls"), callId);
        callDocRef.current = callRef;

        await setDoc(callRef, { caller: callerUid, callee: calleeUid, createdAt: serverTimestamp(), type: "video", status: "calling" });

        const offerCandidatesRef = collection(callRef, "offerCandidates");
        const answerCandidatesRef = collection(callRef, "answerCandidates");

        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try { await addDoc(offerCandidatesRef, JSON.parse(JSON.stringify(event.candidate))); } catch(e) { console.error(e); }
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });
        setCallState("ringing");

        unsubCall = onSnapshot(callRef, async (snap) => {
          const data = snap.data();
          if (!data) return;
          if (data.answer && !pc.currentRemoteDescription) {
            const answerDesc = new RTCSessionDescription(data.answer);
            await pc.setRemoteDescription(answerDesc);
            setCallState("connected");
            intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
          }
          if (data.status === "ended") {
            setCallState("ended");
            cleanup();
          }
        });

        unsubAnswerCandidates = onSnapshot(answerCandidatesRef, (snap) => {
          snap.docChanges().forEach(change => {
            if (change.type === "added") {
              const cand = change.doc.data();
              pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.warn(e));
            }
          });
        });

      } catch (err) {
        console.error(err);
        alert("Call failed: " + err.message);
        navigate(-1);
      }
    })();

    const cleanup = async () => {
      try {
        if (intervalRef.current) clearInterval(intervalRef.current);
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        pcRef.current?.close();
        if (callDocRef.current) {
          await updateDoc(callDocRef.current, { status: "ended", endedAt: serverTimestamp() }).catch(()=>{});
        }
      } catch(e) {}
    };

    return () => {
      if (unsubCall) unsubCall();
      if (unsubAnswerCandidates) unsubAnswerCandidates();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calleeUid]);

  const hangup = async () => {
    if (callDocRef.current) await updateDoc(callDocRef.current, { status: "ended", endedAt: serverTimestamp() }).catch(()=>{});
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    setCallState("ended");
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeout(() => navigate(-1), 600);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
    setMuted(prev => !prev);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => (t.enabled = !t.enabled));
    setVideoOn(prev => !prev);
  };

  const formatTimer = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <div style={{ padding: 12 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>← Back</button>
      <h3>Video Call</h3>
      <div style={{ display: "flex", gap: 12 }}>
        <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 160, height: 120, background: "#000", borderRadius: 8 }} />
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 320, height: 240, background: "#000", borderRadius: 8 }} />
      </div>

      <div style={{ marginTop: 12 }}>
        <div>{callState === "ringing" ? "Ringing..." : callState === "connected" ? `Connected — ${formatTimer(timer)}` : callState}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
          <button onClick={toggleVideo}>{videoOn ? "Stop Video" : "Start Video"}</button>
          <button onClick={hangup} style={{ background: "#ff4d4f", color: "#fff" }}>Hang up</button>
        </div>
      </div>
    </div>
  );
}