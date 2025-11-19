// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, updateDoc, doc, deleteDoc,
  getDoc, arrayUnion, arrayRemove, getDocs, limit as fsLimit
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// =================== Helpers ===================
const fmtTime = ts => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const dayLabel = ts => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short", day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
};

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];

const detectFileType = file => {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  return "file";
};

// =================== Component ===================
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

  // =================== States ===================
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
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

  // =================== Effects ===================
  // Recorder availability
  useEffect(() => {
    setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
  }, []);

  // Load chat metadata + friend info
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    const load = async () => {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (snap.exists()) {
        const data = snap.data();
        setChatInfo({ id: snap.id, ...data });
        const friendId = data.participants?.find(p => p !== myUid);
        if (friendId) {
          const userRef = doc(db, "users", friendId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) setFriendInfo({ id: userSnap.id, ...userSnap.data() });
        }
      }
      unsubChat = onSnapshot(chatRef, s => {
        if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() }));
      });
    };
    load();
    return () => { if (unsubChat) unsubChat(); };
  }, [chatId, myUid]);

  // Listen for messages
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);

      filtered.forEach(async m => {
        if (m.senderId !== myUid && m.status === "sent") {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
        }
      });

      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // Fetch call history
  useEffect(() => {
    if (!chatId) return;
    const fetchCalls = async () => {
      try {
        const res = await axios.get(`/api/call/${chatId}`);
        setCallHistory(res.data);
      } catch (err) {
        console.error("Failed to fetch call history", err);
      }
    };
    fetchCalls();
  }, [chatId]);

  // Scroll detection
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

  // Mark last incoming message as seen
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

  // =================== Message & Call Rendering ===================
  const MessageBubble = ({ m }) => {
    const mine = m.senderId === myUid;
    const bg = mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff");
    const color = mine ? "#fff" : (isDark ? "#fff" : "#000");

    return (
      <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
        <div style={{ background: bg, color, padding: 12, borderRadius: 14, maxWidth: "78%" }}>
          <div>{m.text}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{fmtTime(m.createdAt)}</div>
        </div>
      </div>
    );
  };

  const CallBubble = ({ call }) => {
    const mine = call.participants.includes(myUid);
    const others = call.participants.filter(p => p !== myUid);
    const startTime = new Date(call.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const formatDuration = sec => `${Math.floor(sec / 60)}m ${sec % 60}s`;

    return (
      <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
        <div style={{ background: mine ? "#34B7F1" : "#e5e5ea", color: mine ? "#fff" : "#000", padding: 10, borderRadius: 14, maxWidth: "78%" }}>
          <div style={{ fontWeight: 700 }}>{call.type === "voice" ? "📞 Voice Call" : "🎥 Video Call"}</div>
          <div style={{ fontSize: 12 }}>{call.status === "completed" ? "Completed" : "Missed"} • {formatDuration(call.duration)}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{startTime}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>With: {others.join(", ")}</div>
        </div>
      </div>
    );
  };

  // Merge messages + calls by timestamp
  const combinedFeed = [
    ...messages.map(m => ({ type: "message", data: m })),
    ...callHistory.map(c => ({ type: "call", data: c }))
  ].sort((a, b) => {
    const tA = a.type === "message" ? (a.data.createdAt?.toDate?.() || new Date(a.data.createdAt)) : new Date(a.data.startedAt);
    const tB = b.type === "message" ? (b.data.createdAt?.toDate?.() || new Date(b.data.createdAt)) : new Date(b.data.startedAt);
    return tA - tB;
  });

  // =================== Render ===================
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper || (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 90, display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#1877F2", color: "#fff" }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>←</button>
        <img src={friendInfo?.photoURL || chatInfo?.photoURL || "/default-avatar.png"} alt="avatar" onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} />
        <div onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} style={{ minWidth: 0, cursor: "pointer", flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</div>
        </div>
      </header>

      {/* Chat feed */}
      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: 24 }}>Loading messages…</div>}
        {combinedFeed.map(item => item.type === "message"
          ? <MessageBubble key={item.data.id} m={item.data} />
          : <CallBubble key={item.data._id} call={item.data} />)}
        <div ref={endRef} />
      </main>

      {/* Input area */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." onKeyDown={e => { if(e.key==="Enter") {/* handle send */} }} style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: `1px solid ${isDark ? "#333" : "#ccc"}`, outline: "none" }} />
        <button>➤</button>
      </div>
    </div>
  );
}