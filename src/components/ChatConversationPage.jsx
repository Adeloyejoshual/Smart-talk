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
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage.jsx
 *
 * Features included:
 * - Cloudinary (unsigned) uploads with progress
 * - Multi-file preview and send
 * - Message statuses (sent / delivered / seen)
 * - Real-time updates
 * - Reply-to messages (quote + jump to original)
 * - Long-press / click menu for actions
 * - Reactions (inline + full picker)
 * - Voice notes (hold-to-record)
 * - Sticky header and sticky input
 *
 * Message schema used (Firestore):
 * {
 *   senderId,
 *   text,
 *   mediaUrl,      // if media
 *   mediaType,     // "image"|"video"|"audio"|"pdf"|"file"|null
 *   createdAt,
 *   status,        // "uploading"|"sent"|"delivered"|"seen"
 *   reactions: { [uid]: emoji },
 *   replyTo: { id, text, senderId }
 *   deletedFor: [uid] // optional
 * }
 *
 * Notes:
 * - Requires env: VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET
 * - Upload preset should be set to "Unsigned" in Cloudinary.
 */

// small helpers
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍",
  "😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // object { url, type, name, file }
  const [uploadingIds, setUploadingIds] = useState({}); // messageId -> progress %
  const [replyTo, setReplyTo] = useState(null); // message object
  const [menuOpenFor, setMenuOpenFor] = useState(null); // messageId
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recorderState, setRecorderState] = useState({ available: false, mediaRecorder: null, chunks: [] });
  const [uploadProgress, setUploadProgress] = useState(0);

  const myUid = auth.currentUser?.uid;
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const msgDocsRef = useRef({}); // store unsub functions if necessary

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

  // ---------- detect file type ----------
  const detectFileType = (file) => {
    const t = file.type;
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  // ---------- load messages (real-time) ----------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);

    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(1000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // filter out messages deleted for me
      const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);

      // mark delivered for incoming "sent" messages
      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try {
            const mRef = doc(db, "chats", chatId, "messages", m.id);
            await updateDoc(mRef, { status: "delivered" });
          } catch (e) {
            // ignore
          }
        }
      });

      setLoadingMsgs(false);
      // scroll to bottom (gentle)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
    });

    return () => unsub();
  }, [chatId, myUid]);

  // ---------- mark last message seen when visible ----------
  useEffect(() => {
    if (!chatId || !auth.currentUser) return;
    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        // find last message not by me
        const last = [...messages].slice().reverse().find(m => m.senderId !== myUid);
        if (last && last.status !== "seen") {
          try {
            const lastRef = doc(db, "chats", chatId, "messages", last.id);
            await updateDoc(lastRef, { status: "seen" });
          } catch (e) {}
        }
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    // also call once
    handleVisibility();
    return () => window.removeEventListener("visibilitychange", handleVisibility);
  }, [messages, chatId, myUid]);

  // ---------- file selection and preview ----------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newPreviews = files.map((f) => {
      const url = f.type.startsWith("image/") || f.type.startsWith("video/") ? URL.createObjectURL(f) : null;
      return { url, type: detectFileType(f), name: f.name, file: f };
    });

    setSelectedFiles((s) => [...s, ...files]);
    setPreviews((p) => [...p, ...newPreviews]);
  };

  // ---------- send text or queued files ----------
  const sendTextMessage = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;

    if (selectedFiles.length > 0) {
      // send files (each as a message). We'll create a placeholder message in Firestore with status "uploading"
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]);
      setPreviews([]);

      for (const file of filesToSend) {
        // create placeholder message
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

        // track progress
        setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));

        try {
          const url = await uploadToCloudinary(file, (pct) => {
            setUploadingIds(prev => ({ ...prev, [messageId]: pct }));
          });

          // update message doc with actual url and status
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
            mediaUrl: url,
            status: "sent",
            sentAt: serverTimestamp(),
          });

          // cleanup progress
          setUploadingIds(prev => {
            const c = { ...prev };
            delete c[messageId];
            return c;
          });
        } catch (err) {
          console.error("upload failed", err);
          // mark failed (keep the message so user can retry)
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: "failed" }).catch(()=>{});
          setUploadingIds(prev => {
            const c = { ...prev };
            delete c[messageId];
            return c;
          });
        }
      }
    }

    if (text.trim()) {
      // simple text message
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
        payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaUrl ? (replyTo.mediaType || "media") : ""), senderId: replyTo.senderId || replyTo.sender };
        setReplyTo(null);
      }
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  // ---------- retry upload for a failed message ----------
  const retryUpload = async (messageId) => {
    try {
      const mDoc = await getDoc(doc(db, "chats", chatId, "messages", messageId));
      if (!mDoc.exists()) return;
      const m = mDoc.data();
      // We didn't persist the original file; so we can't re-upload from server.
      // If you want retryable uploads, store file blobs locally or re-select.
      alert("Retry requires re-selecting the file. Please re-send file.");
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- reaction apply ----------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const existing = data.reactions?.[myUid];
      if (existing === emoji) {
        // remove
        await updateDoc(mRef, { [`reactions.${myUid}`]: null });
        // Note: Firestore will set field to null; you can also use a map delete approach if needed in backend rules.
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
      setReactionFor(null);
    } catch (err) {
      console.error("applyReaction", err);
    }
  };

  // ---------- copy text helper ----------
  const copyMessageText = async (m) => {
    try {
      const txt = m.text || m.mediaUrl || m.fileName || "";
      await navigator.clipboard.writeText(txt);
      alert("Copied to clipboard");
      setMenuOpenFor(null);
    } catch (e) {
      console.error(e);
      alert("Copy failed");
    }
  };

  // ---------- delete message (for me / for everyone) ----------
  const deleteMessageForMe = async (messageId) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(mRef, { deletedFor: arrayUnion(myUid) });
      setMenuOpenFor(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete");
    }
  };

  const deleteMessageForEveryone = async (messageId) => {
    if (!window.confirm("Delete for everyone? This will remove the message for all participants.")) return;
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
      setMenuOpenFor(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete for everyone");
    }
  };

  // ---------- edit message ----------
  const editMessage = async (m) => {
    if (m.senderId !== myUid) { alert("You can only edit your messages."); return; }
    const newText = window.prompt("Edit message", m.text || "");
    if (newText == null) return;
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true });
      setMenuOpenFor(null);
    } catch (e) {
      console.error(e);
      alert("Edit failed");
    }
  };

  // ---------- forward (stub: navigate to forward route) ----------
  const forwardMessage = (m) => {
    navigate(`/forward/${m.id}`, { state: { message: m } });
  };

  // ---------- pin message ----------
  const pinMessage = async (m) => {
    try {
      await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType || "") });
      setMenuOpenFor(null);
      alert("Message pinned");
    } catch (e) {
      console.error(e);
      alert("Pin failed");
    }
  };

  // ---------- reply ----------
  const replyToMessage = (m) => {
    setReplyTo(m);
    setMenuOpenFor(null);
  };

  // ---------- jump to original message ----------
  const jumpToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // briefly highlight
      el.style.boxShadow = "0 0 0 3px rgba(50,115,220,0.18)";
      setTimeout(() => (el.style.boxShadow = "none"), 1200);
    }
  };

  // ---------- long-press behavior for mobile ----------
  const longPressStart = (id, m) => {
    // start timer; if held > 450ms open menu
    const timer = setTimeout(() => {
      setMenuOpenFor(id);
    }, 450);
    return timer;
  };

  // ---------- voice recording ----------
  useEffect(() => {
    // check if MediaRecorder is available
    if (typeof window !== "undefined" && navigator.mediaDevices && window.MediaRecorder) {
      setRecorderState(s => ({ ...s, available: true }));
    } else {
      setRecorderState(s => ({ ...s, available: false }));
    }
  }, []);

  const startRecording = async () => {
    if (!recorderState.available) { alert("Recording not supported in this browser"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        // create blob and upload
        const blob = new Blob(chunks, { type: "audio/webm" });
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
        setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
        try {
          const url = await uploadToCloudinary(blob, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setUploadingIds(prev => { const c = {...prev}; delete c[messageId]; return c; });
        } catch (err) {
          console.error("voice upload failed", err);
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: "failed" }).catch(()=>{});
          setUploadingIds(prev => { const c = {...prev}; delete c[messageId]; return c; });
        }
      };
      mediaRecorder.start();
      setRecorderState({ available: true, mediaRecorder, chunks });
      setRecording(true);
    } catch (e) {
      console.error("startRecording", e);
      alert("Could not start recording");
    }
  };

  const stopRecording = () => {
    try {
      recorderState.mediaRecorder?.stop();
      setRecording(false);
      // stop tracks
      recorderState.mediaRecorder?.stream?.getTracks().forEach(t=>t.stop());
      setRecorderState({ available: recorderState.available, mediaRecorder: null, chunks: [] });
    } catch (e) {
      console.error(e);
      setRecording(false);
    }
  };

  // ---------- utility: render status ticks ----------
  const renderStatusTick = (m) => {
    if (m.senderId !== myUid) return null;
    if (m.status === "uploading") return "⌛";
    if (m.status === "sent") return "✔";
    if (m.status === "delivered") return "✔✔";
    if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>;
    return "";
  };

  // ---------- UI render helpers ----------
  const renderMessageContent = (m) => {
    if (m.mediaUrl) {
      switch (m.mediaType) {
        case "image":
          return <img src={m.mediaUrl} alt={m.fileName || "image"} style={{ maxWidth: 320, borderRadius: 12, display: "block" }} />;
        case "video":
          return <video controls src={m.mediaUrl} style={{ maxWidth: 320, borderRadius: 12, display: "block" }} />;
        case "audio":
          return <audio controls src={m.mediaUrl} style={{ width: 300 }} />;
        case "pdf":
        case "file":
          return <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">{m.fileName || "Download file"}</a>;
        default:
          return <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">Open media</a>;
      }
    }
    return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>;
  };

  // ---------- handle Enter / send ----------
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  // ---------- scroll to bottom helper ----------
  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  // ---------- small components (ReactionBar / EmojiPicker) ----------
  const ReactionBar = ({ onPick, onMore }) => (
    <div style={{ display: "flex", gap: 8, padding: 8, borderRadius: 20, background: isDark ? "#111" : "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.08)", alignItems: "center" }}>
      {INLINE_REACTIONS.map(r => <button key={r} onClick={()=>onPick(r)} style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer" }}>{r}</button>)}
      <button onClick={onMore} style={{ border: "none", background: "transparent", cursor: "pointer" }}>＋</button>
    </div>
  );

  const EmojiPicker = ({ onPick, onClose }) => (
    <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999 }}>
      <div style={{ width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8 }}>
          {EXTENDED_EMOJIS.map(e => <button key={e} onClick={() => { onPick(e); onClose(); }} style={{ padding: 10, fontSize: 20, border: "none", background: "transparent" }}>{e}</button>)}
        </div>
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd" }}>Close</button>
        </div>
      </div>
    </div>
  );

  // ---------- main UI ----------
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header - sticky */}
      <header style={{ position: "sticky", top: 0, zIndex: 80, display: "flex", alignItems: "center", gap: 10, padding: 12, background: isDark ? "#0b0b0b" : "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", cursor: "pointer" }}>←</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* profile - try to get from chat doc or from first message */}
          <img src="/default-avatar.png" alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Chat</div>
            <div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666" }}>online</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>🎥</button>
          <button onClick={() => {
            // open chat settings/menu
            navigate(`/chat-settings/${chatId}`);
          }} style={{ background: "transparent", border: "none", cursor: "pointer" }}>⋮</button>
        </div>
      </header>

      {/* messages area */}
      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", color: "#888", marginTop: 12 }}>Loading messages…</div>}

        {messages.map((m) => {
          const mine = m.senderId === myUid;
          return (
            <div
              key={m.id}
              id={`msg-${m.id}`}
              onMouseDown={(e) => {
                // simple long-press for desktop: right-click or long hold
                // we just allow right-click to open menu
                if (e.button === 2) { // right click
                  e.preventDefault();
                  setMenuOpenFor(m.id);
                }
              }}
              onContextMenu={(e) => { e.preventDefault(); setMenuOpenFor(m.id); }}
              style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}
            >
              <div style={{
                background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff"),
                color: mine ? "#fff" : (isDark ? "#fff" : "#000"),
                padding: 12,
                borderRadius: 14,
                maxWidth: "78%",
                position: "relative",
                wordBreak: "break-word",
                boxShadow: menuOpenFor === m.id ? "0 8px 30px rgba(0,0,0,0.2)" : "none",
                border: selectedMessageIds.includes(m.id) ? `2px solid ${isDark ? "#9ad3ff" : "#34B7F1"}` : "none",
                cursor: "pointer"
              }}>
                {/* reply snippet */}
                {m.replyTo && (
                  <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#f3f3f3", color: isDark ? "#ddd" : "#333", fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.replyTo.senderId === myUid ? "You" : "Them"}</div>
                    <div style={{ maxHeight: 36, overflow: "hidden", textOverflow: "ellipsis" }}>{m.replyTo.text}</div>
                  </div>
                )}

                {/* message content */}
                <div onClick={() => {
                  // close menus if open
                  setMenuOpenFor(null);
                  setReactionFor(null);
                }}>
                  {renderMessageContent(m)}
                  {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}> · edited</div>}
                </div>

                {/* reactions preview */}
                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div style={{ position: "absolute", bottom: -10, right: mine ? 6 : 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                    {Object.values(m.reactions).slice(0, 4).join(" ")}
                  </div>
                )}

                {/* meta row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}>
                  <div style={{ marginLeft: "auto" }}>{fmtTime(m.createdAt)} {renderStatusTick(m)}</div>
                </div>

                {/* uploading progress overlay */}
                {m.status === "uploading" && uploadingIds[m.id] !== undefined && (
                  <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", color: "#333", fontSize: 12 }}>
                      {uploadingIds[m.id]}%
                    </div>
                  </div>
                )}

                {/* failed */}
                {m.status === "failed" && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => retryUpload(m.id)} style={{ padding: "6px 8px", borderRadius: 8, border: "none", background: "#ffcc00", cursor: "pointer" }}>Retry</button>
                  </div>
                )}
              </div>

              {/* reaction / menu area */}
              <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <button title="React" onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>😊</button>
                <button title="More" onClick={() => setMenuOpenFor(m.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>⋯</button>
              </div>

              {/* inline menu */}
              {menuOpenFor === m.id && (
                <div style={{
                  position: "absolute",
                  transform: "translate(-50px,-100%)",
                  zIndex: 999,
                  right: mine ? 20 : "auto",
                  left: mine ? "auto" : 80
                }}>
                  <div style={{ background: isDark ? "#111" : "#fff", padding: 8, borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button>
                      <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button>
                      {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>}
                      <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button>
                      <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button>
                      <button onClick={() => {
                        if (confirm("Delete for everyone?")) deleteMessageForEveryone(m.id);
                        else deleteMessageForMe(m.id);
                      }} style={menuBtnStyle}>Delete</button>
                      <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button>
                      <button onClick={() => setMenuOpenFor(null)} style={menuBtnStyle}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {/* emoji picker for this message */}
              {reactionFor === m.id && (
                <div style={{ position: "absolute", top: "calc(100% - 12px)", transform: "translateY(6px)", zIndex: 998 }}>
                  <ReactionBar
                    onPick={(r) => applyReaction(m.id, r)}
                    onMore={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }}
                  />
                </div>
              )}

            </div>
          );
        })}

        <div ref={endRef} />
      </main>

      {/* pinned floating "jump to reply" when replying */}
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
            <button onClick={() => { jumpToMessage(replyTo.id); setReplyTo(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>Go</button>
            <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      {/* previews bar */}
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

              <button onClick={() => { setSelectedFiles(s => s.filter((_,i) => i !== idx)); setPreviews(ps => ps.filter((_,i) => i !== idx)); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>✕</button>
            </div>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={sendTextMessage} style={{ padding: "8px 12px", borderRadius: 8, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}>Send</button>
            <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#ddd", border: "none", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* input area - sticky */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8, zIndex: 90 }}>
        {/* attach + file input */}
        <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          📎
          <input type="file" multiple style={{ display: "none" }} onChange={(e) => onFilesSelected(e)} />
        </label>

        {/* recorder button */}
        <div>
          {recorderState.available ? (
            recording ? (
              <button onMouseUp={stopRecording} onTouchEnd={stopRecording} style={recBtnStyle}>● Release to Send</button>
            ) : (
              <button onMouseDown={startRecording} onTouchStart={startRecording} style={recBtnStyle}>🎤 Hold to Record</button>
            )
          ) : <div style={{ opacity: 0.6 }}>🎤</div>}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} placeholder="Type a message..." style={{ width: "100%", padding: 8, borderRadius: 12, resize: "none", minHeight: 40, background: isDark ? "#111" : "#f5f5f5", color: isDark ? "#fff" : "#000" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <div style={{ fontSize: 12, color: "#888" }}>{/* optional hints */}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {replyTo && <div style={{ fontSize: 12, color: "#888" }}>{replyTo.senderId === myUid ? "Replying to you" : "Replying"}</div>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={sendTextMessage} style={{ padding: 10, borderRadius: 12, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}>➤</button>
        </div>
      </div>

      {/* emoji picker modal */}
      {showEmojiPicker && (
        <EmojiPicker onPick={(e) => applyReaction(emojiPickerFor, e)} onClose={() => setShowEmojiPicker(false)} />
      )}
    </div>
  );
}

// small styles
const menuBtnStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left"
};

const recBtnStyle = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "none",
  background: "#ff6b6b",
  color: "#fff",
  cursor: "pointer",
  marginRight: 6
};