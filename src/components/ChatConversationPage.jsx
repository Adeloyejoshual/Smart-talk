// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage
 * - Cloudinary uploads driven by env vars:
 *    VITE_CLOUDINARY_CLOUD_NAME
 *    VITE_CLOUDINARY_UPLOAD_PRESET
 *
 * - Firestore message shape:
 *    { sender, text, mediaUrl, mediaType, createdAt, status }
 *
 * - Option A storage structure (messages under chats/{chatId}/messages)
 */

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null); // File object
  const [previewUrl, setPreviewUrl] = useState(null); // objectURL for preview
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const recRef = useRef(null); // MediaRecorder instance
  const recChunksRef = useRef([]);
  const recTimerRef = useRef(null);

  const me = auth.currentUser;

  // ---------- load chat info and friend ----------
  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, "chats", chatId);
    let unsubChat = null;
    let unsubFriend = null;

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        alert("Chat not found");
        navigate("/chat");
        return;
      }
      setChatInfo({ id: snap.id, ...snap.data() });

      // infer friend id for 1:1
      const participants = snap.data().participants || [];
      const friendId = participants.find((p) => p !== me?.uid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriendInfo({ id: fsnap.id, ...fsnap.data() });
            // typing state is optional: expects users/{uid}.typing.{chatId} = true
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
          }
        });
      }

      unsubChat = onSnapshot(chatRef, (cSnap) => {
        if (cSnap.exists()) {
          setChatInfo((prev) => ({ ...(prev || {}), ...cSnap.data() }));
        }
      });
    })();

    return () => {
      unsubChat && unsubChat();
      unsubFriend && unsubFriend();
    };
  }, [chatId, me, navigate]);

  // ---------- messages realtime ----------
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      // mark delivered for incoming messages that are "sent"
      docs.forEach((m) => {
        if (m.sender !== me?.uid && m.status === "sent") {
          const mRef = doc(db, "chats", chatId, "messages", m.id);
          updateDoc(mRef, { status: "delivered" }).catch(() => {});
        }
      });
      // scroll to bottom
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return () => unsub();
  }, [chatId, me]);

  // ---------- helpers ----------
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  // Cloudinary upload (unsigned)
  const uploadToCloudinary = (file, onProgress) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      return Promise.reject(new Error("Cloudinary environment variables missing"));
    }
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;

    return new Promise((resolve, reject) => {
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
          try {
            const resp = JSON.parse(xhr.responseText);
            resolve(resp.secure_url || resp.url);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error("Cloudinary upload failed: " + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error("Cloudinary upload network error"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      xhr.send(fd);
    });
  };

  // detect file type string for message (image, video, audio, file)
  const detectMediaType = (file) => {
    const type = file.type || "";
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type.startsWith("audio/")) return "audio";
    return "file";
  };

  // send message to Firestore
  const sendMessageToFirestore = async ({ text = "", mediaUrl = "", mediaType = "text" }) => {
    if (!chatId || !me) return;
    const payload = {
      sender: me.uid,
      text: text || "",
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || (mediaUrl ? "file" : "text"),
      createdAt: serverTimestamp(),
      status: "sent",
    };
    try {
      const ref = await addDoc(collection(db, "chats", chatId, "messages"), payload);
      // update chat's lastMessage/lastMessageAt for ordering
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: text || (mediaType === "image" ? "📷 Photo" : (mediaType === "audio" ? "🎤 Voice note" : "Attachment")),
        lastMessageAt: serverTimestamp(),
      }).catch(()=>{});
      return ref;
    } catch (err) {
      console.error("sendMessageToFirestore error", err);
      throw err;
    }
  };

  // ---------- file pick handler ----------
  const onPickFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    setSelectedFile(f);
    // preview for images only (other files show filename)
    if (f.type.startsWith("image/")) {
      const obj = URL.createObjectURL(f);
      setPreviewUrl(obj);
    } else {
      setPreviewUrl(null);
    }
  };

  // remove preview / cancel selected file
  const clearSelectedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
  };

  // upload selected file then send message
  const uploadAndSendFile = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const url = await uploadToCloudinary(selectedFile, (pct) => {
        setUploadProgress(pct);
      });
      await sendMessageToFirestore({ mediaUrl: url, mediaType: detectMediaType(selectedFile) });
      clearSelectedFile();
    } catch (err) {
      console.error("uploadAndSendFile", err);
      alert("Upload failed - check Cloudinary config or network.");
    } finally {
      setUploading(false);
    }
  };

  // ---------- text send ----------
  const handleSendText = async () => {
    if (!text.trim()) return;
    const t = text.trim();
    setText("");
    try {
      await sendMessageToFirestore({ text: t, mediaUrl: "", mediaType: "text" });
    } catch (err) {
      alert("Failed to send message");
    }
  };

  // ---------- voice recording (hold to record) ----------
  useEffect(() => {
    // clean up on unmount
    return () => {
      if (recRef.current && recRef.current.state === "recording") {
        recRef.current.stop();
      }
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Recording not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recRef.current = recorder;
      recChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recChunksRef.current.push(ev.data);
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);
        recTimerRef.current = setInterval(() => {
          setRecordingTime((t) => t + 1);
        }, 1000);
      };

      recorder.onstop = async () => {
        clearInterval(recTimerRef.current);
        setIsRecording(false);
        const blob = new Blob(recChunksRef.current, { type: mimeType });
        // upload blob to Cloudinary
        setUploading(true);
        setUploadProgress(0);
        try {
          const file = new File([blob], `voice_${Date.now()}.webm`, { type: mimeType });
          const url = await uploadToCloudinary(file, (pct) => setUploadProgress(pct));
          await sendMessageToFirestore({ mediaUrl: url, mediaType: "audio", text: "" });
        } catch (err) {
          console.error("voice upload failed", err);
          alert("Voice upload failed");
        } finally {
          setUploading(false);
          setUploadProgress(0);
          setRecordingTime(0);
        }
        // stop tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
    } catch (err) {
      console.error("startRecording error", err);
      alert("Unable to record audio. Check permissions.");
    }
  };

  const stopRecording = () => {
    try {
      if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
    } catch (err) {
      console.error("stopRecording", err);
    }
  };

  // ---------- input interactions (hold-to-record) ----------
  // For mobile/desktop: start on pointerdown/touchstart, stop on pointerup/touchend
  const onMicPointerDown = (e) => {
    e.preventDefault();
    startRecording();
  };
  const onMicPointerUp = (e) => {
    e.preventDefault();
    stopRecording();
  };

  // ---------- UI helpers ----------
  const renderMessage = (m) => {
    if (m.mediaUrl) {
      if (m.mediaType === "image") {
        return <img src={m.mediaUrl} alt="img" style={{ maxWidth: "320px", borderRadius: 12 }} />;
      }
      if (m.mediaType === "video") {
        return <video controls src={m.mediaUrl} style={{ maxWidth: "320px", borderRadius: 12 }} />;
      }
      if (m.mediaType === "audio") {
        return <audio controls src={m.mediaUrl} style={{ width: 220 }} />;
      }
      return (
        <a href={m.mediaUrl} target="_blank" rel="noreferrer" style={{ color: isDark ? "#9ad3ff" : "#007bff" }}>
          Download attachment
        </a>
      );
    }
    return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>;
  };

  // ---------- JSX ----------
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header (sticky) */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", gap: 12, padding: 12, background: isDark ? "#0b0b0b" : "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", cursor: "pointer" }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</div>
          <div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666" }}>
            {friendTyping ? "typing..." : (friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? (() => {
              const ls = friendInfo.lastSeen;
              if (!ls) return "Offline";
              const ld = ls.toDate ? ls.toDate() : new Date(ls);
              const diffMin = Math.floor((Date.now() - ld.getTime()) / 60000);
              if (diffMin < 1) return "just now";
              if (diffMin < 60) return `${diffMin}m ago`;
              if (diffMin < 1440) return ld.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              const yesterday = new Date(); yesterday.setDate(new Date().getDate() - 1);
              if (ld.toDateString() === yesterday.toDateString()) return `Yesterday`;
              return ld.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            })() : "Offline"))}
          </div>
        </div>
      </header>

      {/* messages */}
      <main ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender === me?.uid ? "flex-end" : "flex-start" }}>
            <div style={{ background: m.sender === me?.uid ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1b1b1b" : "#fff"), color: m.sender === me?.uid ? "#fff" : (isDark ? "#fff" : "#000"), padding: 10, borderRadius: 14, maxWidth: "78%", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
              {renderMessage(m)}
              <div style={{ fontSize: 11, marginTop: 8, textAlign: "right", opacity: 0.9 }}>
                <span>{fmtTime(m.createdAt)}</span>
                {m.sender === me?.uid && <span style={{ marginLeft: 8 }}>{m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </main>

      {/* preview bar (above input) */}
      { (previewUrl || selectedFile) && (
        <div style={{ padding: 10, borderTop: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#070707" : "#fff", display: "flex", alignItems: "center", gap: 10 }}>
          {previewUrl ? (
            <img src={previewUrl} alt="preview" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8 }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee" }}>
              <span style={{ fontSize: 12 }}>{selectedFile?.name || "Attachment"}</span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedFile?.name || "Attachment selected"}</div>
            {uploading ? (
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 6, background: "#eee", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${uploadProgress}%`, height: "100%", background: "#34b7f1" }} />
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>{uploadProgress}%</div>
              </div>
            ) : (
              <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                <button onClick={uploadAndSendFile} style={{ padding: "8px 12px", background: "#34B7F1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Send</button>
                <button onClick={clearSelectedFile} style={{ padding: "8px 12px", background: "#ddd", color: "#333", border: "none", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* input sticky */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 60, display: "flex", gap: 8, alignItems: "center", padding: 10, background: isDark ? "#0b0b0b" : "#fff", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        {/* file picker */}
        <label style={{ cursor: "pointer", padding: 8, borderRadius: 10, background: isDark ? "#111" : "#f3f4f6" }}>
          📎
          <input type="file" accept="image/*,video/*,audio/*" style={{ display: "none" }} onChange={onPickFile} />
        </label>

        {/* text input */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (selectedFile) uploadAndSendFile(); else handleSendText(); } }}
          placeholder="Type a message..."
          style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#111" : "#f7f7f7", color: isDark ? "#fff" : "#000" }}
        />

        {/* send / mic button */}
        { (text.trim() || selectedFile) ? (
          <button onClick={() => { if (selectedFile) uploadAndSendFile(); else handleSendText(); }} style={{ padding: 10, borderRadius: 12, background: "#007bff", color: "#fff", border: "none", cursor: "pointer" }}>
            ➤
          </button>
        ) : (
          <button
            onMouseDown={onMicPointerDown}
            onMouseUp={onMicPointerUp}
            onTouchStart={onMicPointerDown}
            onTouchEnd={onMicPointerUp}
            style={{ padding: 10, borderRadius: 12, background: isRecording ? "#ff4d4f" : "#34d399", color: "#fff", border: "none", cursor: "pointer" }}
            title="Hold to record voice note"
          >
            {isRecording ? `● ${recordingTime}s` : "🎤"}
          </button>
        )}
      </div>
    </div>
  );
}