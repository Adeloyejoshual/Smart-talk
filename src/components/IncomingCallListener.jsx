// src/components/IncomingCallListener.jsx
import React, { useEffect, useState, useRef } from "react";
import { onSnapshot, collection, query, where, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

export default function IncomingCallListener() {
  const [incomingCall, setIncomingCall] = useState(null);
  const ringtoneRef = useRef(null);
  const timerRef = useRef(null);
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
        }
      });
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  // 🎶 ringtone + vibrate + auto cancel
  useEffect(() => {
    if (incomingCall) {
      try {
        ringtoneRef.current?.play();
      } catch (e) {}
      if (navigator.vibrate) navigator.vibrate([300, 200, 300, 200]);
      timerRef.current = setTimeout(() => {
        cancelCall();
      }, 30000);
    }
    return () => {
      stopRinging();
    };
  }, [incomingCall]);

  const acceptCall = () => {
    stopRinging();
    navigate(`/call/${incomingCall.callerId}`);
  };

  const cancelCall = async () => {
    if (!incomingCall) return;
    await deleteDoc(doc(db, "calls", incomingCall.id));
    stopRinging();
    setIncomingCall(null);
  };

  const stopRinging = () => {
    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;
    navigator.vibrate(0);
    clearTimeout(timerRef.current);
  };

  if (!incomingCall) return null;

  return (
    <div style={overlayStyle}>
      <div style={popupStyle} className="animate-popup">
        <h2 style={titleStyle}>📞 Incoming Call</h2>
        <p style={nameStyle}>{incomingCall.callerName || "Unknown User"}</p>

        <div style={buttonContainer}>
          <button onClick={acceptCall} style={acceptBtnStyle}>
            ✅ Accept
          </button>
          <button onClick={cancelCall} style={rejectBtnStyle}>
            ❌ Reject
          </button>
        </div>

        <p style={{ fontSize: "12px", color: "#eee", marginTop: "10px" }}>
          Auto-cancel in 30s…
        </p>
      </div>
    </div>
  );
}

// 🌈 styles
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  backdropFilter: "blur(8px)",
};

const popupStyle = {
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "20px",
  padding: "25px 40px",
  textAlign: "center",
  color: "#fff",
  boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
  backdropFilter: "blur(20px)",
  animation: "fadeIn 0.3s ease",
};

const titleStyle = {
  fontSize: "22px",
  fontWeight: "bold",
  marginBottom: "10px",
};

const nameStyle = {
  fontSize: "18px",
  marginBottom: "20px",
};

const buttonContainer = {
  display: "flex",
  justifyContent: "center",
  gap: "20px",
};

const btnBase = {
  border: "none",
  borderRadius: "50%",
  width: "65px",
  height: "65px",
  fontSize: "16px",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "all 0.3s ease",
  color: "#fff",
  animation: "pulse 1.2s infinite",
};

const acceptBtnStyle = {
  ...btnBase,
  background: "linear-gradient(135deg, #0f0, #05a)",
  boxShadow: "0 0 15px rgba(0,255,0,0.6)",
};

const rejectBtnStyle = {
  ...btnBase,
  background: "linear-gradient(135deg, #f00, #a00)",
  boxShadow: "0 0 15px rgba(255,0,0,0.6)",
};

// 💫 Animations (inject CSS)
const style = document.createElement("style");
style.innerHTML = `
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 10px rgba(255,255,255,0.3); }
  50% { transform: scale(1.1); box-shadow: 0 0 25px rgba(255,255,255,0.6); }
  100% { transform: scale(1); box-shadow: 0 0 10px rgba(255,255,255,0.3); }
}`;
document.head.appendChild(style);