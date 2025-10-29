Implement this
// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
doc,
getDoc,
collection,
addDoc,
query,
orderBy,
limit as fsLimit,
onSnapshot,
serverTimestamp,
updateDoc,
arrayUnion,
arrayRemove,
getDocs,
writeBatch,
deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**

Full ChatConversationPage.jsx

Attachment bottom sheet (Camera, Photos, Files) — slides from bottom and closes on outside tap


No voice note support (removed)


Image previews above input; Send commits them to chat


Placeholder -> upload -> update doc flow


Reaction toggle (add/remove)


Live last seen rendering
*/



const fmtTime = (ts) => {
if (!ts) return "";
const d = ts.toDate ? ts.toDate() : new Date(ts);
return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const fmtLastSeen = (ts) => {
if (!ts) return "";
if (ts === "Online") return "Online";
const d = ts.toDate ? ts.toDate() : new Date(ts);
const now = new Date();
const diffMs = now - d;
const diffMin = Math.floor(diffMs / 60000);
if (diffMin < 1) return "just now";
if (diffMin < 60) return ${diffMin}m ago;
if (diffMin < 1440) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const EMOJIS = ["👍","❤️","😂","😮","😢","👏","🔥","😅"];

export default function ChatConversationPage() {
const { chatId } = useParams();
const navigate = useNavigate();
const { theme, wallpaper } = useContext(ThemeContext);
const isDark = theme === "dark";

const [chatInfo, setChatInfo] = useState(null);
const [friendInfo, setFriendInfo] = useState(null);
const [messages, setMessages] = useState([]);
const [limitCount] = useState(50);

// UI states
const [selectedFiles, setSelectedFiles] = useState([]); // File objects (preview stage)
const [previews, setPreviews] = useState([]); // preview URLs (images) or null for non-image
const [localUploads, setLocalUploads] = useState([]); // placeholders for local upload progress
const [downloadMap, setDownloadMap] = useState({}); // { messageId: {status, progress, blobUrl} }
const [text, setText] = useState("");
const [attachOpen, setAttachOpen] = useState(false); // bottom sheet
const [menuOpen, setMenuOpen] = useState(false);
const [replyTo, setReplyTo] = useState(null);
const [blocked, setBlocked] = useState(false);
const [friendTyping, setFriendTyping] = useState(false);
const [reportOpen, setReportOpen] = useState(false);
const [reportText, setReportText] = useState("");
const [selectedMessageId, setSelectedMessageId] = useState(null);

const [lastSeenLabel, setLastSeenLabel] = useState("");
const messagesRef = useRef(null);
const endRef = useRef(null);
const attachRef = useRef(null);
const fileInputRef = useRef(null);
const imageInputRef = useRef(null);
const myUid = auth.currentUser?.uid;
const [isAtBottom, setIsAtBottom] = useState(true);

// ---------- load chat info and friend (live) ----------
useEffect(() => {
if (!chatId) return;
const chatRef = doc(db, "chats", chatId);
let unsubFriend = null;
let unsubChat = null;

(async () => {  
  const snap = await getDoc(chatRef);  
  if (!snap.exists()) { alert("Chat not found"); navigate("/chat"); return; }  
  setChatInfo({ id: snap.id, ...snap.data() });  
  setBlocked(Boolean(snap.data()?.blockedBy?.includes(myUid)));  

  const friendId = snap.data().participants?.find(p => p !== myUid);  
  if (friendId) {  
    const friendRef = doc(db, "users", friendId);  
    unsubFriend = onSnapshot(friendRef, uSnap => {  
      if (!uSnap.exists()) return;  
      const data = uSnap.data();  
      setFriendInfo({ id: uSnap.id, ...data });  
      setFriendTyping(Boolean(data?.typing?.[chatId]));  
      const ls = data?.isOnline ? "Online" : data?.lastSeen || null;  
      setLastSeenLabel(fmtLastSeen(ls));  
    });  
  }  

  unsubChat = onSnapshot(chatRef, cSnap => {  
    if (cSnap.exists()) {  
      setChatInfo(prev => ({ ...(prev||{}), ...cSnap.data() }));  
      setBlocked(Boolean(cSnap.data()?.blockedBy?.includes(myUid)));  
    }  
  });  
})();  

return () => { unsubFriend && unsubFriend(); unsubChat && unsubChat(); };

}, [chatId, myUid, navigate]);

// ---------- realtime messages ----------
useEffect(() => {
if (!chatId) return;
const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), fsLimit(limitCount));
const unsub = onSnapshot(q, snap => {
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
setMessages(docs);

// auto mark delivered for incoming (best-effort)  
  docs.forEach(m => {  
    if (m.sender !== myUid && m.status === "sent") {  
      const mRef = doc(db, "chats", chatId, "messages", m.id);  
      updateDoc(mRef, { status: "delivered" }).catch(()=>{});  
    }  
  });  

  // queue downloads for attachments  
  docs.forEach(m => {  
    if ((m.type === "image" || m.type === "file") && m.fileURL) {  
      setDownloadMap(prev => {  
        if (prev[m.id] && (prev[m.id].status === "done" || prev[m.id].status === "downloading")) return prev;  
        return { ...prev, [m.id]: { ...(prev[m.id]||{}), status: "queued", progress: 0, blobUrl: null } };  
      });  
    }  
  });  

  // scroll to bottom on first load  
  setTimeout(()=> { endRef.current?.scrollIntoView({ behavior: "auto" }); setIsAtBottom(true); }, 40);  
});  

return () => unsub();

}, [chatId, limitCount, myUid]);

// ---------- start downloads for queued attachments ----------
useEffect(() => {
Object.entries(downloadMap).forEach(([msgId, info]) => {
if (info.status === "queued") {
setDownloadMap(prev => ({ ...prev, [msgId]: { ...prev[msgId], status: "downloading", progress: 0 } }));
startDownloadForMessage(msgId).catch(err => {
console.error("download start error", err);
setDownloadMap(prev => ({ ...prev, [msgId]: { ...prev[msgId], status: "failed" } }));
});
}
});
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [downloadMap]);

// ---------- scroll handler ----------
useEffect(() => {
const el = messagesRef.current;
if (!el) return;
const onScroll = () => {
const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
setIsAtBottom(atBottom);
if (!atBottom) setSelectedMessageId(null);
};
el.addEventListener("scroll", onScroll);
return () => el.removeEventListener("scroll", onScroll);
}, []);

const scrollToBottom = (smooth = true) => endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });

