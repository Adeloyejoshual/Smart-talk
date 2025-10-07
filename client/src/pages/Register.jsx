import React from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebaseClient";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";

async function createUserWallet(userId) {
  const walletRef = doc(db, "wallets", userId);
  await setDoc(walletRef, {
    balance: 5.0,          // 🎁 starting balance
    createdAt: Date.now(),
  });
}

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [err, setErr] = React.useState("");

  const doRegister = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await createUserWallet(cred.user.uid);
      nav("/");
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 20 }}>
      <h2>Register</h2>
      <input
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />
      <button onClick={doRegister} style={{ padding: "10px 20px" }}>
        Register
      </button>
      <div style={{ color: "red", marginTop: 10 }}>{err}</div>
    </div>
  );
}