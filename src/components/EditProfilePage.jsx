// src/components/EditProfilePage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const EditProfilePage = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const profileInputRef = useRef(null);
  const BIO_LIMIT = 80;

  // Load existing data
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setEmail(data.email || user.email);
        setProfilePic(data.profilePic || "");
      }
    };

    load();
  }, [user]);

  // Cloudinary uploader
  const uploadToCloudinary = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary keys missing.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );

    const data = await res.json();
    return data.secure_url;
  };

  const onProfileFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setProfilePic(URL.createObjectURL(file));
  };

  const removeProfilePhoto = () => {
    setSelectedFile(null);
    setProfilePic("");
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    let uploadedUrl = profilePic;

    if (selectedFile) {
      uploadedUrl = await uploadToCloudinary(selectedFile);
    }

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      name,
      bio,
      email,
      profilePic: uploadedUrl,
      updatedAt: serverTimestamp(),
    });

    setSaving(false);
    navigate("/settings");
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "500px",
        margin: "0 auto",
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "transparent",
          border: "none",
          fontSize: "18px",
          marginBottom: "15px",
        }}
      >
        ← Back
      </button>

      {/* Profile Photo */}
      <div style={{ textAlign: "center", marginBottom: "25px" }}>
        <img
          src={
            profilePic ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png"
          }
          alt="Profile"
          style={{
            width: "110px",
            height: "110px",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />

        <br />

        <button
          onClick={() => profileInputRef.current.click()}
          style={{
            marginTop: "10px",
            padding: "8px 15px",
            borderRadius: "10px",
            border: "none",
            background: "#007bff",
            color: "#fff",
          }}
        >
          Choose Photo
        </button>

        {profilePic && (
          <button
            onClick={removeProfilePhoto}
            style={{
              marginLeft: "10px",
              padding: "8px 15px",
              borderRadius: "10px",
              border: "1px solid #999",
              background: "#f5f5f5",
            }}
          >
            Remove
          </button>
        )}

        <input
          type="file"
          ref={profileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={onProfileFileChange}
        />
      </div>

      {/* Name */}
      <label style={{ fontWeight: "600" }}>Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          marginBottom: "15px",
        }}
      />

      {/* Bio with character countdown */}
      <label style={{ fontWeight: "600" }}>Bio</label>
      <textarea
        value={bio}
        onChange={(e) =>
          setBio(e.target.value.slice(0, BIO_LIMIT)) // enforce max 80 chars
        }
        placeholder="Your bio"
        rows={3}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          marginBottom: "5px",
        }}
      />
      <div style={{ textAlign: "right", fontSize: "12px", color: "#555" }}>
        {BIO_LIMIT - bio.length} characters remaining
      </div>

      {/* Email (read only) */}
      <label style={{ fontWeight: "600" }}>Email</label>
      <input
        value={email}
        readOnly
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: "#eee",
          marginBottom: "20px",
        }}
      />

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: "20px",
          border: "none",
          fontSize: "16px",
          background: "#28a745",
          color: "white",
          fontWeight: "600",
        }}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
};

export default EditProfilePage;