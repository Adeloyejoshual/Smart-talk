// src/components/CallHistoryPage.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  or,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

export default function CallHistoryPage() {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedCall, setSelectedCall] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "callHistory"),
      or(
        where("receiverId", "==", auth.currentUser.uid),
        where("callerId", "==", auth.currentUser.uid)
      ),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setHistory(data);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const filteredCalls = history.filter((call) => {
    const matchesSearch =
      call.callerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.receiverName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filter === "all" ? true : call.status === filter;

    return matchesSearch && matchesFilter;
  });

  const handleRedial = (call) => {
    // Redirect to call screen (you can replace with your actual call route)
    navigate(`/call/${call.receiverId}`);
  };

  const closeModal = () => setSelectedCall(null);

  return (
    <div style={container}>
      <h2 style={title}>📜 Call History</h2>

      {/* Search and Filter Controls */}
      <div style={controls}>
        <input
          type="text"
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInput}
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={selectBox}
        >
          <option value="all">All</option>
          <option value="missed">Missed</option>
          <option value="answered">Answered</option>
          <option value="outgoing">Outgoing</option>
        </select>
      </div>

      {/* List */}
      <div>
        {filteredCalls.length === 0 && (
          <p style={{ color: "#aaa", marginTop: "20px" }}>No calls found</p>
        )}

        {filteredCalls.map((call, i) => (
          <div
            key={i}
            style={card(call.status)}
            onClick={() => setSelectedCall(call)}
          >
            <div>
              <strong>{call.callerName || "Unknown"}</strong> →{" "}
              <span>{call.receiverName || "Unknown"}</span>
            </div>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              {new Date(call.timestamp).toLocaleString()}
            </p>
            <p style={{ fontSize: "13px", color: "#ccc" }}>
              Status:{" "}
              <b style={{ color: getStatusColor(call.status) }}>
                {call.status}
              </b>
            </p>
          </div>
        ))}
      </div>

      {/* 🪟 Call Details Modal */}
      {selectedCall && (
        <div style={overlay} onClick={closeModal}>
          <div
            style={modal}
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
          >
            <h3 style={{ marginBottom: "10px" }}>📞 Call Details</h3>
            <p>
              <b>Caller:</b> {selectedCall.callerName || "Unknown"}
            </p>
            <p>
              <b>Receiver:</b> {selectedCall.receiverName || "Unknown"}
            </p>
            <p>
              <b>Status:</b>{" "}
              <span style={{ color: getStatusColor(selectedCall.status) }}>
                {selectedCall.status}
              </span>
            </p>

            {selectedCall.startTime && (
              <p>
                <b>Start:</b>{" "}
                {new Date(selectedCall.startTime).toLocaleString()}
              </p>
            )}
            {selectedCall.endTime && (
              <p>
                <b>End:</b> {new Date(selectedCall.endTime).toLocaleString()}
              </p>
            )}
            {selectedCall.duration && (
              <p>
                <b>Duration:</b> {selectedCall.duration}s
              </p>
            )}

            <div style={modalBtns}>
              <button onClick={() => handleRedial(selectedCall)} style={callBtn}>
                🔁 Call Again
              </button>
              <button onClick={closeModal} style={closeBtn}>
                ✖ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🎨 Styles
const container = {
  padding: "20px",
  color: "#fff",
  background: "linear-gradient(180deg, #111, #1a1a1a)",
  minHeight: "100vh",
};

const title = { fontSize: "22px", marginBottom: "15px" };

const controls = {
  display: "flex",
  gap: "10px",
  marginBottom: "20px",
};

const searchInput = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#222",
  color: "#fff",
};

const selectBox = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#222",
  color: "#fff",
};

const card = (status) => ({
  background: "#1f1f1f",
  borderLeft: `5px solid ${getStatusColor(status)}`,
  marginBottom: "10px",
  padding: "12px",
  borderRadius: "10px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
  cursor: "pointer",
  transition: "transform 0.2s ease",
});

function getStatusColor(status) {
  switch (status) {
    case "missed":
      return "#ff5252";
    case "answered":
      return "#4caf50";
    case "outgoing":
      return "#2196f3";
    default:
      return "#aaa";
  }
}

// 🪟 Modal Styles
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modal = {
  background: "#222",
  padding: "20px 30px",
  borderRadius: "12px",
  width: "90%",
  maxWidth: "400px",
  boxShadow: "0 0 20px rgba(0,0,0,0.4)",
  color: "#fff",
};

const modalBtns = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "20px",
};

const callBtn = {
  background: "linear-gradient(135deg, #00e676, #00bfa5)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  padding: "10px 20px",
  cursor: "pointer",
};

const closeBtn = {
  background: "#555",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  padding: "10px 20px",
  cursor: "pointer",
};