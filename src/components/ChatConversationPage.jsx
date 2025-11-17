// src/components/ChatConversationPage.jsx import React, { useEffect, useState, useRef, useContext } from "react"; import { useParams, useNavigate } from "react-router-dom"; import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc, getDoc, arrayUnion, arrayRemove, deleteDoc, limit as fsLimit, getDocs, } from "firebase/firestore"; import { db, auth } from "../firebaseConfig"; import { ThemeContext } from "../context/ThemeContext";

/**

ChatConversationPage.jsx — professional, improved

header: clicking avatar/name navigates to profile (/profile/:uid)


header contains inline voice/video call buttons (navigate to /voicecall/:uid and /videocall/:uid)


3-dot menu shows first 6 actions and a "More" toggle for the rest; call actions removed from 3-dot


clicking outside the 3-dot menu closes it


long-press on a message opens reactions UI only (no large menu)


right-click / short press opens full message menu (Reply/Copy/Forward/Pin/Delete/React)


audio (voice note) messages render a compact player with avatar + progress


lots of small UX improvements */



const fmtTime = (ts) => { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }; const dayLabel = (ts) => { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); const now = new Date(); const yesterday = new Date(); yesterday.setDate(now.getDate() - 1); if (d.toDateString() === now.toDateString()) return "Today"; if (d.toDateString() === yesterday.toDateString()) return "Yesterday"; return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined, }); };

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"]; const EXTENDED_EMOJIS = [ "❤️", "😂", "👍", "😮", "😢", "👎", "👏", "🔥", "😅", "🤩", "😍", "😎", "🙂", "🙃", "😉", "🤔", "🤨", "🤗", "🤯", "🥳", "🙏", "💪", ];

