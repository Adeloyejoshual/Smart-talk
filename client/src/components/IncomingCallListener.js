import React, { useEffect, useState } from "react";
import { db, auth } from "../firebaseClient";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Video, PhoneOff, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function IncomingCallListener() {
  const [incoming, setIncoming] = useState(null);
  const me = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!me) return;
    const q = query(collection(db, "calls"), where("calleeId", "==", me.uid));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        const call = { id: change.doc.id, ...change.doc.data() };
        if (call.status === "ringing") setIncoming(call);
      });
    });
    return () => unsub();
  }, [me]);

  const acceptCall = async () => {
    await updateDoc(doc(db, "calls", incoming.id), { status: "accepted" });
    setIncoming(null);
    navigate("/videocall", { state: { callee: incoming.callerId } });
  };

  const declineCall = async () => {
    await updateDoc(doc(db, "calls", incoming.id), { status: "declined" });
    setIncoming(null);
  };

  if (!incoming) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        color: "#fff",
      }}
    >
      <div
        style={{
          background: "#1c1c1e",
          padding: "24px 28px",
          borderRadius: 16,
          textAlign: "center",
          width: 300,
        }}
      >
        <Video size={36} color="#0af" />
        <h3 style={{ marginTop: 10 }}>{incoming.callerName}</h3>
        <p style={{ fontSize: 14, opacity: 0.8 }}>Incoming Video Call...</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 18 }}>
          <button
            onClick={acceptCall}
            style={{
              background: "#0af",
              border: "none",
              borderRadius: 50,
              width: 60,
              height: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Phone size={26} color="#fff" />
          </button>

          <button
            onClick={declineCall}
            style={{
              background: "#ff3b30",
              border: "none",
              borderRadius: 50,
              width: 60,
              height: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <PhoneOff size={26} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}