// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  getDocs,
  limit as fsLimit
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Helpers --------------------
const fmtTime = (ts) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
};

// -------------------- Constants --------------------
const INLINE_REACTIONS = ["❤️","😂","👍","😮","😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];
const COLORS = { primary:"#34B7F1", headerBlue:"#1877F2", lightBg:"#f5f5f5", darkBg:"#0b0b0b", lightText:"#000", darkText:"#fff", lightCard:"#fff", darkCard:"#1b1b1b", mutedText:"#888", grayBorder:"rgba(0,0,0,0.06)", edited:"#999", reactionBg:"#111" };
const SPACING = { xs:4, sm:8, md:12, lg:14, xl:20, borderRadius:12 };
const menuBtnStyle = { padding:SPACING.sm, borderRadius:SPACING.borderRadius, border:"none", background:"transparent", cursor:"pointer", textAlign:"left", width:"100%" };

// -------------------- Component --------------------
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  const [chatInfo,setChatInfo] = useState(null);
  const [friendInfo,setFriendInfo] = useState(null);
  const [messages,setMessages] = useState([]);
  const [loadingMsgs,setLoadingMsgs] = useState(true);
  const [text,setText] = useState("");
  const [selectedFiles,setSelectedFiles] = useState([]);
  const [previews,setPreviews] = useState([]);
  const [selectedPreviewIndex,setSelectedPreviewIndex] = useState(0);
  const [uploadingIds,setUploadingIds] = useState({});
  const [replyTo,setReplyTo] = useState(null);
  const [menuOpenFor,setMenuOpenFor] = useState(null);
  const [reactionFor,setReactionFor] = useState(null);
  const [showEmojiPicker,setShowEmojiPicker] = useState(false);
  const [isAtBottom,setIsAtBottom] = useState(true);
  const [recording,setRecording] = useState(false);
  const [recorderAvailable,setRecorderAvailable] = useState(false);
  const [headerMenuOpen,setHeaderMenuOpen] = useState(false);

  // -------------------- Cloudinary --------------------
  const detectFileType = (file) => {
    if(file.type.startsWith("image/")) return "image";
    if(file.type.startsWith("video/")) return "video";
    if(file.type.startsWith("audio/")) return "audio";
    if(file.type === "application/pdf") return "pdf";
    return "file";
  };
  const uploadToCloudinary = (file,onProgress)=>new Promise((resolve,reject)=>{
    try{
      const cloudName=import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset=import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      if(!cloudName||!uploadPreset) return reject(new Error("Cloudinary env not set"));
      const url=`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const xhr=new XMLHttpRequest();
      xhr.open("POST",url);
      xhr.upload.addEventListener("progress",e=>{ if(e.lengthComputable&&onProgress) onProgress(Math.round((e.loaded*100)/e.total)); });
      xhr.onload=()=>{ xhr.status>=200&&xhr.status<300?resolve(JSON.parse(xhr.responseText).secure_url):reject(new Error("Cloudinary upload failed")); };
      xhr.onerror=()=>reject(new Error("Network error"));
      const fd=new FormData(); fd.append("file",file); fd.append("upload_preset",uploadPreset); xhr.send(fd);
    }catch(err){reject(err);}
  });

  // -------------------- Load chat & friend --------------------
  useEffect(()=>{
    if(!chatId) return;
    let unsubChat=null;
    const loadMeta=async()=>{
      try{
        const cRef=doc(db,"chats",chatId);
        const cSnap=await getDoc(cRef);
        if(cSnap.exists()){
          const data=cSnap.data();
          setChatInfo({id:cSnap.id,...data});
          const friendId=data.participants?.find(p=>p!==myUid);
          if(friendId){
            const fRef=doc(db,"users",friendId);
            const fSnap=await getDoc(fRef);
            if(fSnap.exists()) setFriendInfo({id:fSnap.id,...fSnap.data()});
          }
        }
        unsubChat=onSnapshot(doc(db,"chats",chatId),s=>{ if(s.exists()) setChatInfo(prev=>({...prev,...s.data()})); });
      }catch(e){console.error(e);}
    };
    loadMeta();
    return ()=>{ unsubChat?.(); };
  },[chatId,myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(()=>{
    if(!chatId) return;
    setLoadingMsgs(true);
    const q=query(collection(db,"chats",chatId,"messages"),orderBy("createdAt","asc"),fsLimit(2000));
    const unsub=onSnapshot(q,snap=>{
      const docs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      docs.forEach(async m=>{ if(m.senderId!==myUid && m.status==="sent") await updateDoc(doc(db,"chats",chatId,"messages",m.id),{status:"delivered"}); });
      setLoadingMsgs(false);
      setTimeout(()=>{ if(isAtBottom) endRef.current?.scrollIntoView({behavior:"smooth"}); },80);
    });
    return ()=>unsub();
  },[chatId,myUid,isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(()=>{
    const el=messagesRefEl.current;
    if(!el) return;
    const onScroll=()=>{ setIsAtBottom(el.scrollHeight-el.scrollTop-el.clientHeight<80); };
    el.addEventListener("scroll",onScroll);
    return ()=>el.removeEventListener("scroll",onScroll);
  },[]);

  const scrollToBottom=()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); setIsAtBottom(true); };

  // -------------------- Click outside to close menus --------------------
  useEffect(()=>{
    const handleClickOutside=(e)=>{
      if(!e.target.closest(".menu")&&!e.target.closest(".reactionPicker")&&!e.target.closest(".emojiPicker")){
        setMenuOpenFor(null); setReactionFor(null); setHeaderMenuOpen(false); setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown",handleClickOutside);
    return ()=>document.removeEventListener("mousedown",handleClickOutside);
  },[]);

  // -------------------- File select & preview --------------------
  const onFilesSelected=e=>{
    const files=Array.from(e.target.files||[]);
    if(!files.length) return;
    const newPreviews=files.map(f=>({url:f.type.startsWith("image/")||f.type.startsWith("video/")?URL.createObjectURL(f):null,type:detectFileType(f),name:f.name,file:f}));
    setSelectedFiles(prev=>[...prev,...files]);
    setPreviews(prev=>[...prev,...newPreviews]);
    setSelectedPreviewIndex(prev=>prev>=0?prev:0);
  };

  // -------------------- Send message --------------------
  const sendTextMessage=async()=>{
    if((chatInfo?.blockedBy||[]).includes(myUid)) return alert("You are blocked in this chat.");
    if(selectedFiles.length>0){
      const filesToSend=[...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for(const file of filesToSend){
        try{
          const placeholder={senderId:myUid,text:"",mediaUrl:"",mediaType:detectFileType(file),fileName:file.name,createdAt:serverTimestamp(),status:"uploading",reactions:{}};
          const mRef=await addDoc(collection(db,"chats",chatId,"messages"),placeholder);
          const messageId=mRef.id;
          setUploadingIds(prev=>({...prev,[messageId]:0}));
          const url=await uploadToCloudinary(file,pct=>setUploadingIds(prev=>({...prev,[messageId]:pct})));
          await updateDoc(doc(db,"chats",chatId,"messages",messageId),{mediaUrl:url,status:"sent",sentAt:serverTimestamp()});
          setTimeout(()=>setUploadingIds(prev=>{ const c={...prev}; delete c[messageId]; return c; }),200);
        }catch(err){console.error("upload error:",err);}
      }
      return;
    }
    if(text.trim()){
      try{
        const payload={senderId:myUid,text:text.trim(),mediaUrl:"",mediaType:null,createdAt:serverTimestamp(),status:"sent",reactions:{}};
        if(replyTo){ payload.replyTo={id:replyTo.id,text:replyTo.text||(replyTo.mediaType||"media"),senderId:replyTo.senderId}; setReplyTo(null); }
        await addDoc(collection(db,"chats",chatId,"messages"),payload);
        setText(""); scrollToBottom();
      }catch(e){console.error(e); alert("Failed to send");}
    }
  };

  // -------------------- Recording --------------------
  useEffect(()=>setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)),[]);
  const startRecording=async()=>{
    if(!recorderAvailable) return alert("Recording not supported");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      recorderChunksRef.current=[];
      mr.ondataavailable=ev=>{ if(ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop=async()=>{
        const blob=new Blob(recorderChunksRef.current,{type:"audio/webm"});
        const placeholder={senderId:myUid,text:"",mediaUrl:"",mediaType:"audio",createdAt:serverTimestamp(),status:"uploading",reactions:{}};
        try{
          const mRef=await addDoc(collection(db,"chats",chatId,"messages"),placeholder);
          const messageId=mRef.id;
          setUploadingIds(prev=>({...prev,[messageId]:0}));
          const url=await uploadToCloudinary(blob,pct=>setUploadingIds(prev=>({...prev,[messageId]:pct})));
          await updateDoc(doc(db,"chats",chatId,"messages",messageId),{mediaUrl:url,status:"sent",sentAt:serverTimestamp()});
          setTimeout(()=>setUploadingIds(prev=>{ const c={...prev}; delete c[messageId]; return c; }),200);
        }catch(err){console.error("voice upload failed",err);}
      };
      mr.start(); recorderRef.current=mr; setRecording(true);
    }catch(err){console.error(err); alert("Could not start recording");}
  };
  const stopRecording=()=>{ try{ recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach(t=>t.stop()); }catch(e){} setRecording(false); };
  const holdStart=e=>{ e.preventDefault(); longPressTimer.current=setTimeout(()=>startRecording(),250); };
  const holdEnd=e=>{ clearTimeout(longPressTimer.current); if(recording) stopRecording(); };

  // -------------------- Header Actions --------------------
  const clearChat=async()=>{ if(!confirm("Clear chat?")) return; const snap=await getDocs(query(collection(db,"chats",chatId,"messages"),orderBy("createdAt","asc"))); for(const d of snap.docs) try{await deleteDoc(d.ref);}catch(e){} setHeaderMenuOpen(false); alert("Chat cleared."); };
  const toggleBlock=async()=>{ if(!chatInfo) return; const chatRef=doc(db,"chats",chatId); const blockedBy=chatInfo.blockedBy||[]; if(blockedBy.includes(myUid)){ await updateDoc(chatRef,{blockedBy:arrayRemove(myUid)}); setChatInfo(prev=>({...prev,blockedBy:blockedBy.filter(id=>id!==myUid)})); alert("You unblocked this chat."); }else{ await updateDoc(chatRef,{blockedBy:arrayUnion(myUid)}); setChatInfo(prev=>({...prev,blockedBy:[...blockedBy,myUid]})); alert("You blocked this chat."); } setHeaderMenuOpen(false); };

  // -------------------- Message Render --------------------
  const renderMessage=m=>{
    const isMine=m.senderId===myUid;
    const showMenu=menuOpenFor===m.id;
    const showReactionPicker=reactionFor===m.id;
    const time=fmtTime(m.createdAt);
    return (
      <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:isMine?"flex-end":"flex-start", marginBottom:SPACING.sm }}>
        <div style={{ maxWidth:"70%", padding:SPACING.sm, borderRadius:SPACING.borderRadius, backgroundColor:isMine?COLORS.primary:isDark?COLORS.darkCard:COLORS.lightCard, color:isMine?"#fff":isDark?COLORS.darkText:COLORS.lightText, position:"relative", cursor:"pointer", wordBreak:"break-word" }}>
          {m.replyTo && <div style={{ fontSize:12, color:COLORS.edited, borderLeft:`3px solid ${COLORS.mutedText}`, paddingLeft:4, marginBottom:4 }}>{m.replyTo.text||m.replyTo.mediaType}</div>}
          {m.text && <div>{m.text}</div>}
          {m.mediaUrl && (
            <div style={{ marginTop:4 }}>
              {m.mediaType==="image"&&<img src={m.mediaUrl} alt="" style={{ maxWidth:"100%", borderRadius:SPACING.borderRadius }}/>}
              {m.mediaType==="video"&&<video src={m.mediaUrl} controls style={{ maxWidth:"100%", borderRadius:SPACING.borderRadius }}/>}
              {m.mediaType==="audio"&&<audio src={m.mediaUrl} controls />}
              {m.mediaType==="pdf"&&<a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName||"PDF Document"}</a>}
            </div>
          )}
          <div style={{ fontSize:10, color:COLORS.mutedText, marginTop:2, textAlign:"right" }}>{m.edited&&"(edited)"} {time} {m.status&&isMine?`• ${m.status}`:""}</div>

          {Object.keys(m.reactions||{}).length>0&&(
            <div style={{ position:"absolute", bottom:-12, right:-12, display:"flex", gap:2 }}>
              {Object.values(m.reactions).map((r,i)=>r&&<span key={i} style={{ backgroundColor:COLORS.reactionBg, color:"#fff", borderRadius:8, padding:"0 4px", fontSize:10 }}>{r}</span>)}
            </div>
          )}

          {showMenu&&(
            <div className="menu" style={{ position:"absolute", top:-SPACING.lg, right:0, background:COLORS.lightCard, border:`1px solid ${COLORS.grayBorder}`, borderRadius:SPACING.borderRadius, zIndex:10 }}>
              <button style={menuBtnStyle}>Reply</button>
              <button style={menuBtnStyle}>React</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------- JSX --------------------
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", backgroundColor:wallpaper||(isDark?COLORS.darkBg:COLORS.lightBg), color:isDark?COLORS.darkText:COLORS.lightText }}>
      {/* Header */}
      <div style={{ height:56, backgroundColor:COLORS.headerBlue, color:"#fff", display:"flex", alignItems:"center", padding:"0 12px", justifyContent:"space-between", position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>navigate(-1)} style={{ background:"transparent", border:"none", color:"#fff", fontSize:18 }}>←</button>
          <img src={friendInfo?.photoURL||""} alt="" style={{ width:36, height:36, borderRadius:"50%" }} />
          <div>{friendInfo?.name||"Chat"}</div>
<div style={{ fontSize: 12 }}>{friendInfo?.status || ""}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => alert("Voice call")} style={{ background: "transparent", border: "none", color: "#fff" }}>📞</button>
          <button onClick={() => alert("Video call")} style={{ background: "transparent", border: "none", color: "#fff" }}>🎥</button>
          <button onClick={() => setHeaderMenuOpen(prev => !prev)} style={{ background: "transparent", border: "none", color: "#fff" }}>⋮</button>
        </div>

        {headerMenuOpen && (
          <div style={{ position: "absolute", top: 56, right: 12, background: COLORS.lightCard, borderRadius: SPACING.borderRadius, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", zIndex: 20 }}>
            <button style={menuBtnStyle} onClick={() => navigate(`/profile/${friendInfo?.id}`)}>View Profile</button>
            <button style={menuBtnStyle} onClick={clearChat}>Clear Chat</button>
            <button style={menuBtnStyle} onClick={toggleBlock}>{(chatInfo?.blockedBy || []).includes(myUid) ? "Unblock" : "Block"}</button>
            <button style={menuBtnStyle} onClick={() => alert("Reported")}>Report</button>
            <button style={menuBtnStyle} onClick={() => setHeaderMenuOpen(false)}>Close</button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: SPACING.md }}>Loading...</div>}
        {messages.map(renderMessage)}
        <div ref={endRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div style={{ padding: SPACING.sm, background: isDark ? COLORS.darkCard : COLORS.lightCard, borderTop: `1px solid ${COLORS.grayBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>Replying to: <b>{replyTo.text || replyTo.mediaType}</b></div>
          <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: SPACING.sm, display: "flex", alignItems: "center", gap: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: isDark ? COLORS.darkCard : COLORS.lightCard }}>
        <button onClick={() => setShowEmojiPicker(prev => !prev)} style={{ fontSize: 24, background: "transparent", border: "none" }}>😊</button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: `1px solid ${COLORS.grayBorder}`, outline: "none", background: isDark ? COLORS.darkBg : "#fff", color: isDark ? COLORS.darkText : COLORS.lightText }}
          onKeyDown={e => e.key === "Enter" && sendTextMessage()}
        />
        <input type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} id="fileInput" />
        <label htmlFor="fileInput" style={{ cursor: "pointer" }}>📎</label>
        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          {recording ? "🔴" : "📩"}
        </button>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="emojiPicker" style={{ position: "absolute", bottom: 60, left: 12, background: COLORS.lightCard, borderRadius: SPACING.borderRadius, padding: SPACING.sm, display: "flex", flexWrap: "wrap", maxWidth: 300, gap: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>
          {EXTENDED_EMOJIS.map((e, i) => (
            <span key={i} style={{ cursor: "pointer", fontSize: 20 }} onClick={() => setText(prev => prev + e)}>{e}</span>
          ))}
          <button onClick={() => setShowEmojiPicker(false)} style={{ border: "none", background: "transparent", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Multiple file previews */}
      {previews.length > 0 && (
        <div style={{ padding: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: isDark ? COLORS.darkCard : COLORS.lightCard, display: "flex", gap: SPACING.sm, overflowX: "auto" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative", cursor: "pointer" }} onClick={() => setSelectedPreviewIndex(idx)}>
              {p.type === "image" && <img src={p.url} alt={p.name} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: SPACING.borderRadius, border: selectedPreviewIndex === idx ? `2px solid ${COLORS.primary}` : "2px solid transparent" }} />}
              {p.type === "video" && <video src={p.url} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: SPACING.borderRadius, border: selectedPreviewIndex === idx ? `2px solid ${COLORS.primary}` : "2px solid transparent" }} />}
              {(p.type === "audio" || p.type === "pdf" || p.type === "file") && <div style={{ width: 60, height: 60, borderRadius: SPACING.borderRadius, background: COLORS.grayBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, textAlign: "center" }}>{p.name}</div>}
              <button onClick={() => { setPreviews(prev => prev.filter((_,i)=>i!==idx)); setSelectedFiles(prev => prev.filter((_,i)=>i!==idx)); }} style={{ position: "absolute", top: -4, right: -4, background: "#f00", color: "#fff", border: "none", borderRadius: "50%", width: 16, height: 16, fontSize: 10 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}