export default function ChatConversationPage() { const { chatId } = useParams(); const navigate = useNavigate(); const { theme, wallpaper } = useContext(ThemeContext); const isDark = theme === "dark";

const myUid = auth.currentUser?.uid; const messagesRefEl = useRef(null); const endRef = useRef(null); const longPressTimer = useRef(null); const swipeStartX = useRef(null); const headerMenuRef = useRef(null);

// state const [chatInfo, setChatInfo] = useState(null); const [friendInfo, setFriendInfo] = useState(null); const [messages, setMessages] = useState([]); const [loadingMsgs, setLoadingMsgs] = useState(true); const [text, setText] = useState(""); const [selectedFiles, setSelectedFiles] = useState([]); const [previews, setPreviews] = useState([]); const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0); const [uploadingIds, setUploadingIds] = useState({}); const [replyTo, setReplyTo] = useState(null); const [menuOpenFor, setMenuOpenFor] = useState(null); const [reactionFor, setReactionFor] = useState(null); const [showEmojiPicker, setShowEmojiPicker] = useState(false); const [emojiPickerFor, setEmojiPickerFor] = useState(null); const [isAtBottom, setIsAtBottom] = useState(true); const [recording, setRecording] = useState(false); const [recorderAvailable, setRecorderAvailable] = useState(false); const recorderRef = useRef(null); const recorderChunksRef = useRef([]);

const [headerMenuOpen, setHeaderMenuOpen] = useState(false); const [headerMenuExpanded, setHeaderMenuExpanded] = useState(false);

// ---------- Cloudinary upload helper ---------- const uploadToCloudinary = (file, onProgress) => { return new Promise((resolve, reject) => { try { const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME; const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET; if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary env not set")); const url = https://api.cloudinary.com/v1_1/${cloudName}/auto/upload; const xhr = new XMLHttpRequest(); xhr.open("POST", url); xhr.upload.addEventListener("progress", (e) => { if (e.lengthComputable && onProgress) { onProgress(Math.round((e.loaded * 100) / e.total)); } }); xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { const res = JSON.parse(xhr.responseText); resolve(res.secure_url || res.url); } else reject(new Error("Cloudinary upload failed: " + xhr.status)); }; xhr.onerror = () => reject(new Error("Network error")); const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", uploadPreset); xhr.send(fd); } catch (err) { reject(err); } }); };

const detectFileType = (file) => { const t = file.type; if (t.startsWith("image/")) return "image"; if (t.startsWith("video/")) return "video"; if (t.startsWith("audio/")) return "audio"; if (t === "application/pdf") return "pdf"; return "file"; };

// ---------- load chat meta + friend ---------- useEffect(() => { if (!chatId) return; let unsubChat = null; const loadMeta = async () => { try { const cRef = doc(db, "chats", chatId); const cSnap = await getDoc(cRef); if (cSnap.exists()) { const data = cSnap.data(); setChatInfo({ id: cSnap.id, ...data }); const friendId = data.participants?.find((p) => p !== myUid); if (friendId) { const fRef = doc(db, "users", friendId); const fSnap = await getDoc(fRef); if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() }); } } unsubChat = onSnapshot(cRef, (s) => { if (s.exists()) setChatInfo((prev) => ({ ...(prev || {}), ...s.data() })); }); } catch (e) { console.error(e); } }; loadMeta(); return () => { if (unsubChat) unsubChat(); }; }, [chatId, myUid]);

// ---------- messages realtime ---------- useEffect(() => { if (!chatId) return; setLoadingMsgs(true); const msgsRef = collection(db, "chats", chatId, "messages"); const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000)); const unsub = onSnapshot(q, (snap) => { const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })); const filtered = docs.filter((m) => !(m.deletedFor && m.deletedFor.includes(myUid))); setMessages(filtered); filtered.forEach(async (m) => { if (m.senderId !== myUid && m.status === "sent") { try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch (e) {} } }); setLoadingMsgs(false); setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80); }); return () => unsub(); }, [chatId, myUid, isAtBottom]);

// ---------- close header menu when clicking outside ---------- useEffect(() => { const onDocDown = (ev) => { if (!headerMenuRef.current) return; if (!headerMenuRef.current.contains(ev.target)) { setHeaderMenuOpen(false); setHeaderMenuExpanded(false); } }; if (headerMenuOpen) document.addEventListener("mousedown", onDocDown); return () => document.removeEventListener("mousedown", onDocDown); }, [headerMenuOpen]);

// ---------- scrolling detection ---------- useEffect(() => { const el = messagesRefEl.current; if (!el) return; const onScroll = () => { const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80; setIsAtBottom(atBottom); }; el.addEventListener("scroll", onScroll); return () => el.removeEventListener("scroll", onScroll); }, []);

const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

// ---------- mark seen when visible ---------- useEffect(() => { const onVisibility = async () => { if (document.visibilityState !== "visible") return; const lastIncoming = [...messages] .slice() .reverse() .find((m) => m.senderId !== myUid); if (lastIncoming && lastIncoming.status !== "seen") { try { await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" }); } catch (e) {} } }; document.addEventListener("visibilitychange", onVisibility); onVisibility(); return () => document.removeEventListener("visibilitychange", onVisibility); }, [messages, chatId, myUid]);

// ---------- file select & preview ---------- const onFilesSelected = (e) => { const files = Array.from(e.target.files || []); if (!files.length) return; const newPreviews = files.map((f) => ({ url: f.type.startsWith("image/") || f.type.startsWith("video/") ? URL.createObjectURL(f) : null, type: detectFileType(f), name: f.name, file: f, })); setSelectedFiles((prev) => [...prev, ...files]); setPreviews((prev) => [...prev, ...newPreviews]); setSelectedPreviewIndex((prev) => (prev >= 0 ? prev : 0)); };

// ---------- send ---------- const sendTextMessage = async () => { const blockedBy = chatInfo?.blockedBy || []; if (blockedBy && blockedBy.includes(myUid)) { alert("You are blocked in this chat. You cannot send messages."); return; }

if (selectedFiles.length > 0) {
  const filesToSend = [...selectedFiles];
  setSelectedFiles([]);
  setPreviews([]);
  setSelectedPreviewIndex(0);
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
      setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));
      const url = await uploadToCloudinary(file, (pct) => setUploadingIds((prev) => ({ ...prev, [messageId]: pct })));
      await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
        mediaUrl: url,
        status: "sent",
        sentAt: serverTimestamp(),
      });
      setTimeout(() => setUploadingIds((prev) => {
        const c = { ...prev };
        delete c[messageId];
        return c;
      }), 200);
    } catch (err) {
      console.error("upload error:", err);
    }
  }
  return;
}