// ---------- file selection (pictures & files) ----------
const onFilesSelected = (e) => {
const files = Array.from(e.target.files || []);
if (!files.length) return;
const newPreviews = files.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
setSelectedFiles(prev => [...prev, ...files]);
setPreviews(prev => [...prev, ...newPreviews]);
};

// ---------- send queued previews ----------
const sendQueuedFiles = async () => {
if (!selectedFiles.length) return;
const filesToSend = [...selectedFiles];
setSelectedFiles([]); setPreviews([]);

for (const file of filesToSend) {  
  try {  
    const placeholder = {  
      sender: myUid,  
      text: "",  
      fileURL: null,  
      fileName: file.name,  
      type: file.type.startsWith("image/") ? "image" : "file",  
      createdAt: serverTimestamp(),  
      status: "uploading",  
    };  
    const docRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);  

    // local placeholder UI  
    setLocalUploads(prev => [...prev, { id: docRef.id, fileName: file.name, progress: 0, type: placeholder.type, previewUrl: URL.createObjectURL(file) }]);  

    // upload  
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

// ---------- receiver download: stream with progress ----------
const startDownloadForMessage = async (messageId) => {
try {
const mRef = doc(db, "chats", chatId, "messages", messageId);
const mSnap = await getDoc(mRef);
if (!mSnap.exists()) { setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "failed" } })); return; }
const m = { id: mSnap.id, ...mSnap.data() };
if (!m.fileURL) { setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "done", progress: 100, blobUrl: null } })); return; }

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
    received += value.length || value.byteLength || 0;  
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

