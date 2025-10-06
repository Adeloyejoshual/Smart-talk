// /src/pages/CallHistoryPage.jsx
import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseClient";

export default function CallHistoryPage({ onBack }) {
  const [calls, setCalls] = useState([]);
  const me = auth.currentUser;

  useEffect(() => {
    if (!me) return;

    const q = query(
      collection(db, "calls"),
      where("participants", "array-contains", me.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCalls(data);
    });
    return () => unsub();
  }, [me]);

  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusIcon = (call) => {
    if (call.status === "missed") return "❌";
    if (call.status === "ended") return "📞";
    if (call.status === "active") return "🟢";
    return "⏳";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", alignItems: "center" }}>
        <button onClick={onBack} style={{ marginRight: 8 }}>←</button>
        <h3>Call History</h3>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {calls.map((call) => {
          const isOutgoing = call.fromUserId === me.uid;
          return (
            <div
              key={call.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span>{getStatusIcon(call)}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {isOutgoing ? "Outgoing" : "Incoming"} {call.type} call
                  </div>
                  <small style={{ color: "#555" }}>
                    {call.status === "missed" ? "Missed" : call.status} • {fmtTime(call.createdAt)}
                  </small>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}