// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
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
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Helpers --------------------
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

const detectFileType = (file) => {
  if (!file?.type) return "file";
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  return "file";
};

const uploadToCloudinary = async (file, onProgress) => {
  try {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new Error("Cloudinary env not set");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", uploadPreset);

    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).secure_url);
        else reject(new Error("Cloudinary upload failed"));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(fd);
    });
  } catch (err) {
    throw err;
  }
};

// -------------------- Constants --------------------
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const COLORS = {
  primary: "#34B7F1",
  primaryDark: "#007bff",
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
const menuBtnStyle = { padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" };

// -------------------- Component --------------------
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;

  // -------------------- Refs --------------------
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  // -------------------- State --------------------
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
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;

    const loadMeta = async () => {
      try {
        const cSnap = await getDoc(doc(db, "chats", chatId));
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });
          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const fSnap = await getDoc(doc(db, "users", friendId));
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
    return () => unsubChat?.();
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), fsLimit(2000));

    const unsub = onSnapshot(q, async (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);

      // Mark incoming messages as delivered
      const updatePromises = docs
        .filter((m) => m.senderId !== myUid && m.status === "sent")
        .map((m) => updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }));
      await Promise.all(updatePromises);

      setLoadingMsgs(false);
      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // -------------------- Visibility: Mark seen --------------------
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].reverse().find((m) => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [messages, chatId, myUid]);

  // -------------------- File select & preview --------------------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newPreviews = files.map((f) => ({
      url: f.type.startsWith("image/") || f.type.startsWith("video/") ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f,
    }));

    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...newPreviews]);
    setSelectedPreviewIndex((prev) => (prev >= 0 ? prev : 0));
  };

  // -------------------- Send message --------------------
  const sendTextMessage = async () => {
    if ((chatInfo?.blockedBy || []).includes(myUid)) return alert("You are blocked in this chat.");

    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]);
      setPreviews([]);
      setSelectedPreviewIndex(0);

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
          setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));

          const url = await uploadToCloudinary(file, (pct) => setUploadingIds((prev) => ({ ...prev, [messageId]: pct })));

          await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
            mediaUrl: url,
            status: "sent",
            sentAt: serverTimestamp(),
          });

          setTimeout(() => setUploadingIds((prev) => {
            const copy = { ...prev };
            delete copy[messageId];
            return copy;
          }), 200);

        } catch (err) {
          console.error("upload error:", err);
        }
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
        scrollToBottom();
      } catch (e) {
        console.error(e);
        alert("Failed to send message");
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

      mr.ondataavailable = (ev) => ev.data.size && recorderChunksRef.current.push(ev.data);

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

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    setRecording(false);
    recorderRef.current = null;
  };

  const holdStart = (e) => { e.preventDefault(); longPressTimer.current = setTimeout(startRecording, 250); };
  const holdEnd = (e) => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); };

  // -------------------- Message actions --------------------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const existing = snap.data().reactions?.[myUid];
      await updateDoc(mRef, { [`reactions.${myUid}`]: existing === emoji ? null : emoji });
      setReactionFor(null);
    } catch (e) { console.error(e); }
  };

  const copyMessageText = async (m) => { try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); setMenuOpenFor(null); } catch { alert("Copy failed"); } };
  const editMessage = async (m) => { if (m.senderId !== myUid) return alert("You can only edit your messages."); const newText = window.prompt("Edit message", m.text || ""); if (newText == null) return; await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true }); setMenuOpenFor(null); };
  const deleteMessageForEveryone = async (id) => { if (!confirm("Delete for everyone?")) return; await deleteDoc(doc(db, "chats", chatId, "messages", id)); setMenuOpenFor(null); };
  const deleteMessageForMe = async (id) => { await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) }); setMenuOpenFor(null); };
  const forwardMessage = (m) => navigate(`/forward/${m.id}`, { state: { message: m } });
  const pinMessage = async (m) => { await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType || "") }); setMenuOpenFor(null); alert("Pinned"); };
  const replyToMessage = (m) => { setReplyTo(m); setMenuOpenFor(null); };

  // -------------------- Touch handlers --------------------
  const handleMsgTouchStart = (m) => { longPressTimer.current = setTimeout(() => setMenuOpenFor(m.id), 500); swipeStartX.current = null; };
  const handleMsgTouchMove = (ev) => { if (!swipeStartX.current && ev.touches?.[0]) swipeStartX.current = ev.touches[0].clientX; };
  const handleMsgTouchEnd = (m, e) => { clearTimeout(longPressTimer.current); if (!swipeStartX.current) return; const endX = e.changedTouches?.[0]?.clientX; if (endX == null) return; if (swipeStartX.current - endX > 80) replyToMessage(m); swipeStartX.current = null; };

  // -------------------- Click outside to close menus --------------------
  const handleClickOutside = useCallback((e) => {
    const menuEl = menuOpenFor && document.getElementById(`msg-menu-${menuOpenFor}`);
    if (menuEl && !menuEl.contains(e.target)) setMenuOpenFor(null);
    if (reactionFor && !e.target.closest("div[style*='INLINE_REACTIONS']")) setReactionFor(null);
    if (headerMenuOpen && !e.target.closest("#header-menu")) setHeaderMenuOpen(false);
  }, [menuOpenFor, reactionFor, headerMenuOpen]);

  useEffect(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("touchstart", handleClickOutside);
  }, [handleClickOutside]);

  // -------------------- Header actions --------------------
  const clearChat = async () => {
    if (!confirm("Clear chat?")) return;
    const snap = await getDocs(query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc")));
    for (const d of snap.docs) try { await deleteDoc(d.ref); } catch {}
    setHeaderMenuOpen(false);
    alert("Chat cleared.");
  };

  const toggleBlock = async () => {
    if (!chatInfo) return;
    const chatRef = doc(db, "chats", chatId);
    const blockedBy = chatInfo.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
      setChatInfo(prev => ({ ...prev, blockedBy: blockedBy.filter(u => u !== myUid) }));
      alert("Unblocked user.");
    } else {
      await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
      setChatInfo(prev => ({ ...prev, blockedBy: [...blockedBy, myUid] }));
      alert("Blocked user.");
    }
    setHeaderMenuOpen(false);
  };

  const startVoiceCall = () => navigate(`/voicecall/${chatId}`);
  const startVideoCall = () => navigate(`/videocall/${chatId}`);

  // -------------------- Render message --------------------
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
        onTouchEnd={(e) => handleMsgTouchEnd(m, e)}
      >
        <div
          style={{
            maxWidth: "70%",
            padding: SPACING.sm,
            borderRadius: SPACING.borderRadius,
            backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
            color: isMine ? "#fff" : isDark ? COLORS.darkText : COLORS.lightText,
            cursor: "pointer",
            wordBreak: "break-word",
          }}
        >
          {m.replyTo && (
            <div
              style={{
                fontSize: 12,
                color: COLORS.edited,
                borderLeft: `3px solid ${COLORS.mutedText}`,
                paddingLeft: 4,
                marginBottom: 4,
              }}
            >
              {m.replyTo.text || m.replyTo.mediaType}
            </div>
          )}

          {m.text && <div>{m.text}</div>}
          {m.mediaUrl && (
            <div style={{ marginTop: 4 }}>
              {m.mediaType === "image" && <img src={m.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
              {m.mediaType === "video" && <video src={m.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />}
              {m.mediaType === "audio" && <audio src={m.mediaUrl} controls />}
              {m.mediaType === "pdf" && (
                <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                  {m.fileName || "PDF Document"}
                </a>
              )}
            </div>
          )}

          {uploadingIds[m.id] != null && (
            <div style={{ marginTop: 4, fontSize: 10, color: COLORS.mutedText }}>
              Uploading: {uploadingIds[m.id]}%
            </div>
          )}

          <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
            {m.edited && "(edited)"} {time} {m.status && isMine ? `• ${m.status}` : ""}
          </div>

          {Object.keys(m.reactions || {}).length > 0 && (
            <div style={{ position: "absolute", bottom: -12, right: -12, display: "flex", gap: 2 }}>
              {Object.values(m.reactions).map((r, i) => r && (
                <span
                  key={i}
                  style={{
                    backgroundColor: COLORS.reactionBg,
                    color: "#fff",
                    borderRadius: 8,
                    padding: "0 4px",
                    fontSize: 10,
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          {showMenu && (
            <div
              id={`msg-menu-${m.id}`}
              style={{
                position: "absolute",
                top: -SPACING.lg,
                right: 0,
                background: COLORS.lightCard,
                border: `1px solid ${COLORS.grayBorder}`,
                borderRadius: SPACING.borderRadius,
                zIndex: 10,
              }}
            >
              <button style={menuBtnStyle} onClick={() => replyToMessage(m)}>Reply</button>
              <button style={menuBtnStyle} onClick={() => setReactionFor(m.id)}>React</button>
              {isMine && <button style={menuBtnStyle} onClick={() => editMessage(m)}>Edit</button>}
              {isMine && <button style={menuBtnStyle} onClick={() => deleteMessageForEveryone(m.id)}>Delete for Everyone</button>}
              <button style={menuBtnStyle} onClick={() => deleteMessageForMe(m.id)}>Delete for Me</button>
              <button style={menuBtnStyle} onClick={() => forwardMessage(m)}>Forward</button>
              <button style={menuBtnStyle} onClick={() => pinMessage(m)}>Pin</button>
              <button style={menuBtnStyle} onClick={() => copyMessageText(m)}>Copy</button>
              <button style={menuBtnStyle} onClick={() => setMenuOpenFor(null)}>Close</button>
            </div>
          )}

          {showReactionPicker && (
            <div
              style={{
                position: "absolute",
                bottom: -28,
                left: 0,
                display: "flex",
                gap: 4,
                background: COLORS.lightCard,
                borderRadius: SPACING.borderRadius,
                padding: "2px 4px",
              }}
            >
              {INLINE_REACTIONS.map((r, i) => (
                <span
                  key={i}
                  style={{ cursor: "pointer", fontSize: 14 }}
                  onClick={() => applyReaction(m.id, r)}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------- Render --------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg) }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: SPACING.sm, background: COLORS.headerBlue, color: "#fff", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, cursor: "pointer" }} onClick={() => navigate(-1)}>
          <span style={{ fontWeight: "bold", fontSize: 18 }}>←</span>
          <div>
            <div>{friendInfo?.displayName || "Unknown"}</div>
            <div style={{ fontSize: 12 }}>{friendInfo?.online ? "Online" : friendInfo?.lastSeen ? `Last seen ${fmtTime(friendInfo.lastSeen)}` : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
          <button onClick={startVoiceCall}>📞</button>
          <button onClick={startVideoCall}>🎥</button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setHeaderMenuOpen(prev => !prev)}>⋮</button>
            {headerMenuOpen && (
              <div id="header-menu" style={{ position: "absolute", top: 24, right: 0, background: COLORS.lightCard, border: `1px solid ${COLORS.grayBorder}`, borderRadius: SPACING.borderRadius, zIndex: 200 }}>
                <button style={menuBtnStyle} onClick={clearChat}>Clear Chat</button>
                <button style={menuBtnStyle} onClick={toggleBlock}>{chatInfo?.blockedBy?.includes(myUid) ? "Unblock" : "Block"}</button>
                <button style={menuBtnStyle} onClick={() => alert("Report clicked")}>Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}>
        {messages.map((m) => renderMessage(m))}
        <div ref={endRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ background: COLORS.lightCard, padding: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}` }}>
          Replying to: {replyTo.text || replyTo.mediaType}
          <button onClick={() => setReplyTo(null)} style={{ marginLeft: SPACING.sm }}>✖</button>
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", alignItems: "center", padding: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: isDark ? COLORS.darkCard : COLORS.lightCard }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: `1px solid ${COLORS.grayBorder}`, marginRight: SPACING.sm }}
        />
        <input type="file" multiple style={{ display: "none" }} id="file-input" onChange={onFilesSelected} />
        <button onClick={() => document.getElementById("file-input").click()}>📎</button>
        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
        >
          {recording ? "⏹️" : "🎤"}
        </button>
        <button onClick={sendTextMessage}>➡️</button>
      </div>
    </div>
  );
}