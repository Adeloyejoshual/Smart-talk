import React, { useEffect, useState, useRef, useContext, useCallback } from "react"; import { useParams, useNavigate } from "react-router-dom"; import { doc, getDoc, collection, addDoc, query, orderBy, limit as fsLimit, onSnapshot, serverTimestamp, updateDoc, arrayUnion, arrayRemove, getDocs, writeBatch, deleteDoc, } from "firebase/firestore"; import { ref as storageRef, uploadBytesResumable, getDownloadURL, } from "firebase/storage"; import { auth, db, storage } from "../firebaseConfig"; import { ThemeContext } from "../context/ThemeContext";

/**

ChatConversationPage.jsx (Tailwind + React)

Notes / features in this file:

Live messages from Firestore (paginated)


Upload flow: create placeholder message -> upload to Firebase Storage -> update message doc with fileURL & status


Local previews for selected files (images show thumbnails)


Local upload placeholders shown until upload completes


Receiver-side background download stream with progress (stores blob URL in memory)


Last seen / Online / Typing indicator (reads users/{id}.isOnline and lastSeen)


Reactions, reply-to, delete, clear chat


Replace styling or small helper utilities to match your project as needed. */


const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅"];

const fmtTime = (ts) => { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }; const dayLabel = (ts) => { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); const now = new Date(); const yesterday = new Date(); yesterday.setDate(now.getDate() - 1); if (d.toDateString() === now.toDateString()) return "Today"; if (d.toDateString() === yesterday.toDateString()) return "Yesterday"; return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

export default function ChatConversationPage() { const { chatId } = useParams(); const navigate = useNavigate(); const { theme, wallpaper } = useContext(ThemeContext); const isDark = theme === "dark";

const [chatInfo, setChatInfo] = useState(null); const [friendInfo, setFriendInfo] = useState(null);

const [messages, setMessages] = useState([]); const [limitCount] = useState(50);

// UI states const [selectedFiles, setSelectedFiles] = useState([]); const [previews, setPreviews] = useState([]); const [localUploads, setLocalUploads] = useState([]); // {id, fileName, progress, type, previewUrl} const [downloadMap, setDownloadMap] = useState({}); // { msgId: { status, progress, blobUrl }} const [text, setText] = useState(""); const [showAttach, setShowAttach] = useState(false); const [menuOpen, setMenuOpen] = useState(false); const [replyTo, setReplyTo] = useState(null); const [blocked, setBlocked] = useState(false); const [friendTyping, setFriendTyping] = useState(false); const [reportOpen, setReportOpen] = useState(false); const [reportText, setReportText] = useState(""); const [selectedMessageId, setSelectedMessageId] = useState(null);

const messagesRef = useRef(null); const endRef = useRef(null); const myUid = auth.currentUser?.uid; const [isAtBottom, setIsAtBottom] = useState(true);

// cleanup object URLs on unmount useEffect(() => { return () => { previews.forEach(p => p && URL.revokeObjectURL(p)); localUploads.forEach(u => u.previewUrl && URL.revokeObjectURL(u.previewUrl)); Object.values(downloadMap).forEach(d => d.blobUrl && URL.revokeObjectURL(d.blobUrl)); }; // eslint-disable-next-line react-hooks/exhaustive-deps }, []);

// --- load chat & friend live --- useEffect(() => { if (!chatId) return; const chatRef = doc(db, "chats", chatId); let unsubFriend = null; let unsubChat = null;

(async () => {
  const snap = await getDoc(chatRef);
  if (!snap.exists()) { alert("Chat not found"); navigate("/chat"); return; }
  const data = snap.data();
  setChatInfo({ id: snap.id, ...data });
  setBlocked(Boolean(data?.blockedBy?.includes(myUid)));

  const friendId = data.participants?.find(p => p !== myUid);
  if (friendId) {
    const friendRef = doc(db, "users", friendId);
    unsubFriend = onSnapshot(friendRef, fsnap => {
      if (fsnap.exists()) {
        const d = { id: fsnap.id, ...fsnap.data() };
        setFriendInfo(d);
        setFriendTyping(Boolean(d?.typing?.[chatId]));
      }
    });
  }

  unsubChat = onSnapshot(chatRef, cSnap => {
    if (cSnap.exists()) {
      setChatInfo(prev => ({ ...(prev || {}), ...cSnap.data() }));
      setBlocked(Boolean(cSnap.data()?.blockedBy?.includes(myUid)));
    }
  });
})();

return () => { unsubFriend && unsubFriend(); unsubChat && unsubChat(); };

}, [chatId, myUid, navigate]);

