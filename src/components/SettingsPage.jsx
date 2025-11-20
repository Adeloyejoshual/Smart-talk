import React, { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return setUser(null);
      setUser(u);
      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
      }
      // live updates
      return onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const d = s.data();
        setName(d.name || "");
        setBio(d.bio || "");
        setProfilePic(d.profilePic || null);
      });
    });

    return () => unsubAuth();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: "#f8f8f8" }}>
      <button onClick={() => navigate("/chat")} style={{ marginBottom: 20 }}>⬅ Back</button>
      
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", padding: 16, borderRadius: 12 }}>
        <div style={{
          width: 88, height: 88, borderRadius: 44,
          background: profilePic ? `url(${profilePic}) center/cover` : "#999"
        }} />
        <div>
          <h2>{name || "Unnamed"}</h2>
          <p>{bio || "No bio yet — click ⋮ → Edit Info to add one."}</p>
          <p>{user.email}</p>
        </div>
        <button onClick={() => navigate("/edit-profile")} style={{ marginLeft: "auto" }}>⋮</button>
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={handleLogout} style={{ padding: 10, background: "#d32f2f", color: "#fff", borderRadius: 50 }}>🚪 Logout</button>
      </div>
    </div>
  );
}