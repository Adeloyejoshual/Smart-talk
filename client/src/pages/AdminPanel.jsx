import React from "react";
import axios from "axios";
import { auth } from "../firebaseClient";

export default function AdminPanel(){
  const [message, setMessage] = React.useState("");
  const API = import.meta.env.VITE_API_URL || "/api";

  const sendBroadcast = async () => {
    try {
      await axios.post(`${API}/admin/broadcast`, { adminEmail: auth.currentUser.email, message });
      alert("Broadcast queued (demo). Production: use Firebase Admin to write to Firestore.");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div style={{maxWidth:900,margin:"20px auto"}}>
      <h3>Admin Panel</h3>
      <textarea style={{width:"100%",minHeight:120}} value={message} onChange={e=>setMessage(e.target.value)} />
      <div style={{marginTop:8}}>
        <button onClick={sendBroadcast}>Send to all users (demo)</button>
      </div>
    </div>
  );
}