// --- messages realtime --- useEffect(() => { if (!chatId) return; const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), fsLimit(limitCount)); const unsub = onSnapshot(q, snap => { const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse(); setMessages(docs);

// mark delivered
  docs.forEach(m => {
    if (m.sender !== myUid && m.status === "sent") {
      const mRef = doc(db, "chats", chatId, "messages", m.id);
      updateDoc(mRef, { status: "delivered" }).catch(()=>{});
    }
  });

  // queue downloads
  docs.forEach(m => {
    if ((m.type === "image" || m.type === "file" || m.type === "audio" || m.type === "video") && m.fileURL) {
      setDownloadMap(prev => {
        if (prev[m.id] && (prev[m.id].status === "done" || prev[m.id].status === "downloading")) return prev;
        return { ...prev, [m.id]: { status: "queued", progress: 0, blobUrl: null } };
      });
    }
  });

  // auto-scroll the first time
  setTimeout(()=> { endRef.current?.scrollIntoView({ behavior: "auto" }); setIsAtBottom(true); }, 50);
});

return () => unsub();

}, [chatId, limitCount, myUid]);

// --- start downloads when queued --- useEffect(() => { Object.entries(downloadMap).forEach(([msgId, info]) => { if (info.status === "queued") { setDownloadMap(prev => ({ ...prev, [msgId]: { ...prev[msgId], status: "downloading", progress: 0 } })); startDownloadForMessage(msgId).catch(err => { console.error("download start error", err); setDownloadMap(prev => ({ ...prev, [msgId]: { ...prev[msgId], status: "failed" } })); }); } }); // eslint-disable-next-line react-hooks/exhaustive-deps }, [downloadMap]);

// --- scroll handler --- useEffect(() => { const el = messagesRef.current; if (!el) return; const onScroll = () => { const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60; setIsAtBottom(atBottom); if (!atBottom) setSelectedMessageId(null); }; el.addEventListener("scroll", onScroll); return () => el.removeEventListener("scroll", onScroll); }, []);

const scrollToBottom = (smooth = true) => endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });

// --- pick files & previews --- const onFilesSelected = (e) => { const files = Array.from(e.target.files || []); if (!files.length) return; const newPreviews = files.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null); setSelectedFiles(prev => [...prev, ...files]); setPreviews(prev => [...prev, ...newPreviews]); };

// --- send queued files --- const sendQueuedFiles = async () => { if (!selectedFiles.length) return; const filesToSend = [...selectedFiles]; setSelectedFiles([]); setPreviews([]);

for (const file of filesToSend) {
  try {
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
    const placeholder = {
      sender: myUid,
      text: "",
      fileURL: null,
      fileName: file.name,
      type: kind,
      createdAt: serverTimestamp(),
      status: "uploading",
    };
    const docRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);

    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setLocalUploads(prev => [...prev, { id: docRef.id, fileName: file.name, progress: 0, type: kind, previewUrl }]);

    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    task.on("state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setLocalUploads(prev => prev.map(l => l.id === docRef.id ? { ...l, progress: pct } : l));
      },
      (err) => {
        console.error("upload error", err);
        updateDoc(docRef, { status: "failed" }).catch(()=>{});
        setLocalUploads(prev => prev.map(l => l.id === docRef.id ? { ...l, status: "failed" } : l));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(docRef, { fileURL: url, status: "sent", sentAt: serverTimestamp() }).catch(()=>{});
        setLocalUploads(prev => prev.filter(l => l.id !== docRef.id));
        setTimeout(()=> scrollToBottom(true), 120);
      }
    );
  } catch (err) {
    console.error("send queued file failed", err);
  }
}

};

