import React, { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseClient";
import { useTheme } from "../context/ThemeContext";
import { Phone, Video, PhoneOff, Clock, RefreshCw } from "lucide-react";

export default function CallPage({ onStartCall }) {
  const [calls, setCalls] = useState([]);
  const [filter, setFilter] = useState("all");
  const { theme } = useTheme();
  const me = auth.currentUser;
  const prevMissedIds = useRef(new Set()); // to track missed call IDs

  // 🧠 Load call data
  useEffect(() => {
    if (!me) return;
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const myCalls = list.filter(
        (c) => c.callerId === me.uid || c.calleeId === me.uid
      );
      setCalls(myCalls);
    });
    return () => unsub();
  }, [me]);

  // 🔔 Detect new missed calls and play sound
  useEffect(() => {
    const missedNow = calls
      .filter((c) => c.status === "missed" && c.calleeId === me?.uid)
      .map((c) => c.id);

    const newOnes = missedNow.filter((id) => !prevMissedIds.current.has(id));
    if (newOnes.length > 0) {
      const audio = new Audio("/sounds/missed_call.mp3"); // place sound in public/sounds/
      audio.volume = 0.4;
      audio.play().catch(() => {});
    }

    prevMissedIds.current = new Set(missedNow);
  }, [calls, me]);

  const fmtTime = (t) => {
    if (!t) return "";
    const d = t.toDate ? t.toDate() : new Date(t);
    return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "ended":
        return <Phone size={18} color="#00c851" />;
      case "declined":
        return <PhoneOff size={18} color="#888" />;
      case "missed":
        return <Clock size={18} color="#ff3b30" />;
      default:
        return <Phone size={18} color={theme === "dark" ? "#888" : "#777"} />;
    }
  };

  const filteredCalls = calls.filter((c) => {
    if (filter === "all") return true;
    if (filter === "missed") return c.status === "missed";
    if (filter === "voice") return c.type === "voice";
    if (filter === "video") return c.type === "video";
    return true;
  });

  const missedCallsCount = calls.filter(
    (c) => c.status === "missed" && c.calleeId === me?.uid
  ).length;

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
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: theme === "dark" ? "#000" : "#fff",
          borderBottom: theme === "dark" ? "1px solid #222" : "1px solid #ddd",
          padding: "14px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontWeight: 600,
            fontSize: 18,
            marginBottom: 10,
          }}
        >
          <span>Recent Calls</span>
          {missedCallsCount > 0 && (
            <span
              style={{
                background: "#ff3b30",
                color: "#fff",
                borderRadius: 20,
                fontSize: 12,
                padding: "3px 10px",
                fontWeight: 500,
              }}
            >
              {missedCallsCount} Missed Call
              {missedCallsCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {["all", "voice", "video", "missed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                flexShrink: 0,
                background:
                  filter === f
                    ? theme === "dark"
                      ? "#0a84ff"
                      : "#007aff"
                    : theme === "dark"
                    ? "#111"
                    : "#eee",
                color: filter === f ? "#fff" : theme === "dark" ? "#ccc" : "#333",
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredCalls.length === 0 && (
        <div style={{ textAlign: "center", marginTop: 40, opacity: 0.6 }}>
          No {filter !== "all" ? `${filter} ` : ""}calls yet.
        </div>
      )}

      <div>
        {filteredCalls.map((c) => {
          const isMeCaller = c.callerId === me?.uid;
          const otherName = isMeCaller ? c.calleeName : c.callerName;
          const duration = c.duration || 0;
          const minutes = Math.floor(duration / 60);
          const seconds = (duration % 60).toString().padStart(2, "0");

          const missed = c.status === "missed";
          const declined = c.status === "declined";
          const ended = c.status === "ended";

          const bgColor = missed
            ? theme === "dark"
              ? "rgba(255,59,48,0.08)"
              : "rgba(255,59,48,0.05)"
            : declined
            ? theme === "dark"
              ? "rgba(136,136,136,0.08)"
              : "rgba(136,136,136,0.05)"
            : ended
            ? theme === "dark"
              ? "rgba(0,200,81,0.08)"
              : "rgba(0,200,81,0.05)"
            : "transparent";

          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: theme === "dark" ? "1px solid #222" : "1px solid #eee",
                background: bgColor,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {c.type === "video" ? (
                  <Video size={22} color="#007aff" />
                ) : (
                  <Phone size={22} color="#007aff" />
                )}
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: missed
                        ? "#ff3b30"
                        : ended
                        ? "#00c851"
                        : declined
                        ? "#999"
                        : undefined,
                    }}
                  >
                    {otherName}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: missed
                        ? "#ff3b30"
                        : declined
                        ? "#999"
                        : ended
                        ? "#00c851"
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
                  onClick={() =>
                    onStartCall(c.type, { id: c.calleeId, name: c.calleeName })
                  }
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