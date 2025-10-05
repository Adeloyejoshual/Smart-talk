// /src/pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseClient"; // must export auth, db, storage
import { motion, AnimatePresence } from "framer-motion";

/*
  ChatPage.jsx (1-on-1 chat)
  - text, image, file, voice messages
  - delete for me / delete for everyone (10-minute rule)
  - typing indicator
  - resumable uploads and upload progress
  - reply support (basic)
*/

export default function ChatPage({ otherUser, onBack }) {
  // otherUser: { uid, name, photoURL } - the person you're chatting with
  const me = auth.currentUser;
  const myUid = me?.uid;
  if (!myUid) {
    // not logged in - render simple fallback
    return <div>Please login</div>;
  }

  // deterministic chatId for 1-on-1 (both users use same id)
  const chatId = [myUid, otherUser.uid].sort().join("_");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingOther, setTypingOther] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [attachPreview, setAttachPreview] = useState(null); // { file, type, name, url }
  const [uploadProgress, setUploadProgress] = useState(null);
  const [actionMessage, setActionMessage] = useState(null); // message under action sheet
  const [replyTo, setReplyTo] = useState(null);

  const scrollRef = useRef(null);
  const typingTimer = useRef(null);

  // voice recording
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);

  // ---------- listen messages ----------
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // filter deletedFor me
      const visible = docs.filter((m) => !(m.deletedFor || []).includes(myUid));
      setMessages(visible);
      // scroll to bottom
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 120);
    });
    return () => unsub();
  }, [chatId, myUid]);

  // ---------- listen chat doc for typing ----------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsub = onSnapshot(chatRef, (snap) => {
      const data = snap.data() || {};
      setTypingOther(Boolean(data.typing && data.typing[otherUser.uid]));
    });
    return () => unsub();
  }, [chatId, otherUser.uid]);

  // ---------- typing handler ----------
  const handleTyping = async (val) => {
    setText(val);
    if (!chatId) return;
    if (!isTyping) {
      setIsTyping(true);
      try {
        await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: true });
      } catch (e) {
        // chat may not exist yet: create or set
        await addDoc(collection(db, "chats"), {
          // fallback minimal chat creation - ideally create chat doc earlier
          members: [myUid, otherUser.uid],
        }).catch(() => {});
      }
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(async () => {
      setIsTyping(false);
      await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: false }).catch(() => {});
    }, 1200);
  };

  // ---------- send text / attachment ----------
  async function sendMessage({ text = "", file = null, fileType = "text", fileName = null }) {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");

    try {
      if (file) {
        // placeholder to reserve id
        const placeholder = await addDoc(messagesRef, {
          from: myUid,
          type: "uploading",
          text: "",
          fileName: fileName || file.name,
          timestamp: serverTimestamp(),
        });
        const msgId = placeholder.id;
        // upload to storage
        const path = `chatMedia/${chatId}/${msgId}/${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(prog);
          },
          (err) => {
            console.error("upload err", err);
            setUploadProgress(null);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            await updateDoc(doc(db, "chats", chatId, "messages", msgId), {
              type: fileType, // "image", "file", "audio"
              content: url,
              fileName: fileName || file.name,
              timestamp: serverTimestamp(),
            });
            await updateDoc(doc(db, "chats", chatId), {
              lastMessage: { text: fileType === "image" ? "📷 Photo" : (fileName || file.name), type: fileType },
              lastMessageTime: serverTimestamp(),
            });
            setUploadProgress(null);
          }
        );
        setAttachPreview(null);
        setReplyTo(null);
        setText("");
        return;
      }

      // text message
      if (!text.trim()) return;
      await addDoc(messagesRef, {
        from: myUid,
        type: "text",
        text: text.trim(),
        timestamp: serverTimestamp(),
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, from: replyTo.from } : null,
      });
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: { text: text.trim(), type: "text" },
        lastMessageTime: serverTimestamp(),
      });
      setText("");
      setReplyTo(null);
    } catch (e) {
      console.error("sendMessage err", e);
      setUploadProgress(null);
    }
  }

  // ---------- file picker ----------
  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    setAttachPreview({ file: f, type: isImage ? "image" : "file", name: f.name, url: URL.createObjectURL(f) });
  };

  // ---------- voice recording ----------
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Recording not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      setAudioChunks([]);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          setAudioChunks((prev) => [...prev, e.data]);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        // create file-like object
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
        // send as audio file
        await sendMessage({ file, fileType: "audio", fileName: file.name });
        // stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("record err", err);
      alert("Could not start recording - check microphone permissions.");
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch (e) {
      console.warn("stop record", e);
    }
  };

  // ---------- message actions ----------
  const markDeletedForMe = async (messageId) => {
    if (!chatId) return;
    const ref = doc(db, "chats", chatId, "messages", messageId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const arr = data.deletedFor || [];
    if (arr.includes(myUid)) return;
    await updateDoc(ref, { deletedFor: [...arr, myUid] }).catch(() => {});
  };

  const deleteForEveryone = async (messageId) => {
    if (!chatId) return;
    const ref = doc(db, "chats", chatId, "messages", messageId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const ts = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : null);
    if (ts && Date.now() - ts.getTime() > 10 * 60 * 1000) {
      alert("Cannot delete for everyone after 10 minutes.");
      return;
    }
    await updateDoc(ref, { deletedForEveryone: true, text: "This message was deleted", type: "deleted", content: null }).catch(() => {});
  };

  // ---------- open actions ----------
  const openActions = (message) => {
    setActionMessage(message);
  };

  const closeActions = () => setActionMessage(null);

  // reply
  const startReply = (message) => {
    setReplyTo({ id: message.id, text: message.text || message.fileName || "Media", from: message.from });
    closeActions();
  };

  // ---------- render helpers ----------
  const formatTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessageContent = (m) => {
    if (m.deletedForEveryone || m.type === "deleted") return <em>This message was deleted</em>;
    if (m.type === "text") return <span>{m.text}</span>;
    if (m.type === "image") return m.content ? <img src={m.content} alt={m.fileName} style={{ maxWidth: 260, borderRadius: 8 }} /> : <span>Sending image…</span>;
    if (m.type === "file") return m.content ? <a href={m.content} target="_blank" rel="noreferrer">📎 {m.fileName || "Download"}</a> : <span>Sending file…</span>;
    if (m.type === "audio") return m.content ? <audio controls src={m.content} /> : <span>Sending audio…</span>;
    if (m.type === "uploading") return <em>Uploading…</em>;
    return <span>{m.text}</span>;
  };

  // ---------- UI ----------
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>
      {/* header */}
      <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", fontSize: 18 }}>←</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 999, background: "#ddd", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {otherUser.name?.[0] || "U"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700 }}>{otherUser.name}</div>
            <div style={{ fontSize: 13, color: "#666" }}>{typingOther ? "Typing..." : "Online"}</div>
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.from === myUid ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "78%", textAlign: m.from === myUid ? "right" : "left" }}>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: "inline-block", background: m.from === myUid ? "#007bff" : "#f1f3f5", color: m.from === myUid ? "#fff" : "#000", padding: 10, borderRadius: 12 }}>
                {m.replyTo && <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6, background: "#fff", color: "#222", padding: "6px 8px", borderRadius: 6 }}>{m.replyTo.text}</div>}
                {renderMessageContent(m)}
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>{formatTime(m.timestamp)}</div>
              </motion.div>
              <div style={{ marginTop: 6 }}>
                <button onClick={() => openActions(m)} style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}>⋮</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* composer */}
      <div style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ cursor: "pointer" }}>
          📎
          <input type="file" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.zip,audio/*" onChange={handleFilePick} style={{ display: "none" }} />
        </label>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {replyTo && (
            <div style={{ background: "#f4f8ff", padding: "6px 8px", borderRadius: 8, marginBottom: 6 }}>
              Replying to: <strong>{replyTo.text}</strong> <button onClick={() => setReplyTo(null)} style={{ marginLeft: 8 }}>✖</button>
            </div>
          )}
          <input value={text} onChange={(e) => handleTyping(e.target.value)} placeholder="Type a message" style={{ padding: "10px 12px", borderRadius: 20, border: "1px solid #ddd" }} />
        </div>

        {/* record button: hold to record, release to stop */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          title={isRecording ? "Recording..." : "Hold to record"}
          style={{
            background: isRecording ? "#ff4d4d" : "#eee",
            border: "none",
            padding: "10px 12px",
            borderRadius: 999,
            cursor: "pointer",
            marginRight: 6,
          }}
        >
          {isRecording ? "⏺" : "🎤"}
        </button>

        <button onClick={() => sendMessage({ text: text.trim(), file: attachPreview?.file, fileType: attachPreview?.type, fileName: attachPreview?.name })} disabled={!text.trim() && !attachPreview} style={{ background: "#007bff", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 999 }}>
          ➤
        </button>
      </div>

      {/* attach preview */}
      <AnimatePresence>
        {attachPreview && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} style={{ position: "fixed", bottom: 86, left: 12, right: 12, background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: 10, zIndex: 80 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {attachPreview.type === "image" ? <img src={attachPreview.url} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f4", borderRadius: 8 }}>📎</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{attachPreview.name}</div>
                <div style={{ color: "#666", fontSize: 13 }}>{attachPreview.type === "image" ? "Image" : "File"}</div>
              </div>
              <div>
                <button onClick={() => setAttachPreview(null)} style={{ background: "transparent", border: "none", fontSize: 18 }}>✖</button>
              </div>
            </div>
            {uploadProgress !== null && <div style={{ marginTop: 8 }}>Uploading: {uploadProgress}%</div>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* action sheet for message */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.35)", zIndex: 90 }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 80 }} style={{ width: "100%", maxWidth: 420, background: "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Message actions</div>
              <button onClick={() => { startReply(actionMessage); }} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, border: "none", background: "transparent" }}>💬 Reply</button>
              <button onClick={() => { markDeletedForMe(actionMessage.id); setActionMessage(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, border: "none", background: "transparent" }}>🗑 Delete for me</button>
              <button onClick={() => { deleteForEveryone(actionMessage.id); setActionMessage(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, border: "none", background: "transparent" }}>🗑 Delete for everyone (10m)</button>
              <button onClick={() => setActionMessage(null)} style={{ display: "block", width: "100%", textAlign: "left", padding: 12, color: "#ff4d4d", border: "none", background: "transparent" }}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}