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
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];
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
  reactionBg: "#111"
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
  const uploadToCloudinary = (file, onProgress) => new Promise((resolve, reject) => {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary env not set"));
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", e => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded * 100) / e.total)); });
      xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).secure_url); else reject(new Error("Cloudinary upload failed")); };
      xhr.onerror = () => reject(new Error("Network error"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      xhr.send(fd);
    } catch (err) { reject(err); }
  });

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
        unsubChat = onSnapshot(doc(db, "chats", chatId), s => { if (s.exists()) setChatInfo(prev => ({ ...(prev||{}), ...s.data() })); });
      } catch (e) { console.error(e); }
    };
    loadMeta();
    return () => { if (unsubChat) unsubChat(); };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      docs.forEach(async m => { if (m.senderId !== myUid && m.status === "sent") await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); });
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => { setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  // -------------------- Mark seen --------------------
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].reverse().find(m => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [messages, chatId, myUid]);

  // -------------------- File select & preview --------------------
  const onFilesSelected = e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map(f => ({
      url: f.type.startsWith("image/") || f.type.startsWith("video/") ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f
    }));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setSelectedPreviewIndex(prev => prev >= 0 ? prev : 0);
  };

  // -------------------- Send message --------------------
  const sendTextMessage = async () => {
    if ((chatInfo?.blockedBy || []).includes(myUid)) return alert("You are blocked in this chat.");
    
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: detectFileType(file), fileName: file.name, createdAt: serverTimestamp(), status: "uploading", reactions: {} };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c={...prev}; delete c[messageId]; return c; }), 200);
        } catch (err) { console.error("upload error:", err); }
      }
      return;
    }

    if (text.trim()) {
      try {
        const payload = { senderId: myUid, text: text.trim(), mediaUrl: "", mediaType: null, createdAt: serverTimestamp(), status: "sent", reactions: {} };
        if (replyTo) { payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId }; setReplyTo(null); }
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText("");
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      } catch (e) { console.error(e); alert("Failed to send"); }
    }
  };

  // -------------------- Recording --------------------
  useEffect(() => setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)), []);
  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = ev => { if (ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: "audio", createdAt: serverTimestamp(), status: "uploading", reactions: {} };
        try {
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(blob, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c={...prev}; delete c[messageId]; return c; }), 200);
        } catch (err) { console.error("voice upload failed", err); }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) { console.error(err); alert("Could not start recording"); }
  };
  const stopRecording = () => { try { recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach(t=>t.stop()); } catch(e){} setRecording(false); };
  const holdStart = e => { e.preventDefault(); longPressTimer.current = setTimeout(() => startRecording(), 250); };
  const holdEnd = e => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); };

  // -------------------- Message actions --------------------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing===emoji?null:emoji });
      setReactionFor(null);
    } catch(e){console.error(e);}
  };
  const copyMessageText = async m => { try { await navigator.clipboard.writeText(m.text||m.mediaUrl||""); alert("Copied"); setMenuOpenFor(null); } catch(e){alert("Copy failed");} };
  const editMessage = async m => { if (m.senderId!==myUid) return alert("You can only edit your messages."); const newText=window.prompt("Edit message", m.text||""); if(newText==null) return; await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text:newText, edited:true }); setMenuOpenFor(null); };
  const deleteMessageForEveryone = async id => { if(!confirm("Delete for everyone?")) return; await deleteDoc(doc(db, "chats", chatId, "messages", id)); setMenuOpenFor(null); };
  const deleteMessageForMe = async id => { await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) }); setMenuOpenFor(null); };
  const forwardMessage = m => navigate(`/forward/${m.id}`, { state: { message: m }});
  const pinMessage = async m => { await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType||"") }); setMenuOpenFor(null); alert("Pinned"); };
  const replyToMessage = m => { setReplyTo(m); setMenuOpenFor(null); };

  // -------------------- Touch handlers --------------------
  const handleMsgTouchStart = m => { longPressTimer.current = setTimeout(() => setMenuOpenFor(m.id), 500); swipeStartX.current=null; };
  const handleMsgTouchMove = ev => { if(!swipeStartX.current && ev.touches?.[0]) swipeStartX.current=ev.touches[0].clientX; };
  const handleMsgTouchEnd = (m, ev) => { clearTimeout(longPressTimer.current); if(!swipeStartX.current) return; const endX=ev.changedTouches?.[0]?.clientX; if(endX==null) return; if(swipeStartX.current - endX > 80) replyToMessage(m); swipeStartX.current=null; };

  // -------------------- Header actions --------------------
  const clearChat = async () => { if(!confirm("Clear chat?")) return; const snap=await getDocs(query(collection(db,"chats",chatId,"messages"),orderBy("createdAt","asc"))); for(const d of snap.docs) try{await deleteDoc(d.ref);}catch(e){} setHeaderMenuOpen(false); alert("Chat cleared."); };
  const toggleBlock = async () => {
    if (!chatInfo) return;
    const chatRef = doc(db, "chats", chatId);
    const blockedBy = chatInfo.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
      alert("You unblocked this chat.");
    } else {
      await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
      alert("You blocked this chat.");
    }
    setHeaderMenuOpen(false);
  };

  // -------------------- Render --------------------
  return (
    <div className="flex flex-col h-full w-full" style={{ background: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg) }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 sticky top-0 z-50" style={{ backgroundColor: COLORS.headerBlue, color: COLORS.darkText, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <div className="flex items-center gap-3">
          <img src={friendInfo?.avatar || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full object-cover"/>
          <div>
            <div className="font-semibold">{friendInfo?.name || "Chat"}</div>
            <div className="text-xs text-gray-200">{chatInfo?.pinnedMessageText ? `📌 ${chatInfo.pinnedMessageText}` : friendInfo?.lastSeen ? `Last seen: ${fmtTime(friendInfo.lastSeen)}` : "Online"}</div>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setHeaderMenuOpen(prev => !prev)} style={menuBtnStyle}>⋮</button>
          {headerMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-darkCard border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50">
              <button style={menuBtnStyle} onClick={clearChat}>Clear Chat</button>
              <button style={menuBtnStyle} onClick={toggleBlock}>{(chatInfo?.blockedBy||[]).includes(myUid) ? "Unblock" : "Block"}</button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRefEl} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, idx) => {
          const isMe = m.senderId === myUid;
          const daySep = idx === 0 || dayLabel(messages[idx-1]?.createdAt) !== dayLabel(m.createdAt);
          return (
            <React.Fragment key={m.id}>
              {daySep && <div className="text-center text-gray-400 my-2">{dayLabel(m.createdAt)}</div>}
              <div
                onTouchStart={() => handleMsgTouchStart(m)}
                onTouchMove={handleMsgTouchMove}
                onTouchEnd={(ev) => handleMsgTouchEnd(m, ev)}
                className={`max-w-[70%] p-2 rounded-lg ${isMe ? "ml-auto bg-blue-500 text-white" : "bg-gray-200 dark:bg-darkCard text-black"} relative`}
              >
                {m.replyTo && <div className="border-l-2 border-blue-300 pl-2 mb-1 text-xs opacity-70">{m.replyTo.text || "Media"}</div>}
                {m.text && <div>{m.text} {m.edited && <span className="text-[10px] text-gray-400">(edited)</span>}</div>}
                {m.mediaUrl && m.mediaType === "image" && <img src={m.mediaUrl} alt="" className="rounded max-h-48 object-cover"/>}
                {m.mediaUrl && m.mediaType === "video" && <video src={m.mediaUrl} controls className="rounded max-h-48"/>}
                {m.mediaUrl && m.mediaType === "audio" && <audio src={m.mediaUrl} controls className="w-full"/>}
                <div className="flex justify-between text-[10px] mt-1">
                  <span>{fmtTime(m.createdAt)}</span>
                  <span>{isMe && m.status}</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {INLINE_REACTIONS.map(r => (
                    <button key={r} onClick={() => applyReaction(m.id, r)} className={`text-xs ${Object.values(m.reactions||{}).includes(r) ? "font-bold" : ""}`}>{r}</button>
                  ))}
                </div>
              </div>

              {/* Message menu */}
              {menuOpenFor === m.id && (
                <div className="absolute bg-white dark:bg-darkCard border border-gray-300 dark:border-gray-700 rounded shadow p-2 z-50">
                  <button style={menuBtnStyle} onClick={() => replyToMessage(m)}>Reply</button>
                  <button style={menuBtnStyle} onClick={() => copyMessageText(m)}>Copy</button>
                  <button style={menuBtnStyle} onClick={() => editMessage(m)}>Edit</button>
                  <button style={menuBtnStyle} onClick={() => deleteMessageForMe(m.id)}>Delete for me</button>
                  {isMe && <button style={menuBtnStyle} onClick={() => deleteMessageForEveryone(m.id)}>Delete for everyone</button>}
                  <button style={menuBtnStyle} onClick={() => pinMessage(m)}>Pin</button>
                  <button style={menuBtnStyle} onClick={() => setMenuOpenFor(null)}>Cancel</button>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="p-2 bg-gray-300 dark:bg-gray-700 flex justify-between items-center">
          <div className="text-sm truncate">{replyTo.text || replyTo.mediaType}</div>
          <button onClick={() => setReplyTo(null)}>✖</button>
        </div>
      )}

      {/* Composer */}
      <div className="p-2 flex items-center gap-2 bg-gray-100 dark:bg-darkCard sticky bottom-0">
        <input
          type="text"
          placeholder="Type a message"
          className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-darkCard"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <input type="file" multiple onChange={onFilesSelected} className="hidden" id="mediaInput"/>
        <label htmlFor="mediaInput" className="cursor-pointer">📎</label>
        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
          className="px-3 py-2 rounded-full bg-blue-500 text-white"
        >
          {recording ? "🎤..." : "Send"}
        </button>
        <button onClick={sendTextMessage} className="px-3 py-2 rounded-full bg-green-500 text-white">➡️</button>
      </div>
    </div>
  );
}