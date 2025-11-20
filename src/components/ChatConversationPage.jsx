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
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Helpers --------------------
const fmtTime = (ts) =>
  ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// -------------------- Constants --------------------
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];
const COLORS = {
  primary: "#34B7F1",
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
  reactionBg: "#111",
};
const SPACING = { xs: 4, sm: 8, md: 12, lg: 14, xl: 20, borderRadius: 12 };
const menuBtnStyle = {
  padding: SPACING.sm,
  borderRadius: SPACING.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

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
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // -------------------- Helpers --------------------
  const detectFileType = (file) => {
    if (!file?.type) return "file";
    const t = file.type;
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  const uploadToCloudinary = (file, onProgress) =>
    new Promise((resolve, reject) => {
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
          xhr.status >= 200 && xhr.status < 300 ? resolve(JSON.parse(xhr.responseText).secure_url) : reject(new Error("Cloudinary upload failed"));
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
          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const fRef = doc(db, "users", friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
          }
        }
        unsubChat = onSnapshot(doc(db, "chats", chatId), (s) => {
          if (s.exists()) setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error(e);
      }
    };
    loadMeta();
    return () => {
      unsubChat?.();
    };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      docs.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent")
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
      });
      setLoadingMsgs(false);
      if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- Send text & media --------------------
  const sendTextMessage = async () => {
    if ((chatInfo?.blockedBy || []).includes(myUid)) return alert("You are blocked in this chat.");

    // Handle selected files
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]);
      setPreviews([]);
      setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: detectFileType(file), fileName: file.name, createdAt: serverTimestamp(), status: "uploading", reactions: {} };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(file, (pct) => setUploadingIds((prev) => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds((prev) => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
        } catch (err) {
          console.error("upload error:", err);
        }
      }
      return;
    }

    // Handle text message
    if (text.trim()) {
      try {
        const payload = { senderId: myUid, text: text.trim(), mediaUrl: "", mediaType: null, createdAt: serverTimestamp(), status: "sent", reactions: {} };
        if (replyTo) {
          payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId };
          setReplyTo(null);
        }
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText("");
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      } catch (e) {
        console.error(e);
        alert("Failed to send");
      }
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
      mr.ondataavailable = (ev) => { if (ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: "audio", createdAt: serverTimestamp(), status: "uploading", reactions: {} };
        try {
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(blob, (pct) => setUploadingIds((prev) => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds((prev) => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
        } catch (err) {
          console.error("voice upload failed", err);
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error(err);
      alert("Could not start recording");
    }
  };
  const stopRecording = () => { try { recorderRef.current?.stop(); recorderRef.current?.stream?.getTracks().forEach(t => t.stop()); } catch(e){} setRecording(false); };
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

  // -------------------- Header actions --------------------
  const clearChat = async () => {
    if(!confirm("Clear chat?")) return;
    const snap = await getDocs(query(collection(db,"chats",chatId,"messages"), orderBy("createdAt","asc")));
    for(const d of snap.docs) try{await deleteDoc(d.ref);}catch(e){}
    setHeaderMenuOpen(false);
    alert("Chat cleared.");
  };
  const toggleBlock = async () => {
    if (!chatInfo) return;
    const chatRef = doc(db, "chats", chatId);
    const blockedBy = chatInfo.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
      setChatInfo(prev => ({ ...prev, blockedBy: blockedBy.filter(id => id !== myUid) }));
      alert("You unblocked this chat.");
    } else {
      await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
      setChatInfo(prev => ({ ...prev, blockedBy: [...blockedBy, myUid] }));
      alert("You blocked this chat.");
    }
    setHeaderMenuOpen(false);
  };

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

  // -------------------- Scroll to bottom --------------------
  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  // -------------------- Render Message --------------------
const renderMessage = (m) => {
  const isMine = m.senderId === myUid;
  const showMenu = menuOpenFor === m.id;
  const showReactionPicker = reactionFor === m.id;
  const time = fmtTime(m.createdAt);

  return (
    <div
      key={m.id}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
      }}
      onTouchStart={() => handleMsgTouchStart(m)}
      onTouchMove={handleMsgTouchMove}
      onTouchEnd={() => handleMsgTouchEnd(m)}
    >
      {/* Reply Preview */}
      {m.replyTo && (
        <div
          style={{
            background: isDark ? COLORS.darkCard : COLORS.lightCard,
            borderLeft: `3px solid ${COLORS.primary}`,
            padding: SPACING.xs,
            marginBottom: SPACING.xs / 2,
            borderRadius: SPACING.borderRadius / 2,
            fontSize: 12,
            color: COLORS.mutedText,
            maxWidth: "70%",
          }}
        >
          <strong>{m.replyTo.senderId === myUid ? "You" : "Friend"}:</strong>{" "}
          {m.replyTo.text || m.replyTo.mediaType || ""}
        </div>
      )}

      {/* Message bubble */}
      <div
        style={{
          background: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : COLORS.lightText,
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          position: "relative",
          wordBreak: "break-word",
        }}
        onClick={() => setMenuOpenFor(showMenu ? null : m.id)}
      >
        {/* Media */}
        {m.mediaUrl && m.mediaType === "image" && (
          <img
            src={m.mediaUrl}
            alt={m.fileName || "image"}
            style={{ width: "100%", borderRadius: SPACING.borderRadius, marginBottom: m.text ? SPACING.xs : 0 }}
          />
        )}
        {m.mediaUrl && m.mediaType === "video" && (
          <video controls style={{ width: "100%", borderRadius: SPACING.borderRadius, marginBottom: m.text ? SPACING.xs : 0 }}>
            <source src={m.mediaUrl} type="video/mp4" />
          </video>
        )}
        {m.mediaUrl && m.mediaType === "audio" && (
          <audio controls style={{ width: "100%" }}>
            <source src={m.mediaUrl} type="audio/webm" />
          </audio>
        )}
        {/* Text */}
        {m.text && <div>{m.text} {m.edited && <span style={{ fontSize: 10, color: COLORS.edited }}>(edited)</span>}</div>}

        {/* Uploading progress */}
        {uploadingIds[m.id] >= 0 && (
          <div style={{ fontSize: 10, color: COLORS.mutedText }}>{uploadingIds[m.id]}% uploading...</div>
        )}

        {/* Timestamp */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, textAlign: "right", marginTop: SPACING.xs / 2 }}>
          {time}
        </div>
      </div>

      {/* Reactions */}
      <div style={{ display: "flex", marginTop: 2 }}>
        {Object.values(m.reactions || {}).map((r, i) => r && (
          <span key={i} style={{ marginRight: 4, fontSize: 14 }}>{r}</span>
        ))}
        <button
          style={{ marginLeft: 4, background: "transparent", border: "none", cursor: "pointer" }}
          onClick={() => setReactionFor(showReactionPicker ? null : m.id)}
        >
          🙂
        </button>
      </div>

      {/* Context menu */}
      {showMenu && (
        <div
          style={{
            position: "absolute",
            top: -SPACING.lg,
            right: isMine ? 0 : "auto",
            left: isMine ? "auto" : 0,
            background: isDark ? COLORS.darkCard : COLORS.lightCard,
            border: `1px solid ${COLORS.grayBorder}`,
            borderRadius: SPACING.borderRadius,
            boxShadow: "0px 2px 5px rgba(0,0,0,0.2)",
            zIndex: 10,
            minWidth: 140,
          }}
        >
          {m.senderId === myUid && <button style={menuBtnStyle} onClick={() => editMessage(m)}>Edit</button>}
          <button style={menuBtnStyle} onClick={() => deleteMessageForMe(m.id)}>Delete for Me</button>
          {m.senderId === myUid && <button style={menuBtnStyle} onClick={() => deleteMessageForEveryone(m.id)}>Delete for Everyone</button>}
          <button style={menuBtnStyle} onClick={() => replyToMessage(m)}>Reply</button>
          <button style={menuBtnStyle} onClick={() => pinMessage(m)}>Pin</button>
          <button style={menuBtnStyle} onClick={() => copyMessageText(m)}>Copy</button>
          <button style={menuBtnStyle} onClick={() => forwardMessage(m)}>Forward</button>
        </div>
      )}

      {/* Reaction picker */}
      {showReactionPicker && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: isMine ? "auto" : 0,
            right: isMine ? 0 : "auto",
            display: "flex",
            background: isDark ? COLORS.darkCard : COLORS.lightCard,
            borderRadius: SPACING.borderRadius,
            padding: SPACING.xs,
            boxShadow: "0px 2px 5px rgba(0,0,0,0.2)",
            zIndex: 20,
          }}
        >
          {EXTENDED_EMOJIS.map((e) => (
            <span key={e} style={{ fontSize: 18, padding: 4, cursor: "pointer" }} onClick={() => applyReaction(m.id, e)}>
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};