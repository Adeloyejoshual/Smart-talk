import React from "react";
import { auth, googleProvider, db } from "../firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // check if user exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
        });
      }

      // redirect to chat page
      navigate("/chat");
    } catch (err) {
      console.error("Login failed:", err);
      alert("Error signing in with Google: " + err.message);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #111, #222)",
        color: "#fff",
      }}
    >
      <h2>Welcome to SmartTalk 💬</h2>
      <p>Sign in with your Google account to start chatting</p>
      <button
        onClick={handleGoogleLogin}
        style={{
          background: "#4285F4",
          border: "none",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: "8px",
          fontSize: "16px",
          cursor: "pointer",
          marginTop: "20px",
        }}
      >
        🔑 Sign in with Google
      </button>
    </div>
  );
}