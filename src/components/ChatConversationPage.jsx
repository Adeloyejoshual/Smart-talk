// Full ChatConversationPage.jsx
// NOTE: This is a reconstructed complete version based on your pasted snippet.
// You may need to adjust imports, routes, and styles according to your app.

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
    month: "short", day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const menuBtnStyle = {
  width: "100%", padding: "8px 14px", textAlign: "left",
  background: "transparent", border: "none", cursor: "pointer",
  fontSize: 14
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
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

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
          if (e.lengthComputable && onProgress)
            onProgress(Math.round((e.loaded * 100) / e.total));
        });
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const res = JSON.parse(xhr.responseText);
            resolve(res.secure_url || res.url);
          } else reject(new Error("Cloudinary upload failed"));
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
          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const fRef = doc(db, "users", friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
          }
        }
        unsubChat = onSnapshot(cRef, (s) => {
          if (s.exists()) setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) { console.error(e); }
    };
    loadMeta();
    return () => unsubChat && unsubChat();
  }, [chatId, myUid]);

  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter((m) => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

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

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPrev = files.map((f) => ({ url: URL.createObjectURL(f), type: detectFileType(f), name: f.name, file: f }));
    setSelectedFiles((p) => [...p, ...files]);
    setPreviews((p) => [...p, ...newPrev]);
    setSelectedPreviewIndex(0);
  };

  const sendTextMessage = async () => {
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]);
      for (const file of filesToSend) {
        try {
          const placeholder = {
            senderId: myUid, text: "", mediaUrl: "", mediaType: detectFileType(file),
            fileName: file.name, createdAt: serverTimestamp(), status: "uploading", reactions: {}
          };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds((p) => ({ ...p, [messageId]: 0 }));

          const url = await uploadToCloudinary(file, (pct) => setUploadingIds((p) => ({ ...p, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
            mediaUrl: url, status: "sent", sentAt: serverTimestamp()
          });
          setTimeout(() => setUploadingIds((p) => { const c = { ...p }; delete c[messageId]; return c; }), 200);
        } catch (err) { console.error(err); }
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
        reactions: {},
      };
      if (replyTo) {
        payload.replyTo = {
          id: replyTo.id,
          text: replyTo.text || replyTo.mediaType,
          senderId: replyTo.senderId,
        };
        setReplyTo(null);
      }
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
    }
  };

  useEffect(() => {
    setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        const placeholder = {
          senderId: myUid, text: "", mediaUrl: "", mediaType: "audio",
          createdAt: serverTimestamp(), status: "uploading", reactions: {}
        };
        try {
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds((p) => ({ ...p, [messageId]: 0 }));
          const url = await uploadToCloudinary(blob, (pct) => setUploadingIds((p) => ({ ...p, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
            mediaUrl: url, status: "sent", sentAt: serverTimestamp()
          });
          setTimeout(() => setUploadingIds((p) => { const c = { ...p }; delete c[messageId]; return c; }), 200);
        } catch (e) {
          console.error(e);
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch (e) {}
    setRecording(false);
  };

  const holdStart = (e) => {
    e.preventDefault();
    longPressTimer.current = setTimeout(() => startRecording(), 250);
  };

  const holdEnd = () => {
    clearTimeout(longPressTimer.current);
    if (recording) stopRecording();
  };

  const renderMessageContent = (m) => {
    if (m.mediaUrl) {
      if (m.mediaType === "image") return <img src={m.mediaUrl} style={{ maxWidth: 360, borderRadius: 12 }} />;
      if (m.mediaType === "video") return <video controls src={m.mediaUrl} style={{ maxWidth: 360, borderRadius: 12 }} />;
      if (m.mediaType === "audio") return <audio controls src={m.mediaUrl} style={{ width: 300 }} />;
      return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download"}</a>;
    }
    return m.text;
  };

  const groupedMessages = (() => {
    const out = [];
    let lastDay = null;
    messages.forEach((m) => {
      const label = dayLabel(m.createdAt || new Date());
      if (label !== lastDay) {
        out.push({ type: "day", label, id: `day-${label}-${Math.random()}` });
        lastDay = label;
      }
      out.push(m);
    });
    return out;
  })();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: isDark ? "#000" : "#f5f5f5" }}>

      <header style={{ padding: 12, background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/chat")} style={{ background: "transparent", border: "none", fontSize: 20, color: "#fff" }}>←</button>

        <img
          src={friendInfo?.photoURL || "/default-avatar.png"}
          onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}
          style={{ width: 48, height: 48, borderRadius: "50%", cursor: "pointer" }}
        />

        <div style={{ flex: 1 }} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}>
          <div style={{ fontWeight: 700 }}>{friendInfo?.displayName || "Chat"}</div>
        </div>

        <div style={{ position: "relative" }}>
          <button onClick={() => setHeaderMenuOpen((s) => !s)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20 }}>⋮</button>
          {headerMenuOpen && (
            <div style={{ position: "absolute", right: 0, top: 36, background: "#fff", color: "#000", padding: 8, borderRadius: 10 }}>
              <button style={menuBtnStyle} onClick={() => navigate(`/user-profile/${friendInfo?.id}`)}>View Profile</button>
              <button style={menuBtnStyle} onClick={() => setHeaderMenuOpen(false)}>Close</button>
            </div>
          )}
        </div>
      </header>

      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div>Loading…</div>}

        {groupedMessages.map((item) => {
          if (item.type === "day") return <div key={item.id} style={{ textAlign: "center", margin: "10px 0", color: "#777" }}>{item.label}</div>;
          const m = item;
          const mine = m.senderId === myUid;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{ background: mine ? "#1877F2" : "#fff", color: mine ? "#fff" : "#000", padding: 10, borderRadius: 14, maxWidth: "75%" }}>
                {m.replyTo && (
                  <div style={{ background: "#eee", padding: 6, borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                    <b>{m.replyTo.senderId === myUid ? "You" : "Them"}</b>: {m.replyTo.text}
                  </div>
                )}
                {renderMessageContent(m)}
                <div style={{ fontSize: 10, textAlign: "right", marginTop: 4 }}>{fmtTime(m.createdAt)}</div>
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </main>

      {previews.length > 0 && (
        <div style={{ padding: 8, display: "flex", gap: 8, overflowX: "auto", background: "#00000020" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ border: idx === selectedPreviewIndex ? "2px solid #1877F2" : "2px solid transparent", borderRadius: 8, padding: 4 }}>
              {p.type === "image" && <img src={p.url} style={{ height: 70, borderRadius: 6 }} />}
              {p.type === "video" && <video src={p.url} style={{ height: 70, borderRadius: 6 }} muted />}
            </div>
          ))}
        </div>
      )}

      <footer style={{ padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="file"
          multiple
          onChange={onFilesSelected}
          style={{ display: "none" }}
          id="fileInput"
        />
        <label htmlFor="fileInput" style={{ cursor: "pointer", fontSize: 22 }}>📎</label>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: "1px solid #ccc" }}
        />

        <button
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
          onClick={(e) => {
            if (!recording) sendTextMessage();
          }}
          style={{ background: "#1877F2", color: "#fff", borderRadius: "50%", width: 48, height: 48, border: "none", fontSize: 20 }}
        >
          {recording ? "⏺" : "➤"}
        </button>
      </footer>
    </div>
  );
}

