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
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
};

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];

const menuBtnStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%"
};

// -------------------- VoiceMessage --------------------
function VoiceMessage({ src }) {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let ctx, animationId, source, analyser, audioCtx;
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const draw = () => {
      if (!analyser) return;
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasCtx = canvas.getContext("2d");
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvasCtx.fillStyle = "#f1f1f1";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#34B7F1";
      canvasCtx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y);
        x += sliceWidth;
      }
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
      animationId = requestAnimationFrame(draw);
    };

    const init = async () => {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        draw();
      } catch (e) { setSupported(false); }
    };

    init();
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      try { if (source) source.disconnect(); if (analyser) analyser.disconnect(); if (audioCtx) audioCtx.close(); } catch (e) {}
    };
  }, [src]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <audio ref={audioRef} src={src} controls style={{ width: 200 }} />
      <canvas ref={canvasRef} width={160} height={40} style={{ borderRadius: 6, background: "#f1f1f1", display: "block" }} />
    </div>
  );
}

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
  const containerRef = useRef(null);

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
  const [emojiPickerGlobal, setEmojiPickerGlobal] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // ---------- Cloudinary upload ----------
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
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
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
    const t = file.type;
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  // ---------- load chat & friend info ----------
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
        unsubChat = onSnapshot(cRef, s => { if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() })); });
      } catch (e) { console.error(e); }
    };
    loadMeta();
    return () => { if (unsubChat) unsubChat(); };
  }, [chatId, myUid]);

  // ---------- messages realtime ----------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(m => !(m.deletedFor && Array.isArray(m.deletedFor) && m.deletedFor.includes(myUid)));
      setMessages(filtered);
      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch (e) {}
        }
      });
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

