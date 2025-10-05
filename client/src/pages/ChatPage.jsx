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
  setDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseClient";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ChatPage.jsx
 * Props:
 *  - otherUser: { uid, name, photoURL }  // the contact you're chatting with
 *  - onBack: () => void                   // called when user taps back
 *
 * Usage:
 *  <ChatPage otherUser={contact} onBack={() => navigateBack()} />
 */

export default function ChatPage({ otherUser, onBack }) {
  const me = auth.currentUser;
  if (!me) return <div>Please log in</div>;
  const myUid = me.uid;

  // Deterministic chatId for 1-on-1 conversations:
  const chatId = [myUid, otherUser.uid].sort().join("_");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingOther, setTypingOther] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [attachPreview, setAttachPreview] = useState(null); // { file, url, type, name }
  const [uploadProgress, setUploadProgress] = useState(null);
  const [actionMessage, setActionMessage] = useState(null); // message under actions
  const [replyTo, setReplyTo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimerRef = useRef(null);

  // Ensure chat doc exists (simple create if missing)
  useEffect(() => {
    if (!chatId) return;
    const ensure = async () => {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        await setDoc(chatRef, {
          members: [myUid, otherUser.uid],
          lastMessage: { text: "", type: "" },
          lastMessageTime: serverTimestamp(),
          typing: {},
        }).catch((e) => console.warn("create chat doc:", e));
      }
    };
    ensure();
  }, [chatId, myUid, otherUser.uid]);

  // Listen to messages in real time
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // filter out messages deleted for me
      const visible = docs.filter((m) => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(visible);
      // auto scroll to bottom
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [chatId, myUid]);

  // Listen to chat doc for typing state
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, "chats", chatId), (snap) => {
      const data = snap.data() || {};
      if (!data.typing) {
        setTypingOther(false);
        return;
      }
      const otherTyping = Boolean(data.typing && data.typing[otherUser.uid]);
      setTypingOther(otherTyping);
    });
    return () => unsub();
  }, [chatId, otherUser.uid]);

  // Typing indicator: write typing status to chat doc
  const handleTyping = async (value) => {
    setText(value);
    if (!chatId) return;
    if (!isTyping) {
      setIsTyping(true);
      try {
        await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: true });
      } catch (e) {
        // chat might not exist yet; create minimal doc and retry
        try {
          await setDoc(doc(db, "chats", chatId), { members: [myUid, otherUser.uid], typing: { [myUid]: true }, lastMessage: { text: "", type: "" }, lastMessageTime: serverTimestamp() }, { merge: true });
        } catch {}
      }
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(async () => {
      setIsTyping(false);
      updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: false }).catch(() => {});
    }, 1200);
  };

  // Create a message doc (text or attach)
  const sendMessage = async ({ text = "", file = null, fileType = "text", fileName = null } = {}) => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");

    try {
      if (file) {
        // create placeholder doc to reserve messageId for storage path
        const placeholder = await addDoc(messagesRef, {
          from: myUid,
          type: "uploading",
          text: "",
          fileName: fileName || file.name,
          timestamp: serverTimestamp(),
        });
        const messageId = placeholder.id;
        const path = `chat_uploads/${chatId}/${messageId}/${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, file);

        uploadTask.on(
          "state_changed",
          (snap) => {
            const progress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadProgress(progress);
          },
          (err) => {
            console.error("upload error", err);
            setUploadProgress(null);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
              type: fileType, // 'image'|'file'|'audio'
              content: url,
              fileName: fileName || file.name,
              timestamp: serverTimestamp(),
            });
            await updateDoc(doc(db, "chats", chatId), {
              lastMessage: { text: fileType === "image" ? "📷 Photo" : (fileName || file.name), type: fileType },
              lastMessageTime: serverTimestamp(),
              [`typing.${myUid}`]: false,
            });
            setUploadProgress(null);
          }
        );
        setAttachPreview(null);
        setText("");
        setReplyTo(null);
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
        [`typing.${myUid}`]: false,
      });
      setText("");
      setReplyTo(null);
    } catch (err) {
      console.error("sendMessage error:", err);
      setUploadProgress(null);
    }
  };

  // Handle file selection
  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    setAttachPreview({ file, url: URL.createObjectURL(file), type: isImage ? "image" : "file", name: file.name });
  };

  // Voice recording using MediaRecorder
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // name and file
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
        await sendMessage({ file, fileType: "audio", fileName: file.name });
        // stop tracks
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error("startRecording err", err);
      alert("Could not start recording. Check microphone permission.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch (e) {
      console.warn("stopRecording", e);
    }
  };

  // Delete for me: add my uid to deletedFor array on message
  const deleteForMe = async (messageId) => {
    if (!chatId) return;
    const mRef = doc(db, "chats", chatId, "messages", messageId);
    const snap = await getDoc(mRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const arr = data.deletedFor || [];
    if (!arr.includes(myUid)) {
      await updateDoc(mRef, { deletedFor: [...arr, myUid] }).catch(() => {});
    }
  };

  // Delete for everyone: only within 10 minutes
  const deleteForEveryone = async (messageId) => {
    if (!chatId) return;
    const mRef = doc(db, "chats", chatId, "messages", messageId);
    const snap = await getDoc(mRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const ts = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : null);
    if (ts && Date.now() - ts.getTime() > 10 * 60 * 1000) {
      alert("Cannot delete for everyone after 10 minutes.");
      return;
    }
    await updateDoc(mRef, { deletedForEveryone: true, text: "This message was deleted", type: "deleted", content: null }).catch(() => {});
  };

  // Action sheet helpers
  const openActions = (message) => setActionMessage(message);
  const closeActions = () => setActionMessage(null);
  const startReply = (message) => {
    setReplyTo({ id: message.id, text: message.text || message.fileName || "Media", from: message.from });
    closeActions();
  };

  // Format timestamp display
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Render message body
  const renderMessageBody = (m) => {
    if (m.deletedForEveryone || m.type === "deleted") return <em style={{ opacity: 0.85 }}>This message was deleted</em>;
    if (!m.type || m.type === "text") return <span>{m.text}</span>;
    if (m.type === "image") return m.content ? <img src={m.content} alt={m.fileName} style={{ maxWidth: 260, borderRadius: 8 }} /> : <span>Sending image…</span>;
    if (m.type === "file") return m.content ? <a href={m.content} target="_blank" rel="noreferrer">📎 {m.fileName || "Download"}</a> : <span>Sending file…</span>;
    if (m.type === "audio") return m.content ? <audio controls src={m.content} /> : <span>Sending audio…</span>;
    if (m.type === "uploading") return <em>Uploading…</em>;
    return <span>{m.text}</span>;
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>

      {/* Header */}
      <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={iconBtn}>←</button>
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

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.from === myUid ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "78%", textAlign: m.from === myUid ? "right" : "left" }}>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: "inline-block", background: m.from === myUid ? "#007bff" : "#f1f3f5", color: m.from === myUid ? "#fff" : "#000", padding: 10, borderRadius: 12 }}>
                {m.replyTo && <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6, background: "#fff", color: "#222", padding: "6px 8px", borderRadius: 6 }}>{m.replyTo.text}</div>}
                {renderMessageBody(m)}
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>{fmtTime(m.timestamp)}</div>
              </motion.div>

              <div style={{ marginTop: 6 }}>
                <button onClick={() => openActions(m)} style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}>⋮</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", gap: 8, alignItems: "center", background: "#fff" }}>
        <label style={{ cursor: "pointer" }}>
          📎
          <input type="file" accept="image/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.zip" onChange={handleFilePick} style={{ display: "none" }} />
        </label>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {replyTo && (
            <div style={{ background: "#f4f8ff", padding: "6px 8px", borderRadius: 8, marginBottom: 6 }}>
              Replying to: <strong>{replyTo.text}</strong> <button onClick={() => setReplyTo(null)} style={{ marginLeft: 8 }}>✖</button>
            </div>
          )}
          <input value={text} onChange={(e) => handleTyping(e.target.value)} placeholder="Type a message" style={{ padding: "10px 12px", borderRadius: 20, border: "1px solid #ddd" }} />
        </div>

        {/* Voice record: hold to record (mouse/touch) */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          title={isRecording ? "Recording..." : "Hold to record"}
          style={{ background: isRecording ? "#ff4d4d" : "#eee", border: "none", padding: "8px 10px", borderRadius: 999, cursor: "pointer" }}
        >
          {isRecording ? "⏺" : "🎤"}
        </button>

        <button onClick={() => sendMessage({ text, file: attachPreview?.file, fileType: attachPreview?.type, fileName: attachPreview?.name })} disabled={!text.trim() && !attachPreview} style={{ background: "#007bff", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 999 }}>
          ➤
        </button>
      </div>

      {/* Attach preview */}
      <AnimatePresence>
        {attachPreview && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} style={{ position: "fixed", bottom: 86, left: 12, right: 12, background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: 10, zIndex: 80 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {attachPreview.type === "image" ? <img src={attachPreview.url} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f4", borderRadius: 8 }}>📎</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{attachPreview.name}</div>
                <div style={{ color: "#666", fontSize: 13 }}>{attachPreview.type === "image" ? "Image" : "File/Audio"}</div>
              </div>
              <div>
                <button onClick={() => setAttachPreview(null)} style={{ background: "transparent", border: "none", fontSize: 18 }}>✖</button>
              </div>
            </div>
            {uploadProgress !== null && <div style={{ marginTop: 8 }}>Uploading: {uploadProgress}%</div>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action sheet for message */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.35)", zIndex: 90 }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 80 }} style={{ width: "100%", maxWidth: 420, background: "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Message actions</div>
              <button onClick={() => { startReply(actionMessage); }} style={actionBtn}>💬 Reply</button>
              <button onClick={() => { deleteForMe(actionMessage.id); setActionMessage(null); }} style={actionBtn}>🗑 Delete for me</button>
              <button onClick={() => { deleteForEveryone(actionMessage.id); setActionMessage(null); }} style={actionBtn}>🗑 Delete for everyone (10m)</button>
              <button onClick={() => setActionMessage(null)} style={{ ...actionBtn, color: "#ff4d4d" }}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// small styles
const iconBtn = { background: "transparent", border: "none", fontSize: 18, cursor: "pointer" };
const actionBtn = { display: "block", width: "100%", textAlign: "left", padding: "12px 10px", background: "transparent", border: "none", fontSize: 16, cursor: "pointer" };