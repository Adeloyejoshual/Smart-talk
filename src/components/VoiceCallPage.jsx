// src/components/VoiceCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import Video from "twilio-video";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";

export default function VoiceCallPage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [roomName] = useState(uid || `voice-${Date.now()}`);
  const [identity] = useState(auth.currentUser?.uid || `anon-${Math.floor(Math.random()*10000)}`);
  const [room, setRoom] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const remoteAudioRef = useRef();

  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const connect = async () => {
    setConnecting(true);
    try {
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL || ""}/twilio/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, room: roomName }),
      });
      const data = await resp.json();
      if (!data.token) throw new Error(data.error || "No token");

      const twRoom = await Video.connect(data.token, { audio: true, video: false });
      setRoom(twRoom);

      // attach participant audio to DOM
      const attachParticipant = participant => {
        participant.tracks.forEach(publication => {
          if (publication.track && publication.track.kind === "audio") {
            const el = publication.track.attach();
            remoteAudioRef.current.appendChild(el);
          }
        });
        participant.on("trackSubscribed", track => {
          if (track.kind === "audio") remoteAudioRef.current.appendChild(track.attach());
        });
        participant.on("trackUnsubscribed", track => track.detach().forEach(e => e.remove()));
      };

      twRoom.participants.forEach(p => attachParticipant(p));
      twRoom.on("participantConnected", p => attachParticipant(p));
      twRoom.on("participantDisconnected", p => {
        const el = document.getElementById(p.sid);
        if (el) el.remove();
      });

    } catch (err) {
      console.error(err);
      alert("Could not join voice room");
    } finally {
      setConnecting(false);
    }
  };

  const end = () => {
    if (room) room.disconnect();
    navigate(-1);
  };

  return (
    <div style={{ padding: 12 }}>
      <header style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button onClick={() => navigate(-1)}>←</button>
        <h3 style={{ margin:0 }}>Voice Call</h3>
        <div style={{ marginLeft:"auto" }}>
          {!room ? <button onClick={connect} disabled={connecting}>{connecting ? "Joining..." : "Join"}</button> : <button onClick={end}>End</button>}
        </div>
      </header>

      <div style={{ marginTop: 16 }}>
        <div>Remote audio</div>
        <div ref={remoteAudioRef} />
      </div>
    </div>
  );
}