// --- receiver download stream --- const startDownloadForMessage = async (messageId) => { try { const mRef = doc(db, "chats", chatId, "messages", messageId); const mSnap = await getDoc(mRef); if (!mSnap.exists()) { setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "failed" } })); return; } const m = { id: mSnap.id, ...mSnap.data() }; if (!m.fileURL) { setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "done", progress: 100, blobUrl: null } })); return; }

const resp = await fetch(m.fileURL);
  if (!resp.ok) throw new Error("Download failed: " + resp.status);
  const contentLength = resp.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : null;
  const reader = resp.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) {
      const pct = Math.round((received / total) * 100);
      setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "downloading", progress: pct } }));
    } else {
      setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "downloading", progress: Math.min(99, (prev[messageId]?.progress || 0) + 5) } }));
    }
  }
  const blob = new Blob(chunks);
  const blobUrl = URL.createObjectURL(blob);
  setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "done", progress: 100, blobUrl } }));
} catch (err) {
  console.error("download failed", err);
  setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "failed", progress: 0 } }));
  setTimeout(() => setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "queued" } })), 10000);
}

};

// --- display url helper --- const getDisplayUrlForMessage = (m) => { const d = downloadMap[m.id]; if (d && d.blobUrl) return d.blobUrl; if (m.fileURL) return m.fileURL; const local = localUploads.find(l => l.id === m.id); if (local && local.previewUrl) return local.previewUrl; return null; };

// --- send text --- const handleSendText = async () => { if (!text.trim()) return; if (blocked) { alert("You blocked this user — unblock to send."); return; } const payload = { sender: myUid, text: text.trim(), fileURL: null, fileName: null, type: "text", createdAt: serverTimestamp(), status: "sent", }; if (replyTo) { payload.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0, 120) || (replyTo.fileName || "media"), sender: replyTo.sender }; setReplyTo(null); } setText(""); try { await addDoc(collection(db, "chats", chatId, "messages"), payload); setTimeout(() => scrollToBottom(true), 150); } catch (err) { console.error("send text failed", err); alert("Failed to send message"); } };

// --- block/unblock, report, delete, clear chat, reactions --- const toggleBlock = async () => { if (!chatInfo) return; const chatRef = doc(db, "chats", chatId); try { if (blocked) { await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) }); setBlocked(false); } else { await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) }); setBlocked(true); } setMenuOpen(false); } catch (err) { console.error(err); alert("Failed to update block status"); } }; const submitReport = async () => { if (!reportText.trim()) { alert("Please write report details."); return; } try { await addDoc(collection(db, "reports"), { reporterId: myUid, reportedId: friendInfo?.id || null, chatId, reason: reportText.trim(), createdAt: serverTimestamp() }); setReportText(""); setReportOpen(false); setMenuOpen(false); alert("Report submitted. Thank you."); } catch (err) { console.error(err); alert("Failed to submit report"); } }; const deleteMessage = async (messageId) => { if (!window.confirm("Delete message?")) return; try { await deleteDoc(doc(db, "chats", chatId, "messages", messageId)); setSelectedMessageId(null); } catch (err) { console.error(err); alert("Failed to delete message"); } }; const clearChat = async () => { if (!window.confirm("Clear all messages in this chat? This will delete messages permanently.")) return; try { const msgsRef = collection(db, "chats", chatId, "messages"); const snapshot = await getDocs(msgsRef); const docs = snapshot.docs; const batchSize = 400; for (let i=0;i<docs.length;i+=batchSize){ const batch = writeBatch(db); docs.slice(i,i+batchSize).forEach(d=>batch.delete(d.ref)); await batch.commit(); } alert("Chat cleared."); setMenuOpen(false);} catch(err){console.error(err); alert("Failed to clear chat");} }; const applyReaction = async (messageId, emoji) => { try { const mRef = doc(db, "chats", chatId, "messages", messageId); await updateDoc(mRef, { [reactions.${myUid}]: emoji }); setSelectedMessageId(null);} catch(err){console.error(err);} };

