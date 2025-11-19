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
deleteDoc,
getDoc,
arrayUnion,
arrayRemove,
getDocs,
limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
// Helpers
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
return d.toLocaleDateString(undefined, {
month: "short",
day: "numeric",
year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined
});
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
if (!cloudName || !uploadPreset) {
return reject(new Error("Cloudinary env not configured"));
}
const url = https://api.cloudinary.com/v1_1/${cloudName}/auto/upload;
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
} else {
reject(new Error("Cloudinary upload failed: " + xhr.status));
}
};
xhr.onerror = () => reject(new Error("Network error during upload"));
const fd = new FormData();
fd.append("file", file);
fd.append("upload_preset", uploadPreset);
xhr.send(fd);
} catch (err) {
reject(err);
}
});
};
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
// Effects
// Recorder availability
useEffect(() => {
setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
}, []);
// Load chat metadata + friend info
useEffect(() => {
if (!chatId) return;
let unsubChat = null;
const load = async () => { const chatRef = doc(db, "chats", chatId); const snap = await getDoc(chatRef); if (snap.exists()) { const data = snap.data(); setChatInfo({ id: snap.id, ...data }); const friendId = data.participants?.find(p => p !== myUid); if (friendId) { const userRef = doc(db, "users", friendId); const userSnap = await getDoc(userRef); if (userSnap.exists()) { setFriendInfo({ id: userSnap.id, ...userSnap.data() }); } } } unsubChat = onSnapshot(chatRef, (s) => { if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() })); }); }; load(); return () => { if (unsubChat) unsubChat(); }; 
}, [chatId, myUid]);
// Listen for messages realtime
useEffect(() => {
if (!chatId) return;
setLoadingMsgs(true);
const msgsRef = collection(db, "chats", chatId, "messages");
const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
const unsub = onSnapshot(q, (snap) => {
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
setMessages(filtered);
filtered.forEach(async (m) => { if (m.senderId !== myUid && m.status === "sent") { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } }); setLoadingMsgs(false); setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80); }); return () => unsub(); 
}, [chatId, myUid, isAtBottom]);
// Detect scroll to bottom
useEffect(() => {
const el = messagesRefEl.current;
if (!el) return;
const onScroll = () => {
const atBtm = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
setIsAtBottom(atBtm);
};
el.addEventListener("scroll", onScroll);
return () => el.removeEventListener("scroll", onScroll);
}, []);
// Mark last incoming message as seen when tab visible
useEffect(() => {
const onVisibility = async () => {
if (document.visibilityState !== "visible") return;
const lastIncoming = [...messages].reverse().find(m => m.senderId !== myUid);
if (lastIncoming && lastIncoming.status !== "seen") {
await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" });
}
};
document.addEventListener("visibilitychange", onVisibility);
onVisibility();
return () => document.removeEventListener("visibilitychange", onVisibility);
}, [messages, chatId, myUid]);
// File select & preview
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
setSelectedPreviewIndex(prev => (prev >= 0 ? prev : 0));
};
// Sending messages (text or files)
const sendTextMessage = async () => {
// Block check
const blockedBy = chatInfo?.blockedBy || [];
if (blockedBy.includes(myUid)) {
alert("You are blocked in this chat.");
return;
}
// Files if (selectedFiles.length > 0) { const toSend = [...selectedFiles]; setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0); for (const file of toSend) { const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: detectFileType(file), fileName: file.name, createdAt: serverTimestamp(), status: "uploading", reactions: {}, }; const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder); const messageId = mRef.id; setUploadingIds(prev => ({ ...prev, [messageId]: 0 })); try { const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })) ); await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() }); } catch (err) { console.error("Upload failed", err); } setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200); } return; } // Text if (text.trim()) { const payload = { senderId: myUid, text: text.trim(), mediaUrl: "", mediaType: null, createdAt: serverTimestamp(), status: "sent", reactions: {} }; if (replyTo) { payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId }; setReplyTo(null); } await addDoc(collection(db, "chats", chatId, "messages"), payload); setText(""); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80); } 
};
// Recording voice note
const startRecording = async () => {
if (!recorderAvailable) {
alert("Recording is not supported in your browser.");
return;
}
try {
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mr = new MediaRecorder(stream);
recorderChunksRef.current = [];
mr.ondataavailable = e => {
if (e.data.size) recorderChunksRef.current.push(e.data);
};
mr.onstop = async () => {
const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
const placeholder = {
senderId: myUid,
text: "",
mediaUrl: "",
mediaType: "audio",
fileName: "voice_note.webm",
createdAt: serverTimestamp(),
status: "uploading",
reactions: {}
};
const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
const messageId = mRef.id;
setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
try {
const url = await uploadToCloudinary(blob, pct =>
setUploadingIds(prev => ({ ...prev, [messageId]: pct }))
);
await updateDoc(doc(db, "chats", chatId, "messages", mRef.id), {
mediaUrl: url,
status: "sent",
sentAt: serverTimestamp()
});
} catch (err) {
console.error("Voice note upload error", err);
}
setTimeout(() => setUploadingIds(prev => {
const c = { ...prev }; delete c[messageId]; return c;
}), 200);
};
mr.start();
recorderRef.current = mr;
setRecording(true);
} catch (err) {
console.error(err);
alert("Could not start audio recording.");
}
};
const stopRecording = () => {
recorderRef.current?.stop();
recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
setRecording(false);
};
const holdStart = (e) => {
e.preventDefault();
longPressTimer.current = setTimeout(() => startRecording(), 300);
};
const holdEnd = (e) => {
clearTimeout(longPressTimer.current);
if (recording) stopRecording();
};
// Reactions
const applyReaction = async (messageId, emoji) => {
const mRef = doc(db, "chats", chatId, "messages", messageId);
const snap = await getDoc(mRef);
if (!snap.exists()) return;
const data = snap.data();
const existing = data.reactions?.[myUid];
const update = existing === emoji ? { [reactions.${myUid}]: null } : { [reactions.${myUid}]: emoji };
await updateDoc(mRef, update);
setReactionFor(null);
};
// Message actions
const copyMessageText = async (m) => {
try {
await navigator.clipboard.writeText(m.text || m.mediaUrl || "");
alert("Copied");
} catch {
alert("Copy failed");
}
setMenuOpenFor(null);
};
const editMessage = async (m) => {
if (m.senderId !== myUid) return alert("You can only edit your own messages.");
const newText = window.prompt("Edit message", m.text || "");
if (newText == null) return;
await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true });
setMenuOpenFor(null);
};
const deleteMessageForEveryone = async (id) => {
if (!window.confirm("Delete for everyone?")) return;
await deleteDoc(doc(db, "chats", chatId, "messages", id));
setMenuOpenFor(null);
};
const deleteMessageForMe = async (id) => {
await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) });
setMenuOpenFor(null);
};
const forwardMessage = (m) => navigate(/forward/${m.id}, { state: { message: m } });
const pinMessage = async (m) => {
await updateDoc(doc(db, "chats", chatId), {
pinnedMessageId: m.id,
pinnedMessageText: m.text || (m.mediaType || "")
});
setMenuOpenFor(null);
alert("Message pinned");
};
const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };
const clearChat = async () => {
if (!window.confirm("Are you sure you want to clear this chat?")) return;
const msgsRef = collection(db, "chats", chatId, "messages");
const snap = await getDocs(query(msgsRef, orderBy("createdAt", "asc")));
for (const d of snap.docs) {
await deleteDoc(d.ref);
}
setHeaderMenuOpen(false);
alert("Chat cleared");
};
const toggleBlock = async () => {
const chatRef = doc(db, "chats", chatId);
const snap = await getDoc(chatRef);
if (!snap.exists()) return;
const data = snap.data();
const blockedBy = data.blockedBy || [];
if (blockedBy.includes(myUid)) {
await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
} else {
await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
}
setHeaderMenuOpen(false);
};
// Render Message Bubble
const MessageBubble = ({ m }) => {
const mine = m.senderId === myUid;
const bg = mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff");
const color = mine ? "#fff" : (isDark ? "#fff" : "#000");
const renderStatus = () => { if (!mine) return null; if (m.status === "uploading") return "⌛"; if (m.status === "sent") return "✔"; if (m.status === "delivered") return "✔✔"; if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>; return null; }; const renderContent = () => { if (m.mediaUrl) { switch (m.mediaType) { case "image": return <img src={m.mediaUrl} alt={m.fileName} style={{ maxWidth: 360, borderRadius: 12 }} />; case "video": return <video controls src={m.mediaUrl} style={{ maxWidth: 360, borderRadius: 12 }} />; case "audio": return <audio controls src={m.mediaUrl} style={{ width: 280 }} />; case "pdf": case "file": return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>; default: return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open File</a>; } } return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>; }; return ( <div onContextMenu={() => setMenuOpenFor(m.id)} onTouchStart={() => { longPressTimer.current = setTimeout(() => setMenuOpenFor(m.id), 500); swipeStartX.current = null; }} onTouchMove={(e) => { if (!swipeStartX.current && e.touches && e.touches[0]) swipeStartX.current = e.touches[0].clientX; }} onTouchEnd={() => { clearTimeout(longPressTimer.current); if (swipeStartX.current !== null) { const dx = swipeStartX.current - (event.changedTouches ? event.changedTouches[0].clientX : 0); if (dx > 80) replyToMessage(m); } }} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, position: "relative" }} > <div style={{ background: bg, color, padding: 12, borderRadius: 14, maxWidth: "78%", position: "relative", wordBreak: "break-word" }}> {m.replyTo && ( <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#f3f3f3", color: isDark ? "#ddd" : "#333", fontSize: 12, maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}> <div style={{ fontWeight: 700, marginBottom: 4 }}> {m.replyTo.senderId === myUid ? "You" : "Them"} </div> <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}> {m.replyTo.text} </div> </div> )} {renderContent()} {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}>· edited</div>} {m.reactions && Object.keys(m.reactions).length > 0 && ( <div style={{ position: "absolute", bottom: -14, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}> {Object.values(m.reactions).slice(0, 4).join(" ")} </div> )} <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}> <div style={{ marginLeft: "auto" }}> {fmtTime(m.createdAt)} {renderStatus()} </div> </div> {m.status === "uploading" && uploadingIds[m.id] !== undefined && ( <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}> <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", color: "#333", fontSize: 12 }}> {uploadingIds[m.id]}% </div> </div> )} </div> {/* Action Buttons */} <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", gap: 6 }}> <button onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>😊</button> <button onClick={() => setMenuOpenFor(m.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>⋯</button> </div> {/* Inline Menu */} {menuOpenFor === m.id && ( <div style={{ position: "absolute", transform: "translate(-50px, -100%)", zIndex: 999, right: mine ? 20 : "auto", left: mine ? "auto" : 80 }}> <div style={{ background: isDark ? "#111" : "#fff", padding: 8, borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}> <div style={{ display: "flex", flexDirection: "column", gap: 6 }}> <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button> <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button> {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>} <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button> <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button> <button onClick={() => { if (window.confirm("Delete for everyone?")) deleteMessageForEveryone(m.id); else deleteMessageForMe(m.id); }} style={menuBtnStyle}>Delete</button> <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button> <button onClick={() => setMenuOpenFor(null)} style={menuBtnStyle}>Close</button> </div> </div> </div> )} {reactionFor === m.id && ( <div style={{ position: "absolute", top: "calc(100% - 12px)", transform: "translateY(6px)", zIndex: 998 }}> <div style={{ display: "flex", gap: 8, padding: 8, borderRadius: 20, background: isDark ? "#111" : "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.08)", alignItems: "center" }}> {INLINE_REACTIONS.map(r => ( <button key={r} onClick={() => applyReaction(m.id, r)} style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer" }}>{r}</button> ))} <button onClick={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>＋</button> </div> </div> )} </div> ); 
};
// Group messages by day
const groupedMessages = (() => {
const out = [];
let lastDay = null;
messages.forEach(m => {
const lbl = dayLabel(m.createdAt || new Date());
if (lbl !== lastDay) {
out.push({ type: "day", label: lbl, id: day-${lbl}-${Math.random().toString(36).slice(2)} });
lastDay = lbl;
}
out.push(m);
});
return out;
})();
// Header menu style
const menuBtnStyle = {
padding: "8px 10px",
borderRadius: 8,
border: "none",
background: "transparent",
cursor: "pointer",
textAlign: "left",
width: "100%"
};
// Render
return (
<div style={{
minHeight: "100vh",
display: "flex",
flexDirection: "column",
background: wallpaper
? url(${wallpaper}) center/cover no-repeat
: (isDark ? "#070707" : "#f5f5f5"),
color: isDark ? "#fff" : "#000"
}}>
{/* Header /}
<header style={{
position: "sticky",
top: 0,
zIndex: 90,
display: "flex",
alignItems: "center",
gap: 12,
padding: 12,
background: "#1877F2",
color: "#fff",
borderBottom: "1px solid rgba(0,0,0,0.06)"
}}>
<button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>←
<img src={friendInfo?.photoURL || chatInfo?.photoURL || "/default-avatar.png"} alt="avatar" onClick={() => friendInfo && navigate(/user-profile/${friendInfo.id})} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} />
<div onClick={() => friendInfo && navigate(/user-profile/${friendInfo.id})} style={{ minWidth: 0, cursor: "pointer", flex: 1 }}>
<div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{friendInfo?.displayName || chatInfo?.name || "Chat"}

<div style={{ fontSize: 12, opacity: 0.9 }}>
{friendInfo?.isOnline
? "Online"
: friendInfo?.lastSeen
? (() => {
const ls = friendInfo.lastSeen;
const d = ls.toDate ? ls.toDate() : new Date(ls);
const now = new Date();
const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
if (d.toDateString() === now.toDateString()) return Today ${timeStr};
if (d.toDateString() === yesterday.toDateString()) return Yesterday ${timeStr};
const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
return ${dateStr} ${timeStr};
})()
: "Offline"
}


<button onClick={() => navigate(/voice-call/${chatId})} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>📞
<button onClick={() => navigate(/video-call/${chatId})} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>🎥
<div style={{ position: "relative" }}>
<button onClick={() => setHeaderMenuOpen(s => !s)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>⋮
{headerMenuOpen && (
<div style={{
position: "absolute",
right: 0,
top: 36,
background: isDark ? "#111" : "#fff",
color: isDark ? "#fff" : "#000",
padding: 8,
borderRadius: 10,
boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
minWidth: 160,
zIndex: 999
}}>
<button onClick={() => { setHeaderMenuOpen(false); navigate(/user-profile/${friendInfo?.id}); }} style={menuBtnStyle}>👤 View Profile
<button onClick={() => { clearChat(); }} style={menuBtnStyle}>🗑️ Clear Chat
<button onClick={() => { toggleBlock(); }} style={menuBtnStyle}>{(chatInfo?.blockedBy || []).includes(myUid) ? "🔓 Unblock" : "🔒 Block"}
<button onClick={() => { alert("Reported"); setHeaderMenuOpen(false); }} style={menuBtnStyle}>🚩 Report
<button onClick={() => { setHeaderMenuOpen(false); navigate(/voice-call/${chatId}); }} style={menuBtnStyle}>📞 Voice Call
<button onClick={() => { setHeaderMenuOpen(false); navigate(/video-call/${chatId}); }} style={menuBtnStyle}>🎥 Video Call
{/ You can implement mute, search, export if you want */}

)}

