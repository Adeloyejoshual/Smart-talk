import React, { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import BottomNav from "../components/BottomNav";
import CallModal from "../components/CallModal";
import { motion } from "framer-motion";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export default function CallPage({ currentTab, onTabChange, currentUser }) {
  const { theme } = useTheme();
  const [activeCall, setActiveCall] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);

  // 🧠 Listen to call history from Firestore (real-time)
  useEffect(() => {
    const q = query(collection(db, "calls"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRecentCalls(data);
    });
    return () => unsub();
  }, []);

  // 🕹️ Start a new call
  const startCall = async (user, type) => {
    setActiveCall({ user, type });

    // Log call start
    await addDoc(collection(db, "calls"), {
      caller: currentUser?.name || "You",
      callee: user.name,
      type,
      status: "started",
      duration: 0,
      timestamp: serverTimestamp(),
    });
  };

  // 🧾 End call
  const handleEndCall = async () => {
    if (activeCall) {
      await addDoc(collection(db, "calls"), {
        caller: currentUser?.name || "You",
        callee: activeCall.user.name,
        type: activeCall.type,
        status: "ended",
        duration: Math.floor(Math.random() * 300), // Example: 0–5 min random duration
        timestamp: serverTimestamp(),
      });
    }
    setActiveCall(null);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: theme === "dark" ? "#000" : "#fafafa",
        color: theme === "dark" ? "#fff" : "#000",
      }}
    >
      {/* 🔹 Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: theme === "dark" ? "1px solid #222" : "1px solid #ddd",
          fontSize: "18px",
          fontWeight: 600,
        }}
      >
        Calls
      </div>

      {/* 🔹 Recent Calls List */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {recentCalls.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 40, opacity: 0.6 }}>No recent calls</div>
        ) : (
          recentCalls.map((call) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 10px",
                background: theme === "dark" ? "#1c1c1e" : "#fff",
                borderRadius: 10,
                marginBottom: 10,
                boxShadow:
                  theme === "dark"
                    ? "0 1px 3px rgba(255,255,255,0.05)"
                    : "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {call.caller === currentUser?.name ? call.callee : call.caller}
                </div>
                <div style={{ fontSize: 13, color: theme === "dark" ? "#aaa" : "#666" }}>
                  {call.type === "voice" ? "🎙️ Voice" : "📹 Video"} •{" "}
                  {new Date(call.timestamp?.seconds * 1000).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => startCall({ name: call.callee }, call.type)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme === "dark" ? "#0a84ff" : "#007aff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Call
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* 🔹 Bottom Navigation */}
      {!activeCall && (
        <BottomNav current={currentTab} onChange={onTabChange} />
      )}

      {/* 🔹 Active Call Modal */}
      {activeCall && (
        <CallModal
          type={activeCall.type}
          user={activeCall.user}
          onClose={handleEndCall}
        />
      )}
    </div>
  );
}