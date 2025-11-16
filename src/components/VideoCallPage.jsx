// src/components/VideoCallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import Video from "twilio-video";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig"; // optional: to get current user info

export default function VideoCallPage() {
  const { uid: otherUidOrRoom } = useParams(); // route: /videocall/:uid  (we'll treat param as room name)
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState(otherUidOrRoom || `room-${Date.now()}`);
  const [identity, setIdentity] = useState(auth.currentUser?.uid || `anon-${Math.floor(Math.random()*10000)}`);
  const [room, setRoom] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const localRef = useRef();
  const remoteRef = useRef();

  useEffect(() => {
    // cleanup on unmount
    return () => {
      if (room) {
        room.localParticipant.tracks.forEach(t => t.track.stop && t.track.stop());
        room.disconnect();
      }
    };
  }, [room]);

  const attachTrack = (track, container) => {
    container.appendChild(track.attach());
  };

  const detachParticipantTracks = (participant) => {
    participant.tracks.forEach(publication => {
      if (publication.track) {
        publication.track.detach().forEach(el => el.remove());
      }
    });
  };

  const connectToRoom = async () => {
    setConnecting(true);
    try {
      // fetch token from our server
      const resp = await fetch(`${process.env.REACT_APP_BACKEND_URL || ""}/twilio/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, room: roomName }),
      });
      const data = await resp.json();
      if (!data.token) throw new Error(data.error || "No token received");

      const twRoom = await Video.connect(data.token, { audio: true, video: { width: 640 } });
      setRoom(twRoom);

      // attach local preview
      twRoom.localParticipant.videoTracks.forEach(pub => {
        attachTrack(pub.track, localRef.current);
      });

      // attach already present participants
      twRoom.participants.forEach(participant => {
        const container = document.createElement("div");
        container.id = participant.sid;
        remoteRef.current.appendChild(container);
        participant.tracks.forEach(publication => {
          if (publication.track) attachTrack(publication.track, container);
        });
        participant.on("trackSubscribed", track => attachTrack(track, container));
        participant.on("trackUnsubscribed", track => track.detach().forEach(el => el.remove()));
      });

      // listen for new participants
      twRoom.on("participantConnected", participant => {
        const container = document.createElement("div");
        container.id = participant.sid;
        remoteRef.current.appendChild(container);
        participant.on("trackSubscribed", track => attachTrack(track, container));
        participant.on("trackUnsubscribed", track => track.detach().forEach(el => el.remove()));
        // attach any existing tracks
        participant.tracks.forEach(publication => {
          if (publication.track) attachTrack(publication.track, document.getElementById(participant.sid));
        });
      });

      twRoom.on("participantDisconnected", participant => {
        // remove container
        const el = document.getElementById(participant.sid);
        if (el) el.remove();
      });

      twRoom.on("disconnected", () => {
        // clean local preview
        twRoom.localParticipant.tracks.forEach(pub => {
          if (pub.track) {
            pub.track.detach().forEach(el => el.remove());
            pub.track.stop && pub.track.stop();
          }
        });
        setRoom(null);
      });

    } catch (err) {
      console.error("connect error", err);
      alert("Could not connect: " + (err.message || err));
    } finally {
      setConnecting(false);
    }
  };

  const leave = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    navigate(-1);
  };

  return (
    <div style={{ padding: 12 }}>
      <header style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 18 }}>←</button>
        <h3 style={{ margin: 0 }}>Video Call</h3>
        <div style={{ marginLeft: "auto" }}>
          {room ? <button onClick={leave}>End Call</button> : <button onClick={connectToRoom} disabled={connecting}>{connecting ? "Joining..." : "Join"}</button>}
        </div>
      </header>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Local</div>
          <div ref={localRef} style={{ width: "100%", height: 240, background: "#222", borderRadius: 8, overflow: "hidden" }} />
        </div>

        <div style={{ flex: 2 }}>
          <div style={{ fontWeight: 600 }}>Participants</div>
          <div ref={remoteRef} style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 240, background: "#111", padding: 8, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}