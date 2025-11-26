// src/components/EditProfilePage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const NAME_LIMIT = 25;
const BIO_LIMIT = 80;

const EditProfilePage = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const profileInputRef = useRef(null);

  // Load user data
  useEffect(() => {
    if (!user) return;

    const loadUser = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || "");
          setBio(data.bio || "");
          setEmail(data.email || user.email);
          setProfilePic(data.profilePic || "");
        }
      } catch (err) {
        console.error("Failed to load user data:", err);
        setError("Failed to load profile. Try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [user]);

  // Clean up object URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (profilePic && selectedFile) URL.revokeObjectURL(profilePic);
    };
  }, [profilePic, selectedFile]);

  // Cloudinary uploader
  const uploadToCloudinary = async (file) => {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) throw new Error("Cloudinary keys missing.");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      return data.secure_url;
    } catch (err) {
      console.error("Upload failed:", err);
      throw new Error("Image upload failed");
    }
  };

  // File selection
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

  // Save updates
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError("");

    try {
      let uploadedUrl = profilePic;
      if (selectedFile) uploadedUrl = await uploadToCloudinary(selectedFile);

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name,
        bio,
        email,
        profilePic: uploadedUrl,
        updatedAt: serverTimestamp(),
      });

      navigate("/settings");
    } catch (err) {
      console.error(err);
      setError("Failed to save profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Generate initials if no profile picture
  const getInitials = (fullName) => {
    if (!fullName) return "NA";
    const names = fullName.trim().split(" ");
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  if (loading) return <div style={{ textAlign: "center", padding: 50 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "transparent",
          border: "none",
          fontSize: 18,
          marginBottom: 15,
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      {error && (
        <div style={{ color: "red", marginBottom: 15, textAlign: "center" }}>{error}</div>
      )}

      {/* Profile Photo */}
      <div style={{ textAlign: "center", marginBottom: 25 }}>
        {profilePic ? (
          <img
            src={profilePic}
            alt="Profile"
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "#007bff",
              color: "#fff",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 36,
              fontWeight: "bold",
              margin: "0 auto",
            }}
          >
            {getInitials(name)}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => profileInputRef.current.click()}
            style={{
              padding: "8px 15px",
              borderRadius: 10,
              border: "none",
              background: "#007bff",
              color: "#fff",
              cursor: "pointer",
              marginRight: 10,
            }}
            onMouseEnter={(e) => (e.target.style.opacity = 0.8)}
            onMouseLeave={(e) => (e.target.style.opacity = 1)}
          >
            Choose Photo
          </button>

          {profilePic && (
            <button
              onClick={removeProfilePhoto}
              style={{
                padding: "8px 15px",
                borderRadius: 10,
                border: "1px solid #999",
                background: "#f5f5f5",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.target.style.opacity = 0.8)}
              onMouseLeave={(e) => (e.target.style.opacity = 1)}
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
      </div>

      {/* Name */}
      <label style={{ fontWeight: 600 }}>Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, NAME_LIMIT))}
        maxLength={NAME_LIMIT}
        placeholder="Full name"
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ccc",
          marginBottom: 5,
        }}
      />
      <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
        {NAME_LIMIT - name.length} characters remaining
      </div>

      {/* Bio */}
      <label style={{ fontWeight: 600 }}>Bio</label>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
        maxLength={BIO_LIMIT}
        placeholder="Your bio"
        rows={3}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ccc",
          marginBottom: 5,
        }}
      />
      <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
        {BIO_LIMIT - bio.length} characters remaining
      </div>

      {/* Email */}
      <label style={{ fontWeight: 600 }}>Email</label>
      <input
        value={email}
        readOnly
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ccc",
          background: "#eee",
          marginBottom: 20,
        }}
      />

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 20,
          border: "none",
          fontSize: 16,
          background: "#28a745",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.target.style.opacity = 0.9)}
        onMouseLeave={(e) => (e.target.style.opacity = 1)}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
};

export default EditProfilePage;