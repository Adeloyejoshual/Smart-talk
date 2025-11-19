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
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import WaveSurfer from "wavesurfer.js";

/** Helpers */
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

/** Voice message waveform component */
function VoiceMessage({ src }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#34B7F1",
      progressColor: "#007bff",
      cursorColor: "#333",
      height: 40,
      responsive: true,
    });
    wavesurferRef.current.load(src);

    return () => wavesurferRef.current.destroy();
  }, [src]);

  return <div ref={containerRef} />;
}

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

  /** State */
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

  /** Cloudinary upload */
  const uploadToCloudinary = (file, onProgress) => new Promise((resolve, reject) => {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary env not set"));
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).secure_url);
        else reject(new Error("Cloudinary upload failed: " + xhr.status));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      xhr.send(fd);
    } catch (err) { reject(err); }
  });

  const detectFileType = (file) => {
    const t = file.type;
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  /** Load chat meta + friend */
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

  /** Messages realtime - unlimited */
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc")); // unlimited
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(m => !(m.deletedFor?.includes(myUid)));
      setMessages(filtered);

      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch (e){}
        }
      });
      setLoadingMsgs(false);
      if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  /** Scroll detection */
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  /** Visibility = mark seen */
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].reverse().find(m => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        try { await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" }); } catch(e){}
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [messages, chatId, myUid]);

  /** File select & preview */
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

  /** Send message */
  const sendTextMessage = async () => {
    if ((chatInfo?.blockedBy || []).includes(myUid)) return alert("You are blocked in this chat.");

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
          payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId };
          setReplyTo(null);
        }
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText("");
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      } catch (e) { console.error(e); alert("Failed to send"); }
    }
  };

  /** Recording */
  useEffect(() => setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)), []);
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
    try { recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach(t => t.stop()); } catch(e){}
    setRecording(false);
  };
  const holdStart = (e) => { e.preventDefault(); longPressTimer.current = setTimeout(() => startRecording(), 250); };
  const holdEnd = (e) => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); };

  /** Message helpers */
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef); if (!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      if (existing === emoji) await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      else await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      setReactionFor(null);
    } catch(e){ console.error(e); }
  };
  const copyMessageText = async (m) => { try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); setMenuOpenFor(null); } catch(e){alert("Copy failed");} };
  const editMessage = async (m) => { if (m.senderId !== myUid) return alert("You can only edit your messages."); const newText = window.prompt("Edit message", m.text||""); if(newText==null)return; updateDoc(doc(db,"chats",chatId,"messages",m.id),{text:newText,edited:true}); setMenuOpenFor(null); };
  const deleteMessageForEveryone = async (id) => { if(!confirm("Delete for everyone?")) return; await deleteDoc(doc(db,"chats",chatId,"messages",id)); setMenuOpenFor(null); };
  const deleteMessageForMe = async (id) => { await updateDoc(doc(db,"chats",chatId,"messages",id),{deletedFor: arrayUnion(myUid)}); setMenuOpenFor(null); };
  const forwardMessage = (m) => navigate(`/forward/${m.id}`,{state:{message:m}});
  const pinMessage = async (m) => { await updateDoc(doc(db,"chats",chatId),{pinnedMessageId:m.id,pinnedMessageText:m.text||(m.mediaType||"")}); setMenuOpenFor(null); alert("Pinned"); };
  const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };

  /** Long press swipe */
  const handleMsgTouchStart = (m) => { longPressTimer.current = setTimeout(() => setMenuOpenFor(m.id), 500); swipeStartX.current = null; };
  const handleMsgTouchMove = (ev) => { if (!swipeStartX.current && ev.touches && ev.touches[0]) swipeStartX.current = ev.touches[0].clientX; };
  const handleMsgTouchEnd = (m, ev) => { clearTimeout(longPressTimer.current); if (!swipeStartX.current) return; const endX = ev.changedTouches ? ev.changedTouches[0].clientX : null; if(endX==null) return; if(swipeStartX.current - endX>80) replyToMessage(m); swipeStartX.current=null; };

  /** Close menus on outside click */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.message-menu') && !e.target.closest('.reaction-menu') && !e.target.closest('.emoji-picker')) {
        setMenuOpenFor(null);
        setReactionFor(null);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** Render helpers */
  const renderStatusTick = (m) => {
    if(m.senderId!==myUid)return null;
    if(m.status==="uploading")return"⌛";
    if(m.status==="sent")return"✔";
    if(m.status==="delivered")return"✔✔";
    if(m.status==="seen")return <span style={{color:"#2b9f4a"}}>✔✔</span>;
    return null
  };

  const renderMessage = (m) => {
    const isMe = m.senderId === myUid;
    const isReply = !!m.replyTo;
    const reacted = Object.values(m.reactions || {}).filter(Boolean);
    return (
      <div
        key={m.id}
        className={`message ${isMe ? "me" : "friend"}`}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpenFor(m.id); }}
        onTouchStart={() => handleMsgTouchStart(m)}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={(e) => handleMsgTouchEnd(m, e)}
      >
        {isReply && (
          <div className="reply-preview">
            <strong>{m.replyTo.senderId === myUid ? "You" : friendInfo?.name}</strong>: {m.replyTo.text || m.replyTo.mediaType}
          </div>
        )}
        <div className="message-content">
          {m.mediaType === "audio" ? (
            <VoiceMessage src={m.mediaUrl} />
          ) : m.mediaType === "image" ? (
            <img src={m.mediaUrl} alt={m.fileName} className="media-image" />
          ) : m.mediaType === "video" ? (
            <video src={m.mediaUrl} controls className="media-video" />
          ) : (
            <span>{m.text}</span>
          )}
        </div>
        <div className="message-footer">
          {renderStatusTick(m)} <small>{fmtTime(m.createdAt)}</small>
        </div>
        {reacted.length > 0 && (
          <div className="reactions-display">
            {reacted.map((r, idx) => <span key={idx}>{r}</span>)}
          </div>
        )}
        {menuOpenFor === m.id && (
          <div className="message-menu">
            <button onClick={() => replyToMessage(m)}>Reply</button>
            <button onClick={() => setReactionFor(m.id)}>React</button>
            {isMe && <button onClick={() => editMessage(m)}>Edit</button>}
            {isMe && <button onClick={() => deleteMessageForEveryone(m.id)}>Delete for Everyone</button>}
            <button onClick={() => deleteMessageForMe(m.id)}>Delete for Me</button>
            <button onClick={() => copyMessageText(m)}>Copy</button>
            <button onClick={() => forwardMessage(m)}>Forward</button>
            <button onClick={() => pinMessage(m)}>Pin</button>
          </div>
        )}
        {reactionFor === m.id && (
          <div className="reaction-menu">
            {INLINE_REACTIONS.map((emoji) => (
              <button key={emoji} onClick={() => applyReaction(m.id, emoji)}>{emoji}</button>
            ))}
            <button onClick={() => { setShowEmojiPicker(true); setEmojiPickerFor(m.id); }}>+</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`chat-page ${isDark ? "dark" : "light"}`} style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : undefined }}>
      <div className="messages-container" ref={messagesRefEl}>
        {loadingMsgs && <div className="loading">Loading messages...</div>}
        {messages.map(renderMessage)}
        <div ref={endRef} />
      </div>

      {replyTo && (
        <div className="replying-bar">
          Replying to {replyTo.senderId === myUid ? "You" : friendInfo?.name}: {replyTo.text || replyTo.mediaType}
          <button onClick={() => setReplyTo(null)}>x</button>
        </div>
      )}

      {showEmojiPicker && emojiPickerFor && (
        <div className="emoji-picker">
          {EXTENDED_EMOJIS.map((emoji) => (
            <button key={emoji} onClick={() => applyReaction(emojiPickerFor, emoji)}>{emoji}</button>
          ))}
        </div>
      )}

      <div className="chat-input-bar">
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setShowEmojiPicker(false)}
        />
        <input type="file" multiple style={{ display: "none" }} id="fileInput" onChange={onFilesSelected} />
        <button onClick={() => document.getElementById("fileInput").click()}>📎</button>

        {recorderAvailable ? (
          <button
            onMouseDown={holdStart}
            onMouseUp={holdEnd}
            onTouchStart={holdStart}
            onTouchEnd={holdEnd}
            className={`record-btn ${recording ? "recording" : ""}`}
          >
            🎤
          </button>
        ) : (
          <button onClick={sendTextMessage}>➡️</button>
        )}

        <button onClick={sendTextMessage}>Send</button>
      </div>
    </div>
  );
}