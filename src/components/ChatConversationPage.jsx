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

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];

// ---------- helpers ----------
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatLastSeen = (ts) => {
  if (!ts) return "Offline";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff/60)} minutes ago`;
  if (diff < 86400 && d.toDateString() === now.toDateString()) return `${Math.floor(diff/3600)} hours ago`;
  const yesterday = new Date(); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() });
};

const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() });
};

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

// ---------- ChatConversationPage ----------
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
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // ---------- Load chat info ----------
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
        unsubChat = onSnapshot(cRef, s => {
          if (s.exists()) setChatInfo(prev => ({ ...(prev||{}), ...s.data() }));
        });
      } catch (e) { console.error(e); }
    };
    loadMeta();
    return () => unsubChat?.();
  }, [chatId, myUid]);

  // ---------- Messages realtime ----------
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
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch (e){}
        }
      });
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- Scroll detection ----------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  // ---------- Mark seen ----------
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

  // ---------- Recorder ----------
  useEffect(() => { setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)); }, []);

  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        const placeholder = {
          senderId: myUid,
          text: "",
          mediaUrl: "",
          mediaType: "audio",
          createdAt: serverTimestamp(),
          status: "uploading",
          reactions: {},
        };
        try {
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(blob, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = {...prev}; delete c[messageId]; return c; }), 200);
        } catch (err) { console.error("voice upload failed", err); }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) { console.error(err); alert("Could not start recording"); }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    } catch (e) {}
    setRecording(false);
  };

  const holdStart = (e) => { e.preventDefault(); longPressTimer.current = setTimeout(() => startRecording(), 250); };
  const holdEnd = (e) => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); };

  // ---------- File select ----------
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

  // ---------- Send message ----------
  const sendTextMessage = async () => {
    if ((chatInfo?.blockedBy || []).includes(myUid)) { alert("You are blocked"); return; }
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = {
            senderId: myUid,
            text: "",
            mediaUrl: "",
            mediaType: detectFileType(file),
            fileName: file.name,
            createdAt: serverTimestamp(),
            status: "uploading",
            reactions: {},
          };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(file, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = {...prev}; delete c[messageId]; return c; }), 200);
        } catch (err) { console.error("upload error:", err); }
      }
      return;
    }

    if (text.trim()) {
      try {
        const payload = { senderId: myUid, text: text.trim(), mediaUrl:"", mediaType:null, createdAt:serverTimestamp(), status:"sent", reactions:{} };
        if (replyTo) { payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType||"media"), senderId: replyTo.senderId }; setReplyTo(null); }
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText(""); setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
      } catch(e) { console.error(e); alert("Failed to send"); }
    }
  };

  // ---------- Message actions ----------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef); if (!snap.exists()) return;
      const data = snap.data();
      const existing = data.reactions?.[myUid];
      if (existing === emoji) await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      else await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      setReactionFor(null);
    } catch(e){ console.error(e); }
  };

  const copyMessageText = async (m) => { try{ await navigator.clipboard.writeText(m.text||m.mediaUrl||""); alert("Copied"); setMenuOpenFor(null); } catch(e){ alert("Copy failed"); } };
  const editMessage = async (m) => { if(m.senderId!==myUid)return alert("Only your messages"); const newText=window.prompt("Edit message", m.text||""); if(newText==null)return; await updateDoc(doc(db,"chats",chatId,"messages",m.id),{text:newText,edited:true}); setMenuOpenFor(null); };
  const deleteMessageForEveryone = async(id)=>{ if(!confirm("Delete for everyone?"))return; await deleteDoc(doc(db,"chats",chatId,"messages",id)); setMenuOpenFor(null); };
  const deleteMessageForMe = async(id)=>{ await updateDoc(doc(db,"chats",chatId,"messages",id),{deletedFor:arrayUnion(myUid)}); setMenuOpenFor(null); };
  const forwardMessage = (m)=>navigate(`/forward/${m.id}`,{state:{message:m}});
  const pinMessage = async(m)=>{ await updateDoc(doc(db,"chats",chatId),{pinnedMessageId:m.id,pinnedMessageText:m.text||(m.mediaType||"")}); setMenuOpenFor(null); alert("Pinned"); };
  const replyToMessage = (m)=>{ setReplyTo(m); setMenuOpenFor(null); };

  // ---------- Touch handlers ----------
  const handleMsgTouchStart=(m)=>{ longPressTimer.current=setTimeout(()=>setMenuOpenFor(m.id),500); swipeStartX.current=null; };
  const handleMsgTouchMove=(ev)=>{ if(!swipeStartX.current && ev.touches && ev.touches[0]) swipeStartX.current=ev.touches[0].clientX; };
  const handleMsgTouchEnd=(m,ev)=>{ clearTimeout(longPressTimer.current); if(!swipeStartX.current) return; const endX=ev.changedTouches?ev.changedTouches[0].clientX:null; if(endX==null) return; if(swipeStartX.current-endX>80) replyToMessage(m); swipeStartX.current=null; };

  // ---------- Header actions ----------
  const clearChat = async()=>{ if(!confirm("Clear chat?")) return; try{ const msgsRef=collection(db,"chats",chatId,"messages"); const snap=await getDocs(query(msgsRef,orderBy("createdAt","asc"))); for(const d of snap.docs){ try{ await deleteDoc(d.ref); } catch(e){} } setHeaderMenuOpen(false); alert("Chat cleared"); }catch(e){console.error(e); alert("Failed to clear chat"); } };

  const handleClickOutsideMenu = (e) => {
    if (!e.target.closest(".menu")) setMenuOpenFor(null);
    if (!e.target.closest(".reaction-picker")) setReactionFor(null);
    if (!e.target.closest(".header-menu")) setHeaderMenuOpen(false);
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutsideMenu);
    return () => document.removeEventListener("click", handleClickOutsideMenu);
  }, []);

  // ---------- UI ----------
  return (
    <div className={`flex flex-col h-full w-full relative ${wallpaper ? "bg-cover bg-center" : isDark ? "bg-gray-900" : "bg-gray-100"}`}
         style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : undefined }}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 sticky top-0 z-10 shadow-md">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => friendInfo && navigate(`/profile/${friendInfo.id}`)}>
          <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full"/>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{friendInfo?.displayName || "Unknown"}</span>
            <span className="text-xs text-gray-500 dark:text-gray-300">{formatLastSeen(friendInfo?.lastSeen)}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => navigate(`/voice-call/${chatId}`)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            📞
          </button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            🎥
          </button>
          <div className="relative">
            <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              ⋮
            </button>
            {headerMenuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 shadow-md rounded menu z-20">
                <button onClick={clearChat} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Clear Chat</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRefEl} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && !loadingMsgs && (
          <div className="text-center text-gray-400 text-sm mt-2">No messages yet</div>
        )}
        {messages.map((m, idx) => {
          const prev = messages[idx-1];
          const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
          const isMe = m.senderId === myUid;
          return (
            <React.Fragment key={m.id}>
              {showDay && (
                <div className="text-center text-gray-500 text-xs my-2">{dayLabel(m.createdAt)}</div>
              )}
              <div
                className={`flex ${isMe ? "justify-end" : "justify-start"} relative`}
                onTouchStart={() => handleMsgTouchStart(m)}
                onTouchMove={handleMsgTouchMove}
                onTouchEnd={(e) => handleMsgTouchEnd(m,e)}
              >
                <div className={`max-w-[70%] p-2 rounded-lg ${isMe ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"}`}>
                  {/* Reply snippet */}
                  {m.replyTo && (
                    <div className="bg-gray-100 dark:bg-gray-600 p-1 rounded mb-1 text-xs italic">
                      {m.replyTo.text?.length > 50 ? m.replyTo.text.slice(0,50)+"..." : m.replyTo.text || m.replyTo.mediaType}
                    </div>
                  )}
                  {/* Media */}
                  {m.mediaUrl && m.mediaType === "image" && <img src={m.mediaUrl} className="rounded max-h-60 w-auto" />}
                  {m.mediaUrl && m.mediaType === "video" && <video controls src={m.mediaUrl} className="rounded max-h-60 w-auto" />}
                  {m.mediaUrl && m.mediaType === "audio" && <audio controls src={m.mediaUrl} className="w-full" />}
                  {m.mediaUrl && m.mediaType === "pdf" && <a href={m.mediaUrl} target="_blank" className="underline">{m.fileName}</a>}
                  {!m.mediaUrl && <span>{m.text}</span>}
                  {/* Status */}
                  <div className="text-xs mt-1 flex justify-end">
                    {isMe && <span>{m.status==="sent"?"✓":m.status==="delivered"?"✓✓":m.status==="seen"?"✔✔":"⌛"}</span>}
                  </div>
                  {/* Reactions */}
                  {m.reactions && Object.keys(m.reactions).length>0 && (
                    <div className="flex space-x-1 mt-1 text-sm">
                      {Object.values(m.reactions).map(r=>r && <span key={r}>{r}</span>)}
                    </div>
                  )}
                </div>
                {/* 3-dot menu */}
                <div className="relative">
                  <button onClick={() => setMenuOpenFor(m.id)} className="ml-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">⋮</button>
                  {menuOpenFor === m.id && (
                    <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 shadow-md rounded menu z-20">
                      <button onClick={()=>replyToMessage(m)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Reply</button>
                      {isMe && <button onClick={()=>editMessage(m)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Edit</button>}
                      {isMe && <button onClick={()=>deleteMessageForEveryone(m.id)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Delete for Everyone</button>}
                      <button onClick={()=>deleteMessageForMe(m.id)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Delete for Me</button>
                      <button onClick={()=>copyMessageText(m)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Copy</button>
                      <button onClick={()=>pinMessage(m)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Pin</button>
                    </div>
                  )}
                  {/* Reaction picker */}
                  <div className={`absolute -bottom-12 left-0 ${reactionFor===m.id?"block":"hidden"} reaction-picker z-20 bg-white dark:bg-gray-800 shadow-md rounded flex p-1`}>
                    {INLINE_REACTIONS.map(e => (
                      <button key={e} onClick={()=>applyReaction(m.id,e)} className="mx-1">{e}</button>
                    ))}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div className="flex items-center p-2 bg-white dark:bg-gray-800 sticky bottom-0 space-x-2">
        <input
          type="text"
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Type a message"
          className="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-700 outline-none text-gray-900 dark:text-gray-100"
        />
        <input type="file" multiple onChange={onFilesSelected} className="hidden" id="fileInput"/>
        <label htmlFor="fileInput" className="cursor-pointer px-2">📎</label>
        <button onClick={sendTextMessage} className="px-3 py-1 rounded bg-blue-500 text-white">Send</button>
        {recorderAvailable && !recording && <button onTouchStart={holdStart} onTouchEnd={holdEnd} className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-600">🎤</button>}
        {recording && <button onClick={stopRecording} className="px-3 py-1 rounded bg-red-500 text-white">Stop</button>}
      </div>
    </div>
  );
}