import React from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../firebaseClient";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

export default function ChatPage(){
  const { id } = useParams();
  const [messages,setMessages] = React.useState([]);
  const [text,setText] = React.useState("");

  React.useEffect(() => {
    const q = query(collection(db, "chats", id, "messages"), orderBy("createdAt","asc"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [id]);

  const send = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "chats", id, "messages"), {
      text,
      senderId: auth.currentUser.uid,
      senderName: auth.currentUser.displayName || auth.currentUser.email,
      createdAt: serverTimestamp()
    });
    setText("");
  };

  return (
    <div style={{maxWidth:900,margin:"20px auto"}}>
      <h3>Chat {id}</h3>
      <div style={{height:400,overflowY:"auto",border:"1px solid #eee",padding:8}}>
        {messages.map(m=>(
          <div key={m.id} style={{marginBottom:8}}>
            <div style={{fontSize:12,color:"#666"}}>{m.senderName}</div>
            <div style={{display:"inline-block",padding:8,background:"#f1f1f1",borderRadius:8}}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input style={{flex:1}} value={text} onChange={e=>setText(e.target.value)} />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
