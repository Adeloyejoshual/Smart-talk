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
  getDocs
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// ---------- Helpers ----------
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

const formatLastSeen = (ts) => {
  if (!ts) return "Offline";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000 / 60); // minutes
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff} minutes ago`;
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
};

const detectFileType = (file) => {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  return "file";
};

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  // ---------- Refs ----------
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const pinnedMessageRef = useRef(null);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  // ---------- State ----------
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessage, setPinnedMessage] = useState(null);
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

  // ---------- Cloudinary Upload ----------
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

  // ---------- Load Chat Info ----------
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
          // Friend info
          const friendId = data.participants?.find(p => p !== myUid);
          if (friendId) {
            const fRef = doc(db, "users", friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
          }
          // pinned message
          if (data.pinnedMessageId) {
            const pSnap = await getDoc(doc(db, "chats", chatId, "messages", data.pinnedMessageId));
            if (pSnap.exists()) setPinnedMessage({ id: pSnap.id, ...pSnap.data() });
          }
        }
        unsubChat = onSnapshot(cRef, s => {
          if (s.exists()) setChatInfo(prev => ({ ...(prev||{}), ...s.data() }));
        });
      } catch(e){ console.error(e); }
    };
    loadMeta();
    return () => unsubChat && unsubChat();
  }, [chatId, myUid]);

  // ---------- Messages Realtime ----------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(m => !(m.deletedFor?.includes(myUid)));
      setMessages(filtered);
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- Scroll Detection ----------
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

  // ---------- File Select ----------
  const onFilesSelected = (e) => {
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

  // ---------- Send Message ----------
  const sendTextMessage = async () => {
    if (chatInfo?.blockedBy?.includes(myUid)) return alert("You are blocked");
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = { senderId: myUid, text:"", mediaUrl:"", mediaType:detectFileType(file), fileName:file.name, createdAt:serverTimestamp(), status:"uploading", reactions:{} };
          const mRef = await addDoc(collection(db,"chats",chatId,"messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db,"chats",chatId,"messages",messageId), { mediaUrl:url, status:"sent", sentAt:serverTimestamp() });
          setTimeout(()=>setUploadingIds(prev=>{ const c={...prev}; delete c[messageId]; return c; }),200);
        } catch(err){ console.error(err); }
      }
      return;
    }
    if (text.trim()) {
      try {
        const payload = { senderId: myUid, text:text.trim(), mediaUrl:"", mediaType:null, createdAt:serverTimestamp(), status:"sent", reactions:{} };
        if (replyTo) payload.replyTo = { id:replyTo.id, text:replyTo.text || replyTo.mediaType, senderId:replyTo.senderId };
        setReplyTo(null);
        await addDoc(collection(db,"chats",chatId,"messages"), payload);
        setText("");
        setTimeout(()=>endRef.current?.scrollIntoView({ behavior:"smooth" }),80);
      } catch(e){ console.error(e); alert("Failed to send"); }
    }
  };

  // ---------- Return JSX ----------
  return (
    <div className={`flex flex-col h-full w-full relative ${wallpaper ? "bg-cover bg-center" : isDark ? "bg-gray-900" : "bg-gray-100"}`}
         style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : undefined }}>

      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 sticky top-0 z-20 shadow-md">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}>
          <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" className="w-10 h-10 rounded-full"/>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{friendInfo?.displayName || chatInfo?.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-300">{formatLastSeen(friendInfo?.lastSeen)}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => navigate(`/voice-call/${chatId}`)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">🎥</button>
          <div className="relative">
            <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">⋮</button>
            {headerMenuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 shadow-md rounded menu z-30">
                <button onClick={() => setHeaderMenuOpen(false)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">View Profile</button>
                <button onClick={() => { setHeaderMenuOpen(false); clearChat(); }} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">Clear Chat</button>
                <button onClick={() => { setHeaderMenuOpen(false); }} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">{chatInfo?.blockedBy?.includes(myUid) ? "Unblock" : "Block"}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pinned Message */}
      {pinnedMessage && (
        <div ref={pinnedMessageRef} className="bg-yellow-100 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 p-2 text-sm rounded-md mx-3 my-1 cursor-pointer flex justify-between items-center shadow" onClick={()=>pinnedMessageRef.current?.scrollIntoView({ behavior:"smooth", block:"center" })}>
          <div className="truncate">📌 {pinnedMessage.text || pinnedMessage.mediaType || "Pinned message"}</div>
          <div className="text-xs opacity-70">{new Date(pinnedMessage.createdAt?.toDate()).toLocaleDateString()}</div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesRefEl} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loadingMsgs && <div className="text-center text-gray-500 dark:text-gray-300">Loading messages…</div>}
        {messages.map((m, idx) => {
          const prev = messages[idx-1];
          const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
          const isMe = m.senderId === myUid;
          const isPinned = pinnedMessage?.id === m.id;
          return (
            <React.Fragment key={m.id}>
              {showDay && <div className="text-center text-gray-500 dark:text-gray-300 text-xs my-2">{dayLabel(m.createdAt)}</div>}
              <div className={`flex ${isMe ? "justify-end" : "justify-start"} relative`}>
                <div className={`max-w-[70%] p-2 rounded-lg ${isMe ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"} ${isPinned ? "border-2 border-yellow-400 dark:border-yellow-300" : ""}`}>
                  {m.replyTo && (
                    <div className="bg-gray-300 dark:bg-gray-600 p-1 rounded mb-1 text-xs truncate">
                      <strong>{m.replyTo.senderId===myUid?"You":"Them"}:</strong> {m.replyTo.text}
                    </div>
                  )}
                  {m.mediaUrl ? (
                    m.mediaType==="image"?<img src={m.mediaUrl} alt={m.fileName} className="max-w-full rounded"/>:
                    m.mediaType==="video"?<video src={m.mediaUrl} controls className="max-w-full rounded"/>:
                    m.mediaType==="audio"?<audio src={m.mediaUrl} controls className="w-full"/>:
                    <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline">{m.fileName||"File"}</a>
                  ) : <div className="break-words">{m.text}</div>}
                  <div className="text-right text-xs opacity-70 mt-1">{fmtTime(m.createdAt)}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 flex items-center p-2 gap-2 border-t border-gray-300 dark:border-gray-700">
        <label className="cursor-pointer">
          📎 <input type="file" multiple className="hidden" onChange={onFilesSelected}/>
        </label>
        <input type="text" className="flex-1<input
          type="text"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendTextMessage(); }}
        />
        <button
          onClick={sendTextMessage}
          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg"
        >
          ➤
        </button>
      </div>

      {/* Selected File Previews */}
      {previews.length > 0 && (
        <div className="flex overflow-x-auto p-2 gap-2 bg-gray-100 dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700">
          {previews.map((p, i) => (
            <div
              key={i}
              className={`relative w-20 h-20 rounded-lg overflow-hidden border ${i === selectedPreviewIndex ? "border-blue-500" : "border-gray-400"} cursor-pointer`}
              onClick={() => setSelectedPreviewIndex(i)}
            >
              {p.type === "image" && <img src={p.url} alt={p.name} className="w-full h-full object-cover" />}
              {p.type === "video" && <video src={p.url} className="w-full h-full object-cover" />}
              {p.type === "audio" && <audio src={p.url} controls className="w-full h-full"/>}
              {p.type === "file" && <div className="flex items-center justify-center w-full h-full bg-gray-300 dark:bg-gray-600 text-xs text-gray-700 dark:text-gray-200">{p.name}</div>}
              <button
                onClick={() => {
                  setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
                  setPreviews(prev => prev.filter((_, idx) => idx !== i));
                  setSelectedPreviewIndex(0);
                }}
                className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-xs flex items-center justify-center rounded-full"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}