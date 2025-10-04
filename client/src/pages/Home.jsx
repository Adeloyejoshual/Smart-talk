import React from "react";
import { Link } from "react-router-dom";
import { auth } from "../firebaseClient";

export default function Home(){
  // For demo static chats
  const chats = [
    { id:"chat1", name:"Rose", last:"Hey, are you free?", time:"12:45" },
    { id:"chat2", name:"Family Group", last:"Don't forget milk", time:"09:30" }
  ];

  return (
    <div style={{maxWidth:900,margin:"20px auto"}}>
      <header style={{display:"flex",justifyContent:"space-between"}}>
        <h3>Chats</h3>
        <div>{auth.currentUser?.displayName}</div>
      </header>
      <div>
        {chats.map(c=>(
          <Link key={c.id} to={`/chat/${c.id}`} style={{display:"block",padding:12,borderBottom:"1px solid #eee",textDecoration:"none",color:"black"}}>
            <div style={{fontWeight:600}}>{c.name}</div>
            <div style={{color:"#555"}}>{c.last}</div>
            <div style={{color:"#999",fontSize:12}}>{c.time}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
