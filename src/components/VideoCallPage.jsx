// src/components/VideoCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import Video from "twilio-video";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";

export default function VideoCallPage({ setBalance, setTransactions, backend }) {
  const { uid: calleeId } = useParams();
  const navigate = useNavigate();

  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState(calleeId || `room-${Date.now()}`);
  const [participants, setParticipants] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const ratePerMinute = 0.12;

  const localRef = useRef();
  const remoteRef = useRef();
  const roomRef = useRef();
  const timerRef = useRef();

  useEffect(() => {
    const joinRoom = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/");

      try {
        // 1. Get Twilio token
        const identity = user.uid;
        const tokenResp = await fetch(`${import.meta.env.VITE_TWILIO_TOKEN_SERVER}/token?identity=${encodeURIComponent(identity)}&room=${encodeURIComponent(roomName)}`);
        const tokenData = await tokenResp.json();
        if (!tokenResp.ok) throw new Error(tokenData.message || "Failed to get Twilio token");

        // 2. Connect to room
        const room = await Video.connect(tokenData.token, { name: roomName, audio: true, video: { width: 640 } });
        roomRef.current = room;
        setConnected(true);

        // Start call timer
        timerRef.current = setInterval(() => setSeconds(prev => prev + 1), 1000);

        // Attach local tracks
        const localTracks = Array.from(room.localParticipant.videoTracks).map(pub => pub.track);
        if (localTracks.length === 0) {
          const tracks = await Video.createLocalTracks({ audio: true, video: { width: 640 } });
          tracks.forEach(track => localRef.current?.appendChild(track.attach()));
        } else {
          localTracks.forEach(track => localRef.current?.appendChild(track.attach()));
        }

        // Existing participants
        Array.from(room.participants.values()).forEach(handleParticipantConnected);
        room.on("participantConnected", participant => {
          handleParticipantConnected(participant);
          setParticipants(prev => [...prev, participant]);
        });
        room.on("participantDisconnected", participant => {
          handleParticipantDisconnected(participant);
          setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
        });
        room.on("disconnected", cleanupRoom);

      } catch (err) {
        console.error("Join room failed", err);
        alert("Failed to join room: " + err.message);
        navigate(-1);
      }
    };

    joinRoom();
    return () => cleanupRoom();
  }, [roomName]);

  const handleParticipantConnected = participant => {
    const container = document.createElement("div");
    container.id = participant.sid;
    container.style.marginBottom = "8px";
    participant.tracks.forEach(pub => pub.isSubscribed && attachTrack(container, pub.track));
    participant.on("trackSubscribed", track => attachTrack(container, track));
    participant.on("trackUnsubscribed", track => detachTrack(container, track));
    remoteRef.current?.appendChild(container);
  };

  const attachTrack = (container, track) => {
    if (!container.querySelector(`video[data-track="${track.sid}"]`)) {
      const el = track.attach();
      el.dataset.track = track.sid;
      container.appendChild(el);
    }
  };

  const detachTrack = (container, track) => {
    try { track.detach().forEach(el => el.remove()); } catch {}
  };

  const handleParticipantDisconnected = participant => {
    document.getElementById(participant.sid)?.remove();
  };

  // ------------------- Billing -------------------
  const chargeWallet = async () => {
    const user = auth.currentUser;
    if (!user) return { amount: 0, status: "failed" };

    const cost = ((seconds / 60) * ratePerMinute).toFixed(2);
    const payload = { amount: parseFloat(cost), type: "video_call", roomName, durationSeconds: seconds, calleeId };

    try {
      const token = await user.getIdToken(true);
      const res = await fetch(`${backend}/api/wallet/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setBalance?.(data.newBalance);
        setTransactions?.(prev => [data.transaction, ...prev]);
        return { amount: cost, transaction: data.transaction };
      } else {
        console.error("Charge failed", data.error);
        return { amount: cost, status: "failed" };
      }
    } catch (err) {
      console.error("Wallet charge error", err);
      return { amount: cost, status: "failed" };
    }
  };

  // ------------------- Save call history -------------------
  const saveCallHistory = async (billingInfo) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const token = await user.getIdToken(true);
      const res = await fetch(`${backend}/api/callHistory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: user.uid,
          calleeId,
          roomName,
          durationSeconds: seconds,
          amount: billingInfo.amount,
          transactionId: billingInfo.transaction?._id,
          timestamp: new Date(),
          status: "completed",
        }),
      });
      if (!res.ok) throw new Error("Failed to save call history");
    } catch (err) {
      console.error("Save call history error", err);
    }
  };

  // ------------------- Cleanup -------------------
  const cleanupRoom = async () => {
    clearInterval(timerRef.current);

    // 1. Charge wallet
    const billingInfo = await chargeWallet();

    // 2. Save call history
    await saveCallHistory(billingInfo);

    // 3. Disconnect room
    const room = roomRef.current;
    if (room) {
      room.localParticipant.tracks.forEach(pub => { pub.track.stop?.(); pub.track.detach?.().forEach(n => n.remove()); });
      room.disconnect();
      roomRef.current = null;
    }

    setConnected(false);
    setParticipants([]);
    setSeconds(0);
    localRef.current && (localRef.current.innerHTML = "");
    remoteRef.current && (remoteRef.current.innerHTML = "");

    // 4. Navigate to CallHistoryPage
    navigate("/call-history");
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h3>Local</h3>
          <div ref={localRef} style={{ width: "100%", height: 280, background: "#000" }} />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h3>Remote ({participants.length})</h3>
          <div ref={remoteRef} style={{ width: "100%", height: 280, background: "#111", overflowY: "auto" }} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div><strong>Duration:</strong> {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2,"0")} min</div>
        <div><strong>Estimated Cost:</strong> ${((seconds/60)*ratePerMinute).toFixed(2)}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={cleanupRoom} style={{ padding: 8 }}>Leave Call</button>
      </div>
    </div>
  );
}