// --- message bubble component --- const MessageBubble = ({ m }) => { const mine = m.sender === myUid; const replySnippet = m.replyTo ? (m.replyTo.text || (m.replyTo.fileName || "media")) : null; const displayUrl = getDisplayUrlForMessage(m); const downloadInfo = downloadMap[m.id];

return (
  <div className={`flex ${mine ? "justify-end" : "justify-start"} mb-3 px-1`}>
    <div className={`rounded-xl p-3 max-w-[78%] break-words relative ${mine ? (isDark ? "bg-sky-600 text-white" : "bg-sky-500 text-white") : (isDark ? "bg-[#222] text-gray-200" : "bg-white text-black")} shadow-sm`}>

      {replySnippet && (
        <div className={`mb-2 p-2 rounded-md ${isDark ? "bg-[#111] text-gray-300" : "bg-gray-100 text-gray-700"} text-sm`}>
          <span className="block truncate" style={{ maxWidth: 220 }}>{replySnippet}</span>
        </div>
      )}

      {m.type === "text" && <div>{m.text}</div>}

      {m.type === "image" && (
        <div className="relative">
          <img src={displayUrl || m.fileURL || ""} alt={m.fileName || "image"} className={`w-56 h-auto rounded-md ${((downloadInfo && downloadInfo.status === "downloading") || m.status === "uploading") ? "filter blur-sm" : ""}`} />
        </div>
      )}

      {(m.type === "file" || m.type === "audio" || m.type === "video") && (
        <div className="flex items-center gap-3 p-2 rounded-md bg-white text-sm">
          <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">📎</div>
          <div className="max-w-[180px]">
            <div className="font-semibold truncate">{m.fileName || "file"}</div>
            <div className="text-xs text-gray-500">{m.type}</div>
            {m.fileURL && <a href={displayUrl || m.fileURL} target="_blank" rel="noopener noreferrer" className="block mt-2 text-sm underline">Open</a>}
          </div>
        </div>
      )}

      {/* progress / status */}
      <div className="text-xs text-right mt-2 opacity-90">
        <span>{fmtTime(m.createdAt)}</span>
        {mine && <span className="ml-2">{m.status === "uploading" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}</span>}
      </div>

      {/* reactions */}
      {m.reactions && Object.keys(m.reactions).length > 0 && (
        <div className="absolute -bottom-4 right-2 bg-white rounded-full px-2 py-0.5 text-xs shadow-sm">{Object.values(m.reactions).slice(0,3).join(' ')}</div>
      )}

    </div>
  </div>
);

};

// --- grouped messages by day --- const merged = [...messages]; const grouped = []; let lastDay = null; merged.forEach(m => { const label = dayLabel(m.createdAt || new Date()); if (label !== lastDay) { grouped.push({ type: "day", label, id: day-${label}-${Math.random().toString(36).slice(2,6)} }); lastDay = label; } grouped.push(m); });

// --- simple spinner --- const Spinner = ({ percent = 0 }) => ( <div className="w-10 h-10 flex items-center justify-center relative"> <svg viewBox="0 0 36 36" className="w-9 h-9"> <path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#eee" strokeWidth="2" /> <path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#34B7F1" strokeWidth="2" strokeDasharray={${percent},100} strokeLinecap="round" /> </svg> <div className="absolute text-xs font-bold text-white">{Math.min(100, Math.round(percent))}%</div> </div> );

