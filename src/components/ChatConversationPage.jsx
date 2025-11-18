// src/components/ChatConversationPage.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

import { IoCloseSharp } from "react-icons/io5";
import { MdOutlineClose } from "react-icons/md";
import { IoReplyOutline } from "react-icons/io5";
import { IoIosSend } from "react-icons/io";
import { RiImageAddFill, RiVideoAddFill } from "react-icons/ri";
import { LuAudioLines } from "react-icons/lu";
import { GoGoal } from "react-icons/go";
import { FiPhone, FiVideo } from "react-icons/fi";

export default function ChatConversationPage() {
  const { chatId } = useParams(); // new: get chat id
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [cooldown, setCooldown] = useState(false);

  const messageListRef = useRef(null);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(null);

  const menuBtnStyle = {
    padding: "10px 12px",
    width: "100%",
    border: "none",
    background: "transparent",
    fontSize: 15,
    textAlign: "left",
    cursor: "pointer",
  };

  const currentUser = auth.currentUser;

  // ---------------------------
  // Detect file type
  // ---------------------------
  const detectFileType = (file) => {
    if (!file) return "raw";
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "raw";
  };

  // ---------------------------
  // Upload file to Cloudinary
  // ---------------------------
  const uploadToCloudinary = async (file, type) => {
    // NOTE: replace these with your env/preset or keep dependency-free placeholder
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "your_cloud_name";
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "your_preset";

    const safeType = ["image", "video", "audio"].includes(type) ? type : "raw";
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${safeType}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) throw new Error("Cloudinary upload failed");
    return await res.json();
  };

  // ---------------------------
  // Choose files
  // ---------------------------
  const handleFiles = (ev) => {
    const files = Array.from(ev.target.files || []);
    const previews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: detectFileType(file),
    }));
    setAttachments((prev) => [...prev, ...previews]);
  };

  const removeAttachment = (index) => {
    // revoke URL to avoid leaks
    setAttachments((prev) => {
      const item = prev[index];
      if (item && item.url) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ---------------------------
  // Auto scroll
  // ---------------------------
  const scrollToBottom = () => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  };

  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    if (!messageListRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
    setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 20);
  };

  // ---------------------------
  // Listen to messages (scoped to chatId)
  // ---------------------------
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(data);
    });

    return () => unsub();
  }, [chatId]);

  // ---------------------------
  // Send message
  // ---------------------------
  const sendMessage = async () => {
    if (cooldown || !chatId) return;

    if (!inputValue.trim() && attachments.length === 0) return;

    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);

    let uploaded = [];

    try {
      for (const item of attachments) {
        const result = await uploadToCloudinary(item.file, item.type);
        uploaded.push({
          url: result.secure_url,
          type: item.type,
        });
      }

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: inputValue.trim() || "",
        attachments: uploaded,
        senderId: currentUser?.uid,
        createdAt: serverTimestamp(),
        replyTo: replyTo || null,
      });

      setInputValue("");
      // revoke attachment previews and clear
      attachments.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      setAttachments([]);
      setReplyTo(null);
    } catch (err) {
      console.error("Send error:", err);
      alert("Failed to send message");
    }
  };

  // ---------------------------
  // Long press menu
  // ---------------------------
  const handleMsgMouseDown = (m) => {
    longPressTimer.current = setTimeout(() => setMenuOpenFor(m.id), 600);
  };
  const clearLongPress = () => clearTimeout(longPressTimer.current);

  // ---------------------------
  // Swipe to reply
  // ---------------------------
  const handleMsgTouchStart = (ev) => {
    swipeStartX.current = ev.touches?.[0]?.clientX || null;
    longPressTimer.current = setTimeout(() => {
      // long-press will be handled by touchend logic for a given message; nothing else here
    }, 600);
  };

  const handleMsgTouchEnd = (m, ev) => {
    clearTimeout(longPressTimer.current);
    if (!swipeStartX.current) return;
    const endX = ev.changedTouches?.[0]?.clientX || 0;
    const dist = swipeStartX.current - endX;
    // swipe left to reply (distance positive)
    if (dist > 60) {
      setReplyTo({
        id: m.id,
        text: m.text?.slice(0, 60) || (m.attachments?.length ? "[Media]" : ""),
        senderId: m.senderId,
      });
    }
    swipeStartX.current = null;
  };

  // ---------------------------
  // Delete
  // ---------------------------
  const handleDeleteMessage = async (id) => {
    if (!chatId) return;
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", id));
      setMenuOpenFor(null);
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  // ---------------------------
  // Reply target UI
  // ---------------------------
  const replyTarget = useMemo(() => {
    if (!replyTo) return null;
    const m = messages.find((x) => x.id === replyTo.id);
    if (!m) return null;
    return (
      <div
        style={{
          padding: 10,
          marginBottom: 5,
          background: "#e5e7eb",
          borderLeft: "4px solid #4b5563",
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>{m.senderId === currentUser?.uid ? "You" : "Other"}</strong>
          <div>{m.text || "[Media]"}</div>
        </div>
        <button onClick={() => setReplyTo(null)} style={{ background: "transparent", border: "none" }}>
          <MdOutlineClose size={22} />
        </button>
      </div>
    );
  }, [replyTo, messages]);

  // ---------------------------
  // Message bubble
  // ---------------------------
  const MessageBubble = ({ m }) => {
    const isMe = m.senderId === currentUser?.uid;

    return (
      <div
        key={m.id}
        className={`msg-row ${isMe ? "me" : "them"}`}
        style={{ position: "relative", display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", padding: "8px 0" }}
        onTouchStart={(ev) => handleMsgTouchStart(ev)}
        onTouchEnd={(ev) => handleMsgTouchEnd(m, ev)}
        onMouseDown={() => handleMsgMouseDown(m)}
        onMouseUp={clearLongPress}
        onContextMenu={(ev) => { ev.preventDefault(); setMenuOpenFor(m.id); }}
      >
        <div
          className="msg-bubble"
          style={{
            background: isMe ? "#2563eb" : "#f3f4f6",
            color: isMe ? "white" : "black",
            padding: "10px 14px",
            borderRadius: 16,
            maxWidth: "75%",
          }}
        >
          {m.replyTo && (
            <div style={{ borderLeft: "3px solid #6b7280", paddingLeft: 8, marginBottom: 6, opacity: 0.8, fontSize: 12 }}>
              Replying: {m.replyTo.text || "[Media]"}
            </div>
          )}

          {m.text && <div>{m.text}</div>}

          {m.attachments?.map((a, i) => (
            <div key={i} style={{ marginTop: 6 }}>
              {a.type === "image" && <img src={a.url} alt="" style={{ width: 180, borderRadius: 10 }} />}
              {a.type === "video" && <video src={a.url} controls style={{ width: 200, borderRadius: 10, background: "black" }} />}
              {a.type === "audio" && <audio controls src={a.url} />}
            </div>
          ))}
        </div>

        {/* Long-press menu */}
        {menuOpenFor === m.id && (
          <div style={{ position: "absolute", right: isMe ? 0 : "auto", left: isMe ? "auto" : 0, top: -8, background: "white", padding: 6, borderRadius: 10, boxShadow: "0 3px 10px rgba(0,0,0,0.15)", zIndex: 99, width: 140 }}>
            <button style={menuBtnStyle} onClick={() => { setReplyTo({ id: m.id, text: m.text?.slice(0, 40) || "[Media]", senderId: m.senderId }); setMenuOpenFor(null); }}>Reply</button>
            {isMe && <button style={menuBtnStyle} onClick={() => handleDeleteMessage(m.id)}>Delete</button>}
            <button style={menuBtnStyle} onClick={() => setMenuOpenFor(null)}>Close</button>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------
  // Voice / Video call helpers
  // ---------------------------
  const startVoiceCall = async () => {
    try {
      // request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // navigate to the voice call route - implement the actual call page separately
      navigate(`/voice-call/${chatId}`, { state: { fromChat: true } });
    } catch (err) {
      console.error("Voice call failed or permissions denied:", err);
      alert("Microphone permission is required to start a voice call.");
    }
  };

  const startVideoCall = async () => {
    try {
      // request camera + mic permissions
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      navigate(`/video-call/${chatId}`, { state: { fromChat: true } });
    } catch (err) {
      console.error("Video call failed or permissions denied:", err);
      alert("Camera and microphone permissions are required to start a video call.");
    }
  };

  // ---------------------------
  // MAIN RENDER
  // ---------------------------
  return (
    <div className="chat-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <header className="chat-header" style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid #e5e7eb" }}>
        <GoGoal size={28} />
        <h2 style={{ marginLeft: 8, marginRight: 12 }}>Chat</h2>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={startVoiceCall} title="Voice call" style={{ border: "none", background: "transparent", cursor: "pointer" }}><FiPhone size={20} /></button>
          <button onClick={startVideoCall} title="Video call" style={{ border: "none", background: "transparent", cursor: "pointer" }}><FiVideo size={20} /></button>
        </div>
      </header>

      {/* Message list */}
      <main ref={messageListRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
      </main>

      {/* Reply preview */}
      {replyTarget}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 6, padding: 8, overflowX: "auto" }}>
          {attachments.map((a, i) => (
            <div key={i} style={{ position: "relative" }}>
              {a.type === "image" && <img src={a.url} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 10 }} />}
              {a.type === "video" && <video src={a.url} style={{ width: 100, height: 100, borderRadius: 10, background: "black" }} />}
              {a.type === "audio" && <div style={{ width: 100, height: 70, borderRadius: 10, background: "#ddd", display: "flex", justifyContent: "center", alignItems: "center" }}>Audio</div>}

              <button onClick={() => removeAttachment(i)} style={{ position: "absolute", top: -8, right: -8, background: "white", borderRadius: "50%", border: "1px solid #ccc", cursor: "pointer" }}>
                <IoCloseSharp />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <footer style={{ padding: 10, borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ cursor: "pointer" }}>
          <RiImageAddFill size={26} />
          <input type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        </label>

        <label style={{ cursor: "pointer" }}>
          <RiVideoAddFill size={26} />
          <input type="file" accept="video/*" multiple hidden onChange={handleFiles} />
        </label>

        <label style={{ cursor: "pointer" }}>
          <LuAudioLines size={26} />
          <input type="file" accept="audio/*" multiple hidden onChange={handleFiles} />
        </label>

        <input className="msg-input" placeholder="Type a message…" value={inputValue} onChange={(ev) => setInputValue(ev.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: "1px solid #e5e7eb" }} />

        <button onClick={sendMessage} className="send-btn" style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 12px", borderRadius: 10, cursor: "pointer" }}>
          <IoIosSend size={20} />
        </button>
      </footer>
    </div>
  );
}