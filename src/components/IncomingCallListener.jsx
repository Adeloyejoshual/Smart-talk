// src/components/IncomingCallListener.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  onSnapshot,
  collection,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

export default function IncomingCallListener() {
  const [incomingCall, setIncomingCall] = useState(null);
  const ringtoneRef = useRef(null);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  // 🎵 Preload ringtone
  useEffect(() => {
    ringtoneRef.current = new Audio("/ringtone.mp3");
    ringtoneRef.current.loop = true;
  }, []);

  // 👂 Listen for incoming calls
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (change.type === "added" && data?.offer && !data?.answered) {
          setIncomingCall({ id: change.doc.id, ...data });
        }
      });
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  // 🎶 Play ringtone + auto cancel after 30s
  useEffect(() => {
    if (incomingCall) {
      try {
        ringtoneRef.current?.play();
      } catch (err) {
        console.warn("Ringtone autoplay blocked:", err);
      }

      if (navigator.vibrate) navigator.vibrate([300, 200, 300, 200]);

      timerRef.current = setTimeout(() => {
        handleReject();
      }, 30000);
    }

    return () => stopRinging();
  }, [incomingCall]);

  const stopRinging = () => {
    ringtoneRef.current?.pause();
    ringtoneRef.current.currentTime = 0;
    navigator.vibrate(0);
    clearTimeout(timerRef.current);
  };

  const handleAccept = async () => {
    if (!incomingCall) return;
    stopRinging();

    // Optional: mark as answered (so it doesn't trigger again)
    await deleteDoc(doc(db, "calls", incomingCall.id));

    // Redirect to call page with params
    navigate(
      `/call?type=${incomingCall.callType || "voice"}&chatId=${
        incomingCall.chatId
      }&caller=${encodeURIComponent(incomingCall.callerName || "Unknown")}`
    );

    setIncomingCall(null);
  };

  const handleReject = async () => {
    if (!incomingCall) return;
    await deleteDoc(doc(db, "calls", incomingCall.id));
    stopRinging();
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <div style={overlayStyle}>
      <div style={popupStyle}>
        <h2 style={titleStyle}>
          {incomingCall.callType === "video" ? "🎥 Video Call" : "📞 Voice Call"}
        </h2>
        <p style={nameStyle}>{incomingCall.callerName || "Unknown User"}</p>

        <div style={buttonContainer}>
          <button onClick={handleAccept} style={acceptBtnStyle}>
            ✅ Accept
          </button>
          <button onClick={handleReject} style={rejectBtnStyle}>
            ❌ Reject
          </button>
        </div>

        <p style={{ fontSize: "12px", color: "#ddd", marginTop: "12px" }}>
          Auto-cancel in 30s…
        </p>
      </div>
    </div>
  );
}

// 🎨 Styles
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  backdropFilter: "blur(6px)",
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

const baseButton = {
  border: "none",
  borderRadius: "50%",
  width: "65px",
  height: "65px",
  fontSize: "16px",
  cursor: "pointer",
  color: "#fff",
  fontWeight: "bold",
  transition: "transform 0.2s",
};

const acceptBtnStyle = {
  ...baseButton,
  background: "linear-gradient(135deg, #00ff99, #00aaff)",
  boxShadow: "0 0 15px rgba(0,255,100,0.5)",
};

const rejectBtnStyle = {
  ...baseButton,
  background: "linear-gradient(135deg, #ff4444, #cc0000)",
  boxShadow: "0 0 15px rgba(255,0,0,0.5)",
};

// 💫 Inject CSS animations
const style = document.createElement("style");
style.innerHTML = `
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}`;
document.head.appendChild(style);