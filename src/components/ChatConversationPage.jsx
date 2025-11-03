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
deleteField,
} from "firebase/firestore";
import {
ref as storageRef,
uploadBytesResumable,
getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
/**
• ChatConversationPage.jsx
• Full chat view with uploads/downloads and now:
• Long-press to open WhatsApp-style reaction bar (6 emojis + +)
• Reaction stored in Firestore under reactions.{uid}
• Action row on long-press: Copy, Edit (mine), Delete, Reply, Forward, Pin, Close
• Multi-select: repeated long-press toggles message selection; top bar shows count + quick actions
*/
// ---------- helpers ----------
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
const DEFAULT_REACTIONS = ["❤️","😂","😮","😢","👍","👎"];
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅"];
// ---------- component ----------
export default function ChatConversationPage() {
const { chatId } = useParams();
const navigate = useNavigate();
const { theme, wallpaper } = useContext(ThemeContext);
const isDark = theme === "dark";
const [chatInfo, setChatInfo] = useState(null);
const [friendInfo, setFriendInfo] = useState(null);
const [messages, setMessages] = useState([]);
const [limitCount, setLimitCount] = useState(50);
// UI states
const [selectedFiles, setSelectedFiles] = useState([]);
const [previews, setPreviews] = useState([]);
const [localUploads, setLocalUploads] = useState([]);
const [downloadMap, setDownloadMap] = useState({});
const [text, setText] = useState("");
const [showAttach, setShowAttach] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [replyTo, setReplyTo] = useState(null);
const [blocked, setBlocked] = useState(false);
const [friendTyping, setFriendTyping] = useState(false);
const [reportOpen, setReportOpen] = useState(false);
const [reportText, setReportText] = useState("");
const [selectedMessageId, setSelectedMessageId] = useState(null); // single-message UI anchor
const [selectedMessageIds, setSelectedMessageIds] = useState([]); // multi-select array
const [reactionFor, setReactionFor] = useState(null); // message id that shows reaction bar
const [showEmojiPicker, setShowEmojiPicker] = useState(false);
const [emojiPickerFor, setEmojiPickerFor] = useState(null);
const messagesRef = useRef(null);
const endRef = useRef(null);
const myUid = auth.currentUser?.uid;
const [isAtBottom, setIsAtBottom] = useState(true);
// ---------- load chat + friend ----------
useEffect(() => {
if (!chatId) return;
const chatRef = doc(db, "chats", chatId);
let unsubFriend = null;
let unsubChat = null;
(async () => { const snap = await getDoc(chatRef); if (!snap.exists()) { alert("Chat not found"); navigate("/chat"); return; } const data = snap.data(); setChatInfo({ id: snap.id, ...data }); setBlocked(Boolean(data?.blockedBy?.includes(myUid))); const friendId = data.participants?.find(p => p !== myUid); if (friendId) { const friendRef = doc(db, "users", friendId); unsubFriend = onSnapshot(friendRef, fsnap => { if (fsnap.exists()) { setFriendInfo({ id: fsnap.id, ...fsnap.data() }); setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId])); } }); } unsubChat = onSnapshot(chatRef, cSnap => { if (cSnap.exists()) { setChatInfo(prev => ({ ...(prev || {}), ...cSnap.data() })); setBlocked(Boolean(cSnap.data()?.blockedBy?.includes(myUid))); } }); })(); return () => { unsubFriend && unsubFriend(); unsubChat && unsubChat(); }; 
}, [chatId, myUid, navigate]);
// ---------- messages realtime (paginated) ----------
useEffect(() => {
if (!chatId) return;
const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), fsLimit(limitCount));
const unsub = onSnapshot(q, snap => {
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
setMessages(docs);
// mark delivered for incoming messages if needed docs.forEach(m => { if (m.sender !== myUid && m.status === "sent") { const mRef = doc(db, "chats", chatId, "messages", m.id); updateDoc(mRef, { status: "delivered" }).catch(()=>{}); } }); // for any message that has fileURL but not downloaded locally, start the auto-download docs.forEach(m => { if ((m.type === "image" || m.type === "file" || m.type === "audio") && m.fileURL) { // if not present in downloadMap, start download setDownloadMap(prev => { if (prev[m.id] && (prev[m.id].status === "done" || prev[m.id].status === "downloading")) return prev; return { ...prev, [m.id]: { status: "queued", progress: 0, blobUrl: null } }; }); } }); // scroll to bottom on initial load setTimeout(()=> { endRef.current?.scrollIntoView({ behavior: "auto" }); setIsAtBottom(true); }, 50); }); return () => unsub(); 
}, [chatId, limitCount, myUid]);
// ---------- watch downloadMap to start downloads ----------
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
// ---------- ATTACHMENTS & UPLOAD FLOW ----------
const onFilesSelected = (e) => {
const files = Array.from(e.target.files || []);
if (!files.length) return;
// create local preview URLs
const newPreviews = files.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
setSelectedFiles(prev => [...prev, ...files]);
setPreviews(prev => [...prev, ...newPreviews]);
};
const sendQueuedFiles = async () => {
if (!selectedFiles.length) return;
const filesToSend = [...selectedFiles];
setSelectedFiles([]); setPreviews([]);
for (const file of filesToSend) { try { const placeholder = { sender: myUid, text: "", fileURL: null, fileName: file.name, type: file.type.startsWith("image/") ? "image" : (file.type.startsWith("audio/") ? "audio" : "file"), createdAt: serverTimestamp(), status: "uploading", }; const docRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder); setLocalUploads(prev => [...prev, { id: docRef.id, fileName: file.name, progress: 0, type: placeholder.type, previewUrl: URL.createObjectURL(file) }]); const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`); const task = uploadBytesResumable(sRef, file); task.on("state_changed", (snap) => { const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100); setLocalUploads(prev => prev.map(l => l.id === docRef.id ? { ...l, progress: pct } : l)); }, (err) => { console.error("upload error", err); updateDoc(docRef, { status: "failed" }).catch(()=>{}); setLocalUploads(prev => prev.map(l => l.id === docRef.id ? { ...l, status: "failed" } : l)); }, async () => { const url = await getDownloadURL(task.snapshot.ref); await updateDoc(docRef, { fileURL: url, status: "sent", sentAt: serverTimestamp() }).catch(()=>{}); setLocalUploads(prev => prev.filter(l => l.id !== docRef.id)); setTimeout(()=>scrollToBottom(true), 120); } ); } catch (err) { console.error("send queued file failed", err); } } 
};
// ---------- RECEIVER: download ----------
const startDownloadForMessage = async (messageId) => {
try {
const mRef = doc(db, "chats", chatId, "messages", messageId);
const mSnap = await getDoc(mRef);
if (!mSnap.exists()) {
setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "failed" } }));
return;
}
const m = { id: mSnap.id, ...mSnap.data() };
if (!m.fileURL) {
setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "done", progress: 100, blobUrl: null } }));
return;
}
const resp = await fetch(m.fileURL); if (!resp.ok) throw new Error("Download failed: " + resp.status); const contentLength = resp.headers.get("Content-Length"); const total = contentLength ? parseInt(contentLength, 10) : null; const reader = resp.body.getReader(); const chunks = []; let received = 0; while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); received += value.length; if (total) { const pct = Math.round((received / total) * 100); setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "downloading", progress: pct } })); } else { setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "downloading", progress: Math.min(99, (prev[messageId]?.progress||0) + 5) } })); } } const blob = new Blob(chunks); const blobUrl = URL.createObjectURL(blob); setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "done", progress: 100, blobUrl } })); } catch (err) { console.error("download failed", err); setDownloadMap(prev => ({ ...prev, [messageId]: { ...prev[messageId], status: "failed", progress: 0 } })); setTimeout(() => setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "queued" } })), 10000); } 
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
if (!text.trim()) return;
if (blocked) { alert("You blocked this user — unblock to send."); return; }
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
payload.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0, 120) || (replyTo.fileName || "media"), sender: replyTo.sender };
setReplyTo(null);
}
setText("");
try {
await addDoc(collection(db, "chats", chatId, "messages"), payload);
setTimeout(() => scrollToBottom(true), 150);
} catch (err) {
console.error("send text failed", err);
alert("Failed to send message");
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
// clear selection if necessary
setSelectedMessageIds(prev => prev.filter(id => id !== messageId));
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
// ---------- reactions stored in Firestore ----------
const applyReaction = async (messageId, emoji) => {
try {
const mRef = doc(db, "chats", chatId, "messages", messageId);
const snap = await getDoc(mRef);
if (!snap.exists()) return;
const cur = snap.data() || {};
const existing = cur?.reactions?.[myUid];
if (existing === emoji) { // remove reaction await updateDoc(mRef, { [`reactions.${myUid}`]: deleteField() }); } else { // set reaction await updateDoc(mRef, { [`reactions.${myUid}`]: emoji }); } // close reaction UI for this message setReactionFor(null); setSelectedMessageId(null); } catch (err) { console.error("reaction", err); } 
};
// ---------- message action helpers ----------
const copyMessageText = async (m) => {
try {
const txt = m.type === "text" ? (m.text || "") : (m.fileName || "");
await navigator.clipboard.writeText(txt);
alert("Copied to clipboard");
// close UI
setReactionFor(null);
} catch (err) {
console.error("copy failed", err);
alert("Copy failed");
}
};
const editMessage = async (m) => {
if (m.sender !== myUid) return alert("You can only edit your messages.");
const newText = window.prompt("Edit message", m.text || "");
if (newText == null) return;
try {
const mRef = doc(db, "chats", chatId, "messages", m.id);
await updateDoc(mRef, { text: newText, edited: true });
setReactionFor(null);
} catch (err) {
console.error("edit failed", err);
alert("Edit failed");
}
};
const replyToMessage = (m) => {
setReplyTo(m);
setSelectedMessageId(null);
setReactionFor(null);
};
const forwardMessage = (m) => {
// placeholder: navigate to a Forward screen; you should implement actual forward flow
navigate(/forward/${m.id}, { state: { message: m } });
setReactionFor(null);
setSelectedMessageId(null);
};
const pinMessage = async (m) => {
try {
const chatRef = doc(db, "chats", chatId);
await updateDoc(chatRef, { pinnedMessageId: m.id, pinnedMessageText: m.text || m.fileName || "" });
alert("Message pinned");
setReactionFor(null);
setSelectedMessageId(null);
} catch (err) {
console.error("pin failed", err);
alert("Pin failed");
}
};
// ---------- selection helpers ----------
const toggleSelectMessage = (id) => {
setSelectedMessageIds(prev => {
if (prev.includes(id)) return prev.filter(x => x !== id);
return [...prev, id];
});
};
const clearSelection = () => {
setSelectedMessageIds([]);
setSelectedMessageId(null);
};
// ---------- helper UI renderers ----------
const MessageBubble = ({ m }) => {
const mine = m.sender === myUid;
const replySnippet = m.replyTo ? (m.replyTo.text || (m.replyTo.fileName || "media")) : null;
const displayUrl = getDisplayUrlForMessage(m);
const downloadInfo = downloadMap[m.id];
const selected = selectedMessageIds.includes(m.id);
// long-press detection const longPressRef = useRef(null); const onPointerDown = (e) => { e.preventDefault && e.preventDefault(); longPressRef.current = setTimeout(() => { // if nothing selected, set single selection and open actions // toggle selection if already selected -> multi-select behavior toggleSelectMessage(m.id); setSelectedMessageId(m.id); setReactionFor(m.id); // show reactions/action row }, 450); }; const onPointerUp = (e) => { clearTimeout(longPressRef.current); }; const onPointerCancel = () => clearTimeout(longPressRef.current); return ( <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, paddingLeft: 6, paddingRight: 6 }}> <div onMouseDown={onPointerDown} onMouseUp={onPointerUp} onMouseLeave={onPointerCancel} onTouchStart={onPointerDown} onTouchEnd={onPointerUp} onTouchCancel={onPointerCancel} style={{ background: selected ? (isDark ? "#264653" : "#e6f0ff") : (mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#222" : "#eee")), color: mine ? "#fff" : (isDark ? "#fff" : "#000"), padding: "10px 12px", borderRadius: 14, maxWidth: "78%", wordBreak: "break-word", position: "relative", border: selected ? `2px solid ${isDark ? "#9ad3ff" : "#34B7F1"}` : "none", cursor: "pointer" }} > {/* reply preview */} {replySnippet && ( <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#fff", color: isDark ? "#ddd" : "#333", fontSize: 12 }}> <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{replySnippet}</span> </div> )} {/* content */} {m.type === "text" && <div>{m.text}{m.edited ? " · edited" : ""}</div>} {["image", "file", "audio", "video"].includes(m.type) && ( <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}> {m.type === "image" ? ( <img src={displayUrl || m.fileURL || (m.previewUrl || "")} alt={m.fileName || "image"} style={{ width: 220, height: "auto", borderRadius: 8, filter: (downloadInfo && downloadInfo.status === "downloading") || (m.status === "uploading") ? "blur(6px)" : "none", transition: "filter .2s" }} /> ) : m.type === "video" ? ( <video controls src={displayUrl || m.fileURL} style={{ width: 220, borderRadius: 8 }} /> ) : m.type === "audio" ? ( <audio controls src={displayUrl || m.fileURL} style={{ width: 220 }} /> ) : ( <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, background: mine ? "rgba(255,255,255,0.06)" : "#fff" }}> <div style={{ width: 40, height: 40, borderRadius: 6, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>📎</div> <div style={{ maxWidth: 180 }}> <div style={{ fontWeight: 600 }}>{m.fileName || "file"}</div> <div style={{ fontSize: 12, color: "#666" }}>{m.type}</div> {m.fileURL && <a href={displayUrl || m.fileURL} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6, color: isDark ? "#9ad3ff" : "#007bff" }}>Open</a>} </div> </div> )} {(m.status === "uploading" || (downloadInfo && (downloadInfo.status === "downloading" || downloadInfo.status === "queued"))) && ( <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}> <Spinner percent={m.status === "uploading" ? (() => { const u = localUploads.find(x => x.id === m.id); return u ? u.progress : 0; })() : (downloadInfo ? downloadInfo.progress : 0)} /> </div> )} {downloadInfo && downloadInfo.status === "failed" && ( <div style={{ marginLeft: 8 }}> <button onClick={() => setDownloadMap(prev => ({ ...prev, [m.id]: { ...(prev[m.id]||{}), status: "queued", progress: 0 } }))} style={{ padding: "6px 8px", borderRadius: 8, border: "none", background: "#ffcc00", cursor: "pointer" }}>Retry</button> </div> )} </div> )} {/* timestamp / status */} <div style={{ fontSize: 11, textAlign: "right", marginTop: 6, opacity: 0.9 }}> <span>{fmtTime(m.createdAt)}</span> {mine && <span style={{ marginLeft: 8 }}>{m.status === "uploading" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}</span>} </div> {/* small reactions preview */} {m.reactions && Object.keys(m.reactions).length > 0 && ( <div style={{ position: "absolute", bottom: -18, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.12)" }}> {Object.values(m.reactions).slice(0, 3).join(" ")} </div> )} </div> {/* reaction/action overlay for this message */} {reactionFor === m.id && ( <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginTop: 6 }}> <div style={{ position: "absolute", top: -60, transform: "translateY(-100%)", left: mine ? "auto" : 0, right: mine ? 0 : "auto", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}> {/* reaction bar */} <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 20, background: isDark ? "#111" : "#fff", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}> {DEFAULT_REACTIONS.map(r => ( <button key={r} onClick={() => applyReaction(m.id, r)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer" }}>{r}</button> ))} <button onClick={() => { setShowEmojiPicker(true); setEmojiPickerFor(m.id); }} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>＋</button> </div> {/* action row */} <div style={{ display: "flex", gap: 8, marginTop: 8, background: isDark ? "#111" : "#fff", padding: 6, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}> <button title="Copy" onClick={() => copyMessageText(m)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>📋</button> {mine && <button title="Edit" onClick={() => editMessage(m)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✏️</button>} <button title="Delete" onClick={() => deleteMessage(m.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>🗑️</button> <button title="Reply" onClick={() => replyToMessage(m)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>💬</button> <button title="Forward" onClick={() => forwardMessage(m)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>📤</button> <button title="Pin" onClick={() => pinMessage(m)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>📌</button> <button title="Close" onClick={() => { setReactionFor(null); setSelectedMessageId(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✖</button> </div> </div> </div> )} </div> ); 
};
// ---------- merge + group by day ----------
const merged = [...messages];
const grouped = [];
let lastDay = null;
merged.forEach(m => {
const label = dayLabel(m.createdAt || new Date());
if (label !== lastDay) { grouped.push({ type: "day", label, id: day-${label}-${Math.random().toString(36).slice(2,6)} }); lastDay = label; }
grouped.push(m);
});
// ---------- spinner ----------
function Spinner({ percent = 0 }) {
return (
<div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
<svg viewBox="0 0 36 36" style={{ width: 36, height: 36 }}>

<path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#34B7F1" strokeWidth="2" strokeDasharray={${percent},100} strokeLinecap="round" />

<div style={{ position: "absolute", fontSize: 10, color: "#fff", fontWeight: 700 }}>{percent}%

);
}
// ---------- Emoji picker (simple built-in) ----------
const AllEmojiPicker = ({ onPick, onClose }) => {
// Small curated set to avoid massive list — replace with full picker if desired
const more = ["😀","😃","😄","😁","😆","😅","🤣","😊","🙂","🙃","😉","😍","🤩","😘","😎","🤔","🤨","😐","🤗","😇","🤯","😴","🤤","😪","🤒","🤕","🤢","🤮","🤧","🥳","🥺","🤝","👏","🙌","👍","👎","👊","✊","✌️","🤞","🤟","🤘","👋","👌","🙏","💪","🫶"];
return (
<div style={{ position: "fixed", left: 0, right: 0, bottom: 0, top: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
<div style={{ background: isDark ? "#222" : "#fff", padding: 12, borderRadius: 12, maxWidth: 540, width: "95%", boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
{more.map(e => <button key={e} onClick={() => { onPick(e); onClose(); }} style={{ fontSize: 22, padding: 8, borderRadius: 8, cursor: "pointer", border: "none", background: "transparent" }}>{e})}

<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
<button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#ddd" }}>Close



);
};
// ---------- top multi-select bar ----------
const MultiSelectBar = () => {
if (selectedMessageIds.length === 0) return null;
return (
<div style={{ position: "fixed", top: 10, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 400 }}>
<div style={{ background: isDark ? "#222" : "#fff", padding: 8, borderRadius: 10, display: "flex", gap: 10, alignItems: "center", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>
<div style={{ fontWeight: 700 }}>{selectedMessageIds.length} selected
<button onClick={() => { /* forward multiple */ navigate(/forward/multiple, { state: { ids: selectedMessageIds } }); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>📤 Forward
<button onClick={() => clearSelection()} style={{ border: "none", background: "transparent", cursor: "pointer" }}>❌ Clear


);
};
// ---------- UI ----------
return (
<div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? url(${wallpaper}) center/cover no-repeat : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
{/* Multi-select top bar */}
{/* header */} <div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid #ccc", position: "sticky", top: 0, background: isDark ? "#111" : "#fff", zIndex: 30 }}> <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", cursor: "pointer", marginRight: 10 }}>←</button> <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", marginRight: 12, cursor: "pointer" }} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} /> <div> <div style={{ fontWeight: 700 }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</div> <div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666" }}>{friendTyping ? "typing..." : (friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? (() => { const ls = friendInfo.lastSeen; if (!ls) return "Offline"; const ld = ls.toDate ? ls.toDate() : new Date(ls); const diffMin = Math.floor((Date.now() - ld.getTime()) / 60000); if (diffMin < 1) return "just now"; if (diffMin < 60) return `${diffMin}m ago`; if (diffMin < 1440) return ld.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); const yesterday = new Date(); yesterday.setDate(new Date().getDate() - 1); if (ld.toDateString() === yesterday.toDateString()) return `Yesterday`; return ld.toLocaleDateString(undefined, { month: "short", day: "numeric" }); })() : "Offline"))}</div> </div> <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}> <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>📞</button> <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>🎥</button> <div style={{ position: "relative" }}> <button onClick={() => setMenuOpen(s => !s)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>⋮</button> {menuOpen && ( <div style={{ position: "absolute", right: 0, top: 28, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 50 }}> <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>View Profile</button> <button onClick={() => { clearChat(); setMenuOpen(false); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Clear Chat</button> <button onClick={toggleBlock} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>{blocked ? "Unblock" : "Block"}</button> <button onClick={() => { setReportOpen(true); setMenuOpen(false); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Report</button> </div> )} </div> </div> </div> {/* messages */} <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}> {grouped.map(g => { if (g.type === "day") return <div key={g.id} style={{ textAlign: "center", margin: "12px 0", color: "#888", fontSize: 12 }}>{g.label}</div>; return <MessageBubble key={g.id} m={g} />; })} {/* local uploads */} {localUploads.map(u => ( <div key={u.id} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}> <div style={{ background: isDark ? "#0b84ff" : "#007bff", color: "#fff", padding: 10, borderRadius: 14, maxWidth: "78%", position: "relative" }}> {u.type === "image" ? <img src={u.previewUrl} alt={u.fileName} style={{ width: 220, borderRadius: 8, filter: "blur(3px)" }} /> : <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div>📎</div><div>{u.fileName}</div></div>} <div style={{ marginTop: 8, fontSize: 11, textAlign: "right" }}> <span>⌛</span> <span style={{ marginLeft: 8 }}>{u.progress}%</span> </div> <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}> <Spinner percent={u.progress} /> </div> </div> </div> ))} <div ref={endRef} /> </div> {/* down arrow */} <button onClick={() => scrollToBottom(true)} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 120, zIndex: 60, background: "#007bff", color: "#fff", border: "none", borderRadius: 22, width: 48, height: 48, fontSize: 22, cursor: "pointer", opacity: isAtBottom ? 0 : 1, transition: "opacity 0.25s", }} title="Scroll to latest" aria-hidden={isAtBottom} > ↓ </button> {/* previews */} {previews.length > 0 && ( <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid #ddd", background: isDark ? "#0b0b0b" : "#fff" }}> {previews.map((p, idx) => ( <div key={idx} style={{ position: "relative" }}> {p ? <img src={p} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{selectedFiles[idx]?.name}</div>} <button onClick={() => { setSelectedFiles(s => s.filter((_,i) => i !== idx)); setPreviews(s => s.filter((_,i) => i !== idx)); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>✕</button> </div> ))} <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}> <button onClick={sendQueuedFiles} style={{ padding: "8px 12px", borderRadius: 8, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}>Send</button> <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#ddd", border: "none", cursor: "pointer" }}>Cancel</button> </div> </div> )} {/* pinned input */} <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid #ccc", display: "flex", alignItems: "center", gap: 8, zIndex: 50 }}> <div style={{ position: "relative" }}> <button onClick={() => setShowAttach(s => !s)} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20, background: "#f0f0f0", border: "none", cursor: "pointer" }}>＋</button> {showAttach && ( <div style={{ position: "absolute", bottom: 56, left: 0, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 10, padding: 8, display: "flex", gap: 8 }}> <label style={{ cursor: "pointer" }}> 📷 <input type="file" accept="image/*" multiple onChange={(e) => { onFilesSelected(e); setShowAttach(false); }} style={{ display: "none" }} /> </label> <label style={{ cursor: "pointer" }}> 📁 <input type="file" multiple onChange={(e) => { onFilesSelected(e); setShowAttach(false); }} style={{ display: "none" }} /> </label> <label style={{ cursor: "pointer" }}> 🎤 <input type="file" accept="audio/*" multiple onChange={(e) => { onFilesSelected(e); setShowAttach(false); }} style={{ display: "none" }} /> </label> </div> )} </div> <div style={{ flex: 1, display: "flex", flexDirection: "column" }}> {replyTo && ( <div style={{ padding: "6px 10px", borderRadius: 8, background: isDark ? "#111" : "#f0f0f0", marginBottom: 6 }}> <small style={{ color: "#888", display: "block" }}>{replyTo.sender === myUid ? "You" : ""}</small> <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyTo.text || replyTo.fileName || "media"}</div> <button onClick={() => setReplyTo(null)} style={{ marginTop: 6, background: "transparent", border: "none", color: "#888", cursor: "pointer" }}>Cancel</button> </div> )} <input type="text" placeholder={blocked ? "You blocked this user — unblock to send" : "Type a message..."} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }} disabled={blocked} style={{ padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#111" : "#fff", color: isDark ? "#fff" : "#000" }} /> </div> <button onClick={handleSendText} disabled={blocked || (!text.trim() && localUploads.length === 0 && selectedFiles.length === 0)} style={{ background: "#34B7F1", color: "#fff", border: "none", borderRadius: 16, padding: "8px 12px", cursor: "pointer" }}>Send</button> </div> {/* report modal */} {reportOpen && ( <div style={{ position: "fixed", right: 16, top: 80, zIndex: 120, width: 320 }}> <div style={{ background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, padding: 12 }}> <h4 style={{ margin: "0 0 8px 0" }}>Report user</h4> <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe the issue..." style={{ width: "100%", minHeight: 80, borderRadius: 6, padding: 8 }} /> <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}> <button onClick={() => setReportOpen(false)} style={{ padding: "8px 10px", borderRadius: 6, border: "none", background: "#ddd", cursor: "pointer" }}>Cancel</button> <button onClick={submitReport} style={{ padding: "8px 10px", borderRadius: 6, border: "none", background: "#ff4d4f", color: "#fff", cursor: "pointer" }}>Send</button> </div> </div> </div> )} {/* emoji picker modal */} {showEmojiPicker && emojiPickerFor && ( <AllEmojiPicker onPick={async (e) => { // apply chosen emoji to the correct message await applyReaction(emojiPickerFor, e); }} onClose={() => { setShowEmojiPicker(false); setEmojiPickerFor(null); }} /> )} </div> 
);
}
