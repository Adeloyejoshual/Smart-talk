import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { app } from "../firebaseConfig";

export default function HomePage() {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/chat");
    });
    return unsubscribe;
  }, [auth, navigate]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await updateProfile(userCredential.user, { displayName: name });
        alert("✅ Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/chat");
    } catch (error) {
      alert(error.message);
    }
  };

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
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #007bff 0%, #00c6ff 100%)",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.15)",
          backdropFilter: "blur(10px)",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          width: "90%",
          maxWidth: "400px",
          color: "#fff",
          textAlign: "center",
          animation: "fadeIn 0.6s ease-in-out",
        }}
      >
        <h1 style={{ fontSize: "26px", marginBottom: "8px" }}>SmartTalk 💬</h1>
        <p style={{ fontSize: "14px", opacity: 0.9, marginBottom: "20px" }}>
          {isRegister
            ? "Create your account and start chatting instantly"
            : "Login to your account and continue chatting"}
        </p>

        <form
          onSubmit={handleEmailAuth}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          {isRegister && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={isRegister}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                outline: "none",
                fontSize: "15px",
              }}
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              outline: "none",
              fontSize: "15px",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              outline: "none",
              fontSize: "15px",
            }}
          />

          <button
            type="submit"
            style={{
              background: "#fff",
              color: "#007bff",
              fontWeight: "600",
              border: "none",
              borderRadius: "8px",
              padding: "12px",
              cursor: "pointer",
              transition: "0.3s",
            }}
            onMouseOver={(e) => (e.target.style.background = "#e6e6e6")}
            onMouseOut={(e) => (e.target.style.background = "#fff")}
          >
            {isRegister ? "Register" : "Login"}
          </button>
        </form>

        <p
          onClick={() => setIsRegister(!isRegister)}
          style={{
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "14px",
            marginBottom: "16px",
          }}
        >
          {isRegister
            ? "Already have an account? Login"
            : "Don’t have an account? Register"}
        </p>

        <p style={{ fontSize: "13px", opacity: 0.8, marginBottom: "10px" }}>or</p>

        <button
          onClick={handleGoogleLogin}
          style={{
            background: "#4285F4",
            color: "white",
            border: "none",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "15px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          🔑 Sign in with Google
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}