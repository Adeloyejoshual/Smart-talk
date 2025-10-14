// src/components/HomePage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, signInWithGoogle } from "../firebaseConfig";

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) navigate("/chatlist");
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate("/chatlist"); // redirect to chat list after login
    } catch (err) {
      console.error(err);
      alert("Google Sign-In failed");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f5f5f5",
      }}
    >
      <h1>Welcome to CallChat App</h1>
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
          marginTop: "20px",
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}