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
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined
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
      if (!cloudName || !uploadPreset) {
        return reject(new Error("Cloudinary env not configured"));
      }
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
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

// Voice note player with waveform & progress
const VoiceNotePlayer = ({ src, waveColor = "#007bff", bgColor = "#fff", progressColor = "#34B7F1", width = "100%" }) => {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!audioRef.current || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const audio = audioRef.current;

    const resizeCanvas = () => {
      canvas.width = containerRef.current.offsetWidth;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!playing) return;
      requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = waveColor;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      ctx.fillStyle = progressColor + "88";
      ctx.fillRect(0, 0, canvas.width * progress, canvas.height);
    };

    const updateProgress = () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
      if (playing) requestAnimationFrame(updateProgress);
    };

    audio.onplay = () => {
      setPlaying(true);
      audioCtx.resume();
      draw();
      updateProgress();
    };
    audio.onpause = () => setPlaying(false);
    audio.onended = () => setPlaying(false);

    return () => {
      setPlaying(false);
      audio.pause();
      analyser.disconnect();
      source.disconnect();
      audioCtx.close();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [src, playing, waveColor, bgColor, progressColor]);

  return (
    <div ref={containerRef} style={{ width, display: "flex", flexDirection: "column", gap: 4 }}>
      <audio ref={audioRef} controls src={src} style={{ width: "100%" }} />
      <canvas ref={canvasRef} height={40} style={{ borderRadius: 6 }} />
    </div>
  );
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
          if (userSnap.exists()) {
            setFriendInfo({ id: userSnap.id, ...userSnap.data() });
          }
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
      setTimeout(() => {
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
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

  // Sending messages (text or files)
  const sendTextMessage = async () => {
    const blockedBy = chatInfo?.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      alert("You are blocked in this chat.");
      return;
    }

    if (selectedFiles.length > 0) {
      const toSend = [...selectedFiles];
      setSelectedFiles([]);
      setPreviews([]);
      setSelectedPreviewIndex(0);

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
          const url = await uploadToCloudinary(file, pct =>
            setUploadingIds(prev => ({ ...prev, [messageId]: pct }))
          );
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
            mediaUrl: url,
            status: "sent",
            sentAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Upload failed", err);
        }
        setTimeout(() => setUploadingIds(prev => {
          const c = { ...prev }; delete c[messageId]; return c;
        }), 200);
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
        payload.replyTo = {
          id: replyTo.id,
          text: replyTo.text || (replyTo.mediaType || "media"),
          senderId: replyTo.senderId
        };
        setReplyTo(null);
      }
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  // Recording voice note
  const startRecording = async () => {
    if (!recorderAvailable) {
      alert("Recording is not supported in your browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data.size) recorderChunksRef.current.push(e.data);
      };
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
          const url = await uploadToCloudinary(blob, pct =>
            setUploadingIds(prev => ({ ...prev, [messageId]: pct }))
          );
          await updateDoc(doc(db, "chats", chatId, "messages", mRef.id), {
            mediaUrl: url,
            status: "sent",
            sentAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Voice note upload error", err);
        }
        setTimeout(() => setUploadingIds(prev => {
          const c = { ...prev }; delete c[messageId]; return c;
        }), 200);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error(err);
      alert("Could not start audio recording.");
    }
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

  // Reactions & message actions (copy, edit, delete, reply, pin)
  const applyReaction = async (messageId, emoji) => {
    const mRef = doc(db, "chats", chatId, "messages", messageId);
    const snap = await getDoc(mRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const existing = data.reactions?.[myUid];
    const update = existing === emoji ? { [`reactions.${myUid}`]: null } : { [`reactions.${myUid}`]: emoji };
    await updateDoc(mRef, update);
    setReactionFor(null);
  };

  const copyMessageText = async (m) => {
    try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); }
} catch (err) {
        console.error("Copy failed", err);
        alert("Failed to copy");
    }
    setMenuOpenFor(null);
};

// Delete message
const deleteMessage = async (m) => {
    const confirmDelete = window.confirm("Delete this message?");
    if (!confirmDelete) return;

    try {
        await updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            deletedFor: arrayUnion(myUid)
        });
    } catch (err) {
        console.error("Delete failed", err);
    }
    setMenuOpenFor(null);
};

// Pin/unpin message
const togglePin = async (m) => {
    const isPinned = chatInfo?.pinnedMessageId === m.id;
    try {
        await updateDoc(doc(db, "chats", chatId), {
            pinnedMessageId: isPinned ? null : m.id
        });
    } catch (err) {
        console.error("Pin failed", err);
    }
    setMenuOpenFor(null);
};

// Reply to message
const replyMessage = (m) => {
    setReplyTo(m);
    setMenuOpenFor(null);
};

// Render a single message
const renderMessage = (m) => {
    const isMine = m.senderId === myUid;
    const reactedByMe = m.reactions?.[myUid];
    return (
        <div
            key={m.id}
            className={`message ${isMine ? "mine" : "theirs"}`}
            onContextMenu={(e) => { e.preventDefault(); setMenuOpenFor(m.id); }}
        >
            {m.replyTo && (
                <div className="reply-preview">
                    <small>Replying to: {m.replyTo.text}</small>
                </div>
            )}

            {m.text && <div className="text">{m.text}</div>}

            {m.mediaUrl && m.mediaType === "image" && (
                <img src={m.mediaUrl} alt={m.fileName || ""} className="media-image" />
            )}

            {m.mediaUrl && m.mediaType === "video" && (
                <video controls src={m.mediaUrl} className="media-video" />
            )}

            {m.mediaUrl && m.mediaType === "audio" && (
                <VoiceNotePlayer src={m.mediaUrl} />
            )}

            {m.status && <small className="status">{m.status}</small>}

            <div className="reactions">
                {Object.values(m.reactions || {}).map((r, idx) => (
                    <span key={idx} className="reaction">{r}</span>
                ))}
                {reactedByMe && <span className="reaction my-reaction">{reactedByMe}</span>}
            </div>
        </div>
    );
};

// Main render
return (
    <div className={`chat-page ${isDark ? "dark" : "light"}`} style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : "none" }}>
        <header className="chat-header">
            <button onClick={() => navigate(-1)}>Back</button>
            <div className="friend-info">
                <img src={friendInfo?.photoURL} alt="" className="avatar" />
                <span>{friendInfo?.displayName || "Unknown"}</span>
            </div>
            <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)}>⋮</button>
        </header>

        <div ref={messagesRefEl} className="messages-container">
            {loadingMsgs && <div>Loading messages...</div>}
            {!loadingMsgs && messages.map(renderMessage)}
            <div ref={endRef} />
        </div>

        {replyTo && (
            <div className="reply-box">
                Replying to: {replyTo.text || replyTo.mediaType}
                <button onClick={() => setReplyTo(null)}>×</button>
            </div>
        )}

        <div className="input-area">
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message"
            />
            <input type="file" multiple onChange={onFilesSelected} />
            {recording ? (
                <button onMouseUp={holdEnd} onTouchEnd={holdEnd}>Stop</button>
            ) : (
                <button onMouseDown={holdStart} onTouchStart={holdStart}>🎤</button>
            )}
            <button onClick={sendTextMessage}>Send</button>
        </div>
    </div>
);
}