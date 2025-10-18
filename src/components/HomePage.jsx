// src/components/HomePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { app } from "../firebaseConfig"; // make sure firebaseConfig exports app

export default function HomePage() {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/chat");
    });
    return unsubscribe;
  }, [auth, navigate]);

  // Email login/register
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("✅ Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/chat");
    } catch (error) {
      alert(error.message);
    }
  };

  // Google sign in
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/chat");
    } catch (error) {
      alert("Google Sign-In failed");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f8fa",
        padding: "1rem",
      }}
    >
      <h1 style={{ fontSize: "28px", marginBottom: "10px" }}>
        Welcome to SmartTalk 💬
      </h1>
      <p style={{ color: "#555", marginBottom: "20px" }}>
        {isRegister
          ? "Create an account to start chatting"
          : "Sign in with your email to continue"}
      </p>

      <form
        onSubmit={handleEmailAuth}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "280px",
          gap: "12px",
        }}
      >
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "6px",
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "6px",
          }}
        />
        <button
          type="submit"
          style={{
            background: "#007bff",
            color: "white",
            border: "none",
            padding: "10px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {isRegister ? "Register" : "Login"}
        </button>
      </form>

      <p
        onClick={() => setIsRegister(!isRegister)}
        style={{
          marginTop: "10px",
          color: "#007bff",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {isRegister
          ? "Already have an account? Login"
          : "Don't have an account? Register"}
      </p>

      <p style={{ margin: "20px 0", color: "#888" }}>— or —</p>

      <button
        onClick={handleGoogleLogin}
        style={{
          background: "#4285F4",
          color: "white",
          border: "none",
          padding: "12px 20px",
          borderRadius: "6px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        🔑 Sign in with Google
      </button>
    </div>
  );
}