// src/components/VideoCallPage.jsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function VideoCallPage() {
  const { uid } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ height: "100vh", background: "#000", color: "#fff", padding: 30 }}>
      <h1>Video Call</h1>
      <p>Calling user: {uid}</p>

      <button
        onClick={() => navigate(-1)}
        style={{
          marginTop: 30,
          padding: 15,
          width: "100%",
          borderRadius: 10,
          border: "none",
          fontSize: 18,
          background: "red",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        End Call
      </button>
    </div>
  );
}