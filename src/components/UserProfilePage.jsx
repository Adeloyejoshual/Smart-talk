// src/components/UserProfile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { IoArrowBack } from "react-icons/io5";
import { FaPhoneAlt, FaVideo } from "react-icons/fa";

export default function UserProfile() {
  const navigate = useNavigate();
  const { uid } = useParams();

  const [userData, setUserData] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    async function loadUser() {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setUserData(snap.data());
    }
    loadUser();
  }, [uid]);

  if (!userData) return <div>Loading…</div>;

  const isOwner = currentUser?.uid === uid;

  return (
    <div style={{ width: "100%", height: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
      
      {/* ---------------- HEADER ---------------- */}
      <div
        style={{
          width: "100%",
          height: 60,
          background: "#1877F2",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          color: "#fff",
        }}
      >
        {/* Back */}
        <IoArrowBack size={28} onClick={() => navigate(-1)} style={{ cursor: "pointer" }} />

        {/* Name */}
        <div style={{ marginLeft: 12, fontSize: 20, fontWeight: 600 }}>
          {userData.name || "No Name"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
          {/* VOICE CALL */}
          <FaPhoneAlt
            size={22}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/voicecall/${uid}`)}
          />

          {/* VIDEO CALL */}
          <FaVideo
            size={22}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/videocall/${uid}`)}
          />
        </div>
      </div>

      {/* ---------------- CONTENT ---------------- */}
      <div style={{ padding: 20, textAlign: "center" }}>
        
        {/* Profile Picture */}
        <img
          src={userData.photoURL || "https://via.placeholder.com/120"}
          alt="profile"
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            objectFit: "cover",
            margin: "20px auto",
          }}
        />

        {/* Username + Email */}
        <h2 style={{ margin: 5 }}>{userData.name}</h2>
        <p style={{ color: "#666", marginBottom: 10 }}>{userData.email || "No email"}</p>

        {/* LAST SEEN */}
        <p style={{ fontSize: 14, color: "#777" }}>
          Last seen: {userData.lastSeen || "Unavailable"}
        </p>

        <hr style={{ margin: "25px 0" }} />

        {/* ---------------- CALL BUTTONS ---------------- */}
        <button
          onClick={() => navigate(`/voicecall/${uid}`)}
          style={{
            width: "100%",
            padding: 15,
            background: "#1877F2",
            color: "#fff",
            borderRadius: 10,
            border: "none",
            fontSize: 18,
            marginBottom: 15,
            cursor: "pointer",
          }}
        >
          📞 Voice Call
        </button>

        <button
          onClick={() => navigate(`/videocall/${uid}`)}
          style={{
            width: "100%",
            padding: 15,
            background: "#1877F2",
            color: "#fff",
            borderRadius: 10,
            border: "none",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          🎥 Video Call
        </button>

        {/* Only the owner can edit */}
        {!isOwner && (
          <p style={{ marginTop: 25, color: "#777" }}>
            You cannot edit this profile.
          </p>
        )}

        {isOwner && (
          <button
            onClick={() => navigate("/settings")}
            style={{
              marginTop: 20,
              width: "100%",
              padding: 15,
              background: "#e5e5e5",
              borderRadius: 10,
              border: "none",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
}