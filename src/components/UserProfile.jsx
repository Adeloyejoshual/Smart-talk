// src/components/UserProfile.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function UserProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === uid;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    displayName: "",
    email: "",
    about: "",
    photoURL: "",
  });

  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  // -----------------------------
  //  CLOUDINARY UPLOAD FUNCTION
  // -----------------------------
  const uploadToCloudinary = async (file, onProgress) => {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset)
        throw new Error("Cloudinary env not set");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress)
            onProgress(Math.round((e.loaded * 100) / e.total));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText).secure_url);
          } else reject(new Error("Cloudinary upload failed"));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(fd);
      });
    } catch (err) {
      throw err;
    }
  };

  // -----------------------------
  // LOAD PROFILE
  // -----------------------------
  useEffect(() => {
    async function loadProfile() {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProfile(snap.data());
      }
      setLoading(false);
    }
    loadProfile();
  }, [uid]);

  // -----------------------------
  // SAVE TEXT FIELDS
  // -----------------------------
  async function saveProfile() {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, {
      displayName: profile.displayName,
      email: profile.email,
      about: profile.about,
      photoURL: profile.photoURL,
    });

    setEditMode(false);
  }

  // -----------------------------
  // CHANGE PROFILE PICTURE
  // -----------------------------
  async function changePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const url = await uploadToCloudinary(file, (p) =>
        console.log("upload", p + "%")
      );

      setProfile((p) => ({ ...p, photoURL: url }));

      const ref = doc(db, "users", uid);
      await updateDoc(ref, { photoURL: url });

      alert("Profile picture updated!");
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* BACK ARROW */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-white text-2xl font-bold"
        >
          ←
        </button>
        <h2 className="text-xl font-semibold">Profile</h2>
      </div>

      <div className="flex flex-col items-center">
        <img
          src={profile.photoURL || "https://via.placeholder.com/120"}
          className="w-32 h-32 rounded-full object-cover border border-gray-700 mb-4"
        />

        {/* Upload button */}
        {isOwner && (
          <>
            <label
              htmlFor="photoUpload"
              className="bg-blue-600 px-4 py-2 rounded-lg text-white mb-4 cursor-pointer"
            >
              {uploading ? "Uploading..." : "Change Photo"}
            </label>

            <input
              id="photoUpload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={changePhoto}
            />
          </>
        )}

        {isOwner && !editMode && (
          <button
            className="bg-blue-600 px-4 py-2 rounded-lg text-white mb-4"
            onClick={() => setEditMode(true)}
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* VIEW MODE */}
      {!editMode && (
        <div className="space-y-4 mt-4">
          <div>
            <p className="text-gray-400">Name:</p>
            <p className="text-lg">{profile.displayName}</p>
          </div>

          <div>
            <p className="text-gray-400">Email:</p>
            <p className="text-lg">{profile.email}</p>
          </div>

          <div>
            <p className="text-gray-400">About:</p>
            <p className="text-lg">{profile.about || "No bio added."}</p>
          </div>
        </div>
      )}

      {/* EDIT MODE */}
      {editMode && isOwner && (
        <div className="space-y-4 mt-6">
          <div>
            <label className="text-gray-400">Name</label>
            <input
              type="text"
              className="w-full p-2 rounded bg-gray-800 text-white mt-1"
              value={profile.displayName}
              onChange={(e) =>
                setProfile({ ...profile, displayName: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-gray-400">Email</label>
            <input
              type="email"
              className="w-full p-2 rounded bg-gray-800 text-white mt-1"
              value={profile.email}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-gray-400">About</label>
            <textarea
              className="w-full p-2 rounded bg-gray-800 text-white mt-1"
              rows="4"
              value={profile.about}
              onChange={(e) =>
                setProfile({ ...profile, about: e.target.value })
              }
            />
          </div>

          <button
            onClick={saveProfile}
            className="w-full bg-green-600 py-2 rounded-lg text-white font-semibold"
          >
            Save Changes
          </button>

          <button
            onClick={() => setEditMode(false)}
            className="w-full bg-gray-600 py-2 rounded-lg text-white font-semibold mt-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}