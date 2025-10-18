// src/components/HomePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { app } from "../firebaseConfig";

export default function HomePage() {
  const auth = getAuth(app);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  // Redirect logged-in user automatically
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/chat");
    });
    return unsub;
  }, [auth, navigate]);

  // 🔐 Email & Password auth
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        alert("✅ Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/chat");
    } catch (error) {
      alert(error.message);
    }
  };

  // 🔑 Google Sign-In
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/chat");
    } catch (error) {
      alert("❌ Google Sign-In failed: " + error.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1>SmartTalk 💬</h1>
        <p>
          {isRegister
            ? "Create your account to start chatting instantly"
            : "Welcome back! Login to continue chatting"}
        </p>

        <form onSubmit={handleAuth} style={styles.form}>
          {isRegister && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={styles.input}
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            {isRegister ? "Register" : "Login"}
          </button>
        </form>

        <p style={styles.toggle} onClick={() => setIsRegister(!isRegister)}>
          {isRegister
            ? "Already have an account? Login"
            : "Don’t have an account? Register"}
        </p>

        <hr style={styles.divider} />
        <button onClick={handleGoogleLogin} style={styles.googleButton}>
          🔑 Sign in with Google
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #007bff 0%, #00c6ff 100%)",
    fontFamily: "'Poppins', sans-serif",
  },
  card: {
    background: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(10px)",
    padding: "40px",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    width: "90%",
    maxWidth: "400px",
    color: "#fff",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "20px",
  },
  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    outline: "none",
    fontSize: "15px",
  },
  button: {
    background: "#fff",
    color: "#007bff",
    fontWeight: "600",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    cursor: "pointer",
    transition: "0.3s",
  },
  toggle: {
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "14px",
    marginTop: "16px",
  },
  divider: {
    border: "0.5px solid rgba(255,255,255,0.3)",
    margin: "20px 0",
  },
  googleButton: {
    background: "#4285F4",
    color: "white",
    border: "none",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "15px",
    cursor: "pointer",
    width: "100%",
  },
};