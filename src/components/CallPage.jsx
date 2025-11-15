// src/components/VoiceCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
import { doc, setDoc, getDoc, updateDoc, onSnapshot, deleteDoc } from "firebase/firestore";

export default function VoiceCallPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const localAudioRef = useRef();
  const remoteAudioRef = useRef();

  const pcRef = useRef(null);
  const callDocRef = useRef(null);
  const localStreamRef = useRef(null);

  const [callActive, setCallActive] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [error, setError] = useState(null);

  const myUid = auth.currentUser?.uid;

  // RTC config with a public STUN server
  const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    if (!chatId || !myUid) return;

    callDocRef.current = doc(db, "voiceCalls", chatId);

    const startCall = async () => {
      try {
        // Get audio stream
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = localStream;
        if (localAudioRef.current) {
          localAudioRef.current.srcObject = localStream;
        }

        // Create peer connection
        const pc = new RTCPeerConnection(rtcConfig);
        pcRef.current = pc;

        // Add local tracks
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        // Listen for remote track
        pc.ontrack = (event) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }
        };

        // ICE Candidate handling
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await updateDoc(callDocRef.current, {
              [`candidates.${myUid}`]: event.candidate.toJSON(),
            });
          }
        };

        // Create offer for caller
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Save offer in Firestore
        await setDoc(callDocRef.current, {
          offer: offer.toJSON(),
          caller: myUid,
          answer: null,
          candidates: {},
          status: "calling",
        });

        // Listen for answer
        const unsub = onSnapshot(callDocRef.current, async (snapshot) => {
          const data = snapshot.data();
          if (!data) return;
          if (data.answer && !pc.currentRemoteDescription) {
            const answerDesc = new RTCSessionDescription(data.answer);
            await pc.setRemoteDescription(answerDesc);
            setCallActive(true);
          }

          // Add ICE candidates from remote peer
          const remoteCandidates = data.candidates || {};
          for (const [uid, candidate] of Object.entries(remoteCandidates)) {
            if (uid !== myUid && candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch {}
            }
          }

          // Call ended detection
          if (data.status === "ended" && !callEnded) {
            endCallCleanup();
          }
        });

        return () => {
          unsub();
          endCallCleanup();
        };
      } catch (e) {
        setError("Could not start call: " + e.message);
      }
    };

    startCall();

    // Cleanup on unmount or chatId change
    return () => endCallCleanup();
  }, [chatId, myUid]);

  const endCallCleanup = async () => {
    setCallEnded(true);
    setCallActive(false);

    // Stop local stream tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    // Close peer connection
    pcRef.current?.close();
    pcRef.current = null;

    // Remove Firestore signaling doc
    try {
      await deleteDoc(callDocRef.current);
    } catch {}

    navigate("/chat");
  };

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>Voice Call</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <audio ref={localAudioRef} autoPlay muted controls />
      <audio ref={remoteAudioRef} autoPlay controls />

      {!callEnded && (
        <button onClick={endCallCleanup} style={{ marginTop: 20, padding: "10px 20px", fontSize: 16 }}>
          End Call
        </button>
      )}

      {callEnded && <p>Call Ended</p>}
    </div>
  );
}