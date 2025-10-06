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
  writeBatch,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseClient";
import { motion, AnimatePresence } from "framer-motion";
import useWalletBilling from "../hooks/useWalletBilling";

export default function ChatPage({ otherUser, onBack }) {
  const me = auth.currentUser;
  if (!me) return <div>Please log in</div>;
  const myUid = me.uid;
  const chatId = [myUid, otherUser.uid].sort().join("_");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingOther, setTypingOther] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [attachPreview, setAttachPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);

  const { startCall, acceptIncomingCall, endCall, incomingCall, activeCall } = useWalletBilling();

  // Create chat doc if not exists
  useEffect(() => {
    const chatRef = doc(db, "chats", chatId);
    getDoc(chatRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(chatRef, {
          members: [myUid, otherUser.uid],
          typing: {},
          lastMessage: { text: "", type: "" },
          lastMessageTime: serverTimestamp(),
        });
      }
    });
  }, [chatId]);

  // Listen to messages
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const visible = data.filter(
        (m) => !(m.deletedFor && m.deletedFor.includes(myUid))
      );
      setMessages(visible);
      // Mark received messages as delivered
      const batch = writeBatch(db);
      visible
        .filter((m) => m.from !== myUid && !m.delivered)
        .forEach((m) =>
          batch.update(doc(db, "chats", chatId, "messages", m.id), {
            delivered: true,
          })
        );
      if (visible.some((m) => m.from !== myUid && !m.delivered))
        batch.commit();

      // auto scroll
      setTimeout(
        () =>
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          }),
        100
      );
    });
    return () => unsub();
  }, [chatId, myUid]);

  // Mark messages as seen on focus
  useEffect(() => {
    const handleFocus = async () => {
      const unseen = messages.filter(
        (m) => m.from !== myUid && m.delivered && !m.seen
      );
      const batch = writeBatch(db);
      unseen.forEach((m) =>
        batch.update(doc(db, "chats", chatId, "messages", m.id), {
          seen: true,
        })
      );
      if (unseen.length > 0) await batch.commit();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [messages]);

  // Typing handler
  const handleTyping = async (value) => {
    setText(value);
    if (!chatId) return;
    if (!isTyping) {
      setIsTyping(true);
      await updateDoc(doc(db, "chats", chatId), {
        [`typing.${myUid}`]: true,
      }).catch(() => {});
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(async () => {
      setIsTyping(false);
      updateDoc(doc(db, "chats", chatId), {
        [`typing.${myUid}`]: false,
      }).catch(() => {});
    }, 1000);
  };

  // Send message
  const sendMessage = async ({ text = "", file = null, fileType = "text", fileName = null } = {}) => {
    if (!text.trim() && !file) return;
    const msgRef = collection(db, "chats", chatId, "messages");
    if (file) {
      const placeholder = await addDoc(msgRef, {
        from: myUid,
        type: "uploading",
        timestamp: serverTimestamp(),
        sent: true,
      });
      const path = `chat_uploads/${chatId}/${placeholder.id}/${file.name}`;
      const sRef = storageRef(storage, path);
      const uploadTask = uploadBytesResumable(sRef, file);
      uploadTask.on(
        "state_changed",
        (snap) => {
          setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        },
        (err) => console.error("upload error", err),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(
            doc(db, "chats", chatId, "messages", placeholder.id),
            {
              type: fileType,
              content: url,
              fileName,
              timestamp: serverTimestamp(),
              sent: true,
            }
          );
          await updateDoc(doc(db, "chats", chatId), {
            lastMessage: { text: fileType === "image" ? "📷 Photo" : fileName || "File", type: fileType },
            lastMessageTime: serverTimestamp(),
          });
          setUploadProgress(null);
          setAttachPreview(null);
        }
      );
      return;
    }
    await addDoc(msgRef, {
      from: myUid,
      text: text.trim(),
      type: "text",
      timestamp: serverTimestamp(),
      sent: true,
      delivered: false,
      seen: false,
    });
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: { text, type: "text" },
      lastMessageTime: serverTimestamp(),
    });
    setText("");
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    setAttachPreview({ file, url: URL.createObjectURL(file), type: isImage ? "image" : "file", name: file.name });
  };

  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessageBody = (m) => {
    if (m.type === "text") return <span>{m.text}</span>;
    if (m.type === "image") return <img src={m.content} alt="" style={{ maxWidth: 260, borderRadius: 8 }} />;
    if (m.type === "file") return <a href={m.content} target="_blank" rel="noopener noreferrer">📎 {m.fileName}</a>;
    if (m.type === "audio") return <audio controls src={m.content} />;
    if (m.type === "uploading") return <em>Uploading…</em>;
    return null;
  };

  const getStatusText = (m) => {
    if (m.from !== myUid) return "";
    if (m.seen) return "Seen";
    if (m.delivered) return "Delivered";
    if (m.sent) return "Sent";
    return "";
  };

  // Call control handlers
  const onStartVoice = async () => {
    try {
      const res = await startCall(otherUser.uid, "audio");
      console.log("call started:", res.callId);
      // Proceed with WebRTC setup (offer/answer)
    } catch (err) {
      alert(err?.message || "Could not start call");
      console.error(err);
    }
  };

  const onStartVideo = async () => {
    try {
      const res = await startCall(otherUser.uid, "video");
      console.log("video call started", res.callId);
      // Proceed with WebRTC setup
    } catch (err) {
      alert(err?.message || "Could not start video call");
      console.error(err);
    }
  };

  const onAccept = async () => {
    if (!incomingCall) return;
    try {
      await acceptIncomingCall(incomingCall.callId);
      // Proceed with WebRTC answer
    } catch (e) {
      console.error("accept call failed", e);
    }
  };

  const onHangup = async () => {
    if (!activeCall) return;
    await endCall(activeCall.callId);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header with call buttons */}
      <header
        style={{
          padding: 12,
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ border: "none", background: "transparent", cursor: "pointer" }}>←</button>
          <div>
            <div style={{ fontWeight: 600 }}>{otherUser.name}</div>
            <div style={{ fontSize: 13, color: "#666" }}>{typingOther ? "Typing..." : "Online"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onStartVoice} aria-label="Start Voice Call">📞</button>
          <button onClick={onStartVideo} aria-label="Start Video Call">🎥</button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.from === myUid ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div>
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ background: m.from === myUid ? "#007bff" : "#f1f1f1", color: m.from === myUid ? "#fff" : "#000", padding: 10, borderRadius: 10, maxWidth: "75%" }}>
                {renderMessageBody(m)}
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>{fmtTime(m.timestamp)} {m.from === myUid && `• ${getStatusText(m)}`}</div>
              </motion.div>
            </div>
          </div>
        ))}
      </div>

      {/* Message input */}
      <div style={{ display: "flex", gap: 8, borderTop: "1px solid #eee", padding: 10 }}>
        <label>
          📎
          <input type="file" style={{ display: "none" }} onChange={handleFilePick} />
        </label>
        <input value={text} onChange={(e) => handleTyping(e.target.value)} placeholder="Type a message" style={{ flex: 1, padding: 8, borderRadius: 20, border: "1px solid #ddd" }} />
        <button onClick={() => sendMessage({ text })} style={{ border: "none", background: "#007bff", color: "#fff", borderRadius: 20, padding: "0 12px" }}>➤</button>
      </div>

      {/* Upload preview modal */}
      <AnimatePresence>
        {attachPreview && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} style={{ position: "fixed", bottom: 70, left: 10, right: 10, background: "#fff", borderRadius: 10, border: "1px solid #ddd", padding: 10, boxShadow: "0 4px 10px rgba(0,0,0,0.1)", zIndex: 1000 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {attachPreview.type === "image" ? (
                <img src={attachPreview.url} alt="preview" style={{ width: 64, height: 64, borderRadius: 8 }} />
              ) : (
                <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", borderRadius: 8 }}>📎</div>
              )}
              <div style={{ flex: 1 }}>
                <div>{attachPreview.name}</div>
                {uploadProgress && <div>Uploading: {uploadProgress}%</div>}
              </div>
              <button onClick={() => sendMessage({ file: attachPreview.file, fileType: attachPreview.type, fileName: attachPreview.name })} style={{ border: "none", background: "#007bff", color: "#fff", borderRadius: 10, padding: "6px 10px" }}>Send</button>
              <button onClick={() => setAttachPreview(null)} style={{ border: "none", background: "transparent" }}>✖</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming call modal */}
      {incomingCall && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", zIndex: 1050 }}>
          <div style={{ background: "#fff", padding: 18, borderRadius: 10, minWidth: 280 }}>
            <h2 style={{ margin: 0, marginBottom: 10 }}>Incoming {incomingCall.type} call</h2>
            <div>From: {incomingCall.caller}</div>
            <div style={{ marginTop: 10 }}>
              <button onClick={onAccept} style={{ marginRight: 8 }}>Accept</button>
              <button onClick={() => endCall(incomingCall.callId)}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Active call floating button */}
      {activeCall && (
        <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 1050 }}>
          <button onClick={onHangup} style={{ cursor: "pointer", background: "#e03e3e", color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px" }} aria-label="End Call">
            End Call
          </button>
        </div>
      )}
    </div>
  );
}