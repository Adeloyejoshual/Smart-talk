import React from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function VideoCallPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column"}}>
      <h2>Video Call: {chatId}</h2>
      <button onClick={()=>navigate(-1)}>End Call</button>
    </div>
  )
}