// src/components/VoiceCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import Video from "twilio-video";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";

export default function VoiceCallPage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const roomRef = useRef(null);
  const remoteRef = useRef(null);

  useEffect(() => {
    const identity = auth.currentUser?.uid || `anon-${Math.floor(Math.random()*10000)}`;
    const roomName = uid || `audio-room-${Date.now()}`;

    const joinAudio = async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_TWILIO_TOKEN_SERVER}/token?identity=${encodeURIComponent(identity)}&room=${encodeURIComponent(roomName)}`);
        const { token } = await resp.json();
        const room = await Video.connect(token, { name: roomName, audio: true, video: false });
        roomRef.current = room;
        setConnected(true);

        // attach remote audio tracks
        const attachParticipant = (p) => {
          p.tracks.forEach(pub => {
            if (pub.isSubscribed && pub.track.kind === 'audio') {
              remoteRef.current.appendChild(pub.track.attach());
            }
          });
          p.on('trackSubscribed', track => { if (track.kind === 'audio') remoteRef.current.appendChild(track.attach()); });
        };

        room.participants.forEach(attachParticipant);
        room.on('participantConnected', attachParticipant);
        room.on('participantDisconnected', p => {
          // remove participant audio elements
          const el = remoteRef.current.querySelector(`[data-sid="${p.sid}"]`);
          if (el) el.remove();
        });
        room.on('disconnected', () => cleanup());
      } catch (err) { console.error(err); alert('Could not start audio call'); }
    };

    joinAudio();

    return () => cleanup();
  }, []);

  const cleanup = () => {
    const room = roomRef.current;
    if (room) {
      room.localParticipant.tracks.forEach(pub => {
        pub.track.stop && pub.track.stop();
        pub.track.detach && pub.track.detach().forEach(el => el.remove());
      });
      room.disconnect();
      roomRef.current = null;
    }
    setConnected(false);
    navigate(-1);
  };

  return (
    <div style={{ padding: 12 }}>
      <h3>Voice Call</h3>
      <div>
        <div>Connected: {connected ? 'Yes' : 'Connecting...'}</div>
        <div ref={remoteRef} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={cleanup}>Hang Up</button>
      </div>
    </div>
  );
}