const getDisplayUrlForMessage = (m) => {
const d = downloadMap[m.id];
if (d && d.blobUrl) return d.blobUrl;
if (m.fileURL) return m.fileURL;
const local = localUploads.find(l => l.id === m.id);
if (local && local.previewUrl) return local.previewUrl;
return null;
};

// ---------- send text ----------
const handleSendText = async () => {
if (!text.trim() && selectedFiles.length === 0) return;
if (blocked) { alert("You blocked this user — unblock to send."); return; }

// if previews exist, prefer sending queued files first  
if (selectedFiles.length > 0) {  
  await sendQueuedFiles();  
  // if there is text too, send text after files  
}  
if (text.trim()) {  
  const payload = {  
    sender: myUid,  
    text: text.trim(),  
    fileURL: null,  
    fileName: null,  
    type: "text",  
    createdAt: serverTimestamp(),  
    status: "sent",  
  };  
  if (replyTo) {  
    payload.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0,120) || (replyTo.fileName || "media"), sender: replyTo.sender };  
    setReplyTo(null);  
  }  
  setText("");  
  try {  
    await addDoc(collection(db, "chats", chatId, "messages"), payload);  
    setTimeout(()=> scrollToBottom(true), 150);  
  } catch (err) {  
    console.error("send text failed", err);  
    alert("Failed to send message");  
  }  
}

};

// ---------- block/unblock ----------
const toggleBlock = async () => {
if (!chatInfo) return;
const chatRef = doc(db, "chats", chatId);
try {
if (blocked) {
await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
setBlocked(false);
} else {
await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
setBlocked(true);
}
setMenuOpen(false);
} catch (err) {
console.error("toggleBlock", err);
alert("Failed to update block status");
}
};

// ---------- report ----------
const submitReport = async () => {
if (!reportText.trim()) { alert("Please write report details."); return; }
try {
await addDoc(collection(db, "reports"), {
reporterId: myUid,
reportedId: friendInfo?.id || null,
chatId,
reason: reportText.trim(),
createdAt: serverTimestamp(),
emailTo: "smarttalkgit@gmail.com",
});
setReportText(""); setReportOpen(false); setMenuOpen(false);
alert("Report submitted. Thank you.");
} catch (err) {
console.error("report submit", err);
alert("Failed to submit report");
}
};

// ---------- delete message ----------
const deleteMessage = async (messageId) => {
if (!window.confirm("Delete message?")) return;
try {
await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
setSelectedMessageId(null);
} catch (err) {
console.error("delete message", err);
alert("Failed to delete message");
}
};

// ---------- clear chat ----------
const clearChat = async () => {
if (!window.confirm("Clear all messages in this chat? This will delete messages permanently.")) return;
try {
const msgsRef = collection(db, "chats", chatId, "messages");
const snapshot = await getDocs(msgsRef);
const docs = snapshot.docs;
const batchSize = 400;
for (let i = 0; i < docs.length; i += batchSize) {
const batch = writeBatch(db);
docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
await batch.commit();
}
alert("Chat cleared.");
setMenuOpen(false);
} catch (err) {
console.error("clear chat", err);
alert("Failed to clear chat");
}
};

// ---------- reactions toggle (add / remove your reaction) ----------
const toggleReaction = async (messageId, emoji) => {
try {
const mRef = doc(db, "chats", chatId, "messages", messageId);
// fetch current doc to check existing reaction for this user
const snap = await getDoc(mRef);
if (!snap.exists()) return;
const cur = snap.data();
const curReactions = cur.reactions || {};
if (curReactions[myUid] === emoji) {
// remove
await updateDoc(mRef, { [reactions.${myUid}]: null });
} else {
await updateDoc(mRef, { [reactions.${myUid}]: emoji });
}
setSelectedMessageId(null);
} catch (err) {
console.error("reaction error", err);
}
};