return ( <div className={min-h-screen flex flex-col ${isDark ? "bg-[#070707] text-white" : "bg-gray-100 text-black"}} style={{ backgroundImage: wallpaper ? url(${wallpaper}) : undefined }}>

{/* header */}
  <div className={`flex items-center p-3 border-b ${isDark ? "border-gray-800 bg-[#111]" : "border-gray-200 bg-white"} sticky top-0 z-30`}> 
    <button onClick={() => navigate('/chat')} className="mr-3 text-2xl">←</button>
    <img src={friendInfo?.photoURL || '/default-avatar.png'} alt="avatar" className="w-11 h-11 rounded-full object-cover mr-3 cursor-pointer" onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} />
    <div>
      <div className="font-semibold">{friendInfo?.displayName || chatInfo?.name || 'Friend'}</div>
      <div className="text-xs text-gray-400">{friendTyping ? 'typing...' : (friendInfo?.isOnline ? 'Online' : (friendInfo?.lastSeen ? (() => {
        const ls = friendInfo.lastSeen;
        if (!ls) return 'Offline';
        const ld = ls.toDate ? ls.toDate() : new Date(ls);
        const diffMin = Math.floor((Date.now() - ld.getTime())/60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffMin < 1440) return ld.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
        const yesterday = new Date(); yesterday.setDate(new Date().getDate()-1);
        if (ld.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return ld.toLocaleDateString(undefined, {month:'short', day:'numeric'});
      })() : 'Offline'))}</div>
    </div>

    <div className="ml-auto flex items-center gap-2">
      <button onClick={() => navigate(`/voice-call/${chatId}`)} className="text-xl">📞</button>
      <button onClick={() => navigate(`/video-call/${chatId}`)} className="text-xl">🎥</button>

      <div className="relative">
        <button onClick={() => setMenuOpen(s => !s)} className="text-xl">⋮</button>
        {menuOpen && (
          <div className={`absolute right-0 top-8 ${isDark ? 'bg-[#222] border border-gray-800' : 'bg-white border'} rounded-md shadow-lg w-56 p-1`}>
            <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} className="w-full text-left px-3 py-2">View Profile</button>
            <button onClick={() => { clearChat(); setMenuOpen(false); }} className="w-full text-left px-3 py-2">Clear Chat</button>
            <button onClick={toggleBlock} className="w-full text-left px-3 py-2">{blocked ? 'Unblock' : 'Block'}</button>
            <button onClick={() => { setReportOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2">Report</button>
          </div>
        )}
      </div>
    </div>
  </div>

  {/* messages */}
  <div ref={messagesRef} className="flex-1 overflow-y-auto p-3">
    {grouped.map(g => ( g.type === 'day' ? <div key={g.id} className="text-center my-3 text-sm text-gray-400">{g.label}</div> : <MessageBubble key={g.id} m={g} /> ))}

    {/* local uploads */}
    {localUploads.map(u => (
      <div key={u.id} className="flex justify-end mb-3">
        <div className="rounded-xl p-3 max-w-[78%] bg-sky-500 text-white relative">
          {u.type === 'image' ? <img src={u.previewUrl} alt={u.fileName} className="w-56 rounded-md blur-sm" /> : <div className="flex items-center gap-3"><div>📎</div><div>{u.fileName}</div></div>}
          <div className="text-xs mt-2 text-right">⌛ <span className="ml-2">{u.progress}%</span></div>
          <div className="absolute left-2 top-1/2 transform -translate-y-1/2"><Spinner percent={u.progress} /></div>
        </div>
      </div>
    ))}

    <div ref={endRef} />
  </div>

  {/* scroll to bottom */}
  <button onClick={() => scrollToBottom(true)} className={`fixed left-1/2 transform -translate-x-1/2 bottom-28 z-40 bg-sky-600 text-white rounded-full w-12 h-12 ${isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>↓</button>

  {/* previews */}
  {previews.length > 0 && (
    <div className="flex gap-3 p-2 overflow-x-auto border-t bg-white">
      {previews.map((p, i) => (
        <div key={i} className="relative">
          {p ? <img src={p} alt="preview" className="w-20 h-20 object-cover rounded-md" /> : <div className="w-20 h-20 rounded-md bg-gray-200 flex items-center justify-center">{selectedFiles[i]?.name}</div>}
          <button onClick={() => { setSelectedFiles(s => s.filter((_,idx)=>idx!==i)); setPreviews(s => s.filter((_,idx)=>idx!==i)); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6">✕</button>
        </div>
      ))}
      <div className="ml-auto flex gap-2">
        <button onClick={sendQueuedFiles} className="px-3 py-1 rounded bg-sky-500 text-white">Send</button>
        <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
      </div>
    </div>
  )}

  {/* composer */}
  <div className={`sticky bottom-0 p-3 border-t ${isDark ? 'bg-[#0b0b0b] border-gray-800' : 'bg-white border-gray-200'}`}>
    <div className="flex items-center gap-2">
      <div className="relative">
        <button onClick={() => setShowAttach(s => !s)} className="w-11 h-11 rounded-lg bg-gray-100">＋</button>
        {showAttach && (
          <div className={`absolute bottom-14 left-0 p-2 rounded-md ${isDark ? 'bg-[#222] border border-gray-800' : 'bg-white border'}`}> 
            <label className="block cursor-pointer px-2 py-1">📷<input type="file" accept="image/*" multiple onChange={(e)=>{onFilesSelected(e); setShowAttach(false);}} className="hidden" /></label>
            <label className="block cursor-pointer px-2 py-1">📁<input type="file" multiple onChange={(e)=>{onFilesSelected(e); setShowAttach(false);}} className="hidden" /></label>
            <label className="block cursor-pointer px-2 py-1">🎤<input type="file" accept="audio/*" multiple onChange={(e)=>{onFilesSelected(e); setShowAttach(false);}} className="hidden" /></label>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        {replyTo && (
          <div className={`p-2 rounded ${isDark ? 'bg-[#111]' : 'bg-gray-100'} mb-2`}> 
            <div className="text-xs text-gray-400">{replyTo.sender===myUid ? 'You' : ''}</div>
            <div className="truncate">{replyTo.text || replyTo.fileName || 'media'}</div>
            <button onClick={() => setReplyTo(null)} className="text-xs text-gray-500 mt-1">Cancel</button>
          </div>
        )}
        <input type="text" className={`w-full p-3 rounded-full border ${isDark ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-300'}`} placeholder={blocked ? 'You blocked this user — unblock to send' : 'Type a message...'} value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') handleSendText(); }} disabled={blocked} />
      </div>

      <button onClick={handleSendText} disabled={blocked || (!text.trim() && localUploads.length===0 && selectedFiles.length===0)} className="px-4 py-2 rounded-lg bg-sky-500 text-white">Send</button>
    </div>
  </div>

  {/* report modal */}
  {reportOpen && (
    <div className="fixed right-4 top-20 w-80 z-50">
      <div className={`p-3 rounded ${isDark ? 'bg-[#222] border border-gray-800' : 'bg-white border'}`}>
        <h4 className="mb-2">Report user</h4>
        <textarea value={reportText} onChange={(e)=>setReportText(e.target.value)} className="w-full p-2 rounded" rows={4} placeholder="Describe the issue..." />
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={()=>setReportOpen(false)} className="px-2 py-1 rounded bg-gray-200">Cancel</button>
          <button onClick={submitReport} className="px-2 py-1 rounded bg-red-500 text-white">Send</button>
        </div>
      </div>
    </div>
  )}

  {/* selected message header actions */}
  {selectedMessageId && (
    <div className={`fixed top-0 left-0 right-0 flex justify-center p-2 ${isDark ? 'bg-[rgba(0,0,0,0.5)]' : 'bg-[rgba(255,255,255,0.9)]'}`}>
      <div className={`p-2 rounded ${isDark ? 'bg-[#222]' : 'bg-white'} flex items-center gap-2 shadow`}> 
        <button onClick={()=>deleteMessage(selectedMessageId)}>🗑 Delete</button>
        <button onClick={()=>{ const m = messages.find(x=>x.id===selectedMessageId); setReplyTo(m||null); setSelectedMessageId(null); }}>↩ Reply</button>
        <div className="flex gap-2">{EMOJIS.slice(0,4).map(e=><button key={e} onClick={()=>applyReaction(selectedMessageId,e)}>{e}</button>)}</div>
        <button onClick={()=>setSelectedMessageId(null)}>✖</button>
      </div>
    </div>
  )}

</div>

); }