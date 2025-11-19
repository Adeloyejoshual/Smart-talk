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

// small helpers
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

  // state
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

  // ---------- Cloudinary ----------
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

  const detectFileType = (file) => {
    const t = file.type;
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  // ---------- load chat meta + friend ----------
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
    return () => { if (unsubChat) unsubChat(); };
  }, [chatId, myUid]);

  // ---------- messages realtime ----------
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
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch (e) {}
        }
      });
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- scrolling detection ----------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => {
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  // ---------- mark seen when visible ----------
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

  // ---------- file select & preview ----------
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

  // ---------- send message ----------
  const sendTextMessage = async () => {
    const blockedBy = chatInfo?.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      alert("You are blocked in this chat. You cannot send messages.");
      return;
    }

    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = { senderId: myUid, text:"", mediaUrl:"", mediaType: detectFileType(file), fileName: file.name, createdAt: serverTimestamp(), status:"uploading", reactions:{} };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(file, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status:"sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = {...prev}; delete c[messageId]; return c; }), 200);
        } catch(err){ console.error("upload error", err); }
      }
      return;
    }

    if (text.trim()) {
      try {
        const payload = { senderId: myUid, text: text.trim(), mediaUrl:"", mediaType:null, createdAt:serverTimestamp(), status:"sent", reactions:{} };
        if (replyTo) { payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId }; setReplyTo(null); }
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText("");
        setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
      } catch(e){ console.error(e); alert("Failed to send"); }
    }
  };

  // ---------- recording ----------
  useEffect(() => { setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)); }, []);

  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = ev => { if (ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type:"audio/webm" });
        const placeholder = { senderId: myUid, text:"", mediaUrl:"", mediaType:"audio", createdAt:serverTimestamp(), status:"uploading", reactions:{} };
        try {
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(blob, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl:url, status:"sent", sentAt:serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c={...prev}; delete c[messageId]; return c; }), 200);
        } catch(err){ console.error("voice upload failed", err); }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch(err){ console.error(err); alert("Could not start recording"); }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach(t=>t.stop()); } catch(e){}
    setRecording(false);
  };

  const holdStart = (e) => { e.preventDefault(); longPressTimer.current = setTimeout(() => startRecording(), 250); };
  const holdEnd = (e) => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); };

  // ---------- message actions ----------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const existing = data.reactions?.[myUid];
      if (existing === emoji) await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      else await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      setReactionFor(null);
    } catch(e){ console.error(e); }
  };

  const copyMessageText = async (m) => { try{ await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); setMenuOpenFor(null); } catch(e){ alert("Copy failed"); } };
  const editMessage = async (m) => { if (m.senderId!==myUid) return alert("You can only edit your messages."); const newText = window.prompt("Edit message", m.text||""); if(newText==null) return; await updateDoc(doc(db,"chats",chatId,"messages",m.id),{text:newText,edited:true}); setMenuOpenFor(null); };
  const deleteMessageForEveryone = async (id) => { if(!confirm("Delete for everyone?")) return; await deleteDoc(doc(db,"chats",chatId,"messages",id)); setMenuOpenFor(null); };
  const deleteMessageForMe = async (id) => { await updateDoc(doc(db,"chats",chatId,"messages",id),{deletedFor:arrayUnion(myUid)}); setMenuOpenFor(null); };
  const forwardMessage = (m) => navigate(`/forward/${m.id}`,{state:{message:m}});
  const pinMessage = async (m) => { await updateDoc(doc(db,"chats",chatId),{pinnedMessageId:m.id,pinnedMessageText:m.text||(m.mediaType||"")}); setMenuOpenFor(null); alert("Pinned"); };
  const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };

  // ---------- long press & swipe ----------
  const handleMsgTouchStart = (m) => { longPressTimer.current=setTimeout(()=>setMenuOpenFor(m.id),500); swipeStartX.current=null; };
  const handleMsgTouchMove = (ev) => { if(!swipeStartX.current && ev.touches?.[0]) swipeStartX.current=ev.touches[0].clientX; };
  const handleMsgTouchEnd = (m) => { clearTimeout(longPressTimer.current); if(!swipeStartX.current) return; const endX=event.changedTouches?.[0]?.clientX; if(endX==null)return; const dx=swipeStartX.current-endX; if(dx>80) replyToMessage(m); swipeStartX.current=null; };

  // ---------- header actions ----------
  const clearChat = async () => {
    if(!confirm("Clear chat? This will attempt to delete messages.")) return;
    try{
      const msgsRef = collection(db,"chats",chatId,"messages");
      const snap = await getDocs(query(msgsRef, orderBy("createdAt","asc")));
      for(const d of snap.docs){ try{ await deleteDoc(d.ref); } catch(e){} }
      setHeaderMenuOpen(false);
      alert("Chat cleared.");
    } catch(e){ console.error(e); alert("Failed to clear chat"); }
  };

  const toggleBlock = async () => {
    if(!friendInfo?.id) return;
    try{
      const chatRef = doc(db,"chats",chatId);
      const snap = await getDoc(chatRef);
      if(!snap.exists()) return;
      const blockedBy = snap.data()?.blockedBy||[];
      if(blockedBy.includes(myUid)){
        await updateDoc(chatRef,{blockedBy:arrayRemove(myUid)});
        alert("User unblocked");
      } else {
        await updateDoc(chatRef,{blockedBy:arrayUnion(myUid)});
        alert("User blocked");
      }
      setHeaderMenuOpen(false);
    } catch(e){ console.error(e); alert("Failed to toggle block"); }
  };

  // ---------- render helpers ----------
  const renderStatusTick = (m) => {
    if (m.senderId !== myUid) return null;
    if (m.status==="uploading") return "⌛";
    if (m.status==="sent") return "✔";
    if (m.status==="delivered") return "✔✔";
    if (m.status==="seen") return "✔✔ (seen)";
    return "";
  };

  const renderMessage = (m, idx) => {
    const isMe = m.senderId === myUid;
    const reactedByMe = m.reactions?.[myUid];
    return (
      <div
        key={m.id}
        className={`message-row ${isMe ? "me" : "friend"}`}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpenFor(m.id); }}
        onTouchStart={() => handleMsgTouchStart(m)}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={() => handleMsgTouchEnd(m)}
      >
        {replyTo && replyTo.id === m.id && (
          <div className="reply-indicator">Replying...</div>
        )}
        {m.replyTo && (
          <div className="reply-preview">
            <strong>{m.replyTo.senderId===myUid?"You":friendInfo?.name}</strong>: {m.replyTo.text || m.replyTo.mediaType}
          </div>
        )}
        {m.text && <div className="message-text">{m.text}</div>}
        {m.mediaUrl && m.mediaType === "image" && <img src={m.mediaUrl} alt="media" className="message-media" />}
        {m.mediaUrl && m.mediaType === "video" && <video src={m.mediaUrl} controls className="message-media" />}
        {m.mediaUrl && m.mediaType === "audio" && <audio src={m.mediaUrl} controls />}
        {Object.keys(m.reactions || {}).length > 0 && (
          <div className="message-reactions">
            {Object.values(m.reactions).filter(Boolean).map((r, i) => (
              <span key={i} className={r === reactedByMe ? "my-reaction" : ""}>{r}</span>
            ))}
          </div>
        )}
        <div className="message-meta">
          <span className="timestamp">{fmtTime(m.createdAt)}</span>
          {isMe && <span className="status">{renderStatusTick(m)}</span>}
        </div>
        {menuOpenFor === m.id && (
          <div className="message-menu">
            <button onClick={() => replyToMessage(m)}>Reply</button>
            {isMe && <button onClick={() => editMessage(m)}>Edit</button>}
            <button onClick={() => copyMessageText(m)}>Copy</button>
            <button onClick={() => deleteMessageForMe(m.id)}>Delete for me</button>
            {isMe && <button onClick={() => deleteMessageForEveryone(m.id)}>Delete for everyone</button>}
            <button onClick={() => pinMessage(m)}>Pin</button>
            <button onClick={() => setReactionFor(m.id)}>React</button>
            <button onClick={() => forwardMessage(m)}>Forward</button>
            <button onClick={() => setMenuOpenFor(null)}>Cancel</button>
          </div>
        )}
        {reactionFor === m.id && (
          <div className="reaction-picker">
            {EXTENDED_EMOJIS.map((e, i) => (
              <span key={i} onClick={() => applyReaction(m.id, e)}>{e}</span>
            ))}
            <button onClick={() => setReactionFor(null)}>✖</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`chat-page ${isDark ? "dark" : "light"}`} style={{ background: wallpaper || undefined }}>
      <div className="chat-header">
        <button onClick={() => navigate(-1)}>←</button>
        <div className="chat-title">{friendInfo?.name || "Chat"}</div>
        <div className="chat-last-seen">{friendInfo?.lastSeen ? `Last seen: ${fmtTime(friendInfo.lastSeen)}` : ""}</div>
        <div className="header-actions">
          <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)}>⋮</button>
          {headerMenuOpen && (
            <div className="header-menu">
              <button onClick={clearChat}>Clear Chat</button>
              <button onClick={toggleBlock}>{chatInfo?.blockedBy?.includes(myUid) ? "Unblock" : "Block"} User</button>
              <button onClick={() => setHeaderMenuOpen(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div ref={messagesRefEl} className="chat-messages">
        {loadingMsgs && <div className="loading">Loading messages...</div>}
        {messages.map((m, i) => renderMessage(m, i))}
        <div ref={endRef}></div>
      </div>

      {replyTo && (
        <div className="replying-to">
          Replying to: {replyTo.text || replyTo.mediaType}
          <button onClick={() => setReplyTo(null)}>✖</button>
        </div>
      )}

      <div className="chat-input">
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if(e.key==="Enter") sendTextMessage(); }}
        />
        <input type="file" multiple style={{ display: "none" }} id="fileInput" onChange={onFilesSelected} />
        <button onClick={() => document.getElementById("fileInput").click()}>📎</button>
        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
        >{recording ? "🎙️" : "🎤"}</button>
        <button onClick={sendTextMessage}>➡️</button>
      </div>
    </div>
  );
}