{/* Messages */} <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}> {loadingMsgs && <div style={{ textAlign: "center", marginTop: 24 }}>Loading messages…</div>} {groupedMessages.map(item => ( item.type === "day" ? ( <div key={item.id} style={{ textAlign: "center", margin: "12px 0", color: isDark ? "#aaa" : "#555", fontSize: 12 }}> {item.label} </div> ) : ( <MessageBubble key={item.id} m={item} /> ) ))} <div ref={endRef} /> </main> {/* Reply Preview (Pinned) */} {replyTo && ( <div style={{ position: "sticky", bottom: 84, left: 12, right: 12, display: "flex", justifyContent: "space-between", background: isDark ? "#101010" : "#fff", padding: 8, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 90 }}> <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden" }}> <div style={{ width: 4, height: 40, background: "#34B7F1", borderRadius: 4 }} /> <div style={{ maxWidth: "85%" }}> <div style={{ fontSize: 12, color: "#888" }}> {replyTo.senderId === myUid ? "You" : "Them"} </div> <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}> {replyTo.text || (replyTo.mediaType || "media")} </div> </div> </div> <div style={{ display: "flex", gap: 8 }}> <button onClick={() => { const el = document.getElementById(`msg-${replyTo.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); setReplyTo(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>Go</button> <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button> </div> </div> )} {/* File / Media Previews Strip */} {previews.length > 0 && ( <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", background: isDark ? "#0b0b0b" : "#fff", borderTop: `1px solid ${isDark ? "#333" : "#ccc"}` }}> {previews.map((p, idx) => ( <div key={idx} style={{ position: "relative", borderRadius: 8, border: idx === selectedPreviewIndex ? "2px solid #34B7F1" : "none" }}> {p.url && p.type === "image" && ( <img onClick={() => setSelectedPreviewIndex(idx)} src={p.url} alt={p.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> )} {p.url && p.type === "video" && ( <video onClick={() => setSelectedPreviewIndex(idx)} src={p.url} style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 8 }} /> )} {!p.url && ( <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", borderRadius: 8, padding: 6 }}> {p.name} </div> )} <button onClick={() => { setSelectedFiles(sf => sf.filter((_, i) => i !== idx)); setPreviews(ps => { const copy = ps.filter((_, i) => i !== idx); setSelectedPreviewIndex(prev => Math.max(0, Math.min(prev, copy.length - 1))); return copy; }); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>×</button> </div> ))} </div> )} {/* Input / Record Area */} <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`, display: "flex", alignItems: "center", gap: 8, zIndex: 90 }}> <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}> 📎 <input type="file" multiple style={{ display: "none" }} onChange={onFilesSelected} /> </label> <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTextMessage(); } }} style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#111" : "#f5f5f5", color: isDark ? "#fff" : "#000", outline: "none" }} /> <button onMouseDown={e => { if (!text.trim() && previews.length === 0) holdStart(e); }} onMouseUp={e => { if (!text.trim() && previews.length === 0) holdEnd(e); else if (text.trim() || previews.length > 0) sendTextMessage(); }} onTouchStart={e => { if (!text.trim() && previews.length === 0) holdStart(e); }} onTouchEnd={e => { if (!text.trim() && previews.length === 0) holdEnd(e); else if (text.trim() || previews.length > 0) sendTextMessage(); }} style={{ padding: 10, borderRadius: 12, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }} title={(!text.trim() && previews.length === 0) ? (recording ? "Recording… release to stop" : "Hold to record") : "Send"} > {(!text.trim() && previews.length === 0) ? (recording ? "● Recording" : "🎤") : "➤"} </button> </div> {/* Emoji Picker for reactions */} {showEmojiPicker && ( <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999 }}> <div style={{ width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto" }}> <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8 }}> {EXTENDED_EMOJIS.map(e => ( <button key={e} onClick={() => { applyReaction(emojiPickerFor, e); setShowEmojiPicker(false); }} style={{ padding: 10, fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}> {e} </button> ))} </div> <div style={{ textAlign: "right", marginTop: 8 }}> <button onClick={() => setShowEmojiPicker(false)} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd", cursor: "pointer" }}> Close </button> </div> </div> </div> )} </div> 
);
}























































































































































































































































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
deleteDoc,
getDoc,
arrayUnion,
arrayRemove,
getDocs,
limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
// Helpers
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
return d.toLocaleDateString(undefined, {
month: "short",
day: "numeric",
year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined
});
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
if (!cloudName || !uploadPreset) {
return reject(new Error("Cloudinary env not configured"));
}
const url = https://api.cloudinary.com/v1_1/${cloudName}/auto/upload;
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
} else {
reject(new Error("Cloudinary upload failed: " + xhr.status));
}
};
xhr.onerror = () => reject(new Error("Network error during upload"));
const fd = new FormData();
fd.append("file", file);
fd.append("upload_preset", uploadPreset);
xhr.send(fd);
} catch (err) {
reject(err);
}
});
};
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
// Effects
// Recorder availability
useEffect(() => {
setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
}, []);
// Load chat metadata + friend info
useEffect(() => {
if (!chatId) return;
let unsubChat = null;
const load = async () => { const chatRef = doc(db, "chats", chatId); const snap = await getDoc(chatRef); if (snap.exists()) { const data = snap.data(); setChatInfo({ id: snap.id, ...data }); const friendId = data.participants?.find(p => p !== myUid); if (friendId) { const userRef = doc(db, "users", friendId); const userSnap = await getDoc(userRef); if (userSnap.exists()) { setFriendInfo({ id: userSnap.id, ...userSnap.data() }); } } } unsubChat = onSnapshot(chatRef, (s) => { if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() })); }); }; load(); return () => { if (unsubChat) unsubChat(); }; 
}, [chatId, myUid]);
// Listen for messages realtime
useEffect(() => {
if (!chatId) return;
setLoadingMsgs(true);
const msgsRef = collection(db, "chats", chatId, "messages");
const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
const unsub = onSnapshot(q, (snap) => {
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
setMessages(filtered);
filtered.forEach(async (m) => { if (m.senderId !== myUid && m.status === "sent") { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } }); setLoadingMsgs(false); setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80); }); return () => unsub(); 
}, [chatId, myUid, isAtBottom]);
// Detect scroll to bottom
useEffect(() => {
const el = messagesRefEl.current;
if (!el) return;
const onScroll = () => {
const atBtm = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
setIsAtBottom(atBtm);
};
el.addEventListener("scroll", onScroll);
return () => el.removeEventListener("scroll", onScroll);
}, []);
// Mark last incoming message as seen when tab visible
useEffect(() => {
const onVisibility = async () => {
if (document.visibilityState !== "visible") return;
const lastIncoming = [...messages].reverse().find(m => m.senderId !== myUid);
if (lastIncoming && lastIncoming.status !== "seen") {
await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" });
}
};
document.addEventListener("visibilitychange", onVisibility);
onVisibility();
return () => document.removeEventListener("visibilitychange", onVisibility);
}, [messages, chatId, myUid]);
// File select & preview
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
setSelectedPreviewIndex(prev => (prev >= 0 ? prev : 0));
};
// Sending messages (text or files)
const sendTextMessage = async () => {
// Block check
const blockedBy = chatInfo?.blockedBy || [];
if (blockedBy.includes(myUid)) {
alert("You are blocked in this chat.");
return;
}
// Files if (selectedFiles.length > 0) { const toSend = [...selectedFiles]; setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0); for (const file of toSend) { const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: detectFileType(file), fileName: file.name, createdAt: serverTimestamp(), status: "uploading", reactions: {}, }; const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder); const messageId = mRef.id; setUploadingIds(prev => ({ ...prev, [messageId]: 0 })); try { const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })) ); await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() }); } catch (err) { console.error("Upload failed", err); } setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200); } return; } // Text if (text.trim()) { const payload = { senderId: myUid, text: text.trim(), mediaUrl: "", mediaType: null, createdAt: serverTimestamp(), status: "sent", reactions: {} }; if (replyTo) { payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId }; setReplyTo(null); } await addDoc(collection(db, "chats", chatId, "messages"), payload); setText(""); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80); } 
};
// Recording voice note
const startRecording = async () => {
if (!recorderAvailable) {
alert("Recording is not supported in your browser.");
return;
}
try {
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mr = new MediaRecorder(stream);
recorderChunksRef.current = [];
mr.ondataavailable = e => {
if (e.data.size) recorderChunksRef.current.push(e.data);
};
mr.onstop = async () => {
const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
const placeholder = {
senderId: myUid,
text: "",
mediaUrl: "",
mediaType: "audio",
fileName: "voice_note.webm",
createdAt: serverTimestamp(),
status: "uploading",
reactions: {}
};
const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
const messageId = mRef.id;
setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
try {
const url = await uploadToCloudinary(blob, pct =>
setUploadingIds(prev => ({ ...prev, [messageId]: pct }))
);
await updateDoc(doc(db, "chats", chatId, "messages", mRef.id), {
mediaUrl: url,
status: "sent",
sentAt: serverTimestamp()
});
} catch (err) {
console.error("Voice note upload error", err);
}
setTimeout(() => setUploadingIds(prev => {
const c = { ...prev }; delete c[messageId]; return c;
}), 200);
};
mr.start();
recorderRef.current = mr;
setRecording(true);
} catch (err) {
console.error(err);
alert("Could not start audio recording.");
}
};
const stopRecording = () => {
recorderRef.current?.stop();
recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
setRecording(false);
};
const holdStart = (e) => {
e.preventDefault();
longPressTimer.current = setTimeout(() => startRecording(), 300);
};
const holdEnd = (e) => {
clearTimeout(longPressTimer.current);
if (recording) stopRecording();
};
// Reactions
const applyReaction = async (messageId, emoji) => {
const mRef = doc(db, "chats", chatId, "messages", messageId);
const snap = await getDoc(mRef);
if (!snap.exists()) return;
const data = snap.data();
const existing = data.reactions?.[myUid];
const update = existing === emoji ? { [reactions.${myUid}]: null } : { [reactions.${myUid}]: emoji };
await updateDoc(mRef, update);
setReactionFor(null);
};
// Message actions
const copyMessageText = async (m) => {
try {
await navigator.clipboard.writeText(m.text || m.mediaUrl || "");
alert("Copied");
} catch {
alert("Copy failed");
}
setMenuOpenFor(null);
};
const editMessage = async (m) => {
if (m.senderId !== myUid) return alert("You can only edit your own messages.");
const newText = window.prompt("Edit message", m.text || "");
if (newText == null) return;
await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true });
setMenuOpenFor(null);
};
const deleteMessageForEveryone = async (id) => {
if (!window.confirm("Delete for everyone?")) return;
await deleteDoc(doc(db, "chats", chatId, "messages", id));
setMenuOpenFor(null);
};
const deleteMessageForMe = async (id) => {
await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) });
setMenuOpenFor(null);
};
const forwardMessage = (m) => navigate(/forward/${m.id}, { state: { message: m } });
const pinMessage = async (m) => {
await updateDoc(doc(db, "chats", chatId), {
pinnedMessageId: m.id,
pinnedMessageText: m.text || (m.mediaType || "")
});
setMenuOpenFor(null);
alert("Message pinned");
};
const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };
const clearChat = async () => {
if (!window.confirm("Are you sure you want to clear this chat?")) return;
const msgsRef = collection(db, "chats", chatId, "messages");
const snap = await getDocs(query(msgsRef, orderBy("createdAt", "asc")));
for (const d of snap.docs) {
await deleteDoc(d.ref);
}
setHeaderMenuOpen(false);
alert("Chat cleared");
};
const toggleBlock = async () => {
const chatRef = doc(db, "chats", chatId);
const snap = await getDoc(chatRef);
if (!snap.exists()) return;
const data = snap.data();
const blockedBy = data.blockedBy || [];
if (blockedBy.includes(myUid)) {
await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
} else {
await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
}
setHeaderMenuOpen(false);
};
// Render Message Bubble
const MessageBubble = ({ m }) => {
const mine = m.senderId === myUid;
const bg = mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff");
const color = mine ? "#fff" : (isDark ? "#fff" : "#000");
const renderStatus = () => { if (!mine) return null; if (m.status === "uploading") return "⌛"; if (m.status === "sent") return "✔"; if (m.status === "delivered") return "✔✔"; if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>; return null; }; const renderContent = () => { if (m.mediaUrl) { switch (m.mediaType) { case "image": return <img src={m.mediaUrl} alt={m.fileName} style={{ maxWidth: 360, borderRadius: 12 }} />; case "video": return <video controls src={m.mediaUrl} style={{ maxWidth: 360, borderRadius: 12 }} />; case "audio": return <audio controls src={m.mediaUrl} style={{ width: 280 }} />; case "pdf": case "file": return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>; default: return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open File</a>; } } return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>; }; return ( <div onContextMenu={() => setMenuOpenFor(m.id)} onTouchStart={() => { longPressTimer.current = setTimeout(() => setMenuOpenFor(m.id), 500); swipeStartX.current = null; }} onTouchMove={(e) => { if (!swipeStartX.current && e.touches && e.touches[0]) swipeStartX.current = e.touches[0].clientX; }} onTouchEnd={() => { clearTimeout(longPressTimer.current); if (swipeStartX.current !== null) { const dx = swipeStartX.current - (event.changedTouches ? event.changedTouches[0].clientX : 0); if (dx > 80) replyToMessage(m); } }} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, position: "relative" }} > <div style={{ background: bg, color, padding: 12, borderRadius: 14, maxWidth: "78%", position: "relative", wordBreak: "break-word" }}> {m.replyTo && ( <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#f3f3f3", color: isDark ? "#ddd" : "#333", fontSize: 12, maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}> <div style={{ fontWeight: 700, marginBottom: 4 }}> {m.replyTo.senderId === myUid ? "You" : "Them"} </div> <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}> {m.replyTo.text} </div> </div> )} {renderContent()} {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}>· edited</div>} {m.reactions && Object.keys(m.reactions).length > 0 && ( <div style={{ position: "absolute", bottom: -14, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}> {Object.values(m.reactions).slice(0, 4).join(" ")} </div> )} <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}> <div style={{ marginLeft: "auto" }}> {fmtTime(m.createdAt)} {renderStatus()} </div> </div> {m.status === "uploading" && uploadingIds[m.id] !== undefined && ( <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}> <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", color: "#333", fontSize: 12 }}> {uploadingIds[m.id]}% </div> </div> )} </div> {/* Action Buttons */} <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", gap: 6 }}> <button onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>😊</button> <button onClick={() => setMenuOpenFor(m.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>⋯</button> </div> {/* Inline Menu */} {menuOpenFor === m.id && ( <div style={{ position: "absolute", transform: "translate(-50px, -100%)", zIndex: 999, right: mine ? 20 : "auto", left: mine ? "auto" : 80 }}> <div style={{ background: isDark ? "#111" : "#fff", padding: 8, borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}> <div style={{ display: "flex", flexDirection: "column", gap: 6 }}> <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button> <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button> {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>} <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button> <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button> <button onClick={() => { if (window.confirm("Delete for everyone?")) deleteMessageForEveryone(m.id); else deleteMessageForMe(m.id); }} style={menuBtnStyle}>Delete</button> <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button> <button onClick={() => setMenuOpenFor(null)} style={menuBtnStyle}>Close</button> </div> </div> </div> )} {reactionFor === m.id && ( <div style={{ position: "absolute", top: "calc(100% - 12px)", transform: "translateY(6px)", zIndex: 998 }}> <div style={{ display: "flex", gap: 8, padding: 8, borderRadius: 20, background: isDark ? "#111" : "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.08)", alignItems: "center" }}> {INLINE_REACTIONS.map(r => ( <button key={r} onClick={() => applyReaction(m.id, r)} style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer" }}>{r}</button> ))} <button onClick={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>＋</button> </div> </div> )} </div> ); 
};
// Group messages by day
const groupedMessages = (() => {
const out = [];
let lastDay = null;
messages.forEach(m => {
const lbl = dayLabel(m.createdAt || new Date());
if (lbl !== lastDay) {
out.push({ type: "day", label: lbl, id: day-${lbl}-${Math.random().toString(36).slice(2)} });
lastDay = lbl;
}
out.push(m);
});
return out;
})();
// Header menu style
const menuBtnStyle = {
padding: "8px 10px",
borderRadius: 8,
border: "none",
background: "transparent",
cursor: "pointer",
textAlign: "left",
width: "100%"
};
// Render
return (
<div style={{
minHeight: "100vh",
display: "flex",
flexDirection: "column",
background: wallpaper
? url(${wallpaper}) center/cover no-repeat
: (isDark ? "#070707" : "#f5f5f5"),
color: isDark ? "#fff" : "#000"
}}>
{/* Header /}
<header style={{
position: "sticky",
top: 0,
zIndex: 90,
display: "flex",
alignItems: "center",
gap: 12,
padding: 12,
background: "#1877F2",
color: "#fff",
borderBottom: "1px solid rgba(0,0,0,0.06)"
}}>
<button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>←
<img src={friendInfo?.photoURL || chatInfo?.photoURL || "/default-avatar.png"} alt="avatar" onClick={() => friendInfo && navigate(/user-profile/${friendInfo.id})} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} />
<div onClick={() => friendInfo && navigate(/user-profile/${friendInfo.id})} style={{ minWidth: 0, cursor: "pointer", flex: 1 }}>
<div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{friendInfo?.displayName || chatInfo?.name || "Chat"}

<div style={{ fontSize: 12, opacity: 0.9 }}>
{friendInfo?.isOnline
? "Online"
: friendInfo?.lastSeen
? (() => {
const ls = friendInfo.lastSeen;
const d = ls.toDate ? ls.toDate() : new Date(ls);
const now = new Date();
const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
if (d.toDateString() === now.toDateString()) return Today ${timeStr};
if (d.toDateString() === yesterday.toDateString()) return Yesterday ${timeStr};
const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
return ${dateStr} ${timeStr};
})()
: "Offline"
}


<button onClick={() => navigate(/voice-call/${chatId})} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>📞
<button onClick={() => navigate(/video-call/${chatId})} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>🎥
<div style={{ position: "relative" }}>
<button onClick={() => setHeaderMenuOpen(s => !s)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>⋮
{headerMenuOpen && (
<div style={{
position: "absolute",
right: 0,
top: 36,
background: isDark ? "#111" : "#fff",
color: isDark ? "#fff" : "#000",
padding: 8,
borderRadius: 10,
boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
minWidth: 160,
zIndex: 999
}}>
<button onClick={() => { setHeaderMenuOpen(false); navigate(/user-profile/${friendInfo?.id}); }} style={menuBtnStyle}>👤 View Profile
<button onClick={() => { clearChat(); }} style={menuBtnStyle}>🗑️ Clear Chat
<button onClick={() => { toggleBlock(); }} style={menuBtnStyle}>{(chatInfo?.blockedBy || []).includes(myUid) ? "🔓 Unblock" : "🔒 Block"}
<button onClick={() => { alert("Reported"); setHeaderMenuOpen(false); }} style={menuBtnStyle}>🚩 Report
<button onClick={() => { setHeaderMenuOpen(false); navigate(/voice-call/${chatId}); }} style={menuBtnStyle}>📞 Voice Call
<button onClick={() => { setHeaderMenuOpen(false); navigate(/video-call/${chatId}); }} style={menuBtnStyle}>🎥 Video Call
{/ You can implement mute, search, export if you want */}

)}