if (text.trim()) {
  try {
    const payload = {
      senderId: myUid,
      text: text.trim(),
      mediaUrl: "",
      mediaType: null,
      createdAt: serverTimestamp(),
      status: "sent",
      reactions: {},
    };
    if (replyTo) {
      payload.replyTo = { id: replyTo.id, text: replyTo.text || replyTo.mediaType || "media", senderId: replyTo.senderId };
      setReplyTo(null);
    }
    await addDoc(collection(db, "chats", chatId, "messages"), payload);
    setText("");
    setTimeout(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
  } catch (e) {
    console.error(e);
    alert("Failed to send");
  }
}

};

// ---------- recording ---------- useEffect(() => { setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)); }, []);

const startRecording = async () => { if (!recorderAvailable) return alert("Recording not supported in this browser"); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mr = new MediaRecorder(stream); recorderChunksRef.current = []; mr.ondataavailable = (ev) => { if (ev.data.size) recorderChunksRef.current.push(ev.data); }; mr.onstop = async () => { const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" }); const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: "audio", createdAt: serverTimestamp(), status: "uploading", reactions: {}, }; try { const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder); const messageId = mRef.id; setUploadingIds((prev) => ({ ...prev, [messageId]: 0 })); const url = await uploadToCloudinary(blob, (pct) => setUploadingIds((prev) => ({ ...prev, [messageId]: pct }))); await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() }); setTimeout(() => setUploadingIds((prev) => { const c = { ...prev }; delete c[messageId]; return c; }), 200); } catch (err) { console.error("voice upload failed", err); } }; mr.start(); recorderRef.current = mr; setRecording(true); } catch (err) { console.error(err); alert("Could not start recording"); } }; const stopRecording = () => { try { recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach((t) => t.stop()); } catch (e) {} setRecording(false); };

const holdStart = (e) => { e.preventDefault(); longPressTimer.current = setTimeout(() => { // long press => open reactions only // note: we expect the element to have dataset-id with message id in the DOM triggers const id = e.currentTarget?.dataset?.id; if (id) setReactionFor(id); }, 350); }; const holdEnd = (e) => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); };

// ---------- message actions ---------- const applyReaction = async (messageId, emoji) => { try { const mRef = doc(db, "chats", chatId, "messages", messageId); const snap = await getDoc(mRef); if (!snap.exists()) return; const data = snap.data(); const existing = data.reactions?.[myUid]; if (existing === emoji) await updateDoc(mRef, { [reactions.${myUid}]: null }); else await updateDoc(mRef, { [reactions.${myUid}]: emoji }); setReactionFor(null); } catch (e) { console.error(e); } };

const copyMessageText = async (m) => { try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); setMenuOpenFor(null); } catch (e) { alert("Copy failed"); } };

const editMessage = async (m) => { if (m.senderId !== myUid) return alert("You can only edit your messages."); const newText = window.prompt("Edit message", m.text || ""); if (newText == null) return; await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true }); setMenuOpenFor(null); };

const deleteMessageForEveryone = async (id) => { if (!confirm("Delete for everyone?")) return; await deleteDoc(doc(db, "chats", chatId, "messages", id)); setMenuOpenFor(null); }; const deleteMessageForMe = async (id) => { await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) }); setMenuOpenFor(null); };

const forwardMessage = (m) => navigate(/forward/${m.id}, { state: { message: m } }); const pinMessage = async (m) => { await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || m.mediaType || "" }); setMenuOpenFor(null); alert("Pinned to top"); }; const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };

