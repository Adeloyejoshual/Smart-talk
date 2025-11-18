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

// ----------------- Helpers -----------------
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
};

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];

const detectFileType = (file) => {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  return "file";
};

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
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const res = JSON.parse(xhr.responseText);
          resolve(res.secure_url || res.url);
        } else reject(new Error("Cloudinary upload failed: " + xhr.status));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      xhr.send(fd);
    } catch (err) {
      reject(err);
    }
  });
};

// ----------------- Main Component -----------------
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

  // ----------------- State -----------------
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
  const [typingUsers, setTypingUsers] = useState([]);

  // ----------------- Effects -----------------
  useEffect(() => { setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)); }, []);

  // Load chat info + friend
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
        unsubChat = onSnapshot(cRef, s => { if (s.exists()) setChatInfo(prev => ({ ...(prev||{}), ...s.data() })); });
      } catch (e) { console.error(e); }
    };
    loadMeta();
    return () => { if (unsubChat) unsubChat(); };
  }, [chatId, myUid]);

  // Load messages realtime
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);
      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch(e){}
        }
      });
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // Scroll detection
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => { setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Mark seen on visibility
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].slice().reverse().find(m => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        try { await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" }); } catch(e){}
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [messages, chatId, myUid]);

  // ----------------- Handlers -----------------
  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map(f => ({
      url: (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f
    }));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setSelectedPreviewIndex(prev => prev >= 0 ? prev : 0);
  };

  const sendTextMessage = async () => {
    if ((chatInfo?.blockedBy || []).includes(myUid)) { alert("You are blocked."); return; }

    // Send files
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = {
            senderId: myUid, text:"", mediaUrl:"", mediaType: detectFileType(file),
            fileName:file.name, createdAt: serverTimestamp(), status:"uploading", reactions:{},
          };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(file, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status:"sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c={...prev}; delete c[messageId]; return c; }), 200);
        } catch (err) { console.error("upload error:", err); }
      }
      return;
    }

    // Send text
    if (text.trim()) {
      try {
        const payload = { senderId: myUid, text:text.trim(), mediaUrl:"", mediaType:null, createdAt: serverTimestamp(), status:"sent", reactions:{} };
        if (replyTo) { payload.replyTo = { id:replyTo.id, text:replyTo.text || (replyTo.mediaType || "media"), senderId:replyTo.senderId }; setReplyTo(null); }
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText(""); setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
      } catch(e){ console.error(e); alert("Failed to send"); }
    }
  };

  // ----------------- UI Components -----------------
  const MessageBubble = ({ m }) => {
    const mine = m.senderId === myUid;
    const bgColor = mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff");
    const color = mine ? "#fff" : (isDark ? "#fff" : "#000");

    const renderStatusTick = () => {
      if (!mine) return null;
      if (m.status==="uploading") return "⌛";
      if (m.status==="sent") return "✔";
      if (m.status==="delivered") return "✔✔";
      if (m.status==="seen") return <span style={{color:"#2b9f4a"}}>✔✔</span>;
      return null;
    };

    const renderMessageContent = () => {
      if (m.mediaUrl) {
        switch(m.mediaType){
          case "image": return <img src={m.mediaUrl} alt={m.fileName||"image"} style={{maxWidth:360,borderRadius:12}}/>;
          case "video": return <video controls src={m.mediaUrl} style={{maxWidth:360,borderRadius:12}}/>;
          case "audio": return <audio controls src={m.mediaUrl} style={{width:300}}/>;
          case "pdf":
          case "file": return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>;
          default: return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open media</a>;
        }
      }
      return <div style={{whiteSpace:"pre-wrap"}}>{m.text}</div>;
    };

    return (
      <div style={{ display:"flex", justifyContent: mine ? "flex-end":"flex-start", marginBottom:12, position:"relative" }}>
        <div style={{ background:bgColor, color, padding:12, borderRadius:14, maxWidth:"78%", position:"relative", wordBreak:"break-word" }}>
          {m.replyTo && <div style={{marginBottom:6,padding:"6px 8px",borderRadius:8,background:isDark?"#0f0f0f":"#f3f3f3",color:isDark?"#ddd":"#333",fontSize:12}}>
            <div style={{fontWeight:700,marginBottom:4}}>{m.replyTo.senderId===myUid?"You":"Them"}</div>
            <div style={{maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.replyTo.text}</div>
          </div>}
          {renderMessageContent()}
          {m.edited && <div style={{fontSize:11,opacity:0.9}}>· edited</div>}
          {m.reactions && Object.keys(m.reactions).length>0 && (
            <div style={{position:"absolute",bottom:-14,right:6,background:isDark?"#111":"#fff",padding:"4px 8px",borderRadius:12,fontSize:12,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>
              {Object.values(m.reactions).slice(0,4).join(" ")}
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,fontSize:11,opacity:0.9}}>
            <div style={{marginLeft:"auto"}}>{fmtTime(m.createdAt)} {renderStatusTick()}</div>
          </div>
          {m.status==="uploading" && uploadingIds[m.id]!==undefined && (
            <div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)"}}>
              <div style={{width:36,height:36,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",background:"#eee",color:"#333",fontSize:12}}>
                {uploadingIds[m.id]}%
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const groupedMessages = (() => {
    const out = []; let lastDay = null;
    messages.forEach(m => {
      const label = dayLabel(m.createdAt||new Date());
      if(label!==lastDay){ out.push({type:"day",label,id:`day-${label}-${Math.random().toString(36).slice(2,6)}`}); lastDay=label; }
      out.push(m);
    });
    return out;
  })();

  // ----------------- Render -----------------
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:wallpaper?`url(${wallpaper}) center/cover no-repeat`:(isDark?"#070707":"#f5f5f5"),color:isDark?"#fff":"#000"}}>
      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:90,display:"flex",alignItems:"center",gap:12,padding:12,background:"#1877F2",color:"#fff",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
        <button onClick={()=>navigate("/chat")} style={{fontSize:20,background:'transparent',border:'none',color:'#fff',cursor:'pointer'}}>←</button>
        <img onClick={()=>friendInfo&&navigate(`/user-profile/${friendInfo.id}`)} src={friendInfo?.photoURL||chatInfo?.photoURL||"/default-avatar.png"} alt="avatar" style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",cursor:"pointer"}}/>
        <div style={{minWidth:0,cursor:'pointer'}} onClick={()=>friendInfo&&navigate(`/user-profile/${friendInfo.id}`)}>
          <div style={{fontWeight:700,fontSize:16}}>{friendInfo?.displayName||chatInfo?.name||"Chat"}</div>
          <div style={{ fontSize:12, opacity:0.8 }}>
            {typingUsers.length > 0
              ? typingUsers.join(", ") + " is typing..."
              : friendInfo?.status || "Online"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 20 }}>⋮</button>
          {headerMenuOpen && (
            <div style={{
              position: "absolute",
              top: 60,
              right: 12,
              background: isDark ? "#222" : "#fff",
              color: isDark ? "#fff" : "#000",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              overflow: "hidden",
              zIndex: 100
            }}>
              <button style={{ padding: "8px 16px", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
                onClick={() => alert("Block user")}>Block</button>
              <button style={{ padding: "8px 16px", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
                onClick={() => alert("Unblock user")}>Unblock</button>
              <button style={{ padding: "8px 16px", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
                onClick={() => navigate("/")}>Close Chat</button>
            </div>
          )}
        </div>
      </header>

      {/* Messages Container */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: 24 }}>Loading messages...</div>}
        {groupedMessages.map(item => (
          item.type === "day" ? (
            <div key={item.id} style={{ textAlign: "center", margin: "12px 0", color: isDark ? "#aaa" : "#555", fontSize: 12 }}>
              {item.label}
            </div>
          ) : (
            <MessageBubble key={item.id} m={item} />
          )
        ))}
        <div ref={endRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div style={{
          padding: "8px 12px",
          background: isDark ? "#111" : "#eaeaea",
          display: "flex",
          alignItems: "center",
          borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`
        }}>
          <div style={{ flex: 1, fontSize: 12 }}>
            Replying to {replyTo.senderId === myUid ? "You" : "Them"}: {replyTo.text || replyTo.mediaType}
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>✖</button>
        </div>
      )}

      {/* Input Area */}
      <div style={{ display: "flex", alignItems: "center", padding: 8, borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#0a0a0a" : "#fff" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 20,
            border: `1px solid ${isDark ? "#333" : "#ccc"}`,
            background: isDark ? "#1a1a1a" : "#f5f5f5",
            color: isDark ? "#fff" : "#000",
            outline: "none"
          }}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
        />
        <input
          type="file"
          multiple
          onChange={onFilesSelected}
          style={{ display: "none" }}
          id="file-upload"
        />
        <label htmlFor="file-upload" style={{ marginLeft: 8, cursor: "pointer", fontSize: 20 }}>📎</label>
        <button onClick={sendTextMessage} style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 20, border: "none", background: "#0b84ff", color: "#fff", cursor: "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
}