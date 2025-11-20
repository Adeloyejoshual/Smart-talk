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
  limit as fsLimit,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Helpers --------------------
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};
const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// -------------------- Constants --------------------
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];
const COLORS = {
  primary: "#34B7F1",
  primaryDark: "#007bff",
  headerBlue: "#1877F2",
  lightBg: "#f5f5f5",
  darkBg: "#0b0b0b",
  lightText: "#000",
  darkText: "#fff",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  edited: "#999",
  reactionBg: "#111",
};
const SPACING = { xs: 4, sm: 8, md: 12, lg: 14, xl: 20, borderRadius: 12 };
const menuBtnStyle = { padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" };

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
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // -------------------- Cloudinary --------------------
  const detectFileType = (file) => {
    const t = file.type;
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };
  const uploadToCloudinary = async (file, onProgress) => {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) throw new Error("Cloudinary env not set");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
        xhr.upload.onprogress = (e) => { if(e.lengthComputable && onProgress) onProgress(Math.round((e.loaded*100)/e.total)); };
        xhr.onload = () => { 
          if(xhr.status >=200 && xhr.status<300) resolve(JSON.parse(xhr.responseText).secure_url);
          else reject(new Error("Cloudinary upload failed"));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(fd);
      });
    } catch(err){ throw err; }
  };

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });
          const friendId = data.participants?.find(p => p !== myUid);
          if (friendId) {
            const fRef = doc(db, "users", friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
          }
        }
        unsubChat = onSnapshot(doc(db, "chats", chatId), s => { if(s.exists()) setChatInfo(prev => ({ ...(prev||{}), ...s.data() })); });
      } catch(e){ console.error(e); }
    };
    loadMeta();
    return () => { if(unsubChat) unsubChat(); };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt","asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      docs.forEach(async m => {
        if(m.senderId!==myUid && m.status==="sent") 
          await updateDoc(doc(db,"chats",chatId,"messages",m.id), {status:"delivered"});
      });
      setLoadingMsgs(false);
      if(isAtBottom) endRef.current?.scrollIntoView({behavior:"smooth"});
    });
    return () => unsub();
  }, [chatId,myUid,isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if(!el) return;
    const onScroll = () => { setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => { endRef.current?.scrollIntoView({behavior:"smooth"}); setIsAtBottom(true); };

  // -------------------- Mark seen --------------------
  useEffect(() => {
    const onVisibility = async () => {
      if(document.visibilityState!=="visible") return;
      const lastIncoming = [...messages].reverse().find(m => m.senderId!==myUid);
      if(lastIncoming && lastIncoming.status!=="seen") 
        await updateDoc(doc(db,"chats",chatId,"messages",lastIncoming.id), {status:"seen"});
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return ()=>document.removeEventListener("visibilitychange", onVisibility);
  }, [messages, chatId, myUid]);

  // -------------------- File select & preview --------------------
  const onFilesSelected = e => {
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    const newPreviews = files.map(f=>({
      url: f.type.startsWith("image/")||f.type.startsWith("video/") ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f
    }));
    setSelectedFiles(prev=>[...prev,...files]);
    setPreviews(prev=>[...prev,...newPreviews]);
    setSelectedPreviewIndex(prev => prev>=0 ? prev : 0);
  };

  // -------------------- Send message --------------------
  const sendTextMessage = async () => {
    if((chatInfo?.blockedBy||[]).includes(myUid)) return alert("You are blocked in this chat.");
    if(selectedFiles.length>0){
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for(const file of filesToSend){
        try{
          const placeholder = { senderId: myUid, text:"", mediaUrl:"", mediaType:detectFileType(file), fileName:file.name, createdAt:serverTimestamp(), status:"uploading", reactions:{} };
          const mRef = await addDoc(collection(db,"chats",chatId,"messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({...prev,[messageId]:0}));
          const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({...prev,[messageId]:pct})));
          await updateDoc(doc(db,"chats",chatId,"messages",messageId), { mediaUrl:url, status:"sent", sentAt:serverTimestamp() });
          setTimeout(()=>setUploadingIds(prev=>{const c={...prev}; delete c[messageId]; return c;}),200);
        } catch(err){ console.error("upload error:",err);}
      }
      return;
    }
    if(text.trim()){
      try{
        const payload = { senderId: myUid, text:text.trim(), mediaUrl:"", mediaType:null, createdAt:serverTimestamp(), status:"sent", reactions:{} };
        if(replyTo){
          payload.replyTo = { id: replyTo.id, text:replyTo.text||(replyTo.mediaType||"media"), senderId:replyTo.senderId };
          setReplyTo(null);
        }
        await addDoc(collection(db,"chats",chatId,"messages"), payload);
        setText("");
        scrollToBottom();
      } catch(e){ console.error(e); alert("Failed to send"); }
    }
  };

  // -------------------- Recording --------------------
  useEffect(()=>setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)),[]);
  const startRecording = async () => {
    if(!recorderAvailable) return alert("Recording not supported");
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current=[];
      mr.ondataavailable = ev => { if(ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current,{type:"audio/webm"});
        const placeholder = { senderId: myUid, text:"", mediaUrl:"", mediaType:"audio", createdAt:serverTimestamp(), status:"uploading", reactions:{} };
        try{
          const mRef = await addDoc(collection(db,"chats",chatId,"messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({...prev,[messageId]:0}));
          const url = await uploadToCloudinary(blob, pct => setUploadingIds(prev => ({...prev,[messageId]:pct})));
          await updateDoc(doc(db,"chats",chatId,"messages",messageId), { mediaUrl:url, status:"sent", sentAt:serverTimestamp() });
          setTimeout(()=>setUploadingIds(prev=>{const c={...prev}; delete c[messageId]; return c;}),200);
        } catch(err){ console.error("voice upload failed",err);}
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch(err){ console.error(err); alert("Could not start recording"); }
  };
  const stopRecording = () => { 
    try { 
      recorderRef.current?.stop(); 
      recorderRef.current?.stream?.getTracks().forEach(t=>t.stop()); 
    } catch(e){}
    setRecording(false); 
    recorderRef.current = null;
  };
  const holdStart = e => { e.preventDefault(); longPressTimer.current = setTimeout(()=>startRecording(),250); };
  const holdEnd = e => { clearTimeout(longPressTimer.current); if(recording) stopRecording(); };

  // -------------------- Message actions --------------------
  const applyReaction = async (messageId, emoji) => {
    try{
      const mRef = doc(db,"chats",chatId,"messages",messageId);
      const snap = await getDoc(mRef);
      if(!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing===emoji?null:emoji });
      setReactionFor(null);
    } catch(e){ console.error(e); }
  };
  const copyMessageText = async m => { try{ await navigator.clipboard.writeText(m.text||m.mediaUrl||""); alert("Copied"); setMenuOpenFor(null); } catch(e){alert("Copy failed");} };
  const editMessage = async m => { if(m.senderId!==myUid) return alert("You can only edit your messages."); const newText=window.prompt("Edit message",m.text||""); if(newText==null) return; await updateDoc(doc(db,"chats",chatId,"messages",m.id),{text:newText,edited:true}); setMenuOpenFor(null); };
  const deleteMessageForEveryone = async id => { if(!confirm("Delete for everyone?")) return; await deleteDoc(doc(db,"chats",chatId,"messages",id)); setMenuOpenFor(null); };
  const deleteMessageForMe = async id => { await updateDoc(doc(db,"chats",chatId,"messages",id),{deletedFor:arrayUnion(myUid)}); setMenuOpenFor(null); };
  const forwardMessage = m => navigate(`/forward/${m.id}`,{state:{message:m}});
  const pinMessage = async m => { await updateDoc(doc(db,"chats",chatId),{pinnedMessageId:m.id,pinnedMessageText:m.text||(m.mediaType||"")}); setMenuOpenFor(null); alert("Pinned"); };
  const replyToMessage = m => { setReplyTo(m); setMenuOpenFor(null); };

  // -------------------- Touch handlers --------------------
  const handleMsgTouchStart = m => { longPressTimer.current = setTimeout(()=>setMenuOpenFor(m.id),500); swipeStartX.current=null; };
  const handleMsgTouchMove = ev => { if(!swipeStartX.current && ev.touches?.[0]) swipeStartX.current=ev.touches[0].clientX; };
  const handleMsgTouchEnd = (m, e) => {
    clearTimeout(longPressTimer.current);
    if(!swipeStartX.current) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if(endX==null) return;
    if(swipeStartX.current - endX > 80) replyToMessage(m);
    swipeStartX.current=null;
  };

  // -------------------- Header actions --------------------
  const clearChat = async () => {
    if(!confirm("Clear chat?")) return;
    const snap = await getDocs(query(collection(db,"chats",chatId,"messages"),orderBy("createdAt","asc")));
    for(const d of snap.docs) try{ await deleteDoc(d.ref); } catch(e){}
    setHeaderMenuOpen(false); alert("Chat cleared.");
  };
  const toggleBlock = async () => {
    if(!chatInfo) return;
    const chatRef = doc(db,"chats",chatId);
    const blockedBy = chatInfo.blockedBy||[];
    if(blockedBy.includes(myUid)){
      await updateDoc(chatRef,{blockedBy:arrayRemove(myUid)});
      setChatInfo(prev=>({...prev, blockedBy: blockedBy.filter(id=>id!==myUid)}));
      alert("You unblocked this chat.");
    } else {
      await updateDoc(chatRef,{blockedBy:arrayUnion(myUid)});
      setChatInfo(prev=>({...prev, blockedBy:[...blockedBy,myUid]}));
      alert("You blocked this chat.");
    }
    setHeaderMenuOpen(false);
  };

  // -------------------- Render message --------------------
  const renderMessage = (m) => {
    const isMine = m.senderId === myUid;
    const showMenu = menuOpenFor === m.id;
    const showReactionPicker = reactionFor === m.id;
    const time = fmtTime(m.createdAt);

    return (
      <div
        key={m.id}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
          marginBottom: SPACING.sm,
          position: "relative"
        }}
      >
        <div
          onTouchStart={() => handleMsgTouchStart(m)}
          onTouchMove={handleMsgTouchMove}
          onTouchEnd={(e) => handleMsgTouchEnd(m, e)}
          style={{
            maxWidth: "70%",
            padding: SPACING.sm,
            borderRadius: SPACING.borderRadius,
            backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
            color: isMine ? "#fff" : isDark ? COLORS.darkText : COLORS.lightText,
            cursor: "pointer",
            wordBreak: "break-word",
          }}
        >
          {/* Reply preview */}
          {m.replyTo && (
            <div
              style={{
                fontSize: 12,
                color: COLORS.edited,
                borderLeft: `3px solid ${COLORS.mutedText}`,
                paddingLeft: 4,
                marginBottom: 4,
              }}
            >
              {m.replyTo.text || m.replyTo.mediaType}
            </div>
          )}

          {/* Text */}
          {m.text && <div>{m.text}</div>}

          {/* Media */}
          {m.mediaUrl && (
            <div style={{ marginTop: 4 }}>
              {m.mediaType === "image" && (
                <img src={m.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
              )}
              {m.mediaType === "video" && (
                <video src={m.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
              )}
              {m.mediaType === "audio" && <audio src={m.mediaUrl} controls />}
              {m.mediaType === "pdf" && (
                <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                  {m.fileName || "PDF Document"}
                </a>
              )}
            </div>
          )}

          {/* Upload progress */}
          {uploadingIds[m.id] != null && (
            <div style={{ marginTop: 4, fontSize: 10, color: COLORS.mutedText }}>
              Uploading: {uploadingIds[m.id]}%
            </div>
          )}

          {/* Time and status */}
          <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
            {m.edited && "(edited)"} {time} {m.status && isMine ? `• ${m.status}` : ""}
          </div>

          {/* Reactions */}
          {Object.keys(m.reactions || {}).length > 0 && (
            <div style={{ position: "absolute", bottom: -12, right: -12, display: "flex", gap: 2 }}>
              {Object.values(m.reactions).map((r, i) => r && (
                <span
                  key={i}
                  style={{
                    backgroundColor: COLORS.reactionBg,
                    color: "#fff",
                    borderRadius: 8,
                    padding: "0 4px",
                    fontSize: 10,
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          {/* Message menu */}
          {showMenu && (
            <div
              style={{
                position: "absolute",
                top: -SPACING.lg,
                right: 0,
                background: COLORS.lightCard,
                border: `1px solid ${COLORS.grayBorder}`,
                borderRadius: SPACING.borderRadius,
                zIndex: 10,
              }}
            >
              <button style={menuBtnStyle} onClick={() => replyToMessage(m)}>Reply</button>
              <button style={menuBtnStyle} onClick={() => setReactionFor(m.id)}>React</button>
              {isMine && <button style={menuBtnStyle} onClick={() => editMessage(m)}>Edit</button>}
              {isMine && <button style={menuBtnStyle} onClick={() => deleteMessageForEveryone(m.id)}>Delete for Everyone</button>}
              <button style={menuBtnStyle} onClick={() => deleteMessageForMe(m.id)}>Delete for Me</button>
              <button style={menuBtnStyle} onClick={() => forwardMessage(m)}>Forward</button>
              <button style={menuBtnStyle} onClick={() => pinMessage(m)}>Pin</button>
              <button style={menuBtnStyle} onClick={() => copyMessageText(m)}>Copy</button>
              <button style={menuBtnStyle} onClick={() => setMenuOpenFor(null)}>Close</button>
            </div>
          )}

          {/* Inline reaction picker */}
          {showReactionPicker && (
            <div
              style={{
                position: "absolute",
                bottom: -28,
                left: 0,
                display: "flex",
                gap: 4,
                background: COLORS.lightCard,
                borderRadius: SPACING.borderRadius,
                padding: "2px 4px",
              }}
            >
              {INLINE_REACTIONS.map((r, i) => (
                <span
                  key={i}
                  style={{ cursor: "pointer", fontSize: 14 }}
                  onClick={() => applyReaction(m.id, r)}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------- JSX Return --------------------
return (
  <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg), color: isDark ? COLORS.darkText : COLORS.lightText }}>

  {/* Header (sticky at top) */}
  <div style={{ height: 56, backgroundColor: COLORS.headerBlue, color: "#fff", display: "flex", alignItems: "center", padding: "0 12px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => navigate(`/user/${friendInfo?.id}`)}>
      <button onClick={(e) => { e.stopPropagation(); navigate(-1); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}>←</button>
      <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
      <div>
        <div>{friendInfo?.name || "Chat"}</div>
        <div style={{ fontSize: 12 }}>{friendInfo?.status || ""}</div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={() => navigate(`/voice-call/${friendInfo?.id}`)} style={{ background: "transparent", border: "none", color: "#fff" }}>📞</button>
      <button onClick={() => navigate(`/video-call/${friendInfo?.id}`)} style={{ background: "transparent", border: "none", color: "#fff" }}>🎥</button>
      <button onClick={() => setHeaderMenuOpen(prev => !prev)} style={{ background: "transparent", border: "none", color: "#fff" }}>⋮</button>
    </div>

    {headerMenuOpen && (
      <div style={{ position: "absolute", top: 56, right: 12, background: COLORS.lightCard, borderRadius: SPACING.borderRadius, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", zIndex: 30 }}>
        <button style={menuBtnStyle} onClick={clearChat}>Clear Chat</button>
        <button style={menuBtnStyle} onClick={toggleBlock}>
          {(chatInfo?.blockedBy || []).includes(myUid) ? "Unblock" : "Block"}
        </button>
        <button style={menuBtnStyle} onClick={() => setHeaderMenuOpen(false)}>Close</button>
      </div>
    )}
  </div>

  {/* Pinned message (sticky below header) */}
  {chatInfo?.pinnedMessageId && (
    <div style={{ padding: SPACING.sm, background: isDark ? COLORS.darkCard : COLORS.lightCard, borderBottom: `1px solid ${COLORS.grayBorder}`, position: "sticky", top: 56, zIndex: 15 }}>
      <b>Pinned:</b> {chatInfo.pinnedMessageText || ""}
    </div>
  )}

  {/* Messages scrollable container */}
  <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm, marginTop: chatInfo?.pinnedMessageId ? 0 : 0 }}>
    {loadingMsgs && <div style={{ textAlign: "center", marginTop: SPACING.md }}>Loading...</div>}
    {messages.map(renderMessage)}
    <div ref={endRef} />
  </div>

  {/* Reply preview above input */}
  {replyTo && (
    <div style={{ padding: SPACING.sm, background: isDark ? COLORS.darkCard : COLORS.lightCard, borderTop: `1px solid ${COLORS.grayBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
      <div>
        <b>{replyTo.text ? (replyTo.text.length > 30 ? replyTo.text.slice(0, 30) + "…" : replyTo.text) : replyTo.mediaType}</b>
      </div>
      <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", fontSize: 16 }}>×</button>
    </div>
  )}

  {/* Input bar (sticky at bottom) */}
  <div style={{ padding: SPACING.sm, display: "flex", alignItems: "center", gap: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: isDark ? COLORS.darkCard : COLORS.lightCard, position: "sticky", bottom: 0, zIndex: 20 }}>
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
</div>
  );
}