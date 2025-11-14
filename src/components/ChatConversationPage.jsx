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
  deleteDoc,
  arrayUnion,
  arrayRemove,
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage.jsx
 *
 * - Uses Cloudinary unsigned upload via env vars:
 *   VITE_CLOUDINARY_CLOUD_NAME
 *   VITE_CLOUDINARY_UPLOAD_PRESET
 *
 * - Features:
 *   • Deep-blue header (#1877F2) with avatar/name -> /profile/:userId
 *   • Voice recording (press & hold) -> uploads and shows playable audio message
 *   • Multiple file select; thumbnails; select/pin one preview; clicking ➤ sends either pinned preview (if selected) or all
 *   • Upload placeholder messages with percent indicator inside chat
 *   • Swipe-left to reply (touch); long-press/right-click menu; reactions; forward
 *   • Scroll-to-latest floating arrow
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

  const myUid = auth.currentUser?.uid;

  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // { url, type, name, file }
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(null); // pinned preview index
  const [uploadingIds, setUploadingIds] = useState({}); // { messageId: pct }
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // recording
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  // swipe detection
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  // ---------- Cloudinary unsigned uploader ----------
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
            const pct = Math.round((e.loaded * 100) / e.total);
            onProgress(pct);
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
      } catch (err) { reject(err); }
    });
  };

  const detectFileType = (file) => {
    const t = file.type || "";
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  // ---------- load chat and friend ----------
  useEffect(() => {
    if (!chatId) return;
    (async () => {
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
      } catch (e) {
        console.error("load chat", e);
      }
    })();
  }, [chatId, myUid]);

  // ---------- realtime messages ----------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // filter out deleted for me
      const visible = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(visible);

      // mark incoming as delivered if status is "sent"
      visible.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch(e){ }
        }
      });

      setLoadingMsgs(false);

      // auto scroll if near bottom
      setTimeout(() => {
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- scroll bottom detection ----------
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

  // ---------- mark seen on focus/visibility ----------
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].slice().reverse().find(m => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        try { await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" }); } catch(e) {}
      }
    };
    document.addEventListener("visibilitychange", handler);
    handler();
    return () => document.removeEventListener("visibilitychange", handler);
  }, [messages, chatId, myUid]);

  // ---------- file selection & previews ----------
  const onFilesSelected = (e) => {
    const sel = Array.from(e.target.files || []);
    if (!sel.length) return;
    const newPreviews = sel.map(f => ({
      url: (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f,
    }));
    setFiles(prev => [...prev, ...sel]);
    setPreviews(prev => {
      const combined = [...prev, ...newPreviews];
      // if no pinned preview, set first as selected
      if (selectedPreviewIndex === null && combined.length > 0) setSelectedPreviewIndex(0);
      return combined;
    });
  };

  // ---------- send (➤) behavior ----------
  // If pinned preview selected -> send that one only (and remove from previews)
  // Else if previews exist -> send all previews
  // Else if text -> send text message
  const sendHandler = async () => {
    // If pinned preview exists -> send that file
    if (previews.length > 0) {
      const pinnedIdx = selectedPreviewIndex;
      if (pinnedIdx !== null && previews[pinnedIdx]) {
        const item = previews[pinnedIdx];
        await sendFileAsMessage(item.file, item.type, item.name);
        // remove the pinned preview only
        setFiles(prev => {
          // remove first matching file by name+size heuristic
          const idxToRemove = prev.findIndex(f => f.name === item.name && f.size === item.file.size);
          if (idxToRemove >= 0) prev.splice(idxToRemove,1);
          return [...prev];
        });
        setPreviews(prev => prev.filter((_,i)=>i!==pinnedIdx));
        setSelectedPreviewIndex(prev => {
          if (previews.length <= 1) return null;
          return prev > 0 ? prev - 1 : 0;
        });
        return;
      }

      // no pinned, send all
      const toSend = [...previews];
      for (const p of toSend) {
        await sendFileAsMessage(p.file, p.type, p.name);
        // remove matching file from files/previews
        setFiles(prev => {
          const idx = prev.findIndex(f => f.name === p.name && f.size === p.file.size);
          if (idx>=0) prev.splice(idx,1);
          return [...prev];
        });
        setPreviews(prev => prev.filter(x => x.name !== p.name || x.url !== p.url));
      }
      setSelectedPreviewIndex(null);
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
      try {
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText("");
        setTimeout(() => scrollToBottom(), 80);
      } catch (e) {
        console.error("send text failed", e);
        alert("Failed to send message");
      }
    }
  };

  // helper: create placeholder message and upload file, then update message
  const sendFileAsMessage = async (file, fileType, fileName) => {
    const placeholder = {
      senderId: myUid,
      text: "",
      mediaUrl: "",
      mediaType: fileType,
      fileName: fileName || file.name,
      createdAt: serverTimestamp(),
      status: "uploading",
      reactions: {},
    };
    try {
      const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
      const messageId = mRef.id;
      setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));

      const url = await uploadToCloudinary(file, (pct) => {
        setUploadingIds(prev => ({ ...prev, [messageId]: pct }));
      });

      await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
        mediaUrl: url,
        status: "sent",
        sentAt: serverTimestamp(),
      });

      // remove progress after short delay
      setTimeout(() => setUploadingIds(prev => {
        const c = { ...prev }; delete c[messageId]; return c;
      }), 400);
    } catch (e) {
      console.error("upload failed", e);
      // mark message failed if exists
      // best-effort: set status to failed
      try { await updateDoc(doc(db, "chats", chatId, "messages", placeholder.id || ""), { status: "failed" }); } catch(_) {}
      // cleanup progress
      setUploadingIds(prev => {
        const c = { ...prev }; Object.keys(c).forEach(k => { if (c[k] === 0) delete c[k]; }); return c;
      });
      alert("Upload failed. Check Cloudinary or network.");
    }
  };

  // ---------- recording handlers (press & hold) ----------
  useEffect(() => {
    setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
  }, []);

  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendFileAsMessage(blob, "audio", `voice-${Date.now()}.webm`);
        // stop tracks
        try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
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
    } catch (e) { console.error(e); }
    setRecording(false);
  };

  // press & hold logic for ➤ button (desktop & touch)
  const holdTimerRef = useRef(null);
  const handleActionMouseDown = (e) => {
    // only start hold if input empty and there are no previews
    if (text.trim() || previews.length > 0) return;
    holdTimerRef.current = setTimeout(() => startRecording(), 220);
  };
  const handleActionMouseUp = (e) => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (recording) stopRecording();
  };

  // ---------- message actions ----------
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
    } catch (e) { console.error(e); }
  };

  const copyMessageText = async (m) => {
    try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); setMenuOpenFor(null); } catch (e) { alert("Copy failed"); }
  };

  const editMessage = async (m) => {
    if (m.senderId !== myUid) return alert("You can only edit your messages.");
    const newText = window.prompt("Edit message", m.text || "");
    if (newText == null) return;
    try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true }); setMenuOpenFor(null); } catch(e){ alert("Edit failed"); }
  };

  const deleteForEveryone = async (id) => {
    if (!confirm("Delete for everyone?")) return;
    try { await deleteDoc(doc(db, "chats", chatId, "messages", id)); setMenuOpenFor(null); } catch(e){ alert("Delete failed"); }
  };

  const deleteForMe = async (id) => {
    try { await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) }); setMenuOpenFor(null); } catch(e){ alert("Delete failed"); }
  };

  const forwardMessage = (m) => navigate(`/forward/${m.id}`, { state: { message: m } });
  const pinMessage = async (m) => { try { await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType||'') }); alert("Pinned"); setMenuOpenFor(null); } catch(e){ alert("Pin failed"); } };
  const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };

  // swipe-to-reply: start/move/end
  const onMsgTouchStart = (e) => {
    touchStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
    touchCurrentX.current = touchStartX.current;
  };
  const onMsgTouchMove = (e) => {
    touchCurrentX.current = e.touches ? e.touches[0].clientX : e.clientX;
  };
  const onMsgTouchEnd = (m) => {
    const dx = touchCurrentX.current - touchStartX.current;
    // swipe left (dx < -60) -> reply
    if (dx < -60) replyToMessage(m);
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  // ---------- header actions (call, video, block/unblock, profile) ----------
  const startVoiceCall = () => navigate(`/voice-call/${chatId}`);
  const startVideoCall = () => navigate(`/video-call/${chatId}`);
  const toggleBlock = async () => {
    try {
      const cRef = doc(db, "chats", chatId);
      const cSnap = await getDoc(cRef);
      if (!cSnap.exists()) return;
      const data = cSnap.data();
      const blocked = data.blockedBy || [];
      if (blocked.includes(myUid)) {
        // unblock
        await updateDoc(cRef, { blockedBy: arrayRemove(myUid) });
      } else {
        await updateDoc(cRef, { blockedBy: arrayUnion(myUid) });
      }
      setHeaderMenuOpen(false);
    } catch (e) { console.error(e); }
  };

  // show avatar/name click -> redirect to /profile/:userId
  const onProfileClick = () => {
    if (friendInfo?.id) navigate(`/profile/${friendInfo.id}`);
  };

  // ---------- small UI helpers ----------
  const renderStatusTick = (m) => {
    if (m.senderId !== myUid) return null;
    if (m.status === "uploading") return "⌛";
    if (m.status === "sent") return "✔";
    if (m.status === "delivered") return "✔✔";
    if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>;
    return null;
  };

  const renderMessageContent = (m) => {
    if (m.mediaUrl) {
      switch (m.mediaType) {
        case "image":
          return <img src={m.mediaUrl} alt={m.fileName || "image"} style={{ maxWidth: 360, borderRadius: 12 }} />;
        case "video":
          return <video controls src={m.mediaUrl} style={{ maxWidth: 360, borderRadius: 12 }} />;
        case "audio":
          return <audio controls src={m.mediaUrl} style={{ width: 300 }} />;
        case "pdf":
        case "file":
          return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>;
        default:
          return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open media</a>;
      }
    }
    return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>;
  };

  // ---------- UI ----------
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 90, display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#1877F2", color: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>←</button>
        <img onClick={onProfileClick} src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: friendInfo ? "pointer" : "default" }} />
        <div style={{ minWidth: 0, cursor: friendInfo ? "pointer" : "default" }} onClick={onProfileClick}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 12, opacity: 0.95 }}>{friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? (() => { const ld = friendInfo.lastSeen.toDate ? friendInfo.lastSeen.toDate() : new Date(friendInfo.lastSeen); return ld.toLocaleString(); })() : "Offline")}</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button title="Voice call" onClick={startVoiceCall} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}>📞</button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setHeaderMenuOpen(s => !s)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>⋮</button>
            {headerMenuOpen && (
              <div style={{ position: "absolute", right: 0, top: 36, background: "#fff", color: "#000", padding: 8, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                <button onClick={() => { setHeaderMenuOpen(false); startVideoCall(); }} style={menuBtnStyle}>Video Call</button>
                <button onClick={() => { toggleBlock(); }} style={menuBtnStyle}>{(chatInfo?.blockedBy || []).includes(myUid) ? "Unblock" : "Block"}</button>
                <button onClick={() => { setHeaderMenuOpen(false); onProfileClick(); }} style={menuBtnStyle}>View Profile</button>
                <button onClick={() => { setHeaderMenuOpen(false); alert("Reported"); }} style={menuBtnStyle}>Report</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", color: "#888", marginTop: 12 }}>Loading messages…</div>}
        {messages.map(m => {
          const mine = m.senderId === myUid;
          return (
            <div
              key={m.id}
              id={`msg-${m.id}`}
              onTouchStart={(e) => { onMsgTouchStart(e); }}
              onTouchMove={(e) => { onMsgTouchMove(e); }}
              onTouchEnd={() => { onMsgTouchEnd(m); }}
              onMouseDown={(e) => { if (e.button === 2) setMenuOpenFor(m.id); }}
              style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, position: "relative" }}
            >
              <div style={{
                background: mine ? "#0b84ff" : (isDark ? "#1b1b1b" : "#fff"),
                color: mine ? "#fff" : (isDark ? "#fff" : "#000"),
                padding: 12,
                borderRadius: 14,
                maxWidth: "78%",
                position: "relative",
                wordBreak: "break-word",
                boxShadow: menuOpenFor === m.id ? "0 8px 30px rgba(0,0,0,0.12)" : "none"
              }}>
                {m.replyTo && (
                  <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#f3f3f3", color: isDark ? "#ddd" : "#333", fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.replyTo.senderId === myUid ? "You" : "Them"}</div>
                    <div style={{ maxHeight: 40, overflow: "hidden", textOverflow: "ellipsis" }}>{m.replyTo.text}</div>
                  </div>
                )}

                <div onClick={() => { setMenuOpenFor(null); setReactionFor(null); }}>
                  {renderMessageContent(m)}
                </div>

                {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}> · edited</div>}

                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div style={{ position: "absolute", bottom: -14, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                    {Object.values(m.reactions).slice(0, 4).join(" ")}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}>
                  <div style={{ marginLeft: "auto" }}>{fmtTime(m.createdAt)} {renderStatusTick(m)}</div>
                </div>

                {/* upload progress circle */}
                {m.status === "uploading" && uploadingIds[m.id] !== undefined && (
                  <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#333", fontSize: 12 }}>
                      {uploadingIds[m.id]}%
                    </div>
                  </div>
                )}

                {m.status === "failed" && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => alert("Please re-send file to retry")} style={{ padding: "6px 8px", borderRadius: 8, border: "none", background: "#ffcc00", cursor: "pointer" }}>Retry</button>
                  </div>
                )}
              </div>

              {/* right-side small buttons */}
              <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <button title="React" onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>😊</button>
                <button title="More" onClick={() => setMenuOpenFor(m.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>⋯</button>
              </div>

              {/* inline menu */}
              {menuOpenFor === m.id && (
                <div style={{ position: "absolute", zIndex: 999, transform: "translate(-50px,-100%)", right: (m.senderId === myUid) ? 20 : "auto", left: (m.senderId === myUid) ? "auto" : 80 }}>
                  <div style={{ background: isDark ? "#111" : "#fff", padding: 8, borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button>
                      <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button>
                      {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>}
                      <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button>
                      <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button>
                      <button onClick={() => { if (confirm("Delete for everyone?")) deleteForEveryone(m.id); else deleteForMe(m.id); }} style={menuBtnStyle}>Delete</button>
                      <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button>
                      <button onClick={() => setMenuOpenFor(null)} style={menuBtnStyle}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {/* reactions bar */}
              {reactionFor === m.id && (
                <div style={{ position: "absolute", top: "calc(100% - 12px)", transform: "translateY(6px)", zIndex: 998 }}>
                  <div style={{ display: "flex", gap: 8, padding: 8, borderRadius: 20, background: isDark ? "#111" : "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.08)", alignItems: "center" }}>
                    {INLINE_REACTIONS.map(r => <button key={r} onClick={() => applyReaction(m.id, r)} style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer" }}>{r}</button>)}
                    <button onClick={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>＋</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div ref={endRef} />
      </main>

      {/* scroll to bottom arrow */}
      {!isAtBottom && (
        <button onClick={scrollToBottom} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 120, zIndex: 70, background: "#1877F2", color: "#fff", border: "none", borderRadius: 22, width: 48, height: 48, fontSize: 22 }}>↓</button>
      )}

      {/* selected preview pinned above input */}
      {selectedPreviewIndex !== null && previews[selectedPreviewIndex] && (
        <div style={{ padding: 8, borderTop: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#0b0b0b" : "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 96, height: 72, borderRadius: 8, overflow: "hidden", flex: "none" }}>
            {previews[selectedPreviewIndex].type === "image" ? <img src={previews[selectedPreviewIndex].url} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
              previews[selectedPreviewIndex].type === "video" ? <video src={previews[selectedPreviewIndex].url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#eee" }}>{previews[selectedPreviewIndex].name}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{previews[selectedPreviewIndex].name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{previews[selectedPreviewIndex].type}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { /* unpin (send all behavior unchanged) */ setSelectedPreviewIndex(null); }} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20 }}>↩</button>
            <button onClick={() => { setFiles([]); setPreviews([]); setSelectedPreviewIndex(null); }} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20 }}>×</button>
          </div>
        </div>
      )}

      {/* previews carousel */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative", border: idx === selectedPreviewIndex ? `2px solid ${isDark ? "#9ad3ff" : "#1877F2"}` : "none", borderRadius: 8 }}>
              {p.url ? (p.type === "image" ? <img src={p.url} alt={p.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, cursor: "pointer" }} onClick={() => setSelectedPreviewIndex(idx)} /> :
                p.type === "video" ? <video src={p.url} style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 8, cursor: "pointer" }} onClick={() => setSelectedPreviewIndex(idx)} /> :
                <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee", cursor: "pointer" }} onClick={() => setSelectedPreviewIndex(idx)}>{p.name}</div>)
                : (<div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{p.name}</div>)}
              <button onClick={() => { setFiles(prev => { const c = [...prev]; c.splice(idx,1); return c; }); setPreviews(prev => { const c = [...prev]; c.splice(idx,1); return c; }); if (selectedPreviewIndex === idx) setSelectedPreviewIndex(null); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>×</button>
            </div>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => { /* send pinned or all */ sendHandler(); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#1877F2", color: "#fff", border: "none", cursor: "pointer" }}>➤</button>
            <button onClick={() => { setFiles([]); setPreviews([]); setSelectedPreviewIndex(null); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#ddd", border: "none", cursor: "pointer" }}>×</button>
          </div>
        </div>
      )}

      {/* input area */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8, zIndex: 90 }}>
        <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          📎
          <input type="file" multiple style={{ display: "none" }} onChange={onFilesSelected} />
        </label>

        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendHandler(); } }}
            placeholder="Type a message..."
            style={{ width: "100%", padding: "10px 12px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#111" : "#f5f5f5", color: isDark ? "#fff" : "#000" }}
          />
        </div>

        <div>
          <button
            onMouseDown={handleActionMouseDown}
            onMouseUp={handleActionMouseUp}
            onMouseLeave={handleActionMouseUp}
            onTouchStart={handleActionMouseDown}
            onTouchEnd={(e) => { handleActionMouseUp(); /* if touch end and text or previews exist -> send */ if (text.trim() || previews.length>0) sendHandler(); }}
            onClick={() => {
              // normal click
              if (text.trim() || previews.length > 0) sendHandler();
            }}
            style={{ padding: 10, borderRadius: 12, background: "#1877F2", color: "#fff", border: "none", cursor: "pointer", minWidth: 56 }}
            title={(!text.trim() && previews.length === 0) ? (recording ? "Recording..." : "Hold to record / Tap to start recording") : "Send"}
          >
            {(!text.trim() && previews.length === 0) ? (recording ? "● Rec" : "🎤") : "➤"}
          </button>
        </div>
      </div>

      {/* emoji picker modal */}
      {showEmojiPicker && (
        <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999 }}>
          <div style={{ width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8 }}>
              {EXTENDED_EMOJIS.map(e => <button key={e} onClick={() => { applyReaction(emojiPickerFor, e); setShowEmojiPicker(false); }} style={{ padding: 10, fontSize: 20, border: "none", background: "transparent" }}>{e}</button>)}
            </div>
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button onClick={() => setShowEmojiPicker(false)} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle = { padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" };