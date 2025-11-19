// src/pages/VoiceCallPage.jsx
import React, { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { auth, db } from "../firebaseConfig";

export default function VoiceCallPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const callStartRef = useRef(null);
  const callTimerRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  const [duration, setDuration] = React.useState(0);

  useEffect(() => {
    callStartRef.current = Date.now();

    // Start timer
    callTimerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);

    return () => clearInterval(callTimerRef.current);
  }, []);

  const saveCallHistory = async (status = "completed") => {
    try {
      // Get friend ID from chat
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      if (!chatDoc.exists()) return;
      const data = chatDoc.data();
      const friendId = data.participants.find(p => p !== myUid);

      await axios.post("http://localhost:5000/api/call/add", {
        chatId,
        participants: [myUid, friendId],
        type: "voice",
        duration,
        status,
        startedAt: new Date(callStartRef.current),
        endedAt: new Date(),
      });
      console.log("Call history saved");
    } catch (err) {
      console.error("Failed to save call history", err);
    }
  };

  const endCall = async (missed = false) => {
    clearInterval(callTimerRef.current);
    await saveCallHistory(missed ? "missed" : "completed");
    navigate(`/chat/${chatId}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <h2>Voice Call with Friend</h2>
      <p>Duration: {Math.floor(duration / 60)}:{("0" + (duration % 60)).slice(-2)}</p>
      <button onClick={() => endCall(false)} style={{ padding: "10px 20px", marginTop: 20 }}>End Call</button>
      <button onClick={() => endCall(true)} style={{ padding: "10px 20px", marginTop: 10, background: "#f55", color: "#fff" }}>Missed / Cancel</button>
    </div>
  );
}