// long-press touch handlers for swiping to reply (keeps existing behaviour but limited) const handleMsgTouchStart = (m, e) => { // keep swipe start for reply gesture swipeStartX.current = null; longPressTimer.current = setTimeout(() => setReactionFor(m.id), 500); }; const handleMsgTouchMove = (ev) => { if (!swipeStartX.current && ev.touches && ev.touches[0]) swipeStartX.current = ev.touches[0].clientX; }; const handleMsgTouchEnd = (m, ev) => { clearTimeout(longPressTimer.current); if (!swipeStartX.current) return; const changed = ev.changedTouches ? ev.changedTouches[0].clientX : null; if (changed == null) return; const dx = swipeStartX.current - changed; if (dx > 72) replyToMessage(m); // smaller threshold and concise swipeStartX.current = null; };

// ---------- header actions ---------- const clearChat = async () => { if (!confirm("Clear chat? This will attempt to delete messages.")) return; try { const msgsRef = collection(db, "chats", chatId, "messages"); const snap = await getDocs(query(msgsRef, orderBy("createdAt", "asc"))); const docs = snap.docs; for (const d of docs) { try { await deleteDoc(d.ref); } catch (e) {} } setHeaderMenuOpen(false); alert("Chat cleared."); } catch (e) { console.error(e); alert("Failed to clear chat"); } };

const toggleBlock = async () => { try { const chatRef = doc(db, "chats", chatId); const snap = await getDoc(chatRef); if (!snap.exists()) return; const data = snap.data(); const blockedBy = data.blockedBy || []; if (blockedBy.includes(myUid)) await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) }); else await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) }); setHeaderMenuOpen(false); } catch (e) { console.error(e); alert("Block toggle failed"); } };

// ---------- render helpers ---------- const renderStatusTick = (m) => { if (m.senderId !== myUid) return null; if (m.status === "uploading") return "⌛"; if (m.status === "sent") return "✔"; if (m.status === "delivered") return "✔✔"; if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>; return null; };

// compact audio player component (inline) const AudioPlayer = ({ m }) => { const audioRef = useRef(null); const [playing, setPlaying] = useState(false); const [progress, setProgress] = useState(0);

useEffect(() => {
  const a = audioRef.current;
  if (!a) return;
  const onTime = () => setProgress((a.currentTime / (a.duration || 1)) * 100);
  const onEnd = () => setPlaying(false);
  a.addEventListener("timeupdate", onTime);
  a.addEventListener("ended", onEnd);
  return () => {
    a.removeEventListener("timeupdate", onTime);
    a.removeEventListener("ended", onEnd);
  };
}, []);

const toggle = () => {
  const a = audioRef.current;
  if (!a) return;
  if (playing) { a.pause(); setPlaying(false); }
  else { a.play(); setPlaying(true); }
};

