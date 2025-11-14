
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
  deleteDoc,
  getDocs,
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage.jsx
 *
 * - Cloudinary unsigned multiple uploads
 * - Preview strip (× = cancel), multiple send
 * - ➤ button: click to send text or files; press-and-hold to record voice (mobile & desktop)
 * - Voice messages are saved as messages and show an inline player
 * - Upload progress shown inside the sending bubble
 *
 * Required env:
 * VITE_CLOUDINARY_CLOUD_NAME
 * VITE_CLOUDINARY_UPLOAD_PRESET
 */

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍",
  "😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // { url, type, name, file }
  const [uploadingIds, setUploadingIds] = useState({}); // { [msgId]: pct }
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);

  const myUid = auth.currentUser?.uid;
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const longPressTimerRef = useRef(null);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // ---------- Cloudinary upload helper (unsigned) ----------
  const uploadToCloudinary = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      try {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) {
          reject(new Error("Cloudinary environment variables not set"));
          return;
        }
        const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && onProgress) {
            const pct = Math.round((e.loaded * 100) / e.total);
            onProgress(pct);
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

  const detectFileType = (file) => {
    const t = file.type;
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  // ---------- load chat + friend meta ----------
  useEffect(() => {
    if (!chatId) return;
    let mounted = true;
    (async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists() && mounted) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });
          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const fRef = doc(db, "users", friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
          }
        }
      } catch (e) {
        console.error("load chat meta", e);
      }
    })();
    return () => { mounted = false; };
  }, [chatId, myUid]);

  // ---------- messages realtime ----------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter((m) => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);

      // mark delivered for incoming messages
      filtered.forEach((m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }).catch(() => {});
        }
      });

      setLoadingMsgs(false);
      // auto-scroll if already at bottom
      setTimeout(() => {
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- visibility -> mark seen ----------
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].slice().reverse().find((m) => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" }).catch(()=>{});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [messages, chatId, myUid]);

  // ---------- scroll detection ----------
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

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // ---------- recorder availability ----------
  useEffect(() => {
    setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
  }, []);

  // ---------- file select & previews (multiple) ----------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map((f) => ({
      url: f.type.startsWith("image/") || f.type.startsWith("video/") ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f,
    }));
    setSelectedFiles((s) => [...s, ...files]);
    setPreviews((p) => [...p, ...newPreviews]);
  };

  // ---------- send text or queued files (➤ click) ----------
  const sendTextMessage = async () => {
    // send files first (if any)
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]);
      for (const file of filesToSend) {
        const placeholder = {
          senderId: myUid,
          text: "",
          mediaUrl: "",
          mediaType: detectFileType(file),
          createdAt: serverTimestamp(),
          status: "uploading",
          reactions: {},
        };
        const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
        const messageId = mRef.id;
        setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));
        try {
          const url = await uploadToCloudinary(file, (pct) => setUploadingIds((prev) => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
        } catch (err) {
          console.error("upload failed", err);
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: "failed" }).catch(()=>{});
        } finally {
          setUploadingIds((prev) => { const c = { ...prev }; delete c[messageId]; return c; });
        }
      }
      return;
    }

    // send text
    if (text.trim()) {
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
    }
  };

  // ---------- press-and-hold record handlers ----------
  const holdRecordStart = (e) => {
    e.preventDefault();
    longPressTimerRef.current = setTimeout(() => {
      startRecording();
    }, 220); // short delay to avoid accidental taps
  };
  const holdRecordCancel = (e) => {
    clearTimeout(longPressTimerRef.current);
    if (recording) stopRecording(); // if already recording, releasing stops it
  };

  // ---------- recording logic ----------
  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported in this browser");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        // create placeholder message
        const placeholder = {
          senderId: myUid,
          text: "",
          mediaUrl: "",
          mediaType: "audio",
          createdAt: serverTimestamp(),
          status: "uploading",
          reactions: {},
        };
        const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
        const messageId = mRef.id;
        setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));
        try {
          const url = await uploadToCloudinary(blob, (pct) => setUploadingIds((prev) => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
        } catch (err) {
          console.error("voice upload failed", err);
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: "failed" }).catch(()=>{});
        } finally {
          setUploadingIds((prev) => { const c = { ...prev }; delete c[messageId]; return c; });
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      console.error("startRecording", e);
      alert("Could not start recording");
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.error("stopRecording", e);
    }
    setRecording(false);
  };

  // ---------- actions (reactions, copy, edit, delete, forward, pin, reply) ----------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const existing = data.reactions?.[myUid];
      if (existing === emoji) await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      else await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      setReactionFor(null);
    } catch (e) {
      console.error("applyReaction", e);
    }
  };

  const copyMessageText = async (m) => {
    try {
      const txt = m.text || m.mediaUrl || m.fileName || "";
      await navigator.clipboard.writeText(txt);
      alert("Copied");
      setMenuOpenFor(null);
    } catch (e) { alert("Copy failed"); }
  };

  const editMessage = async (m) => {
    if (m.senderId !== myUid) return alert("You can only edit your messages.");
    const newText = window.prompt("Edit message", m.text || "");
    if (newText == null) return;
    await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true });
    setMenuOpenFor(null);
  };

  const deleteMessageForEveryone = async (id) => {
    if (!confirm("Delete for everyone?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", id));
    setMenuOpenFor(null);
  };

  const deleteMessageForMe = async (id) => {
    await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) });
    setMenuOpenFor(null);
  };

  const forwardMessage = (m) => navigate(`/forward/${m.id}`, { state: { message: m } });

  const pinMessage = async (m) => {
    await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType || "") });
    setMenuOpenFor(null);
    alert("Pinned");
  };

  const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };

  // ---------- long-press handlers for messages ----------
  const handleMsgTouchStart = (m) => {
    longPressTimerRef.current = setTimeout(() => setMenuOpenFor(m.id), 500);
  };
  const handleMsgTouchEnd = () => { clearTimeout(longPressTimerRef.current); };

  // ---------- header actions ----------
  const clearChat = async () => {
    if (!confirm("Clear chat? This will attempt to delete messages. Confirm.")) return;
    try {
      const msgsRef = collection(db, "chats", chatId, "messages");
      const snap = await getDocs(query(msgsRef, orderBy("createdAt", "asc")));
      // naive deletion (may need batched deletes for >500)
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(()=>{});
      }
      setHeaderMenuOpen(false);
      alert("Chat cleared.");
    } catch (e) { console.error("clearChat", e); alert("Failed to clear chat"); }
  };

  const toggleBlock = async () => {
    try {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const blockedBy = data.blockedBy || [];
      if (blockedBy.includes(myUid)) {
        // remove
        const newBlocked = blockedBy.filter((x) => x !== myUid);
        await updateDoc(chatRef, { blockedBy: newBlocked });
      } else {
        await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
      }
      setHeaderMenuOpen(false);
    } catch (e) { console.error("toggleBlock", e); }
  };

  // ---------- render helpers ----------
  const renderStatusTick = (m) => {
    if (m.senderId !== myUid) return null;
    if (m.status === "uploading") return "⌛";
    if (m.status === "sent") return "✔";
    if (m.status === "delivered") return "✔✔";
    if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>;
    return null;
  };

  // ---------- AudioMessageBubble (inline) ----------
  const AudioMessageBubble = ({ m, mine }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(m.duration || 0);

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const onLoaded = () => {
        if (!m.duration && audio.duration) setDuration(Math.round(audio.duration));
      };
      const onTime = () => {
        const total = audio.duration || duration || 1;
        setProgress((audio.currentTime / total) * 100);
      };
      const onEnd = () => { setIsPlaying(false); setProgress(0); };
      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("timeupdate", onTime);
      audio.addEventListener("ended", onEnd);
      return () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("timeupdate", onTime);
        audio.removeEventListener("ended", onEnd);
      };
    }, [m.mediaUrl, m.duration, duration]);

    const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) { audio.pause(); setIsPlaying(false); }
      else { audio.play(); setIsPlaying(true); }
    };

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={togglePlay} style={{ width: 40, height: 40, borderRadius: 20, border: "none", background: mine ? "#fff3" : "#0001", color: mine ? "#000" : "#000", cursor: "pointer" }}>
          {isPlaying ? "⏸" : "▶️"}
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: mine ? "#fff" : "#007bff" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, opacity: 0.9 }}>
            <div>{duration ? `${duration}s` : "—"}</div>
            <div>{fmtTime(m.createdAt)}</div>
          </div>
        </div>

        <audio ref={audioRef} src={m.mediaUrl} preload="metadata" />
      </div>
    );
  };

  // ---------- message renderer ----------
  const renderMessageContent = (m) => {
    if (m.mediaUrl) {
      switch (m.mediaType) {
        case "image":
          return <img src={m.mediaUrl} alt={m.fileName || "image"} style={{ width: "100%", borderRadius: 12 }} />;
        case "video":
          return <video controls src={m.mediaUrl} style={{ width: "100%", borderRadius: 12 }} />;
        case "audio":
          return <AudioMessageBubble m={m} mine={m.senderId === myUid} />;
        case "pdf":
        case "file":
          return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>;
        default:
          return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open media</a>;
      }
    }
    return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>;
  };

  // ---------- Enter key sending ----------
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  // ---------- render ----------
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 80, display: "flex", alignItems: "center", gap: 10, padding: 12, background: isDark ? "#0b0b0b" : "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", cursor: "pointer" }}>←</button>

        <img onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} />

        <div style={{ minWidth: 0, cursor: "pointer" }} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666" }}>
            {friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? (() => { const ld = friendInfo.lastSeen.toDate ? friendInfo.lastSeen.toDate() : new Date(friendInfo.lastSeen); return ld.toLocaleString(); })() : "Offline")}
          </div>
        </div>

        <div style={{ marginLeft: "auto", position: "relative" }}>
          <button onClick={() => setHeaderMenuOpen((s) => !s)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>⋮</button>
          {headerMenuOpen && (
            <div style={{ position: "absolute", right: 0, top: 36, background: isDark ? "#111" : "#fff", padding: 8, borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
              <button onClick={() => { setHeaderMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} style={menuBtnStyle}>View Profile</button>
              <button onClick={clearChat} style={menuBtnStyle}>Clear Chat</button>
              <button onClick={toggleBlock} style={menuBtnStyle}>Block / Unblock</button>
              <button onClick={() => { alert("Report submitted"); setHeaderMenuOpen(false); }} style={menuBtnStyle}>Report</button>
            </div>
          )}
        </div>
      </header>

      {/* Messages area */}
      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", color: "#888", marginTop: 12 }}>Loading messages…</div>}

        {messages.map((m) => {
          const mine = m.senderId === myUid;
          return (
            <div key={m.id} id={`msg-${m.id}`} onTouchStart={() => handleMsgTouchStart(m)} onTouchEnd={handleMsgTouchEnd} onMouseDown={(e) => { if (e.button === 2) setMenuOpenFor(m.id); }} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{ maxWidth: "78%", position: "relative" }}>
                <div style={{
                  background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff"),
                  color: mine ? "#fff" : (isDark ? "#fff" : "#000"),
                  padding: 12,
                  borderRadius: 14,
                  wordBreak: "break-word",
                }}>
                  {m.replyTo && (
                    <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#f3f3f3", color: isDark ? "#ddd" : "#333", fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.replyTo.senderId === myUid ? "You" : "Them"}</div>
                      <div style={{ maxHeight: 36, overflow: "hidden", textOverflow: "ellipsis" }}>{m.replyTo.text}</div>
                    </div>
                  )}

                  <div onClick={() => { setMenuOpenFor(null); setReactionFor(null); }}>
                    {renderMessageContent(m)}
                  </div>

                  {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}> · edited</div>}

                  {m.reactions && Object.keys(m.reactions).length > 0 && (
                    <div style={{ position: "absolute", bottom: -12, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                      {Object.values(m.reactions).slice(0, 4).join(" ")}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}>
                    <div style={{ marginLeft: "auto" }}>{fmtTime(m.createdAt)} {renderStatusTick(m)}</div>
                  </div>

                  {/* uploading progress circle inside bubble */}
                  {m.status === "uploading" && uploadingIds[m.id] !== undefined && (
                    <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", color: "#333", fontSize: 12 }}>
                        {uploadingIds[m.id]}%
                      </div>
                    </div>
                  )}

                </div>

                {/* action buttons column */}
                <div style={{ position: "absolute", right: mine ? -46 : "auto", left: mine ? "auto" : -46, top: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <button title="React" onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>😊</button>
                  <button title="More" onClick={() => setMenuOpenFor(m.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>⋯</button>
                </div>

                {/* inline menu */}
                {menuOpenFor === m.id && (
                  <div style={{ position: "absolute", transform: "translate(-50px, -100%)", zIndex: 999, right: mine ? 20 : "auto", left: mine ? "auto" : 80 }}>
                    <div style={{ background: isDark ? "#111" : "#fff", padding: 8, borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button>
                        <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button>
                        {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>}
                        <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button>
                        <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button>
                        <button onClick={() => { if (confirm("Delete for everyone?")) deleteMessageForEveryone(m.id); else deleteMessageForMe(m.id); }} style={menuBtnStyle}>Delete</button>
                        <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button>
                        <button onClick={() => setMenuOpenFor(null)} style={menuBtnStyle}>Close</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* reactions picker */}
                {reactionFor === m.id && (
                  <div style={{ position: "absolute", top: "calc(100% - 12px)", transform: "translateY(6px)", zIndex: 998 }}>
                    <div style={{ display: "flex", gap: 8, padding: 8, borderRadius: 20, background: isDark ? "#111" : "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
                      {INLINE_REACTIONS.map((r) => <button key={r} onClick={() => applyReaction(m.id, r)} style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer" }}>{r}</button>)}
                      <button onClick={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>＋</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </main>

      {/* scroll-to-latest arrow */}
      {!isAtBottom && (
        <button onClick={scrollToBottom} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 120, zIndex: 70, background: "#007bff", color: "#fff", border: "none", borderRadius: 22, width: 48, height: 48, fontSize: 22 }}>↓</button>
      )}

      {/* pinned reply preview */}
      {replyTo && (
        <div style={{ position: "sticky", bottom: 84, left: 12, right: 12, display: "flex", justifyContent: "space-between", background: isDark ? "#101010" : "#fff", padding: 8, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 90 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 4, height: 40, background: "#34B7F1", borderRadius: 4 }} />
            <div style={{ maxWidth: "85%" }}>
              <div style={{ fontSize: 12, color: "#888" }}>{replyTo.senderId === myUid ? "You" : "Them"}</div>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyTo.text || (replyTo.mediaType || "media")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { const el = document.getElementById(`msg-${replyTo.id}`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.boxShadow = "0 0 0 3px rgba(50,115,220,0.18)"; setTimeout(()=>el.style.boxShadow='none',1200); } setReplyTo(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>Go</button>
            <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      {/* preview strip */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {p.url ? (
                p.type === "image" ? <img src={p.url} alt={p.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />
                : p.type === "video" ? <video src={p.url} style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 8 }} />
                : <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{p.name}</div>
              ) : (
                <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{p.name}</div>
              )}

              <button onClick={() => { setSelectedFiles((s) => s.filter((_, i) => i !== idx)); setPreviews((ps) => ps.filter((_, i) => i !== idx)); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>×</button>
            </div>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={sendTextMessage} style={{ padding: "8px 12px", borderRadius: 8, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}>➤</button>
            <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#ddd", border: "none", cursor: "pointer" }}>×</button>
          </div>
        </div>
      )}

      {/* input area */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8, zIndex: 90 }}>
        {/* attach */}
        <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          📎
          <input type="file" multiple style={{ display: "none" }} onChange={onFilesSelected} />
        </label>

        {/* input */}
        <div style={{ flex: 1 }}>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} placeholder="Type a message..." style={{ width: "100%", padding: "10px 12px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#111" : "#f5f5f5", color: isDark ? "#fff" : "#000" }} />
        </div>

        {/* ➤: press&hold to record if input empty */}
        <div>
          <button
            onMouseDown={(e) => { if (!text.trim() && previews.length === 0 && selectedFiles.length === 0) holdRecordStart(e); }}
            onMouseUp={(e) => { if (!text.trim() && previews.length === 0 && selectedFiles.length === 0) holdRecordCancel(e); }}
            onTouchStart={(e) => { if (!text.trim() && previews.length === 0 && selectedFiles.length === 0) holdRecordStart(e); }}
            onTouchEnd={(e) => { if (!text.trim() && previews.length === 0 && selectedFiles.length === 0) holdRecordCancel(e); else sendTextMessage(); }}
            onClick={(e) => {
              // normal click: if have input or previews/files -> send
              if (text.trim() || previews.length > 0 || selectedFiles.length > 0) sendTextMessage();
            }}
            style={{ padding: 10, borderRadius: 12, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}
            title={(!text.trim() && previews.length === 0 && selectedFiles.length === 0) ? "Hold to record" : "Send"}
          >
            {(!text.trim() && previews.length === 0 && selectedFiles.length === 0) ? (recording ? "● Recording" : "🎤") : "➤"}
          </button>
        </div>
      </div>

      {/* emoji picker modal */}
      {showEmojiPicker && (
        <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999 }}>
          <div style={{ width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8 }}>
              {EXTENDED_EMOJIS.map((e) => <button key={e} onClick={() => { applyReaction(emojiPickerFor, e); setShowEmojiPicker(false); }} style={{ padding: 10, fontSize: 20, border: "none", background: "transparent" }}>{e}</button>)}
            </div>
            <div style={{ textAlign: "right", marginTop: 8 }}><button onClick={() => setShowEmojiPicker(false)} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd" }}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
};