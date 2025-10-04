import React from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebaseClient";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Register(){
  const nav = useNavigate();
  const [email,setEmail]=React.useState("");
  const [password,setPassword]=React.useState("");
  const [name,setName]=React.useState("");
  const [err,setErr]=React.useState("");

  const doRegister = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(cred.user,{ displayName: name });
      // Create initial wallet + bonus server-side
      await axios.post(`${import.meta.env.VITE_API_URL || "/api"}/wallet/add`, { uid: cred.user.uid, amount: Number(process.env.VITE_NEW_USER_BONUS || 5) });
      nav("/");
    } catch(e) {
      setErr(e.message);
    }
  };

  return (
    <div style={{maxWidth:420,margin:"40px auto",padding:20}}>
      <h2>Register</h2>
      <input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Password" value={password} type="password" onChange={e=>setPassword(e.target.value)} />
      <button onClick={doRegister}>Register</button>
      <div style={{color:"red"}}>{err}</div>
    </div>
  );
}
