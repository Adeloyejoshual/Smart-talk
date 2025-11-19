// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc,
  getDoc, arrayUnion, arrayRemove, deleteDoc, limit as fsLimit, getDocs
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/* -------------------- Constants -------------------- */
const COLORS = {
  primary: "#34B7F1",
  headerBlue: "#1877F2",
  lightBg: "#d0e6ff", // default blue background
  lightCard: "#fff",
  mutedText: "#888",
  reactionBg: "#111"
};
const SPACING = { sm: 8, md: 12, lg: 16, borderRadius: 14 };
const INLINE_REACTIONS = ["❤️","😂","👍","😮","😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];

/* -------------------- Helpers -------------------- */
const fmtTime = ts => ts?.toDate ? ts.toDate().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
const detectFileType = file => {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  return "file";
};

/* -------------------- Component -------------------- */
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const longPressTimer = useRef(null);

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
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  /* -------------------- Cloudinary Upload -------------------- */
  const uploadToCloudinary = (file, onProgress) => new Promise((resolve, reject) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary env not set"));
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = e => { if(e.lengthComputable && onProgress) onProgress(Math.round((e.loaded*100)/e.total)); };
    xhr.onload = () => xhr.status>=200&&xhr.status<300 ? resolve(JSON.parse(xhr.responseText).secure_url) : reject(new Error("Upload failed"));
    xhr.onerror = () => reject(new Error("Network error"));
    const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", uploadPreset); xhr.send(fd);
  });

  /* -------------------- Load Chat & Friend -------------------- */
  useEffect(() => {
    if(!chatId) return;
    let unsub = null;
    (async () => {
      const cSnap = await getDoc(doc(db,"chats",chatId));
      if(cSnap.exists()){
        const data = cSnap.data(); setChatInfo({id:cSnap.id,...data});
        const friendId = data.participants?.find(p=>p!==myUid);
        if(friendId){
          const fSnap = await getDoc(doc(db,"users",friendId));
          if(fSnap.exists()) setFriendInfo({id:fSnap.id,...fSnap.data()});
        }
      }
      unsub = onSnapshot(doc(db,"chats",chatId), s=>{ if(s.exists()) setChatInfo(prev=>({...prev,...s.data()})); });
    })();
    return ()=>unsub?.();
  }, [chatId,myUid]);

  /* -------------------- Messages Real-time -------------------- */
  useEffect(() => {
    if(!chatId) return;
    setLoadingMsgs(true);
    const q = query(collection(db,"chats",chatId,"messages"), orderBy("createdAt","asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      docs.forEach(async m=>{ if(m.senderId!==myUid && m.status==="sent") await updateDoc(doc(db,"chats",chatId,"messages",m.id),{status:"delivered"}); });
      setLoadingMsgs(false);
      if(isAtBottom) endRef.current?.scrollIntoView({behavior:"smooth"});
    });
    return ()=>unsub();
  }, [chatId,myUid,isAtBottom]);

  /* -------------------- Scroll Detection -------------------- */
  useEffect(()=>{
    const el = messagesRefEl.current;
    if(!el) return;
    const onScroll = ()=>setIsAtBottom(el.scrollHeight-el.scrollTop-el.clientHeight<80);
    el.addEventListener("scroll",onScroll);
    return ()=>el.removeEventListener("scroll",onScroll);
  },[]);

  const scrollToBottom = ()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); setIsAtBottom(true); };

  /* -------------------- Recording -------------------- */
  useEffect(()=>setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)),[]);
  const startRecording = async ()=>{
    if(!recorderAvailable) return alert("Recording not supported");
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current=[];
      mr.ondataavailable=ev=>{if(ev.data.size) recorderChunksRef.current.push(ev.data);};
      mr.onstop=async ()=>{
        const blob=new Blob(recorderChunksRef.current,{type:"audio/webm"});
        const placeholder={senderId:myUid,text:"",mediaUrl:"",mediaType:"audio",createdAt:serverTimestamp(),status:"uploading",reactions:{}};
        const mRef=await addDoc(collection(db,"chats",chatId,"messages"),placeholder);
        const messageId = mRef.id;
        setUploadingIds(prev=>({...prev,[messageId]:0}));
        const url = await uploadToCloudinary(blob,pct=>setUploadingIds(prev=>({...prev,[messageId]:pct})));
        await updateDoc(doc(db,"chats",chatId,"messages",messageId),{mediaUrl:url,status:"sent",sentAt:serverTimestamp()});
        setTimeout(()=>setUploadingIds(prev=>{const c={...prev}; delete c[messageId]; return c;}),200);
      };
      mr.start(); recorderRef.current=mr; setRecording(true);
    }catch(err){console.error(err); alert("Could not start recording");}
  };
  const stopRecording = ()=>{ try{recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach(t=>t.stop()); }catch{} setRecording(false); };
  const holdStart=e=>{ e.preventDefault(); longPressTimer.current=setTimeout(()=>startRecording(),250); };
  const holdEnd=e=>{ clearTimeout(longPressTimer.current); if(recording) stopRecording(); };

  /* -------------------- Send Text Message -------------------- */
  const sendTextMessage = async ()=>{
    if(!text.trim() && selectedFiles.length===0) return;

    if(selectedFiles.length>0){
      const files=[...selectedFiles]; setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for(const file of files){
        const placeholder={senderId:myUid,text:"",mediaUrl:"",mediaType:detectFileType(file),fileName:file.name,createdAt:serverTimestamp(),status:"uploading",reactions:{}};
        const mRef=await addDoc(collection(db,"chats",chatId,"messages"),placeholder);
        const messageId=mRef.id; setUploadingIds(prev=>({...prev,[messageId]:0}));
        const url = await uploadToCloudinary(file,pct=>setUploadingIds(prev=>({...prev,[messageId]:pct})));
        await updateDoc(doc(db,"chats",chatId,"messages",messageId),{mediaUrl:url,status:"sent",sentAt:serverTimestamp()});
        setTimeout(()=>setUploadingIds(prev=>{const c={...prev}; delete c[messageId]; return c;}),200);
      }
      return;
    }

    if(text.trim()){
      const payload={senderId:myUid,text:text.trim(),mediaUrl:"",mediaType:null,createdAt:serverTimestamp(),status:"sent",reactions:{}};
      if(replyTo){payload.replyTo={id:replyTo.id,text:replyTo.text||replyTo.mediaType,senderId:replyTo.senderId}; setReplyTo(null);}
      await addDoc(collection(db,"chats",chatId,"messages"),payload);
      setText(""); scrollToBottom();
    }
  };

  /* -------------------- Render Messages -------------------- */
  const renderMessage = m=>{
    const isMine = m.senderId===myUid;
    return (
      <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:isMine?"flex-end":"flex-start",marginBottom:SPACING.sm}}>
        <div style={{
          maxWidth:"70%", padding:SPACING.sm, borderRadius:SPACING.borderRadius, backgroundColor:isMine?COLORS.primary:COLORS.lightCard,
          color:isMine?"#fff":"#000", wordBreak:"break-word", position:"relative"
        }}>
          {m.text && <div>{m.text}</div>}
          {m.mediaUrl && <div style={{marginTop:4}}>
            {m.mediaType==="image" && <img src={m.mediaUrl} alt="" style={{maxWidth:"100%",borderRadius:SPACING.borderRadius}} />}
            {m.mediaType==="video" && <video src={m.mediaUrl} controls style={{maxWidth:"100%",borderRadius:SPACING.borderRadius}} />}
            {m.mediaType==="audio" && <audio src={m.mediaUrl} controls />}
            {m.mediaType==="pdf" && <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName||"PDF"}</a>}
          </div>}
          <div style={{fontSize:10,color:COLORS.mutedText,marginTop:2,textAlign:"right"}}>{fmtTime(m.createdAt)} {m.edited?"(edited)":""}</div>
        </div>
      </div>
    );
  };

  /* -------------------- JSX -------------------- */
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:wallpaper||COLORS.lightBg}}>
      {/* Header */}
      <div style={{height:56,backgroundColor:COLORS.headerBlue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>navigate(-1)} style={{background:"transparent",border:"none",color:"#fff"}}>←</button>
          <img src={friendInfo?.photoURL||""} alt="" style={{width:36,height:36,borderRadius:"50%"}} />
          <div><div>{friendInfo?.name||"Chat"}</div><div style={{fontSize:12}}>{friendInfo?.status||""}</div></div>
        </div>
        <div style={{display:"flex",gap:12}}>
          <button onClick={()=>alert("Voice call")} style={{background:"transparent",border:"none",color:"#fff"}}>📞</button>
          <button onClick={()=>alert("Video call")} style={{background:"transparent",border:"none",color:"#fff"}}>🎥</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRefEl} style={{flex:1,overflowY:"auto",padding:SPACING.sm}}>
        {loadingMsgs && <div style={{textAlign:"center",marginTop:SPACING.md}}>Loading...</div>}
        {messages.map(renderMessage)}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{display:"flex",padding:SPACING.sm,gap:SPACING.sm,borderTop:`1px solid ${COLORS.mutedText}`,background:COLORS.lightCard}}>
        <button onClick={()=>setShowEmojiPicker(prev=>!prev)} style={{fontSize:24,background:"transparent",border:"none"}}>😊</button>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendTextMessage()} placeholder="Type a message" style={{flex:1,padding:SPACING.sm,borderRadius:SPACING.borderRadius,border:`1px solid ${COLORS.mutedText}`,outline:"none"}} />
        <button onMouseDown={holdStart} onMouseUp={holdEnd} onTouchStart={holdStart} onTouchEnd={holdEnd} style={{fontSize:18,background:"transparent",border:"none"}}>{recording?"🔴":"📩"}</button>
      </div>
    </div>
  );
}