// ---------- scroll handling ----------
  const handleScroll = () => {
    const el = messagesRefEl.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setIsAtBottom(atBottom);
  };

  // ---------- send message ----------
  const sendMessage = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;
    const msgsRef = collection(db, "chats", chatId, "messages");
    let attachments = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const id = `${Date.now()}-${i}`;
      setUploadingIds(prev => ({ ...prev, [id]: 0 }));
      try {
        const url = await uploadToCloudinary(file, (p) => setUploadingIds(prev => ({ ...prev, [id]: p })));
        attachments.push({ url, type: detectFileType(file), name: file.name });
      } catch (e) { console.error(e); }
      setUploadingIds(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
    }

    await addDoc(msgsRef, {
      senderId: myUid,
      text: text.trim(),
      attachments,
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text || "", sender: replyTo.senderId } : null,
      createdAt: serverTimestamp(),
      status: "sent",
      reactions: {},
    });

    setText("");
    setSelectedFiles([]);
    setPreviews([]);
    setReplyTo(null);
    setSelectedPreviewIndex(0);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // ---------- handle file selection ----------
  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    const urls = files.map(f => ({ url: URL.createObjectURL(f), type: detectFileType(f), name: f.name }));
    setPreviews(urls);
    setSelectedPreviewIndex(0);
  };

  // ---------- start/stop recording ----------
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;
      recorderChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { recorderChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        setSelectedFiles([new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" })]);
        setPreviews([{ url: URL.createObjectURL(blob), type: "audio" }]);
        setSelectedPreviewIndex(0);
        setRecording(false);
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (e) { console.error(e); setRecording(false); }
  };

  const stopRecording = () => { recorderRef.current?.stop(); };

  // ---------- add reaction ----------
  const addReaction = async (msgId, emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", msgId);
    const msg = messages.find(m => m.id === msgId);
    const reactions = msg.reactions || {};
    const myReaction = reactions[myUid];
    const update = { ...reactions, [myUid]: myReaction === emoji ? "" : emoji };
    await updateDoc(msgRef, { reactions: update });
    setReactionFor(null);
  };

  // ---------- render message ----------
  const renderMessage = (msg) => {
    const isMine = msg.senderId === myUid;
    return (
      <div key={msg.id} style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 12,
        position: "relative"
      }}>
        {msg.replyTo && (
          <div style={{
            background: isDark ? "#333" : "#f1f1f1",
            borderRadius: 8,
            padding: "4px 8px",
            fontSize: 12,
            marginBottom: 4,
            maxWidth: "80%"
          }}>
            Reply to: {msg.replyTo.text}
          </div>
        )}

        <div
          onContextMenu={(e) => { e.preventDefault(); setMenuOpenFor(msg.id); }}
          style={{
            background: isMine ? "#34B7F1" : isDark ? "#555" : "#eee",
            color: isMine ? "#fff" : "#000",
            borderRadius: 16,
            padding: "8px 12px",
            maxWidth: "70%",
            position: "relative",
            cursor: "pointer"
          }}
        >
          {msg.text && <div style={{ marginBottom: msg.attachments?.length ? 4 : 0 }}>{msg.text}</div>}
          {msg.attachments?.map((att, idx) => {
            if (att.type === "image") return <img key={idx} src={att.url} alt="" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 4 }} />;
            if (att.type === "video") return <video key={idx} src={att.url} controls style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 4 }} />;
            if (att.type === "audio") return <VoiceMessage key={idx} src={att.url} />;
            return <a key={idx} href={att.url} target="_blank" rel="noreferrer">{att.name}</a>;
          })}

          {msg.reactions && Object.values(msg.reactions).some(Boolean) && (
            <div style={{ display: "flex", gap: 4, position: "absolute", bottom: -16, right: isMine ? 0 : undefined, left: !isMine ? 0 : undefined }}>
              {Object.values(msg.reactions).filter(Boolean).map((r, i) => <span key={i}>{r}</span>)}
            </div>
          )}
          <div style={{ fontSize: 10, color: isDark ? "#aaa" : "#666", marginTop: 2, textAlign: "right" }}>{fmtTime(msg.createdAt)}</div>
        </div>

        {reactionFor === msg.id && (
          <div style={{
            position: "absolute",
            bottom: -30,
            left: isMine ? undefined : "0",
            right: isMine ? "0" : undefined,
            display: "flex",
            gap: 4,
            background: isDark ? "#222" : "#fff",
            padding: "4px 6px",
            borderRadius: 12,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
          }}>
            {INLINE_REACTIONS.map((e, i) => (
              <span key={i} style={{ cursor: "pointer" }} onClick={() => addReaction(msg.id, e)}>{e}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: wallpaper || (isDark ? "#121212" : "#f9f9f9"),
      color: isDark ? "#fff" : "#000"
    }}>
      {/* ---------- Header ---------- */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: `1px solid ${isDark ? "#333" : "#ccc"}`,
        position: "relative",
        background: isDark ? "#222" : "#fff"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => navigate(-1)}>
          <span style={{ fontSize: 20 }}>←</span>
          <div>
            <div>{friendInfo?.name || "Loading..."}</div>
            <div style={{ fontSize: 12, color: isDark ? "#aaa" : "#666" }}>
              {friendInfo?.lastSeen ? `Last seen: ${fmtTime(friendInfo.lastSeen)}` : "Online"}
            </div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setHeaderMenuOpen(prev => !prev)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>⋮</button>
          {headerMenuOpen && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: 0,
              background: isDark ? "#333" : "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              borderRadius: 8,
              overflow: "hidden",
              zIndex: 10
            }}>
              <button style={menuBtnStyle} onClick={() => alert("View Profile")}>View Profile</button>
              <button style={menuBtnStyle} onClick={() => alert("Clear Chat")}>Clear Chat</button>
              <button style={menuBtnStyle} onClick={() => alert("Block/Unblock")}>Block/Unblock</button>
              <button style={menuBtnStyle} onClick={() => alert("Report")}>Report</button>
              <button style={menuBtnStyle} onClick={() => alert("Voice/Video Call")}>Voice/Video Call</button>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Messages ---------- */}
      <div
        ref={messagesRefEl}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column" }}
      >
        {loadingMsgs ? <div style={{ textAlign: "center", marginTop: 20 }}>Loading messages...</div> : null}
        {messages.length === 0 && !loadingMsgs ? <div style={{ textAlign: "center", marginTop: 20 }}>No messages yet</div> : null}

        {messages.reduce((acc, msg, idx) => {
          const prev = messages[idx - 1];
          const label = (!prev || dayLabel(prev.createdAt) !== dayLabel(msg.createdAt)) ? dayLabel(msg.createdAt) : null;
          if (label) acc.push(
            <div key={"label-" + msg.id} style={{ textAlign: "center", margin: "12px 0", fontSize: 12, color: isDark ? "#aaa" : "#666" }}>{label}</div>
          );
          acc.push(renderMessage(msg));
          return acc;
        }, [])}

        <div ref={endRef} />
      </div>

      {/* ---------- File Preview Carousel ---------- */}
      {previews.length > 0 && (
        <div style={{ display: "flex", overflowX: "auto", padding: 4, gap: 4, borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#111" : "#fafafa" }}>
          {previews.map((p, i) => (
            <div key={i} onClick={() => setSelectedPreviewIndex(i)} style={{
              border: i === selectedPreviewIndex ? `2px solid #34B7F1` : "2px solid transparent",
              borderRadius: 8,
              padding: 2,
              cursor: "pointer"
            }}>
              {p.type === "image" && <img src={p.url} alt="" style={{ height: 60, borderRadius: 6 }} />}
              {p.type === "video" && <video src={p.url} style={{ height: 60, borderRadius: 6 }} />}
              {p.type === "audio" && <div style={{ width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "#ddd", borderRadius: 6 }}>🎵</div>}
              {p.type === "pdf" && <div style={{ width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "#ddd", borderRadius: 6 }}>📄</div>}
              {p.type === "file" && <div style={{ width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "#ddd", borderRadius: 6 }}>📎</div>}
            </div>
          ))}
        </div>
      )}

      {/* ---------- Input ---------- */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "6px 10px",
        borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`,
        background: isDark ? "#222" : "#fff",
        gap: 6
      }}>
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={e => setText(e.target.value)}
          style={{
            flex: 1,
            borderRadius: 20,
            border: `1px solid ${isDark ? "#555" : "#ccc"}`,
            padding: "8px 12px",
            background: isDark ? "#333" : "#f9f9f9",
            color: isDark ? "#fff" : "#000"
          }}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
        />
        <input type="file" multiple style={{ display: "none" }} id="file-input" onChange={handleFiles} />
        <label htmlFor="file-input" style={{ cursor: "pointer" }}>📎</label>

        {!recording ? (
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            style={{ cursor: "pointer", fontSize: 20 }}
          >🎤</button>
        ) : <span style={{ color: "#f44", fontSize: 20 }}>⏺</span>}

        <button onClick={sendMessage} style={{ cursor: "pointer", fontSize: 20 }}>➡️</button>
      </div>
    </div>
  );
}