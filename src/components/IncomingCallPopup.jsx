// src/components/IncomingCallPopup.jsx
import React, { useEffect, useState, useRef } from "react";
import { onSnapshot, collection, query, where, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

export default function IncomingCallPopup() {
  const [incomingCall, setIncomingCall] = useState(null);
  const ringtoneRef = useRef(null);
  const navigate = useNavigate();

  // 🔔 preload ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio("/ringtone.mp3");
    ringtoneRef.current.loop = true;
  }, []);

  // 👂 listen for new calls
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "calls"), where("receiverId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.offer && !data?.answered) {
          setIncomingCall({ id: docSnap.id, ...data });
          ringtoneRef.current?.play();
        }
      });
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  const acceptCall = () => {
    stopRinging();
    navigate(`/call?type=${incomingCall.type}&callerId=${incomingCall.callerId}&callId=${incomingCall.id}`);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    await deleteDoc(doc(db, "calls", incomingCall.id));
    stopRinging();
    setIncomingCall(null);
  };

  const stopRinging = () => {
    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;
  };

  if (!incomingCall) return null;

  return (
    <div style={popupContainer}>
      <div style={popupBox} className="slide-up-popup">
        <h4 style={{ marginBottom: "5px" }}>📞 {incomingCall.callerName || "Unknown User"}</h4>
        <p style={{ fontSize: "13px", color: "#ccc" }}>
          Incoming {incomingCall.type === "video" ? "Video" : "Voice"} Call
        </p>

        <div style={btnContainer}>
          <button onClick={acceptCall} style={acceptBtn}>✅ Accept</button>
          <button onClick={rejectCall} style={rejectBtn}>❌ Reject</button>
        </div>
      </div>
    </div>
  );
}

// 🌈 styles
const popupContainer = {
  position: "fixed",
  bottom: "20px",
  right: "20px",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const popupBox = {
  background: "rgba(25, 25, 25, 0.95)",
  padding: "15px 25px",
  borderRadius: "15px",
  color: "#fff",
  boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
  textAlign: "center",
  transform: "translateY(100%)",
  animation: "slideUp 0.4s ease-out forwards",
};

const btnContainer = {
  display: "flex",
  justifyContent: "center",
  gap: "10px",
  marginTop: "10px",
};

const acceptBtn = {
  background: "linear-gradient(45deg, #00e676, #00bfa5)",
  border: "none",
  borderRadius: "8px",
  padding: "6px 12px",
  cursor: "pointer",
  color: "#fff",
  fontWeight: "bold",
  boxShadow: "0 0 10px rgba(0,255,150,0.4)",
};

const rejectBtn = {
  background: "linear-gradient(45deg, #ff1744, #d50000)",
  border: "none",
  borderRadius: "8px",
  padding: "6px 12px",
  cursor: "pointer",
  color: "#fff",
  fontWeight: "bold",
  boxShadow: "0 0 10px rgba(255,0,0,0.4)",
};

// 🎬 inject animation CSS
const style = document.createElement("style");
style.innerHTML = `
@keyframes slideUp {
  0% { opacity: 0; transform: translateY(100%); }
  100% { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(style);