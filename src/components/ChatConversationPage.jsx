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
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage.jsx (complete)
 *
 * - Firebase v9 modular imports
 * - Unsigned Cloudinary uploads (images/videos/audio/files)
 * - Multiple file preview + send (➤ sends all previews as messages)
 * - Preview cancel '×' per item and global cancel (×)
 * - Upload progress badge inside placeholder bubble
 * - Reactions (inline set + extended picker)
 * - Forward navigates to /forward/:messageId with state
 * - Header displays friend's name, photo, online/lastSeen
 * - Voice note: press & hold to record, release to send
 * - Redirect to /voice-call/:chatId and /video-call/:chatId
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

  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // { url,type,name,file }
  const [uploadingIds, setUploadingIds] = useState({}); // messageId -> pct
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  const myUid = auth.currentUser?.uid;
  const endRef = useRef(null);

  // friend info (header)
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);

  // ---------------- Cloudinary unsigned upload ----------------
  const uploadToCloudinary = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      try {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) return reject(new Error("Cloudinary env not set"));
        // 'auto' endpoint handles images/video/audio/raw
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

  // ---------------- utility ----------------
  const detectFileType = (file) => {
    const t = file.type || "";
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  // ---------------- load chat meta + friend ----------------
  useEffect(() => {
    if (!chatId) return;
    const load = async () => {
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
      } catch (e) { console.error(e); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // ---------------- messages realtime ----------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(1000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // hide messages deleted for this user
      const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);

      // auto mark delivered for incoming 'sent'
      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch(e){ /* ignore */ }
        }
      });

      setLoadingMsgs(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });

    return () => unsub();
  }, [chatId, myUid]);

  // ---------------- mark seen on visibility ----------------
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].slice().reverse().find(m => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        try { await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" }); } catch(e){}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [messages, chatId, myUid]);

  // ---------------- file select & preview (multiple) ----------------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map(f => ({
      url: f.type.startsWith("image/") || f.type.startsWith("video/") ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f
    }));
    setSelectedFiles(s => [...s, ...files]);
    setPreviews(p => [...p, ...newPreviews]);
    // keep focus on input / don't auto-send — user will press ➤ to send
  };

  // ---------------- send behavior (➤) ----------------
  const sendTextMessage = async () => {
    // If there are previews/files, send them first (each becomes one message)
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      // clear UI immediately so user can continue typing
      setSelectedFiles([]);
      setPreviews([]);

      for (const file of filesToSend) {
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
          const url = await uploadToCloudinary(file, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          // small delay so user can see 100% briefly
          setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 400);
        } catch (err) {
          console.error("upload failed", err);
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: "failed" }).catch(()=>{});
          setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; });
        }
      }
      return;
    }

    // If no files but text exists, send text
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

  // ---------------- retry (note: original file not stored server-side) ----------------
  const retryUpload = async (messageId) => {
    alert("To retry, re-select the file in the picker and send again.");
  };

  // ---------------- reactions ----------------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const existing = data.reactions?.[myUid];
      if (existing === emoji) {
        // set to null (keeps field present as null)
        await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
      setReactionFor(null);
    } catch (e) { console.error(e); }
  };

  // ---------------- message actions ----------------
  const copyMessageText = async (m) => {
    try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); setMenuOpenFor(null); } catch (e) { alert("Copy failed"); }
  };
  const editMessage = async (m) => {
    if (m.senderId !== myUid) return alert("You can only edit your messages.");
    const newText = window.prompt("Edit message", m.text || "");
    if (newText == null) return;
    try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true }); setMenuOpenFor(null); } catch(e){ alert("Edit failed"); }
  };
  const deleteMessageForMe = async (messageId) => { try { await updateDoc(doc(db, "chats", chatId, "messages", messageId), { deletedFor: arrayUnion(myUid) }); setMenuOpenFor(null); } catch(e){ alert("Delete failed"); } };
  const deleteMessageForEveryone = async (messageId) => { if (!window.confirm("Delete for everyone?")) return; try { await deleteDoc(doc(db, "chats", chatId, "messages", messageId)); setMenuOpenFor(null); } catch(e){ alert("Delete failed"); } };
  const forwardMessage = (m) => navigate(`/forward/${m.id}`, { state: { message: m } });
  const pinMessage = async (m) => { try { await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType || "") }); setMenuOpenFor(null); alert("Pinned"); } catch(e){ alert("Pin failed"); } };

  const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };
  const jumpToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.boxShadow = "0 0 0 3px rgba(50,115,220,0.18)";
      setTimeout(() => (el.style.boxShadow = "none"), 1200);
    }
  };

  // ---------------- long-press placeholder (desktop uses right-click/context) ----------------
  // (Mobile handled by touch start/stop events on recorder button)

  // ---------------- voice recording (hold-to-record) ----------------
  useEffect(() => {
    setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
  }, []);

  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported in this browser");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) recorderChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: 'audio/webm' });
        const placeholder = { senderId: myUid, text: '', mediaUrl: '', mediaType: 'audio', createdAt: serverTimestamp(), status: 'uploading', reactions: {} };
        const mRef = await addDoc(collection(db, 'chats', chatId, 'messages'), placeholder);
        const messageId = mRef.id;
        setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
        try {
          const url = await uploadToCloudinary(blob, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { mediaUrl: url, status: 'sent', sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = {...prev}; delete c[messageId]; return c; }), 300);
        } catch (err) {
          console.error(err);
          await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { status: 'failed' }).catch(()=>{});
          setUploadingIds(prev => { const c = {...prev}; delete c[messageId]; return c; });
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
      recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    } catch (e) { console.error(e); }
    setRecording(false);
  };

  // ---------------- UI helpers ----------------
  const renderStatusTick = (m) => {
    if (m.senderId !== myUid) return null;
    if (m.status === 'uploading') return '⌛';
    if (m.status === 'sent') return '✔';
    if (m.status === 'delivered') return '✔✔';
    if (m.status === 'seen') return <span style={{color: '#2b9f4a'}}>✔✔</span>;
    return null;
  };

  const renderMessageContent = (m) => {
    if (m.mediaUrl) {
      switch (m.mediaType) {
        case 'image': return <img src={m.mediaUrl} alt={m.fileName || 'image'} style={{ maxWidth: 320, borderRadius: 12, display: 'block' }} />;
        case 'video': return <video controls src={m.mediaUrl} style={{ maxWidth: 320, borderRadius: 12 }} />;
        case 'audio': return <audio controls src={m.mediaUrl} style={{ width: 280 }} />;
        case 'pdf':
        case 'file': return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || 'Download'}</a>;
        default: return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open</a>;
      }
    }
    return <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>;
  };

  // keyboard send
  const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); } };

  // ---------------- render ----------------
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? '#070707' : '#f5f5f5'), color: isDark ? '#fff' : '#000' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 80, display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: isDark ? '#0b0b0b' : '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <button onClick={() => navigate('/chat')} style={{ fontSize: 20, background: 'transparent', border: 'none', cursor: 'pointer' }}>←</button>
        <img src={friendInfo?.photoURL || '/default-avatar.png'} alt="avatar" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{friendInfo?.displayName || chatInfo?.name || 'Chat'}</div>
          <div style={{ fontSize: 12, color: isDark ? '#bbb' : '#666' }}>
            {friendInfo?.isOnline ? 'Online' : (friendInfo?.lastSeen ? (() => { try { const ld = friendInfo.lastSeen.toDate ? friendInfo.lastSeen.toDate() : new Date(friendInfo.lastSeen); return ld.toLocaleString(); } catch { return 'Offline'; } })() : 'Offline')}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>🎥</button>
          <button onClick={() => navigate(`/chat-settings/${chatId}`)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>⋮</button>
        </div>
      </header>

      {/* Messages */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: 'center', color: '#888', marginTop: 12 }}>Loading messages…</div>}

        {messages.map((m) => {
          const mine = m.senderId === myUid;
          return (
            <div key={m.id} id={`msg-${m.id}`} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{ background: mine ? (isDark ? '#0b84ff' : '#007bff') : (isDark ? '#1b1b1b' : '#fff'), color: mine ? '#fff' : (isDark ? '#fff' : '#000'), padding: 12, borderRadius: 14, maxWidth: '78%', position: 'relative', wordBreak: 'break-word' }}>
                {m.replyTo && (
                  <div style={{ marginBottom: 6, padding: '6px 8px', borderRadius: 8, background: isDark ? '#0f0f0f' : '#f3f3f3', color: isDark ? '#ddd' : '#333', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.replyTo.senderId === myUid ? 'You' : 'Them'}</div>
                    <div style={{ maxHeight: 36, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.replyTo.text}</div>
                  </div>
                )}

                <div>{renderMessageContent(m)}</div>

                {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}> · edited</div>}

                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div style={{ position: 'absolute', bottom: -12, right: 6, background: isDark ? '#111' : '#fff', padding: '4px 8px', borderRadius: 12, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>{Object.values(m.reactions).slice(0,4).join(' ')}</div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}>
                  <div style={{ marginLeft: 'auto' }}>{fmtTime(m.createdAt)} {renderStatusTick(m)}</div>
                </div>

                {m.status === 'uploading' && uploadingIds[m.id] !== undefined && (
                  <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee', color: '#333', fontSize: 12 }}>{uploadingIds[m.id]}%</div>
                  </div>
                )}

                {m.status === 'failed' && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => retryUpload(m.id)} style={{ padding: '6px 8px', borderRadius: 8, border: 'none', background: '#ffcc00', cursor: 'pointer' }}>Retry</button>
                  </div>
                )}
              </div>

              <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button title="React" onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>😊</button>
                <button title="More" onClick={() => setMenuOpenFor(m.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>⋯</button>
              </div>

              {menuOpenFor === m.id && (
                <div style={{ position: 'absolute', transform: 'translate(-50px,-100%)', zIndex: 999, right: (m.senderId === myUid) ? 20 : 'auto', left: (m.senderId === myUid) ? 'auto' : 80 }}>
                  <div style={{ background: isDark ? '#111' : '#fff', padding: 8, borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.14)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button>
                      <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button>
                      {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>}
                      <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button>
                      <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button>
                      <button onClick={() => { if (confirm('Delete for everyone?')) deleteMessageForEveryone(m.id); else deleteMessageForMe(m.id); }} style={menuBtnStyle}>Delete</button>
                      <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button>
                      <button onClick={() => setMenuOpenFor(null)} style={menuBtnStyle}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {reactionFor === m.id && (
                <div style={{ position: 'absolute', top: 'calc(100% - 12px)', transform: 'translateY(6px)', zIndex: 998 }}>
                  <div style={{ display: 'flex', gap: 8, padding: 8, borderRadius: 20, background: isDark ? '#111' : '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', alignItems: 'center' }}>
                    {INLINE_REACTIONS.map(r => <button key={r} onClick={() => applyReaction(m.id, r)} style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer' }}>{r}</button>)}
                    <button onClick={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>＋</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div ref={endRef} />
      </main>

      {/* pinned reply preview */}
      {replyTo && (
        <div style={{ position: 'sticky', bottom: 84, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', background: isDark ? '#101010' : '#fff', padding: 8, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', zIndex: 90 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 4, height: 40, background: '#34B7F1', borderRadius: 4 }} />
            <div style={{ maxWidth: '85%' }}>
              <div style={{ fontSize: 12, color: '#888' }}>{replyTo.senderId === myUid ? 'You' : 'Them'}</div>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.text || (replyTo.mediaType || 'media')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { jumpToMessage(replyTo.id); setReplyTo(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>Go</button>
            <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* previews bar */}
      {previews.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: 8, overflowX: 'auto', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.06)', background: isDark ? '#0b0b0b' : '#fff' }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              {p.url ? (
                p.type === 'image' ? <img src={p.url} alt={p.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} /> : p.type === 'video' ? <video src={p.url} style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#eee' }}>{p.name}</div>
              ) : (
                <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#eee' }}>{p.name}</div>
              )}

              {/* single cancel button per preview */}
              <button onClick={() => { setSelectedFiles(s => s.filter((_,i) => i !== idx)); setPreviews(ps => ps.filter((_,i) => i !== idx)); }} style={{ position: 'absolute', top: -6, right: -6, background: '#ff4d4f', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer' }}>×</button>
            </div>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={sendTextMessage} style={{ padding: '8px 12px', borderRadius: 8, background: '#34B7F1', color: '#fff', border: 'none', cursor: 'pointer' }}>➤</button>
            <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#ddd', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
        </div>
      )}

      {/* input area - sticky */}
      <div style={{ position: 'sticky', bottom: 0, background: isDark ? '#0b0b0b' : '#fff', padding: 10, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 90 }}>
        {/* attach + file input */}
        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          📎
          <input type="file" multiple style={{ display: 'none' }} onChange={onFilesSelected} />
        </label>

        {/* recorder button: hold to record */}
        <div>
          {recorderAvailable ? (
            recording ? (
              <button onMouseUp={stopRecording} onTouchEnd={stopRecording} style={recBtnStyle}>● Release to Send</button>
            ) : (
              <button onMouseDown={startRecording} onTouchStart={startRecording} style={recBtnStyle}>🎤 Hold to Record</button>
            )
          ) : <div style={{ opacity: 0.6 }}>🎤</div>}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} placeholder="Type a message..." style={{ width: '100%', padding: 8, borderRadius: 12, resize: 'none', minHeight: 40, background: isDark ? '#111' : '#f5f5f5', color: isDark ? '#fff' : '#000' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ fontSize: 12, color: '#888' }}>{/* optional hints */}</div>
            <div style={{ display: 'flex', gap: 8 }}>{replyTo && <div style={{ fontSize: 12, color: '#888' }}>{replyTo.senderId === myUid ? 'Replying to you' : 'Replying'}</div>}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={sendTextMessage} style={{ padding: 10, borderRadius: 12, background: '#34B7F1', color: '#fff', border: 'none', cursor: 'pointer' }}>➤</button>
        </div>
      </div>

      {/* emoji picker modal */}
      {showEmojiPicker && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', zIndex: 999 }}>
          <div style={{ width: '100%', maxHeight: '45vh', background: isDark ? '#0b0b0b' : '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 8 }}>
              {EXTENDED_EMOJIS.map(e => <button key={e} onClick={() => { applyReaction(emojiPickerFor, e); setShowEmojiPicker(false); }} style={{ padding: 10, fontSize: 20, border: 'none', background: 'transparent' }}>{e}</button>)}
            </div>
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button onClick={() => setShowEmojiPicker(false)} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: '#ddd' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// small styles
const menuBtnStyle = { padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' };
const recBtnStyle = { padding: '6px 10px', borderRadius: 10, border: 'none', background: '#ff6b6b', color: '#fff', cursor: 'pointer', marginRight: 6 };