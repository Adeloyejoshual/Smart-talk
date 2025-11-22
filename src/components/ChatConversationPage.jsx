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

import ChatHeader from "./ChatHeader";
import MessageItem from "./MessageItem";

// -------------------- Helpers --------------------
const detectFileType = (file) => {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t === "application/pdf") return "pdf";
  return "file";
};

const uploadToCloudinary = async (file, onProgress) => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary env not set");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", uploadPreset);

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded * 100) / e.total)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(JSON.parse(xhr.responseText).secure_url) : reject(new Error("Cloudinary upload failed"));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
};

// -------------------- Component --------------------
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingIds, setUploadingIds] = useState({});
  const [replyTo, setReplyTo] = useState(null);

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    let unsubUser = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await cRef.get();
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });

          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const userRef = doc(db, "users", friendId);
            unsubUser = onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
          }
        }

        unsubChat = onSnapshot(doc(db, "chats", chatId), (s) => s.exists() && setChatInfo(prev => ({ ...(prev || {}), ...s.data() })));
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => { unsubChat && unsubChat(); unsubUser && unsubUser(); };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      setLoadingMsgs(false);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId, myUid]);

  // -------------------- Scroll --------------------
  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  // -------------------- File select --------------------
  const onFilesSelected = e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // -------------------- Send message --------------------
  const sendMessage = async () => {
    if (selectedFiles.length > 0) {
      const files = [...selectedFiles];
      setSelectedFiles([]);
      for (const file of files) {
        const placeholder = { senderId: myUid, text: "", mediaUrl: "", mediaType: detectFileType(file), fileName: file.name, createdAt: serverTimestamp(), status: "uploading", reactions: {} };
        const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
        const messageId = mRef.id;
        setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
        try {
          const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
        } catch (err) { console.error(err); }
      }
      return;
    }

    if (text.trim()) {
      const payload = { senderId: myUid, text: text.trim(), mediaUrl: "", mediaType: null, createdAt: serverTimestamp(), status: "sent", reactions: {} };
      if (replyTo) { payload.replyTo = replyTo; setReplyTo(null); }
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
      scrollToBottom();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5") }}>
      {/* Header */}
      <ChatHeader chatInfo={chatInfo} friendInfo={friendInfo} myUid={myUid} />

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: 20 }}>Loading...</div>}
        {messages.map(m => (
          <MessageItem
            key={m.id}
            message={m}
            myUid={myUid}
            chatId={chatId}
            uploadingPct={uploadingIds[m.id]}
            onReply={(msg) => setReplyTo(msg)}
            onPin={(msg) => console.log("Pin", msg)}
            onForward={(msg) => console.log("Forward", msg)}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ padding: 8, background: isDark ? "#1b1b1b" : "#fff", borderTop: `1px solid rgba(0,0,0,0.06)`, display: "flex", justifyContent: "space-between" }}>
          <div><b>{replyTo.text || replyTo.mediaType}</b></div>
          <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent" }}>×</button>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: 8, display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid rgba(0,0,0,0.06)`, background: isDark ? "#1b1b1b" : "#fff" }}>
        <input
          type="text"
          value={text}
          placeholder="Type a message"
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 12, border: `1px solid rgba(0,0,0,0.06)`, outline: "none", background: isDark ? "#0b0b0b" : "#fff", color: isDark ? "#fff" : "#000" }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <input type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} id="fileInput" />
        <label htmlFor="fileInput" style={{ cursor: "pointer" }}>📎</label>
        <button onClick={sendMessage} style={{ fontSize: 18, background: "transparent", border: "none" }}>📩</button>
      </div>
    </div>
  );
}
