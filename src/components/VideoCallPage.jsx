// src/components/VideoCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import Video from "twilio-video";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig"; // optional to get identity

export default function VideoCallPage() {
  const { uid } = useParams(); // we navigate to /videocall/:uid (or pass room)
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState(uid || `room-${Date.now()}`);
  const [participants, setParticipants] = useState([]);
  const localRef = useRef();
  const remoteRef = useRef();
  const roomRef = useRef(null);

  useEffect(() => {
    const identity = auth.currentUser?.uid || `anon-${Math.floor(Math.random()*1000)}`;

    // fetch token from your server
    const join = async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_TWILIO_TOKEN_SERVER}/token?identity=${encodeURIComponent(identity)}&room=${encodeURIComponent(roomName)}`);
        const data = await resp.json();
        if (!resp.ok) {
          console.error('Failed to get token', data);
          alert('Could not get token for video. Check server.');
          return;
        }

        const token = data.token;
        const room = await Video.connect(token, { name: roomName, audio: true, video: { width: 640 } });
        roomRef.current = room;
        setConnected(true);

        // attach local tracks
        const localTrack = Array.from(room.localParticipant.videoTracks)[0]?.track;
        if (localTrack && localRef.current) {
          localRef.current.innerHTML = "";
          localRef.current.appendChild(localTrack.attach());
        } else {
          // ensure we create and attach local video track
          const localTracks = await Video.createLocalTracks({ audio: true, video: { width: 640 } });
          const vt = localTracks.find(t => t.kind === 'video');
          const at = localTracks.find(t => t.kind === 'audio');
          if (vt && localRef.current) localRef.current.appendChild(vt.attach());
        }

        // existing participants
        room.participants.forEach(p => {
          handleParticipantConnected(p);
          setParticipants(prev => [...prev, p]);
        });

        // new participant
        room.on("participantConnected", p => {
          handleParticipantConnected(p);
          setParticipants(prev => [...prev, p]);
        });

        // participant disconnected
        room.on("participantDisconnected", p => {
          handleParticipantDisconnected(p);
          setParticipants(prev => prev.filter(x => x.sid !== p.sid));
        });

        // when disconnected
        room.on("disconnected", () => {
          cleanupRoom();
        });

      } catch (err) {
        console.error("join error", err);
        alert("Failed to join room");
      }
    };

    join();

    // cleanup on unmount
    return () => { cleanupRoom(); };
  }, [roomName]);

  const handleParticipantConnected = (participant) => {
    const container = document.createElement("div");
    container.id = participant.sid;
    container.style.marginBottom = "8px";

    participant.tracks.forEach(publication => {
      if (publication.isSubscribed) attachTrack(container, publication.track);
    });

    participant.on("trackSubscribed", track => attachTrack(container, track));
    participant.on("trackUnsubscribed", track => detachTrack(container, track));

    if (remoteRef.current) remoteRef.current.appendChild(container);
  };

  const attachTrack = (container, track) => {
    container.appendChild(track.attach());
  };

  const detachTrack = (container, track) => {
    try { track.detach().forEach(el => el.remove()); } catch (e) {}
  };

  const handleParticipantDisconnected = (participant) => {
    const el = document.getElementById(participant.sid);
    if (el) el.remove();
  };

  const cleanupRoom = () => {
    const room = roomRef.current;
    if (room) {
      room.localParticipant.tracks.forEach(publication => {
        try { publication.track.stop && publication.track.stop(); } catch {}
        try { publication.track.detach && publication.track.detach().forEach(node => node.remove()); } catch {}
      });
      room.disconnect();
      roomRef.current = null;
    }
    setConnected(false);
    setParticipants([]);
    if (localRef.current) localRef.current.innerHTML = "";
    if (remoteRef.current) remoteRef.current.innerHTML = "";
    navigate(-1); // go back to chat
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h3>Local</h3>
          <div ref={localRef} style={{ width: "100%", height: 280, background: "#000" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3>Remote</h3>
          <div ref={remoteRef} style={{ width: "100%", height: 280, background: "#111", overflowY: "auto" }} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={cleanupRoom} style={{ padding: 8 }}>Leave</button>
      </div>
    </div>
  );
}