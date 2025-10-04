import React from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseClient";
import { Link, useNavigate } from "react-router-dom";

export default function Login(){
  const nav = useNavigate();
  const [email,setEmail]=React.useState("");
  const [password,setPassword]=React.useState("");
  const [err,setErr]=React.useState("");

  const doLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth,email,password);
      nav("/");
    } catch(e) {
      setErr(e.message);
    }
  };

  return (
    <div style={{maxWidth:420,margin:"40px auto",padding:20}}>
      <h2>SmartTalk — Login</h2>
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={doLogin}>Login</button>
      <div style={{color:"red"}}>{err}</div>
      <p>Don't have an account? <Link to="/register">Register</Link></p>
    </div>
  );
}
