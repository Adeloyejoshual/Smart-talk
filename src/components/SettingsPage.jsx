import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState({ name: false, bio: false });

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;
      setUser(userAuth);
      setEmail(userAuth.email);

      const userRef = doc(db, "users", userAuth.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // First-time user
        await setDoc(userRef, {
          name: userAuth.displayName || "New User",
          email: userAuth.email,
          bio: "",
          createdAt: serverTimestamp(),
        });
        setName(userAuth.displayName || "New User");
      } else {
        const data = userSnap.data();
        setName(data.name || userAuth.displayName || "");
        setBio(data.bio || "");
      }

      // Live updates
      const unsub = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || "");
          setBio(data.bio || "");
        }
      });

      return () => unsub();
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (field) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);

    const updateData = {};
    if (field === "name") updateData.name = name;
    if (field === "bio") updateData.bio = bio;

    await updateDoc(userRef, updateData);
    setEditing((prev) => ({ ...prev, [field]: false }));
  };

  const isDark = theme === "dark";

  return (
    <div style={{ padding: 20, background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000", minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Name */}
      <Section title="Name" isDark={isDark}>
        {editing.name ? (
          <>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={selectStyle(isDark)}
            />
            <button onClick={() => handleSave("name")} style={btnStyle("#007bff")}>💾 Save</button>
            <button onClick={() => setEditing({ ...editing, name: false })} style={btnStyle("#d32f2f")}>✖ Cancel</button>
          </>
        ) : (
          <p onClick={() => setEditing({ ...editing, name: true })} style={{ cursor: "pointer" }}>{name || "Click to edit name"}</p>
        )}
      </Section>

      {/* Email (not editable) */}
      <Section title="Email" isDark={isDark}>
        <p>{email}</p>
      </Section>

      {/* Bio */}
      <Section title="Bio" isDark={isDark}>
        {editing.bio ? (
          <>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ ...selectStyle(isDark), height: 60 }}
            />
            <button onClick={() => handleSave("bio")} style={btnStyle("#007bff")}>💾 Save</button>
            <button onClick={() => setEditing({ ...editing, bio: false })} style={btnStyle("#d32f2f")}>✖ Cancel</button>
          </>
        ) : (
          <p onClick={() => setEditing({ ...editing, bio: true })} style={{ cursor: "pointer" }}>
            {bio || "Click to add bio"}
          </p>
        )}
      </Section>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={async () => { await signOut(auth); navigate("/"); }} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>
    </div>
  );
}

function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: 20, borderRadius: 12, marginTop: 25, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

const btnStyle = (bg) => ({ marginRight: 8, padding: "8px 12px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });