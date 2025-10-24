import React, { useState } from "react";
import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import {
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref"); // read ?ref=uid

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // ✅ Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // ✅ Create user doc with $5 welcome bonus
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        balance: 5,
        referredBy: referralCode || null,
        referralCount: 0,
        createdAt: serverTimestamp(),
      });

      // ✅ Credit referrer if referral code is valid
      if (referralCode) {
        const referrerRef = doc(db, "users", referralCode);
        const referrerSnap = await getDoc(referrerRef);
        if (referrerSnap.exists()) {
          await updateDoc(referrerRef, {
            balance: increment(0.5),
            referralCount: increment(1),
          });
        }
      }

      // ✅ Send verification email
      await sendEmailVerification(user);

      setSuccess(
        "Account created successfully! 🎉 You’ve received $5. Please verify your email."
      );
      setTimeout(() => navigate("/chat"), 2000);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "60px auto",
        padding: "25px",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        background: "#fff",
        textAlign: "center",
      }}
    >
      <h2>🆕 Sign Up</h2>
      {referralCode && (
        <p style={{ color: "#007BFF", fontWeight: "bold" }}>
          🎁 You’re joining via referral — you’ll get +$5!
        </p>
      )}
      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            ...btnStyle,
            backgroundColor: loading ? "#ccc" : "#007BFF",
          }}
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <p style={{ marginTop: "15px" }}>
        Already have an account?{" "}
        <span
          onClick={() => navigate("/")}
          style={{ color: "#007BFF", cursor: "pointer" }}
        >
          Login
        </span>
      </p>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  fontSize: "16px",
};

const btnStyle = {
  width: "100%",
  padding: "10px",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "16px",
  cursor: "pointer",
};