// ---------- long press select & swipe-to-reply ----------
const longPressTimeout = useRef(null);
const startLongPress = (id) => { longPressTimeout.current = setTimeout(() => setSelectedMessageId(id), 450); };
const cancelLongPress = () => clearTimeout(longPressTimeout.current);

const swipeStart = useRef({ x: 0, y: 0 });
const onPointerDown = (e) => swipeStart.current = { x: e.clientX || (e.touches && e.touches[0].clientX), y: e.clientY || (e.touches && e.touches[0].clientY) };
const onPointerUpForReply = (e, m) => {
const endX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
const dx = endX - swipeStart.current.x;
if (dx > 110) { setReplyTo(m); setSelectedMessageId(null); setTimeout(()=> { const el = document.querySelector('input[type="text"]'); if (el) el.focus(); }, 50); }
};

// ---------- merge & group messages by day ----------
const merged = [...messages];
const grouped = [];
let lastDay = null;
merged.forEach(m => {
const label = (() => {
if (!m.createdAt) return "";
const d = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
const now = new Date();
const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
if (d.toDateString() === now.toDateString()) return "Today";
if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
})();
if (label !== lastDay) { grouped.push({ type: "day", label, id: day-${label}-${Math.random().toString(36).slice(2,6)} }); lastDay = label; }
grouped.push(m);
});

// ---------- spinner ----------
function Spinner({ percent = 0 }) {
return (
<div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
<svg viewBox="0 0 36 36" style={{ width: 36, height: 36 }}>
<path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#eee" strokeWidth="2" />
<path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#34B7F1" strokeWidth="2" strokeDasharray={${percent},100} strokeLinecap="round" />
</svg>
<div style={{ position: "absolute", fontSize: 10, color: "#fff", fontWeight: 700 }}>{Math.min(100, Math.round(percent))}%</div>
</div>
);
}

// ---------- attach outside click to close (for bottom sheet overlay) ----------
useEffect(() => {
const handler = (e) => {
if (attachOpen && attachRef.current && !attachRef.current.contains(e.target)) {
setAttachOpen(false);
}
};
if (attachOpen) document.addEventListener("mousedown", handler);
return () => document.removeEventListener("mousedown", handler);
}, [attachOpen]);

