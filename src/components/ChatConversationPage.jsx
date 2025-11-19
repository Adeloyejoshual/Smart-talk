// src/components/ChatConversationPage.jsx
import React, { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  getDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  serverTimestamp,
  limit as fsLimit,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import "../styles/ChatConversationPage.css"; // We'll create this next

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];

// Small helpers
const fmtTime = (ts) => ts?.toDate ? ts.toDate().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : "";
const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear()!==now.getFullYear()? "numeric": undefined });
};

const detectFileType = (file) => {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  return "file";
};

// Cloudinary upload helper
const uploadToCloudinary = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary env not set"));
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded*100)/e.total));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const res = JSON.parse(xhr.responseText);
          resolve(res.secure_url || res.url);
        } else reject(new Error("Upload failed: "+xhr.status));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      xhr.send(fd);
    } catch(err){ reject(err); }
  });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme==="dark";
  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const longPressTimer = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const swipeStartX = useRef(null);

  // State
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [uploadingIds, setUploadingIds] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // ---------- Load chat & friend ----------
  useEffect(()=>{
    if(!chatId) return;
    let unsubChat = null;
    const loadMeta = async()=>{
      try{
        const cRef = doc(db,"chats",chatId);
        const cSnap = await getDoc(cRef);
        if(cSnap.exists()){
          const data = cSnap.data();
          setChatInfo({id:cSnap.id,...data});
          const friendId = data.participants?.find(p=>p!==myUid);
          if(friendId){
            const fRef = doc(db,"users",friendId);
            const fSnap = await getDoc(fRef);
            if(fSnap.exists()) setFriendInfo({id:fSnap.id,...fSnap.data()});
          }
        }
        unsubChat = onSnapshot(doc(db,"chats",chatId),(s)=>{if(s.exists()) setChatInfo(prev=>({...prev,...s.data()}));});
      }catch(e){console.error(e);}
    };
    loadMeta();
    return ()=>{if(unsubChat) unsubChat();}
  },[chatId,myUid]);

  // ---------- Messages realtime ----------
  useEffect(()=>{
    if(!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db,"chats",chatId,"messages");
    const q = query(msgsRef,orderBy("createdAt","asc"),fsLimit(2000));
    const unsub = onSnapshot(q,(snap)=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      const filtered = docs.filter(m=>!(m.deletedFor?.includes(myUid)));
      setMessages(filtered);
      filtered.forEach(async(m)=>{
        if(m.senderId!==myUid && m.status==="sent"){
          try{await updateDoc(doc(db,"chats",chatId,"messages",m.id),{status:"delivered"});}catch(e){}
        }
      });
      setLoadingMsgs(false);
      setTimeout(()=>{if(isAtBottom) endRef.current?.scrollIntoView({behavior:"smooth"});},80);
    });
    return ()=>unsub();
  },[chatId,myUid,isAtBottom]);

  // ---------- Scroll detection ----------
  useEffect(()=>{
    const el = messagesRefEl.current;
    if(!el) return;
    const onScroll=()=>{setIsAtBottom(el.scrollHeight-el.scrollTop-el.clientHeight<80);};
    el.addEventListener("scroll",onScroll);
    return ()=>el.removeEventListener("scroll",onScroll);
  },[]);

  const scrollToBottom=()=>{endRef.current?.scrollIntoView({behavior:"smooth"}); setIsAtBottom(true);};

  // ---------- Mark seen ----------
  useEffect(()=>{
    const onVisibility=async()=>{
      if(document.visibilityState!=="visible") return;
      const lastIncoming = [...messages].reverse().find(m=>m.senderId!==myUid);
      if(lastIncoming && lastIncoming.status!=="seen"){
        try{await updateDoc(doc(db,"chats",chatId,"messages",lastIncoming.id),{status:"seen"});}catch(e){}
      }
    };
    document.addEventListener("visibilitychange",onVisibility);
    onVisibility();
    return ()=>document.removeEventListener("visibilitychange",onVisibility);
  },[messages,chatId,myUid]);

  // ---------- File select & preview ----------
  const onFilesSelected=(e)=>{
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    const newPreviews = files.map(f=>({
      url: f.type.startsWith("image/")||f.type.startsWith("video/")? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f
    }));
    setSelectedFiles(prev=>[...prev,...files]);
    setPreviews(prev=>[...prev,...newPreviews]);
    setSelectedPreviewIndex(prev=>prev>=0?prev:0);
  };

  // ---------- Send message ----------
  const sendTextMessage = async ()=>{
    const blockedBy = chatInfo?.blockedBy||[];
    if(blockedBy.includes(myUid)) return alert("You are blocked in this chat.");
    
    if(selectedFiles.length>0){
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for(const file of filesToSend){
        try{
          const placeholder = {
            senderId: myUid, text:"", mediaUrl:"", mediaType:detectFileType(file),
            fileName:file.name, createdAt:serverTimestamp(), status:"uploading", reactions:{}
          };
          const mRef = await addDoc(collection(db,"chats",chatId,"messages"),placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev=>({...prev,[messageId]:0}));
          const url = await uploadToCloudinary(file,(pct)=>setUploadingIds(prev=>({...prev,[messageId]:pct})));
          await updateDoc(doc(db,"chats",chatId,"messages",messageId),{mediaUrl:url,status:"sent",sentAt:serverTimestamp()});
          setTimeout(()=>setUploadingIds(prev=>{const c={...prev}; delete c[messageId]; return c;}),200);
        }catch(err){console.error("upload error",err);}
      }
      return;
    }

    if(text.trim()){
      try{
        const payload = { senderId:myUid, text:text.trim(), mediaUrl:"", mediaType:null, createdAt:serverTimestamp(), status:"sent", reactions:{} };
        if(replyTo){
          payload.replyTo = {id:replyTo.id, text:replyTo.text||replyTo.mediaType, senderId:replyTo.senderId};
          setReplyTo(null);
        }
        await addDoc(collection(db,"chats",chatId,"messages"),payload);
        setText("");
        setTimeout(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},80);
      }catch(e){console.error(e); alert("Failed to send");}
    }
  };

  // ---------- Voice recording ----------
  useEffect(()=>{setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));},[]);
  const startRecording = async ()=>{
    if(!recorderAvailable) return alert("Recording not supported");
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current=[];
      mr.ondataavailable=(ev)=>{if(ev.data.size) recorderChunksRef.current.push(ev.data);};
      mr.onstop=async()=>{
        const blob = new Blob(recorderChunksRef.current,{type:"audio/webm"});
        const placeholder = {senderId:myUid,text:"",mediaUrl:"",mediaType:"audio",createdAt:serverTimestamp(),status:"uploading",reactions:{}};
        try{
          const mRef = await addDoc(collection(db,"chats",chatId,"messages"),placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev=>({...prev,[messageId]:0}));
          const url = await uploadToCloudinary(blob,(pct)=>setUploadingIds(prev=>({...prev,[messageId]:pct})));
          await updateDoc(doc(db,"chats",chatId,"messages",messageId),{mediaUrl:url,status:"sent",sentAt:serverTimestamp()});
          setTimeout(()=>setUploadingIds(prev=>{const c={...prev}; delete c[messageId]; return c;}),200);
        }catch(err){console.error("voice upload failed",err);}
      };
      mr.start();
      recorderRef.current=mr;
      setRecording(true);
    }catch(err){console.error(err); alert("Could not start recording");}
  };
  const stopRecording = ()=>{
    try{recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach(t=>t.stop());}catch(e){}
    setRecording(false);
  };
  const holdStart=(e)=>{e.preventDefault(); longPressTimer.current=setTimeout(()=>startRecording(),250);};
  const holdEnd=(e)=>{clearTimeout(longPressTimer.current); if(recording) stopRecording();};

  // ---------- Message actions ----------
  const applyReaction = async (messageId,emoji)=>{
    try{
      const mRef=doc(db,"chats",chatId,"messages",messageId);
      const snap=await getDoc(mRef);
      if(!snap.exists()) return;
      const data = snap.data();
      const existing = data.reactions?.[myUid];
      if(existing===emoji) await updateDoc(mRef,{[`reactions.${myUid}`]:null});
      else await updateDoc(mRef,{[`reactions.${myUid}`]:emoji});
      setReactionFor(null);
    }catch(e){console.error(e);}
  };

  const copyMessageText = async (m)=>{try{await navigator.clipboard.writeText(m.text||m.mediaUrl||""); alert("Copied"); setMenuOpenFor(null);}catch(e){alert("Copy failed");}};
  const editMessage = async (m)=>{if(m.senderId!==myUid) return alert("You can only edit your messages."); const newText = window.prompt("Edit message",m.text||""); if(newText==null) return; await updateDoc(doc(db,"chats",chatId,"messages",m.id),{text:newText,edited:true}); setMenuOpenFor(null);};
  const deleteMessageForEveryone = async (id)=>{if(!confirm("Delete for everyone?")) return; await deleteDoc(doc(db,"chats",chatId,"messages",id)); setMenuOpenFor(null);};
  const deleteMessageForMe = async (id)=>{await updateDoc(doc(db,"chats",chatId,"messages",id),{deletedFor:arrayUnion(myUid)}); setMenuOpenFor(null);};
  const forwardMessage = (m)=>navigate(`/forward/${m.id}`,{state:{message:m}});
  const pinMessage = async (m)=>{await updateDoc(doc(db,"chats",chatId),{pinnedMessageId:m.id,pinnedMessageText:m.text||(m.mediaType||"")}); setMenuOpenFor(null); alert("Pinned");};
  const replyToMessage = (m)=>{setReplyTo(m); setMenuOpenFor(null);};

  // Long press & swipe handlers
  const handleMsgTouchStart=(m)=>{longPressTimer.current=setTimeout(()=>setMenuOpenFor(m.id),500); swipeStartX.current=null;};
  const handleMsgTouchMove=(ev)=>{if(!swipeStartX.current && ev.touches && ev.touches[0]) swipeStartX.current=ev.touches[0].clientX;};
  const handleMsgTouchEnd=(m)=>{
    clearTimeout(longPressTimer.current);
    const endX = event.changedTouches?.[0]?.clientX;
    if(endX==null || swipeStartX.current==null) return;
    if(swipeStartX.current-endX>80) replyToMessage(m);
    swipeStartX.current=null;
  };

  // ---------- Header actions ----------
  const clearChat = async ()=>{
    if(!confirm("Clear chat?")) return;
    try{
      const msgsRef = collection(db,"chats",chatId,"messages");
      const snap = await getDocs(query(msgsRef,orderBy("createdAt","asc")));
      for(const d of snap.docs){try{await deleteDoc(d.ref);}catch(e){}}
      setHeaderMenuOpen(false);
      alert("Chat cleared.");
    }catch(e){console.error(e); alert("Failed to clear chat");}
  };
  const toggleBlock = async ()=>{
    try{
      const chatRef=doc(db,"chats",chatId);
      const snap=await getDoc(chatRef);
      if(!snap.exists()) return;
      const data=snap.data();
      const blockedBy=data.blockedBy||[];
      if(blockedBy.includes(myUid)) await updateDoc(chatRef,{blockedBy:arrayRemove(myUid)});
      else await updateDoc(chatRef,{blockedBy:arrayUnion(myUid)});
      setHeaderMenuOpen(false);
    }catch(e){console.error(e); alert("Block toggle failed");}
  };

  // ---------- Render helpers ----------
  const renderStatusTick=(m)=>{
    if(m.senderId!==myUid) return null;
    if(m.status==="uploading") return "⌛";
    if(m.status==="sent") return "✔";
    if(m.status==="delivered") return "✔✔";
    if(m.status==="seen") return <span className="seen-tick">✔✔</span>;
    return null;
  };
  const renderMessageContent=(m)=>{
    if(m.mediaUrl){
      switch(m.mediaType){
        case "image": return <img src={m.mediaUrl} alt={m.fileName||"image"} className="msg-media"/>;
        case "video": return <video controls src={m.mediaUrl} className="msg-media"/>;
        case "audio": return <audio controls src={m.mediaUrl} className="msg-audio"/>;
        case "pdf": case "file": return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName||"Download file"}</a>;
        default: return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open media</a>;
      }
    }
    return <div className="msg-text">{m.text}</div>;
  };

  const groupedMessages = (() => {
    const out=[];
    let lastDay=null;
    messages.forEach(m=>{
      const label = dayLabel(m.createdAt||new Date());
      if(label!==lastDay){
        out.push({ type: "day", label });
        lastDay = label;
      }
      out.push({ type: "msg", data: m });
    });
    return out;
  })();

  return (
    <div className={`chat-page ${isDark ? "dark" : "light"}`} style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : "" }}>
      {/* Header */}
      <div className="chat-header">
        <div className="friend-info" onClick={()=>navigate(`/profile/${friendInfo?.id}`)}>
          <img src={friendInfo?.photoURL} alt="avatar" className="avatar"/>
          <div>
            <div className="name">{friendInfo?.displayName || "Unknown"}</div>
            <div className="last-seen">{chatInfo?.lastSeen ? `Last seen: ${new Date(chatInfo.lastSeen.seconds*1000).toLocaleString()}` : ""}</div>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={()=>setHeaderMenuOpen(prev=>!prev)}>⋮</button>
          {headerMenuOpen && (
            <div className="header-menu popup-menu">
              <button onClick={clearChat}>Clear chat</button>
              <button onClick={toggleBlock}>{chatInfo?.blockedBy?.includes(myUid) ? "Unblock" : "Block"}</button>
              <button onClick={()=>navigate(`/report/${friendInfo?.id}`)}>Report</button>
              <button onClick={()=>navigate(`/media/${chatId}`)}>Media</button>
              <button onClick={()=>navigate(`/profile/${friendInfo?.id}`)}>View Profile</button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" ref={messagesRefEl}>
        {groupedMessages.map((item, idx) => {
          if(item.type==="day") return <div key={`day-${idx}`} className="day-divider">{item.label}</div>;
          const m = item.data;
          const isMine = m.senderId===myUid;
          const reactionsArray = m.reactions ? Object.values(m.reactions).filter(Boolean) : [];
          return (
            <div key={m.id} className={`message-wrapper ${isMine ? "mine" : "theirs"}`}
              onContextMenu={(e)=>{e.preventDefault(); setMenuOpenFor(m.id);}}
              onTouchStart={()=>handleMsgTouchStart(m)}
              onTouchMove={handleMsgTouchMove}
              onTouchEnd={()=>handleMsgTouchEnd(m)}
            >
              {m.replyTo && (
                <div className="reply-preview">
                  <small>{m.replyTo.text || m.replyTo.mediaType || "Media"}</small>
                </div>
              )}
              <div className="message-bubble">
                {renderMessageContent(m)}
                <div className="msg-footer">
                  <span className="msg-time">{fmtTime(m.createdAt)}</span>
                  {renderStatusTick(m)}
                </div>
              </div>
              {reactionsArray.length>0 && (
                <div className="reactions-display">
                  {reactionsArray.map((r,i)=><span key={i} className="reaction">{r}</span>)}
                </div>
              )}

              {/* Inline message menu */}
              {menuOpenFor===m.id && (
                <div className="popup-menu message-menu">
                  <button onClick={()=>replyToMessage(m)}>Reply</button>
                  {m.senderId===myUid && <button onClick={()=>editMessage(m)}>Edit</button>}
                  <button onClick={()=>deleteMessageForMe(m.id)}>Delete for me</button>
                  {m.senderId===myUid && <button onClick={()=>deleteMessageForEveryone(m.id)}>Delete for everyone</button>}
                  <button onClick={()=>forwardMessage(m)}>Forward</button>
                  <button onClick={()=>pinMessage(m)}>Pin</button>
                  <button onClick={()=>setReactionFor(m.id)}>React</button>
                </div>
              )}

              {/* Reaction picker */}
              {reactionFor===m.id && (
                <div className="popup-menu reaction-picker">
                  {EXTENDED_EMOJIS.map((e,i)=><button key={i} onClick={()=>applyReaction(m.id,e)}>{e}</button>)}
                  <button onClick={()=>setReactionFor(null)}>Close</button>
                </div>
              )}

              {/* Uploading progress */}
              {uploadingIds[m.id]!==undefined && (
                <div className="uploading-overlay">{uploadingIds[m.id]}%</div>
              )}
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>

      {/* Scroll-to-bottom arrow */}
      {!isAtBottom && <button className="scroll-bottom-btn" onClick={scrollToBottom}>⬇</button>}

      {/* Reply preview */}
      {replyTo && (
        <div className="replying-bar">
          Replying to: {replyTo.text || replyTo.mediaType || "Media"}
          <button onClick={()=>setReplyTo(null)}>✖</button>
        </div>
      )}

      {/* Message input */}
      <div className="chat-input-bar">
        <input type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} id="file-input"/>
        <button onClick={()=>document.getElementById("file-input").click()}>📎</button>
        <input type="text" value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message"/>
        {recorderAvailable && (
          <button
            onMouseDown={holdStart}
            onMouseUp={holdEnd}
            onTouchStart={holdStart}
            onTouchEnd={holdEnd}
          >{recording ? "🎙️" : "🎤"}</button>
        )}
        <button onClick={sendTextMessage}>➡️</button>
      </div>
    </div>
  );
}