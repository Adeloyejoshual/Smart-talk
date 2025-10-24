// ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// Message status
const MessageStatus = ({ status }) => {
  if (status === "sending") return <span>⌛</span>;
  if (status === "sent") return <span>✔</span>;
  if (status === "delivered") return <span>✔✔</span>;
  if (status === "seen") return <span style={{ color: "#34B7F1" }}>✔✔</span>;
  return null;
};

// Format last seen
const formatLastSeen = (ts, isOnline) => {
  if (isOnline) return "Online";
  if (!ts) return "";
  const last = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMin = Math.floor((new Date() - last) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return last.toLocaleDateString();
};

// Format message day
const formatMessageDay = (date) => {
  const msgDate = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  if (msgDate.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
  return msgDate.toLocaleDateString();
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [friendTyping, setFriendTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  // Toggle three-dot menu
  const toggleMenu = () => setMenuOpen(!menuOpen);

  // Scroll to bottom
  useEffect(() => {
    const container = endRef.current?.parentElement;
    if (!container) return;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 100) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, localMessages]);

  // Load chat + friend
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend = null;

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) { navigate("/chat"); return; }
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });

      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriendInfo({ id: fsnap.id, ...fsnap.data() });
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
          }
        });
      }
    })();

    return () => unsubFriend && unsubFriend();
  }, [chatId, myUid, navigate]);

  // Listen messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // mark delivered
      msgs.filter(m => m.sender !== myUid && m.status === "sent")
          .forEach(m => updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }).catch(() => {}));
    });
    return () => unsub();
  }, [chatId, myUid]);

  // Typing indicator
  useEffect(() => {
    if (!myUid) return;
    const userRef = doc(db, "users", myUid);
    let timer;
    if (text) {
      updateDoc(userRef, { [`typing.${chatId}`]: true }).catch(() => {});
      clearTimeout(timer);
      timer = setTimeout(() => updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {}), 1200);
    } else {
      updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
    }
    return () => clearTimeout(timer);
  }, [text, myUid, chatId]);

  // Push local message
  const pushLocal = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    setLocalMessages(prev => [...prev, { id: tempId, ...payload, createdAt: new Date(), status: "sending" }]);
    return tempId;
  };

  // Upload file
  const uploadFile = (file) => {
    const tempId = pushLocal({ sender: myUid, text: "", fileURL: URL.createObjectURL(file), fileName: file.name, type: file.type.startsWith("image/") ? "image" : "file", status: "sending" });
    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    task.on("state_changed", null, err => console.error(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, "chats", chatId, "messages"), { sender: myUid, text: "", fileURL: url, fileName: file.name, type: file.type.startsWith("image/") ? "image" : "file", createdAt: serverTimestamp(), status: "sent" });
        setLocalMessages(prev => prev.filter(m => m.id !== tempId));
      }
    );
  };

  // Select files
  const onFilesSelected = e => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setFiles(prev => [...prev, ...chosen]);
    setPreviews(prev => [...prev, ...chosen.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null)]);
    chosen.forEach(uploadFile);
  };

  // Send text
  const handleSend = async () => {
    if ((!text || !text.trim()) && files.length === 0) return;
    if (text?.trim()) pushLocal({ sender: myUid, text: text.trim(), type: "text", status: "sending" });
    const msgCol = collection(db, "chats", chatId, "messages");
    if (text?.trim()) {
      await addDoc(msgCol, { sender: myUid, text: text.trim(), fileURL: null, type: "text", createdAt: serverTimestamp(), status: "sent" });
      await updateDoc(doc(db, "chats", chatId), { lastMessage: text.trim(), lastMessageAt: serverTimestamp() });
      setText("");
    }
    files.forEach(uploadFile);
    setFiles([]);
    setPreviews([]);
  };

  // Merge messages
  const allMessages = [...messages, ...localMessages].sort((a,b) => {
    const aTime = a.createdAt?.seconds ? a.createdAt.seconds*1000 : a.createdAt?.getTime();
    const bTime = b.createdAt?.seconds ? b.createdAt.seconds*1000 : b.createdAt?.getTime();
    return aTime - bTime;
  });

  const groupedMessages = [];
  let lastDay = "";
  allMessages.forEach(m => {
    const dayLabel = formatMessageDay(m.createdAt);
    if (dayLabel !== lastDay) { groupedMessages.push({ type:"day", id:`day-${dayLabel}-${m.id}`, label:dayLabel }); lastDay = dayLabel; }
    groupedMessages.push(m);
  });

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background: wallpaper? `url(${wallpaper}) center/cover no-repeat` : isDark?"#121212":"#f5f5f5", color: isDark?"#fff":"#000" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 18px", borderBottom:"1px solid #ccc", position:"sticky", top:0, background:isDark?"#1e1e1e":"#fff", zIndex:2 }}>
        <button onClick={()=>navigate("/chat")} style={{fontSize:22, background:"transparent", border:"none", cursor:"pointer", marginRight:10}}>←</button>
        <img src={friendInfo?.photoURL||"/default-avatar.png"} alt="avatar" style={{width:45,height:45,borderRadius:"50%",objectFit:"cover",cursor:"pointer"}} onClick={()=>friendInfo&&navigate(`/profile/${friendInfo.id}`)}/>
        <div style={{marginLeft:10}}>
          <h4 style={{margin:0}}>{friendInfo?.displayName||chatInfo?.name||"Friend"}</h4>
          <small style={{color:"#34B7F1"}}>{friendTyping?"typing...":formatLastSeen(friendInfo?.lastSeen, friendInfo?.isOnline)}</small>
        </div>
        <div style={{marginLeft:"auto", position:"relative"}}>
          <button onClick={toggleMenu} style={{fontSize:22, background:"transparent", border:"none", cursor:"pointer"}}>⋮</button>
          {menuOpen && (
            <div style={{position:"absolute", top:30, right:0, background:isDark?"#2c2c2c":"#fff", border:"1px solid #ccc", borderRadius:6, boxShadow:"0 2px 6px rgba(0,0,0,0.2)", zIndex:5, minWidth:120}}>
              <button style={{padding:"8px 12px", width:"100%", textAlign:"left", background:"transparent", border:"none", cursor:"pointer"}} onClick={()=>alert("View Profile")}>View Profile</button>
              <button style={{padding:"8px 12px", width:"100%", textAlign:"left", background:"transparent", border:"none", cursor:"pointer"}} onClick={()=>alert("Mute Chat")}>Mute Chat</button>
              <button style={{padding:"8px 12px", width:"100%", textAlign:"left", background:"transparent", border:"none", cursor:"pointer"}} onClick={()=>alert("Delete Chat")}>Delete Chat</button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1, overflowY:"auto", padding:10}}>
        {groupedMessages.map(item => {
          if (item.type==="day") return <div key={item.id} style={{textAlign:"center", margin:"10px 0", color:"#888", fontSize:12, fontWeight:600}}>{item.label}</div>
          const m=item;
          const mine=m.sender===myUid;
          return (
            <div key={m.id} style={{display:"flex", justifyContent:mine?"flex-end":"flex-start", marginBottom:6}}>
              <div style={{background:mine?"#34B7F1":"#e5e5ea", color:mine?"#fff":"#000", padding:"8px 12px", borderRadius:15, maxWidth:"70%", wordBreak:"break-word"}}>
                {m.type==="text"&&m.text}
                {m.type==="image"&&<img src={m.fileURL} alt="sent" style={{width:150,borderRadius:10}} />}
                {m.type==="file"&&<a href={m.fileURL} target="_blank" rel="noreferrer" style={{color:mine?"#fff":"#007BFF"}}>📎 {m.fileName}</a>}
                <div style={{fontSize:10,textAlign:"right"}}><MessageStatus status={m.status}/></div>
              </div>
            </div>
          )
        })}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div style={{display:"flex", gap:6, padding:10, borderTop:"1px solid #ccc"}}>
        <input type="file" multiple onChange={onFilesSelected} style={{display:"none"}} id="fileInput"/>
        <label htmlFor="fileInput" style={{cursor:"pointer"}}>📎</label>
        <input type="text" placeholder="Type a message" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} style={{flex:1, padding:"8px 12px", borderRadius:20, border:"1px solid #ccc"}}/>
        <button onClick={handleSend} style={{background:"#34B7F1", color:"#fff", border:"none", padding:"8px 16px", borderRadius:20, cursor:"pointer"}}>Send</button>
      </div>

      {/* File previews */}
      {previews.length>0 && <div style={{display:"flex", gap:8, padding:6, overflowX:"auto"}}>{previews.map((p,idx)=><div key={idx} style={{position:"relative"}}>{p?<img src={p} alt="preview" style={{width:60,height:60,objectFit:"cover",borderRadius:10}} />:<span>{files[idx]?.name}</span>}</div>)}</div>}
    </div>
  )
}