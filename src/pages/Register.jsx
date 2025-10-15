// src/pages/Register.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ✉️ Register with email/password
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return alert("All fields required");

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });

      // Save user info in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        name,
        email,
        createdAt: new Date().toISOString(),
      });

      navigate("/chat"); // ✅ Redirect after registration
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Register with Google
  const handleGoogleSignup = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save user info if not already saved
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      navigate("/chat");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={container}>
      <div style={formBox}>
        <h2>🧑‍💻 Create Account</h2>

        <form onSubmit={handleRegister} style={form}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={input}
          />
          <button type="submit" style={btn} disabled={loading}>
            {loading ? "Creating..." : "Register"}
          </button>
        </form>

        <p style={{ color: "#bbb" }}>or</p>

        <button onClick={handleGoogleSignup} style={googleBtn}>
          🌐 Sign Up with Google
        </button>

        <p style={{ marginTop: "20px" }}>
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            style={{ color: "#4fc3f7", cursor: "pointer" }}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

// 🖌️ Styles
const container = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
  color: "#fff",
};

const formBox = {
  background: "rgba(255,255,255,0.1)",
  padding: "40px 50px",
  borderRadius: "15px",
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
  textAlign: "center",
  width: "90%",
  maxWidth: "400px",
};

const form = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  marginBottom: "15px",
};

const input = {
  padding: "10px 15px",
  borderRadius: "8px",
  border: "none",
  outline: "none",
  background: "#333",
  color: "#fff",
};

const btn = {
  padding: "10px 15px",
  background: "linear-gradient(135deg, #4caf50, #2e7d32)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  cursor: "pointer",
};

const googleBtn = {
  ...btn,
  background: "linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)",
  fontWeight: "bold",
};