return (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width:36, height:36, borderRadius:18, objectFit:"cover" }} />
    <div style={{ display:"flex", flexDirection:"column", minWidth:120 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button onClick={toggle} style={{ border:"none", background:"transparent", cursor:"pointer", fontSize:16 }}>{playing ? "⏸" : "▶"}</button>
        <div style={{ fontSize:13, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{m.fileName || "Voice message"}</div>
      </div>
      <div style={{ height:6, background:"rgba(0,0,0,0.08)", borderRadius:6, marginTop:6 }}>
        <div style={{ width:`${progress}%`, height:6, borderRadius:6, background: "#34B7F1" }} />
      </div>
    </div>
    <audio ref={audioRef} src={m.mediaUrl} preload="metadata" />
  </div>
);

};

const renderMessageContent = (m) => { if (m.mediaUrl) { switch (m.mediaType) { case "image": return <img src={m.mediaUrl} alt={m.fileName || "image"} style={{ maxWidth: 360, borderRadius: 12 }} />; case "video": return <video controls src={m.mediaUrl} style={{ maxWidth: 360, borderRadius: 12 }} />; case "audio": return <AudioPlayer m={m} />; case "pdf": case "file": return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>; default: return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open media</a>; } } return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>; };

// ---------- grouped messages ---------- const groupedMessages = (() => { const out = []; let lastDay = null; messages.forEach((m) => { const label = dayLabel(m.createdAt || new Date()); if (label !== lastDay) { out.push({ type: "day", label, id: day-${label}-${Math.random().toString(36).slice(2,6)} }); lastDay = label; } out.push(m); }); return out; })();

// header menu actions list (first 6 shown) const headerActions = [ { id: 'view-profile', label: 'View Profile', action: () => navigate(/profile/${friendInfo?.id}) }, { id: 'mute', label: 'Mute Notifications', action: () => alert('Muted (placeholder)') }, { id: 'block', label: (chatInfo?.blockedBy || []).includes(myUid) ? 'Unblock' : 'Block User', action: toggleBlock }, { id: 'clear', label: 'Clear Chat', action: clearChat }, { id: 'archive', label: 'Archive Chat', action: () => alert('Archived (placeholder)') }, { id: 'pin', label: 'Pin Chat', action: () => alert('Pinned chat (placeholder)') }, ]; const headerActionsMore = [ { id: 'search', label: 'Search', action: () => alert('Open search (placeholder)') }, { id: 'wallpaper', label: 'Wallpaper/Theme', action: () => alert('Open wallpaper chooser (placeholder)') }, { id: 'report', label: 'Report', action: () => { if (confirm('Do you want to report this user?')) alert('Reported'); } }, ];

return ( <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? url(${wallpaper}) center/cover no-repeat : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}> {/* Header */} <header style={{ position: "sticky", top:0, zIndex:90, display:"flex", alignItems:"center", gap:12, padding:12, background: "#1877F2", color: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}> <button onClick={() => navigate("/chat")} style={{ fontSize:20, background:'transparent', border:'none', color:'#fff', cursor:'pointer' }}>←</button>

<div style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => friendInfo && navigate(`/profile/${friendInfo.id}`)}>
      <img src={friendInfo?.photoURL || chatInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover" }} />
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:16 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</div>
        <div style={{ fontSize:12, opacity:0.95 }}>
          {friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? (() => {
            const ls = friendInfo.lastSeen;
            const d = ls?.toDate ? ls.toDate() : new Date(ls);
            const now = new Date();
            const yesterday = new Date(); yesterday.setDate(now.getDate()-1);
            if (d.toDateString() === now.toDateString()) return `Today ${d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`;
            if (d.toDateString() === yesterday.toDateString()) return `Yesterday`;
            return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() });
          })() : "Offline")}
        </div>
      </div>
    </div>

    {/* inline call buttons */}
    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
      <button title="Voice call" onClick={() => friendInfo && navigate(`/voicecall/${friendInfo.id}`)} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:18 }}>📞</button>
      <button title="Video call" onClick={() => friendInfo && navigate(`/videocall/${friendInfo.id}`)} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:18 }}>🎥</button>

      {/* header menu */}
      <div ref={headerMenuRef} style={{ position:'relative' }}>
        <button onClick={() => setHeaderMenuOpen((s) => !s)} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:20 }}>⋮</button>
        {headerMenuOpen && (
          <div style={{ position:'absolute', right:0, top:36, background:isDark ? '#111' : '#fff', color:isDark ? '#fff' : '#000', padding:8, borderRadius:10, boxShadow:'0 8px 30px rgba(0,0,0,0.12)', minWidth:220 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {headerActions.map((a, i) => (
                <button key={a.id} onClick={() => { a.action(); setHeaderMenuOpen(false); }} style={menuBtnStyle}>{a.label}</button>
              ))}

              {!headerMenuExpanded && headerActionsMore.length > 0 && (
                <button onClick={() => setHeaderMenuExpanded(true)} style={{ ...menuBtnStyle, fontWeight:700 }}>More…</button>
              )}

              {headerMenuExpanded && headerActionsMore.map((a) => (
                <button key={a.id} onClick={() => { a.action(); setHeaderMenuOpen(false); setHeaderMenuExpanded(false); }} style={menuBtnStyle}>{a.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </header>

  {/* Messages area */}
  <main ref={messagesRefEl} style={{ flex:1, overflowY:'auto', padding:12 }}>
    {loadingMsgs && <div style={{ textAlign:'center', color:'#888', marginTop:12 }}>Loading messages…</div>}

    {groupedMessages.map((item) => {
      if (item.type === 'day') return <div key={item.id} style={{ textAlign:'center', margin:'14px 0', color:'#8a8a8a', fontSize:12 }}>{item.label}</div>;
      const m = item;
      const mine = m.senderId === myUid;
      return (
        <div key={m.id} id={`msg-${m.id}`} data-id={m.id}
          onTouchStart={(e) => handleMsgTouchStart(m, e)}
          onTouchMove={handleMsgTouchMove}
          onTouchEnd={(e) => handleMsgTouchEnd(m, e)}
          onMouseDown={(e) => { if (e.button === 2) setMenuOpenFor(m.id); }}
          style={{ display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom:12, position:'relative' }}>

          <div style={{ background: mine ? (isDark ? '#0b84ff' : '#007bff') : (isDark ? '#1b1b1b' : '#fff'), color: mine ? '#fff' : (isDark ? '#fff' : '#000'), padding:12, borderRadius:14, maxWidth:'78%', position:'relative', wordBreak:'break-word' }}>

            {m.replyTo && (
              <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background:isDark ? '#0f0f0f' : '#f3f3f3', color:isDark ? '#ddd' : '#333', fontSize:12 }}>
                <div style={{ fontWeight:700, marginBottom:4 }}>{m.replyTo.senderId === myUid ? 'You' : 'Them'}</div>
                <div style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.replyTo.text}</div>
              </div>
            )}

            <div onClick={() => { setMenuOpenFor(null); setReactionFor(null); }}>{renderMessageContent(m)}</div>
            {m.edited && <div style={{ fontSize:11, opacity:0.9 }}> · edited</div>}

            {m.reactions && Object.keys(m.reactions).length > 0 && (
              <div style={{ position:'absolute', bottom:-14, right:6, background:isDark ? '#111' : '#fff', padding:'4px 8px', borderRadius:12, fontSize:12, boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
                {Object.values(m.reactions).slice(0,4).join(' ')}
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, fontSize:11, opacity:0.9 }}>
              <div style={{ marginLeft:'auto' }}>{fmtTime(m.createdAt)} {renderStatusTick(m)}</div>
            </div>

            {m.status === 'uploading' && uploadingIds[m.id] !== undefined && (
              <div style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)' }}>
                <div style={{ width:36, height:36, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', background:'#eee', color:'#333', fontSize:12 }}>{uploadingIds[m.id]}%</div>
              </div>
            )}

            {m.status === 'failed' && <div style={{ marginTop:8 }}><button onClick={() => alert('Please re-select file to retry')} style={{ padding:'6px 8px', borderRadius:8, background:'#ffcc00', border:'none' }}>Retry</button></div>}
          </div>

          {/* action buttons */}
          <div style={{ marginLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
            <button title="React" onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border:'none', background:'transparent', cursor:'pointer' }}>💬</button>
            <button title="More" onClick={() => setMenuOpenFor(m.id)} style={{ border:'none', background:'transparent', cursor:'pointer' }}>⋯</button>
          </div>

          {/* inline menu (opens on right-click or More) */}
          {menuOpenFor === m.id && (
            <div style={{ position:'absolute', transform:'translate(-50px, -100%)', zIndex:999, right: (m.senderId === myUid) ? 20 : 'auto', left: (m.senderId === myUid) ? 'auto' : 80 }}>
              <div style={{ background:isDark ? '#111' : '#fff', padding:8, borderRadius:10, boxShadow:'0 8px 30px rgba(0,0,0,0.14)' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button>
                  <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button>
                  {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>}
                  <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button>
                  <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button>
                  <button onClick={() => { if (confirm('Delete for everyone?')) deleteMessageForEveryone(m.id); else deleteMessageForMe(m.id); }} style={menuBtnStyle}>Delete</button>
                  <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button>
                </div>
              </div>
            </div>
          )}

          {/* reaction picker (appears on long-press or React) */}
          {reactionFor === m.id && (
            <div style={{ position:'absolute', top:'calc(100% - 12px)', transform:'translateY(6px)', zIndex:998 }}>
              <div style={{ display:'flex', gap:8, padding:8, borderRadius:20, background:isDark ? '#111' : '#fff', boxShadow:'0 6px 18px rgba(0,0,0,0.08)', alignItems:'center' }}>
                {INLINE_REACTIONS.map((r) => <button key={r} onClick={() => applyReaction(m.id, r)} style={{ fontSize:18, width:36, height:36, borderRadius:10, border:'none', background:'transparent', cursor:'pointer' }}>{r}</button>)}
                <button onClick={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }} style={{ border:'none', background:'transparent', cursor:'pointer' }}>＋</button>
              </div>
            </div>
          )}
        </div>
      );
    })}

    <div ref={endRef} />
  </main>

  {/* scroll to latest arrow */}
  {!isAtBottom && (
    <button onClick={scrollToBottom} style={{ position:'fixed', left:'50%', transform:'translateX(-50%)', bottom:120, zIndex:80, background:'#007bff', color:'#fff', border:'none', borderRadius:22, width:48, height:48, fontSize:22 }}>↓</button>
  )}

  {/* pinned reply preview */}
  {replyTo && (
    <div style={{ position:'sticky', bottom:84, left:12, right:12, display:'flex', justifyContent:'space-between', background:isDark ? '#101010' : '#fff', padding:8, borderRadius:8, boxShadow:'0 6px 18px rgba(0,0,0,0.08)', zIndex:90 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ width:4, height:40, background:'#34B7F1', borderRadius:4 }} />
        <div style={{ maxWidth:'85%' }}>
          <div style={{ fontSize:12, color:'#888' }}>{replyTo.senderId === myUid ? 'You' : 'Them'}</div>
          <div style={{ fontSize:14, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{replyTo.text || (replyTo.mediaType || 'media')}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => { const id = replyTo.id; const el = document.getElementById(`msg-${id}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } setReplyTo(null); }} style={{ border:'none', background:'transparent', cursor:'pointer' }}>Go</button>
        <button onClick={() => setReplyTo(null)} style={{ border:'none', background:'transparent', cursor:'pointer' }}>✕</button>
      </div>
    </div>
  )}

  {/* previews strip */}
  {previews.length > 0 && (
    <div style={{ display:'flex', gap:8, padding:8, overflowX:'auto', alignItems:'center', borderTop:'1px solid rgba(0,0,0,0.06)', background:isDark ? '#0b0b0b' : '#fff' }}>
      {previews.map((p, idx) => (
        <div key={idx} style={{ position:'relative', cursor:'pointer', border: idx === selectedPreviewIndex ? `2px solid #34B7F1` : 'none', borderRadius:8 }}>
          {p.url ? (p.type === 'image' ? <img onClick={() => setSelectedPreviewIndex(idx)} src={p.url} alt={p.name} style={{ width:80, height:80, objectFit:'cover', borderRadius:8 }} /> : p.type === 'video' ? <video onClick={() => setSelectedPreviewIndex(idx)} src={p.url} style={{ width:110, height:80, objectFit:'cover', borderRadius:8 }} /> : <div style={{ width:80, height:80, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, background:'#eee', padding:6 }}>{p.name}</div>) : (<div style={{ width:80, height:80, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, background:'#eee' }}>{p.name}</div>)}
          <button onClick={() => { setSelectedFiles((sf) => sf.filter((_,i) => i !== idx)); setPreviews((ps) => { const copy = ps.filter((_,i) => i !== idx); setSelectedPreviewIndex((prev) => Math.max(0, Math.min(prev, copy.length - 1))); return copy; }); }} style={{ position:'absolute', top:-6, right:-6, background:'#ff4d4f', border:'none', borderRadius:'50%', width:22, height:22, color:'#fff', cursor:'pointer' }}>×</button>
        </div>
      ))}

      <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
        <button onClick={sendTextMessage} style={{ padding:'8px 12px', borderRadius:8, background:'#34B7F1', color:'#fff', border:'none', cursor:'pointer' }}>➤</button>
        <button onClick={() => { setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0); }} style={{ padding:'8px 12px', borderRadius:8, background:'#ddd', border:'none', cursor:'pointer' }}>×</button>
      </div>
    </div>
  )}

  {/* input area */}
  <div style={{ position:'sticky', bottom:0, background:isDark ? '#0b0b0b' : '#fff', padding:10, borderTop:'1px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:8, zIndex:90 }}>
    <label style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
      📎
      <input type='file' multiple style={{ display:'none' }} onChange={onFilesSelected} />
    </label>

    {previews.length > 0 && previews[selectedPreviewIndex] && (
      <div style={{ width:80, height:80, borderRadius:8, overflow:'hidden' }}>
        {previews[selectedPreviewIndex].url ? (previews[selectedPreviewIndex].type === 'image' ? <img src={previews[selectedPreviewIndex].url} alt='' style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <video src={previews[selectedPreviewIndex].url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />) : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#eee' }}>{previews[selectedPreviewIndex].name}</div>}
      </div>
    )}

    <div style={{ flex:1 }}>
      <input type='text' value={text} onChange={(e) => setText(e.target.value)} placeholder='Type a message...' onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); } }} style={{ width:'100%', padding:'10px 12px', borderRadius:20, border:'1px solid rgba(0,0,0,0.06)', background:isDark ? '#111' : '#f5f5f5', color:isDark ? '#fff' : '#000' }} />
    </div>

    <div>
      <button
        onMouseDown={(e) => { if (!text.trim() && previews.length === 0) holdStart(e); }}
        onMouseUp={(e) => { if (!text.trim() && previews.length === 0) holdEnd(e); else if (text.trim() || previews.length > 0) sendTextMessage(); }}
        onTouchStart={(e) => { if (!text.trim() && previews.length === 0) holdStart(e); }}
        onTouchEnd={(e) => { if (!text.trim() && previews.length === 0) holdEnd(e); else if (text.trim() || previews.length > 0) sendTextMessage(); }}
        onClick={(e) => { if (text.trim() || previews.length > 0) sendTextMessage(); }}
        style={{ padding:10, borderRadius:12, background:'#34B7F1', color:'#fff', border:'none', cursor:'pointer' }}
        title={(!text.trim() && previews.length === 0) ? (recording ? 'Recording... release to send' : 'Hold to record, click to start') : 'Send'}
      >
        {(!text.trim() && previews.length === 0) ? (recording ? '● Recording' : '🎤') : '➤'}
      </button>
    </div>
  </div>

  {/* emoji picker modal */}
  {showEmojiPicker && (
    <div style={{ position:'fixed', left:0, right:0, top:0, bottom:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'flex-end', zIndex:999 }} onClick={() => setShowEmojiPicker(false)}>
      <div style={{ width:'100%', maxHeight:'45vh', background:isDark ? '#0b0b0b' : '#fff', borderTopLeftRadius:14, borderTopRightRadius:14, padding:12, overflowY:'auto' }} onClick={(e)=>e.stopPropagation()}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:8 }}>
          {EXTENDED_EMOJIS.map((e) => <button key={e} onClick={() => { applyReaction(emojiPickerFor, e); setShowEmojiPicker(false); }} style={{ padding:10, fontSize:20, border:'none', background:'transparent' }}>{e}</button>)}
        </div>
        <div style={{ textAlign:'right', marginTop:8 }}><button onClick={() => setShowEmojiPicker(false)} style={{ padding:'8px 10px', borderRadius:8, border:'none', background:'#ddd' }}>Close</button></div>
      </div>
    </div>
  )}
</div>

); }

const menuBtnStyle = { padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", };
