// /src/pages/CallPage.jsx
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseClient";
import { useTheme } from "../context/ThemeContext";
import { Phone, Video, PhoneOff, Clock, RefreshCw } from "lucide-react";

export default function CallPage({ onStartCall }) {
  const [calls, setCalls] = useState([]);
  const { theme } = useTheme();
  const me = auth.currentUser;

  useEffect(() => {
    if (!me) return;
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCalls(list.filter((c) => c.callerId === me.uid || c.calleeId === me.uid));
    });
    return () => unsub();
  }, [me]);

  const fmtTime = (t) => {
    if (!t) return "";
    const d = t.toDate ? t.toDate() : new Date(t);
    return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "ended":
        return <Phone size={18} color={theme === "dark" ? "#00ff99" : "#007a3d"} />;
      case "declined":
        return <PhoneOff size={18} color="#ff4444" />;
      case "missed":
        return <Clock size={18} color="#ff9900" />;
      default:
        return <Phone size={18} color="#888" />;
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: theme === "dark" ? "#000" : "#f8f8f8",
        color: theme === "dark" ? "#fff" : "#000",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: theme === "dark" ? "1px solid #222" : "1px solid #ddd",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Recent Calls
      </div>

      {calls.length === 0 && (
        <div style={{ textAlign: "center", marginTop: 40, opacity: 0.6 }}>
          No recent calls yet.
        </div>
      )}

      <div>
        {calls.map((c) => {
          const isMeCaller = c.callerId === me?.uid;
          const otherName = isMeCaller ? c.calleeName : c.callerName;
          const duration = c.duration || 0;
          const minutes = Math.floor(duration / 60);
          const seconds = (duration % 60).toString().padStart(2, "0");

          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: theme === "dark" ? "1px solid #222" : "1px solid #eee",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {c.type === "video" ? (
                  <Video size={22} color={theme === "dark" ? "#0af" : "#007aff"} />
                ) : (
                  <Phone size={22} color={theme === "dark" ? "#0af" : "#007aff"} />
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{otherName}</div>
                  <div
                    style={{
                      fontSize: 13,
                      color:
                        c.status === "missed"
                          ? "#ff6600"
                          : c.status === "declined"
                          ? "#ff3333"
                          : theme === "dark"
                          ? "#aaa"
                          : "#555",
                    }}
                  >
                    {isMeCaller ? "You →" : "← You"} {c.status}{" "}
                    {c.status === "ended" && `(${minutes}:${seconds})`}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{fmtTime(c.timestamp)}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {getStatusIcon(c.status)}
                <button
                  onClick={() => onStartCall(c.type, { id: c.calleeId, name: c.calleeName })}
                  style={{
                    border: "none",
                    background: theme === "dark" ? "#111" : "#f1f1f1",
                    color: theme === "dark" ? "#0af" : "#007aff",
                    borderRadius: 20,
                    padding: "6px 10px",
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <RefreshCw size={14} />
                  Call
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}