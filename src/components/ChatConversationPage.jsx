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

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];

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
      if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary env not configured"));
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const res = JSON.parse(xhr.responseText);
          resolve(res.secure_url || res.url);
        } else reject(new Error("Cloudinary upload failed: " + xhr.status));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      xhr.send(fd);
    } catch (err) { reject(err); }
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

  // Recorder availability
  useEffect(() => setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)), []);

  // Load chat & friend info
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
      unsubChat = onSnapshot(chatRef, (s) => {
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
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);
      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
        }
      });
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

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

  // Mark last message seen
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

  // File select
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map(f => ({
      url: (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f,
    }));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setSelectedPreviewIndex(prev => (prev >= 0 ? prev : 0));
  };

  // Send message
  const sendTextMessage = async () => {
    const blockedBy = chatInfo?.blockedBy || [];
    if (blockedBy.includes(myUid)) { alert("You are blocked in this chat."); return; }

    // Send files
    if (selectedFiles.length > 0) {
      const toSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of toSend) {
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

        try {
          const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
        } catch (err) { console.error(err); }

        setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
      }
      return;
    }

    // Send text
    if (text.trim()) {
      const payload = { senderId: myUid, text: text.trim(), mediaUrl: "", mediaType: null, createdAt: serverTimestamp(), status: "sent", reactions: {} };
      if (replyTo) {
        payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId };
        setReplyTo(null);
      }
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  // Copy message
  const copyMessageText = async (m) => {
    try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); }
    catch (err) { console.error("Copy failed", err); alert("Failed to copy"); }
    setMenuOpenFor(null);
  };

  // Edit, delete, forward, pin
  const editMessage = async (m) => {
    if (m.senderId !== myUid) return alert("You can only edit your own messages.");
    try {
      const newText = window.prompt("Edit message", m.text || "");
      if (newText == null) return;
      await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true });
    } catch (err) { console.error(err); }
    setMenuOpenFor(null);
  };

  const deleteMessageForEveryone = async (id) => {
    if (!window.confirm("Delete for everyone?")) return;
    try { await deleteDoc(doc(db, "chats", chatId, "messages", id)); }
    catch (err) { console.error(err); }
    setMenuOpenFor(null);
  };

  const deleteMessageForMe = async (id) => {
    try { await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) }); }
    catch (err) { console.error(err); }
    setMenuOpenFor(null);
  };

  const forwardMessage = (m) => navigate(`/forward/${m.id}`, { state: { message: m } });
  const pinMessage = async (m) => {
    try {
      await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType || "") });
      alert("Message pinned");
    } catch (err) { console.error(err); alert("Failed to pin message"); }
    setMenuOpenFor(null);
  };
  const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };

  // Apply reaction
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const existing = data.reactions?.[myUid];
      const update = existing === emoji ? { [`reactions.${myUid}`]: null } : { [`reactions.${myUid}`]: emoji };
      await updateDoc(mRef, update);
    } catch (err) { console.error(err); }
    setReactionFor(null);
  };

  // Start/stop recording
  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) recorderChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: "audio", fileName: "voice_note.webm", createdAt: serverTimestamp(), status: "uploading", reactions: {} };
        const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
        const messageId = mRef.id;
        setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
        try {
          const url = await uploadToCloudinary(blob, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
        } catch (err) { console.error(err); }
        setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) { console.error(err); alert("Could not start recording"); }
  };
  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    setRecording(false);
  };
  const holdStart = (e) => { e.preventDefault(); longPressTimer.current = setTimeout(() => startRecording(), 300); };
  const holdEnd = (e) => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); };

  // Group messages by day
  const groupedMessages = (() => {
    const out = []; let lastDay = null;
    messages.forEach(m => {
      const lbl = dayLabel(m.createdAt || new Date());
      if (lbl !== lastDay) { out.push({ type: "day", label: lbl, id: `day-${lbl}-${Math.random().toString(36).slice(2)}` }); lastDay = lbl; }
      out.push(m);
    });
    return out;
  })();

  // Menu button style
  const menuBtnStyle = { padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" };

  // Render
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 90, display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#1877F2", color: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>←</button>
        <img
          src={friendInfo?.photoURL || chatInfo?.photoURL || "/default-avatar.png"}
          alt="Avatar"
          style={{ width: 40, height: 40, borderRadius: "50%" }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "bold" }}>{friendInfo?.displayName || chatInfo?.title || "Chat"}</div>
          {chatInfo?.status && <div style={{ fontSize: 12 }}>{chatInfo.status}</div>}
        </div>
        <button onClick={() => setHeaderMenuOpen(prev => !prev)} style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>⋮</button>
        {headerMenuOpen && (
          <div style={{ position: "absolute", top: 60, right: 12, background: "#fff", color: "#000", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 100 }}>
            <button style={menuBtnStyle} onClick={() => alert("View profile")}>View Profile</button>
            <button style={menuBtnStyle} onClick={() => alert("Block user")}>Block</button>
            <button style={menuBtnStyle} onClick={() => alert("Delete chat")}>Delete Chat</button>
          </div>
        )}
      </header>

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {loadingMsgs && <div style={{ textAlign: "center" }}>Loading messages...</div>}
        {groupedMessages.map((m) => {
          if (m.type === "day") {
            return <div key={m.id} style={{ textAlign: "center", fontSize: 12, color: "#888" }}>{m.label}</div>;
          }
          const isMine = m.senderId === myUid;
          return (
            <div
              key={m.id}
              style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}
              onMouseEnter={() => setMenuOpenFor(m.id)}
              onMouseLeave={() => setMenuOpenFor(null)}
            >
              {m.replyTo && (
                <div style={{ background: "#eee", padding: "4px 8px", borderRadius: 6, marginBottom: 2, fontSize: 12 }}>
                  {m.replyTo.text || m.replyTo.mediaType}
                </div>
              )}
              <div style={{
                background: isMine ? "#0b93f6" : "#e5e5ea",
                color: isMine ? "#fff" : "#000",
                padding: 8,
                borderRadius: 12,
                maxWidth: "75%",
                position: "relative"
              }}>
                {m.text && <div>{m.text}</div>}
                {m.mediaUrl && m.mediaType === "image" && <img src={m.mediaUrl} alt="" style={{ width: "100%", borderRadius: 8, marginTop: m.text ? 4 : 0 }} />}
                {m.mediaUrl && m.mediaType === "video" && (
                  <video src={m.mediaUrl} controls style={{ width: "100%", borderRadius: 8, marginTop: m.text ? 4 : 0 }} />
                )}
                {m.mediaUrl && m.mediaType === "audio" && (
                  <audio src={m.mediaUrl} controls style={{ width: 200, marginTop: m.text ? 4 : 0 }} />
                )}
                <div style={{ fontSize: 10, textAlign: "right", marginTop: 2 }}>{fmtTime(m.createdAt)} {m.edited && "(edited)"}</div>
              </div>

              {/* Message menu */}
              {menuOpenFor === m.id && (
                <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                  <button style={menuBtnStyle} onClick={() => replyToMessage(m)}>Reply</button>
                  <button style={menuBtnStyle} onClick={() => copyMessageText(m)}>Copy</button>
                  {isMine && <button style={menuBtnStyle} onClick={() => editMessage(m)}>Edit</button>}
                  {isMine && <button style={menuBtnStyle} onClick={() => deleteMessageForEveryone(m.id)}>Delete for Everyone</button>}
                  <button style={menuBtnStyle} onClick={() => deleteMessageForMe(m.id)}>Delete for Me</button>
                  <button style={menuBtnStyle} onClick={() => pinMessage(m)}>Pin</button>
                  <button style={menuBtnStyle} onClick={() => forwardMessage(m)}>Forward</button>
                  <button style={menuBtnStyle} onClick={() => setReactionFor(m.id)}>React</button>
                  {reactionFor === m.id && (
                    <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                      {INLINE_REACTIONS.map(e => <button key={e} style={menuBtnStyle} onClick={() => applyReaction(m.id, e)}>{e}</button>)}
                    </div>
                  )}
                </div>
              )}

              {/* Display reactions */}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <div style={{ display: "flex", gap: 2, fontSize: 14, marginTop: 2 }}>
                  {Object.values(m.reactions).filter(Boolean).map((r, idx) => <span key={idx}>{r}</span>)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ background: "#eee", padding: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12 }}>Replying to: {replyTo.text || replyTo.mediaType}</div>
          <button onClick={() => setReplyTo(null)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>✖</button>
        </div>
      )}

      {/* Input area */}
      <div style={{ display: "flex", gap: 4, padding: 8, alignItems: "center", borderTop: "1px solid #ccc", background: isDark ? "#111" : "#fff" }}>
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 20, border: "1px solid #ccc" }}
          onKeyDown={e => { if (e.key === "Enter") sendTextMessage(); }}
        />
        <input type="file" multiple style={{ display: "none" }} id="fileInput" onChange={onFilesSelected} />
        <label htmlFor="fileInput" style={{ cursor: "pointer" }}>📎</label>
        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
          style={{ padding: 6, borderRadius: "50%", background: recording ? "red" : "#0b93f6", color: "#fff", border: "none", cursor: "pointer" }}
        >🎤</button>
        <button onClick={sendTextMessage} style={{ padding: 6, borderRadius: "50%", background: "#0b93f6", color: "#fff", border: "none", cursor: "pointer" }}>➤</button>
      </div>

      {/* Selected previews */}
      {previews.length > 0 && (
        <div style={{ display: "flex", overflowX: "auto", gap: 4, padding: 4 }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {p.type === "image" && <img src={p.url} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6 }} />}
              {p.type === "video" && <video src={p.url} style={{ width: 60, height: 60, borderRadius: 6 }} />}
              <button onClick={() => { setPreviews(previews.filter((_, i) => i !== idx)); setSelectedFiles(selectedFiles.filter((_, i) => i !== idx)); }} style={{ position: "absolute", top: -6, right: -6, background: "red", color: "#fff", borderRadius: "50%", border: "none", width: 16, height: 16, fontSize: 10 }}>✖</button>
              {uploadingIds[p.id] != null && <div style={{ position: "absolute", bottom: 0, left: 0, width: `${uploadingIds[p.id]}%`, height: 3, background: "#0b93f6" }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}