// ---------- MessageBubble renderer ----------
const MessageBubble = ({ m }) => {
const mine = m.sender === myUid;
const replySnippet = m.replyTo ? (m.replyTo.text || (m.replyTo.fileName || "media")) : null;
const displayUrl = getDisplayUrlForMessage(m);
const downloadInfo = downloadMap[m.id];

// bubble styles tuned for dark/light readability  
const bubbleStyle = {  
  background: mine ? (isDark ? "#0b79d0" : "#0b84ff") : (isDark ? "#1d1d1d" : "#f1f1f1"),  
  color: mine ? "#fff" : (isDark ? "#e6e6e6" : "#111"),  
  padding: "10px 12px",  
  borderRadius: 14,  
  maxWidth: "78%",  
  wordBreak: "break-word",  
  position: "relative",  
};  

return (  
  <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, paddingLeft: 6, paddingRight: 6 }}>  
    <div  
      onMouseDown={() => startLongPress(m.id)}  
      onMouseUp={() => cancelLongPress()}  
      onTouchStart={() => startLongPress(m.id)}  
      onTouchEnd={() => cancelLongPress()}  
      onPointerDown={(e) => onPointerDown(e)}  
      onPointerUp={(e) => onPointerUpForReply(e, m)}  
      style={bubbleStyle}  
    >  
      {replySnippet && (  
        <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#fff", color: isDark ? "#cfcfcf" : "#444", fontSize: 12 }}>  
          <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{replySnippet}</span>  
        </div>  
      )}  

      {m.type === "text" && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}  

      {["image","file"].includes(m.type) && (  
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>  
          {m.type === "image" ? (  
            <img  
              src={displayUrl || m.fileURL || (m.previewUrl || "")}  
              alt={m.fileName || "image"}  
              style={{  
                width: 220,  
                height: "auto",  
                borderRadius: 8,  
                filter: (downloadInfo && downloadInfo.status === "downloading") || (m.status === "uploading") ? "blur(6px)" : "none",  
                transition: "filter .2s",  
                display: "block"  
              }}  
            />  
          ) : (  
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, background: mine ? "rgba(255,255,255,0.02)" : "#fff" }}>  
              <div style={{ width: 40, height: 40, borderRadius: 6, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>📎</div>  
              <div style={{ maxWidth: 180 }}>  
                <div style={{ fontWeight: 600, color: isDark ? "#e6e6e6" : "#111" }}>{m.fileName || "file"}</div>  
                <div style={{ fontSize: 12, color: "#666" }}>{m.type}</div>  
                {/* allow download if blob or fileURL */}  
                {displayUrl && <a href={displayUrl} download={m.fileName} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: "block", marginTop: 6 }}>Download</a>}  
              </div>  
            </div>  
          )}  

          {(m.status === "uploading" || (downloadInfo && (downloadInfo.status === "downloading" || downloadInfo.status === "queued"))) && (  
            <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>  
              <Spinner percent={m.status === "uploading" ? (() => { const u = localUploads.find(x => x.id === m.id); return u ? u.progress : 0; })() : (downloadInfo ? downloadInfo.progress : 0)} />  
            </div>  
          )}  

          {downloadInfo && downloadInfo.status === "failed" && (  
            <div style={{ marginLeft: 8 }}>  
              <button onClick={() => setDownloadMap(prev => ({ ...prev, [m.id]: { ...(prev[m.id]||{}), status: "queued", progress: 0 } }))} style={{ padding: "6px 8px", borderRadius: 8, border: "none", background: "#ffcc00", cursor: "pointer" }}>Retry</button>  
            </div>  
          )}  
        </div>  
      )}  

      <div style={{ fontSize: 11, textAlign: "right", marginTop: 6, opacity: 0.9 }}>  
        <span>{fmtTime(m.createdAt)}</span>  
        {mine && <span style={{ marginLeft: 8 }}>{m.status === "uploading" ? "⌛" : m.status === "sent" ? "✓" : m.status === "delivered" ? "✓✓" : m.status === "seen" ? "✓✓" : ""}</span>}  
      </div>  

      {/* reactions preview */}  
      {m.reactions && Object.keys(m.reactions).length > 0 && (  
        <div style={{ position: "absolute", bottom: -18, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.12)" }}>  
          {Object.values(m.reactions).slice(0,3).join(" ")}  
        </div>  
      )}  
    </div>  
  </div>  
);

};

