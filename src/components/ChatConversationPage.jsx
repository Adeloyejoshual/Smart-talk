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
      if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary not configured"));
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
        } else reject(new Error("Cloudinary upload failed"));
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
      unsubChat = onSnapshot(chatRef, (s) => {
        if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() }));
      });
    };
    load();
    return () => { if (unsubChat) unsubChat(); };
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

  // Sending messages (text/files)
  const sendTextMessage = async () => {
    const blockedBy = chatInfo?.blockedBy || [];
    if (blockedBy.includes(myUid)) return alert("You are blocked in this chat.");

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
        } catch (err) { console.error("Upload failed", err); }

        setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
      }
      return;
    }

    if (text.trim()) {
      const payload = {
        senderId: myUid,
        text: text.trim(),
        mediaUrl: "",
        mediaType: null,
        createdAt: serverTimestamp(),
        status: "sent",
        reactions: {}
      };
      if (replyTo) {
        payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId };
        setReplyTo(null);
      }
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  // --------------------- VOICE NOTE ---------------------
  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) recorderChunksRef.current.push(e.data); };

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
          const url = await uploadToCloudinary(blob, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
        } catch (err) { console.error("Voice note upload error", err); }

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

  const holdStart = (e) => {
    e.preventDefault();
    longPressTimer.current = setTimeout(() => startRecording(), 300);
  };

  const holdEnd = (e) => {
    clearTimeout(longPressTimer.current);
    if (recording) stopRecording();
  };

  // --------------------- MESSAGE BUBBLE ---------------------
  const MessageBubble = ({ m }) => {
    const mine = m.senderId === myUid;
    const bg = mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff");
    const color = mine ? "#fff" : (isDark ? "#fff" : "#000");

    const renderStatus = () => {
      if (!mine) return null;
      if (m.status === "uploading") return "⌛";
      if (m.status === "sent") return "✔";
      if (m.status === "delivered") return "✔✔";
      if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>;
      return null;
    };

    const renderContent = () => {
      if (m.mediaUrl) {
        switch (m.mediaType) {
          case "image": return <img src={m.mediaUrl} alt={m.fileName} style={{ maxWidth: 360, borderRadius: 12 }} />;
          case "video": return <video controls src={m.mediaUrl} style={{ maxWidth: 360, borderRadius: 12 }} />;
          case "audio": return <AudioBubble m={m} mine={mine} isDark={isDark} />;
          case "pdf":
          case "file": return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>;
          default: return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open File</a>;
        }
      }
      return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>;
    };

    return (
      <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, position: "relative" }}>
        <div style={{ background: bg, color, padding: 12, borderRadius: 14, maxWidth: "78%", wordBreak: "break-word" }}>
          {m.replyTo && <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#f3f3f3", color: isDark ? "#ddd" : "#333", fontSize: 12, maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.replyTo.senderId === myUid ? "You" : "Them"}</div>
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.replyTo.text}</div>
          </div>}
          {renderContent()}
          {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}>· edited</div>}
          {m.reactions && Object.keys(m.reactions).length > 0 && (
            <div style={{ position: "absolute", bottom: -14, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12 }}>
              {Object.values(m.reactions).slice(0, 4).join(" ")}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}>
            <div style={{ marginLeft: "auto" }}>{fmtTime(m.createdAt)} {renderStatus()}</div>
          </div>
          {m.status === "uploading" && uploadingIds[m.id] !== undefined && (
            <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", color: "#333", fontSize: 12 }}>{uploadingIds[m.id]}%</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --------------------- AUDIO BUBBLE ---------------------
  const AudioBubble = ({ m, mine, isDark }) => {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    };

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const onEnded = () => setPlaying(false);
      const onPlay = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("play", onPlay);
      audio.addEventListener("pause", onPause);
      return () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("pause", onPause);
      };
    }, []);

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={togglePlay}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: mine ? "#fff" : "#0b84ff",
            color: mine ? "#0b84ff" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {playing ? "⏸" : "▶️"}
        </button>
        <audio ref={audioRef} src={m.mediaUrl} preload="metadata" />
        <span style={{ fontSize: 12, color: isDark ? "#ccc" : "#333" }}>{m.fileName || "voice_note.webm"}</span>
      </div>
    );
  };

  // --------------------- INPUT AREA ---------------------
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: wallpaper || (isDark ? "#121212" : "#f5f5f5") }}>
      {/* HEADER */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "#1c1c1c" : "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontWeight: 700 }}>{friendInfo?.name || "Chat"}</div>
            <div style={{ fontSize: 12, color: isDark ? "#aaa" : "#666" }}>{friendInfo?.online ? "Online" : "Offline"}</div>
          </div>
        </div>
        <div>
          {/* Optional voice/video call icons */}
          <button style={{ marginRight: 8 }}>🎤</button>
          <button>📹</button>
        </div>
      </div>

      {/* MESSAGES LIST */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", color: isDark ? "#aaa" : "#666" }}>Loading messages...</div>}
        {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
        <div ref={endRef} />
      </div>

      {/* REPLY PREVIEW */}
      {replyTo && (
        <div style={{ padding: "8px 12px", background: isDark ? "#222" : "#eee", borderLeft: `4px solid ${isDark ? "#0b84ff" : "#007bff"}` }}>
          Replying to: {replyTo.text || replyTo.mediaType}
          <button onClick={() => setReplyTo(null)} style={{ marginLeft: 12 }}>✖</button>
        </div>
      )}

      {/* INPUT AREA */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderTop: "1px solid #ccc", background: isDark ? "#1c1c1c" : "#fff" }}>
        <button onClick={() => setShowEmojiPicker(prev => !prev)}>😊</button>
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none" }}
        />
        {text.trim() || selectedFiles.length > 0 ? (
          <button onClick={sendTextMessage} style={{ padding: "8px 12px", borderRadius: "50%", background: "#0b84ff", color: "#fff", border: "none" }}>➤</button>
        ) : (
          <button
            onMouseDown={holdStart}
            onMouseUp={holdEnd}
            onMouseLeave={holdEnd}
            style={{ padding: "8px 12px", borderRadius: "50%", background: recording ? "#f00" : "#0b84ff", color: "#fff", border: "none" }}
          >🎤</button>
        )}
      </div>

      {/* EMOJI PICKER */}
      {showEmojiPicker && (
        <div style={{ position: "absolute", bottom: 60, left: 12, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 12, padding: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {EXTENDED_EMOJIS.map((e, i) => <button key={i} style={{ fontSize: 18, border: "none", background: "transparent" }} onClick={() => addEmoji(e)}>{e}</button>)}
        </div>
      )}
    </div>
  );
}