{/* Messages */} <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}> {loadingMsgs && <div style={{ textAlign: "center", marginTop: 24 }}>Loading messages…</div>} {groupedMessages.map(item => ( item.type === "day" ? ( <div key={item.id} style={{ textAlign: "center", margin: "12px 0", color: isDark ? "#aaa" : "#555", fontSize: 12 }}> {item.label} </div> ) : ( <MessageBubble key={item.id} m={item} /> ) ))} <div ref={endRef} /> </main> {/* Reply Preview (Pinned) */} {replyTo && ( <div style={{ position: "sticky", bottom: 84, left: 12, right: 12, display: "flex", justifyContent: "space-between", background: isDark ? "#101010" : "#fff", padding: 8, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 90 }}> <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden" }}> <div style={{ width: 4, height: 40, background: "#34B7F1", borderRadius: 4 }} /> <div style={{ maxWidth: "85%" }}> <div style={{ fontSize: 12, color: "#888" }}> {replyTo.senderId === myUid ? "You" : "Them"} </div> <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}> {replyTo.text || (replyTo.mediaType || "media")} </div> </div> </div> <div style={{ display: "flex", gap: 8 }}> <button onClick={() => { const el = document.getElementById(`msg-${replyTo.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); setReplyTo(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>Go</button> <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button> </div> </div> )} {/* File / Media Previews Strip */} {previews.length > 0 && ( <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", background: isDark ? "#0b0b0b" : "#fff", borderTop: `1px solid ${isDark ? "#333" : "#ccc"}` }}> {previews.map((p, idx) => ( <div key={idx} style={{ position: "relative", borderRadius: 8, border: idx === selectedPreviewIndex ? "2px solid #34B7F1" : "none" }}> {p.url && p.type === "image" && ( <img onClick={() => setSelectedPreviewIndex(idx)} src={p.url} alt={p.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> )} {p.url && p.type === "video" && ( <video onClick={() => setSelectedPreviewIndex(idx)} src={p.url} style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 8 }} /> )} {!p.url && ( <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", borderRadius: 8, padding: 6 }}> {p.name} </div> )} <button onClick={() => { setSelectedFiles(sf => sf.filter((_, i) => i !== idx)); setPreviews(ps => { const copy = ps.filter((_, i) => i !== idx); setSelectedPreviewIndex(prev => Math.max(0, Math.min(prev, copy.length - 1))); return copy; }); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>×</button> </div> ))} </div> )} {/* Input / Record Area */} <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`, display: "flex", alignItems: "center", gap: 8, zIndex: 90 }}> <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}> 📎 <input type="file" multiple style={{ display: "none" }} onChange={onFilesSelected} /> </label> <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTextMessage(); } }} style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#111" : "#f5f5f5", color: isDark ? "#fff" : "#000", outline: "none" }} /> <button onMouseDown={e => { if (!text.trim() && previews.length === 0) holdStart(e); }} onMouseUp={e => { if (!text.trim() && previews.length === 0) holdEnd(e); else if (text.trim() || previews.length > 0) sendTextMessage(); }} onTouchStart={e => { if (!text.trim() && previews.length === 0) holdStart(e); }} onTouchEnd={e => { if (!text.trim() && previews.length === 0) holdEnd(e); else if (text.trim() || previews.length > 0) sendTextMessage(); }} style={{ padding: 10, borderRadius: 12, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }} title={(!text.trim() && previews.length === 0) ? (recording ? "Recording… release to stop" : "Hold to record") : "Send"} > {(!text.trim() && previews.length === 0) ? (recording ? "● Recording" : "🎤") : "➤"} </button> </div> {/* Emoji Picker for reactions */} {showEmojiPicker && ( <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999 }}> <div style={{ width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto" }}> <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8 }}> {EXTENDED_EMOJIS.map(e => ( <button key={e} onClick={() => { applyReaction(emojiPickerFor, e); setShowEmojiPicker(false); }} style={{ padding: 10, fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}> {e} </button> ))} </div> <div style={{ textAlign: "right", marginTop: 8 }}> <button onClick={() => setShowEmojiPicker(false)} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd", cursor: "pointer" }}> Close </button> </div> </div> </div> )} </div> 
);
}

















































































































































































































