// ---------- UI ----------
return (
<div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? url(${wallpaper}) center/cover no-repeat : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
{/* header */}
<div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid #ccc", position: "sticky", top: 0, background: isDark ? "#111" : "#fff", zIndex: 40 }}>
<button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", cursor: "pointer", marginRight: 10 }}>←</button>
<img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", marginRight: 12, cursor: "pointer" }} onClick={() => friendInfo && navigate(/user-profile/${friendInfo.id})} />
<div>
<div style={{ fontWeight: 700 }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</div>
<div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666" }}>
{friendTyping ? "typing..." : fmtLastSeen(friendInfo?.isOnline ? "Online" : friendInfo?.lastSeen)}
</div>
</div>

<div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>  
      <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>📞</button>  
      <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>🎥</button>  

      <div style={{ position: "relative" }}>  
        <button onClick={() => setMenuOpen(s => !s)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>⋮</button>  
        {menuOpen && (  
          <div style={{ position: "absolute", right: 0, top: 28, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 50 }}>  
            <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>View Profile</button>  
            <button onClick={() => { clearChat(); setMenuOpen(false); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Clear Chat</button>  
            <button onClick={toggleBlock} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>{blocked ? "Unblock" : "Block"}</button>  
            <button onClick={() => { setReportOpen(true); setMenuOpen(false); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Report</button>  
          </div>  
        )}  
      </div>  
    </div>  
  </div>  

  {/* messages list */}  
  <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>  
    {grouped.map(g => {  
      if (g.type === "day") return <div key={g.id} style={{ textAlign: "center", margin: "12px 0", color: "#888", fontSize: 12 }}>{g.label}</div>;  
      return <MessageBubble key={g.id} m={g} />;  
    })}  

    {localUploads.map(u => (  
      <div key={u.id} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>  
        <div style={{ background: isDark ? "#0b84ff" : "#007bff", color: "#fff", padding: 10, borderRadius: 14, maxWidth: "78%", position: "relative" }}>  
          {u.type === "image" ? <img src={u.previewUrl} alt={u.fileName} style={{ width: 220, borderRadius: 8, filter: "blur(3px)" }} /> : <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div>📎</div><div>{u.fileName}</div></div>}  
          <div style={{ marginTop: 8, fontSize: 11, textAlign: "right" }}>  
            <span>⌛</span> <span style={{ marginLeft: 8 }}>{u.progress}%</span>  
          </div>  
          <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>  
            <Spinner percent={u.progress} />  
          </div>  
        </div>  
      </div>  
    ))}  

    <div ref={endRef} />  
  </div>  

  {/* center down arrow */}  
  <button  
    onClick={() => scrollToBottom(true)}  
    style={{  
      position: "fixed",  
      left: "50%",  
      transform: "translateX(-50%)",  
      bottom: 120,  
      zIndex: 60,  
      background: "#007bff",  
      color: "#fff",  
      border: "none",  
      borderRadius: 22,  
      width: 48,  
      height: 48,  
      fontSize: 22,  
      cursor: "pointer",  
      opacity: isAtBottom ? 0 : 1,  
      transition: "opacity 0.25s",  
    }}  
    title="Scroll to latest"  
    aria-hidden={isAtBottom}  
  >  
    ↓  
  </button>  

  {/* previews (above input) */}  
  {previews.length > 0 && (  
    <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid #ddd", background: isDark ? "#0b0b0b" : "#fff" }}>  
      {previews.map((p, idx) => (  
        <div key={idx} style={{ position: "relative" }}>  
          {p ? <img src={p} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{selectedFiles[idx]?.name}</div>}  
          <button onClick={() => { setSelectedFiles(s => s.filter((_,i) => i !== idx)); setPreviews(s => s.filter((_,i) => i !== idx)); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>✕</button>  
        </div>  
      ))}  

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>  
        <button onClick={sendQueuedFiles} style={{ padding: "8px 12px", borderRadius: 8, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}>Send</button>  
        <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#ddd", border: "none", cursor: "pointer" }}>Cancel</button>  
      </div>  
    </div>  
  )}  

  {/* pinned input */}  
  <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid #ccc", display: "flex", alignItems: "center", gap: 8, zIndex: 80 }}>  
    <div style={{ position: "relative" }} ref={attachRef}>  
      <button onClick={() => setAttachOpen(s => !s)} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20, background: "#f0f0f0", border: "none", cursor: "pointer" }}>＋</button>  
    </div>  

    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>  
      {replyTo && (  
        <div style={{ padding: "6px 10px", borderRadius: 8, background: isDark ? "#111" : "#f0f0f0", marginBottom: 6 }}>  
          <small style={{ color: "#888", display: "block" }}>{replyTo.sender === myUid ? "You" : ""}</small>  
          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyTo.text || replyTo.fileName || "media"}</div>  
          <button onClick={() => setReplyTo(null)} style={{ marginTop: 6, background: "transparent", border: "none", color: "#888", cursor: "pointer" }}>Cancel</button>  
        </div>  
      )}  

      <input type="text" placeholder={blocked ? "You blocked this user — unblock to send" : "Type a message..."} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }} disabled={blocked} style={{ padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#111" : "#fff", color: isDark ? "#fff" : "#000" }} />  
    </div>  

    <button onClick={handleSendText} disabled={blocked || (!text.trim() && localUploads.length === 0 && selectedFiles.length === 0)} style={{ background: "#34B7F1", color: "#fff", border: "none", borderRadius: 16, padding: "8px 12px", cursor: "pointer" }}>Send</button>  
  </div>  

  {/* attachment bottom sheet (WhatsApp-like) */}  
  {attachOpen && (  
    <>  
      {/* overlay */}  
      <div onClick={() => setAttachOpen(false)} style={{ position: "fixed", left: 0, top: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", zIndex: 90 }} />  

      {/* sheet */}  
      <div style={{  
        position: "fixed",  
        left: 0,  
        right: 0,  
        bottom: 0,  
        zIndex: 100,  
        background: isDark ? "#111" : "#fff",  
        borderTopLeftRadius: 12,  
        borderTopRightRadius: 12,  
        boxShadow: "0 -8px 30px rgba(0,0,0,0.2)",  
        padding: 16,  
        transform: attachOpen ? "translateY(0)" : "translateY(100%)",  
        transition: "transform 220ms ease-out"  
      }} ref={attachRef}>  

        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", gap: 12 }}>  
          <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { /* camera - fallback to image input for now */ imageInputRef.current?.click(); setAttachOpen(false); }}>  
            <div style={{ width: 60, height: 60, borderRadius: 14, background: isDark ? "#1b1b1b" : "#f4f4f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📷</div>  
            <div style={{ marginTop: 8, fontSize: 12 }}>Camera</div>  
          </div>  

          <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { imageInputRef.current?.click(); setAttachOpen(false); }}>  
            <div style={{ width: 60, height: 60, borderRadius: 14, background: isDark ? "#1b1b1b" : "#f4f4f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🖼️</div>  
            <div style={{ marginTop: 8, fontSize: 12 }}>Photos</div>  
          </div>  

          <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { fileInputRef.current?.click(); setAttachOpen(false); }}>  
            <div style={{ width: 60, height: 60, borderRadius: 14, background: isDark ? "#1b1b1b" : "#f4f4f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📁</div>  
            <div style={{ marginTop: 8, fontSize: 12 }}>File</div>  
          </div>  
        </div>  

        <div style={{ marginTop: 12, color: "#888", fontSize: 13, textAlign: "center" }}>Tap to attach</div>  

        {/* hidden inputs */}  
        <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onFilesSelected(e)} />  
        <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => onFilesSelected(e)} />  
      </div>  
    </>  
  )}  

  {/* report modal */}  
  {reportOpen && (  
    <div style={{ position: "fixed", right: 16, top: 80, zIndex: 120, width: 320 }}>  
      <div style={{ background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>  
        <h4 style={{ margin: "0 0 8px 0" }}>Report user</h4>  
        <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe the issue..." style={{ width: "100%", minHeight: 80, borderRadius: 6, padding: 8 }} />  
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>  
          <button onClick={() => setReportOpen(false)} style={{ padding: "8px 10px", borderRadius: 6, border: "none", background: "#ddd", cursor: "pointer" }}>Cancel</button>  
          <button onClick={submitReport} style={{ padding: "8px 10px", borderRadius: 6, border: "none", background: "#ff4d4f", color: "#fff", cursor: "pointer" }}>Send</button>  
        </div>  
      </div>  
    </div>  
  )}  

  {/* header action when message selected */}  
  {selectedMessageId && (  
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", padding: "8px 0", background: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)", zIndex: 120 }}>  
      <div style={{ background: isDark ? "#222" : "#fff", padding: "6px 10px", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>  
        <button onClick={() => deleteMessage(selectedMessageId)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>🗑 Delete</button>  
        <button onClick={() => { const m = messages.find(x => x.id === selectedMessageId); setReplyTo(m || null); setSelectedMessageId(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>↩ Reply</button>  
        <div style={{ display: "flex", gap: 6 }}>  
          {EMOJIS.slice(0, 4).map(e => <button key={e} onClick={() => toggleReaction(selectedMessageId, e)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>{e}</button>)}  
        </div>  
        <button onClick={() => setSelectedMessageId(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✖</button>  
      </div>  
    </div>  
  )}  
</div>

);
}