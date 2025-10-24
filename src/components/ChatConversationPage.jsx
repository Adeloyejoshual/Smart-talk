// ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// Message status component
function MessageStatus({ status }) {
  if (status === "sending") return <span style={{ marginLeft: 6 }}>⌛</span>;
  if (status === "sent") return <span style={{ marginLeft: 6 }}>✔</span>;
  if (status === "delivered") return <span style={{ marginLeft: 6 }}>✔✔</span>;
  if (status === "seen") return <span style={{ marginLeft: 6, color: "#34B7F1" }}>✔✔</span>;
  return null;
}

// Format last seen / online
function formatLastSeen(ts, isOnline) {
  if (isOnline) return "Online";
  if (!ts) return "";
  const last = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now - last) / 1000 / 60);
  if (now.toDateString() === last.toDateString()) {
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString();
}

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  // Scroll to bottom when messages update
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, localMessages]);

  // Presence
  useEffect(() => {
    if (!myUid) return;
    const userRef = doc(db, "users", myUid);
    updateDoc(userRef, { isOnline: true }).catch(() => {});

    const handleUnload = async () => {
      try {
        await updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
      } catch (e) {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [myUid]);

  // Load chat & friend info
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend = null;

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        alert("Chat not found");
        navigate("/chat");
        return;
      }
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });

      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriendInfo({ id: fsnap.id, ...fsnap.data() });
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
          }
        });
      }
    })();

    return () => {
      if (unsubFriend) unsubFriend();
    };
  }, [chatId, myUid, navigate]);

  // Listen messages
  useEffect(() => {
    if (!chatId) return;
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // mark incoming sent -> delivered
      const incoming = msgs.filter((m) => m.sender !== myUid && m.status === "sent");
      for (const m of incoming) {
        try {
          updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
        } catch (e) {}
      }
    });
    return () => unsub();
  }, [chatId, myUid]);

  // delivered -> seen
  useEffect(() => {
    if (!chatId) return;
    const toMark = messages.filter((m) => m.sender !== myUid && m.status === "delivered");
    for (const m of toMark) {
      updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "seen" }).catch(() => {});
    }
  }, [messages, chatId, myUid]);

  // Typing indicator
  useEffect(() => {
    if (!myUid) return;
    const userRef = doc(db, "users", myUid);
    let timer = null;
    if (text && text.length > 0) {
      updateDoc(userRef, { [`typing.${chatId}`]: true }).catch(() => {});
      clearTimeout(timer);
      timer = setTimeout(() => {
        updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
      }, 1200);
    } else {
      updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
    }
    return () => clearTimeout(timer);
  }, [text, myUid, chatId]);

  // File selection
  const onFilesSelected = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setFiles((prev) => [...prev, ...chosen]);
    setPreviews((p) => [
      ...p,
      ...chosen.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    ]);
  };
  const removeFileAt = (index) => {
    setFiles((s) => s.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  };

  // Optimistic local messages
  const pushLocal = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const localMsg = { id: tempId, ...payload, createdAt: new Date(), status: "sending", local: true };
    setLocalMessages((prev) => [...prev, localMsg]);
    return tempId;
  };

  // Send message
  const handleSend = async () => {
    if ((!text || !text.trim()) && files.length === 0) return;
    if (!myUid) return;

    setUploading(true);

    try {
      // Add files optimistically
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        pushLocal({
          sender: myUid,
          text: "",
          fileURL: previews[i] || null,
          fileName: f.name,
          type: f.type.startsWith("image/") ? "image" : "file",
          status: "sending",
        });
      }
      // Add text optimistically
      if (text && text.trim()) {
        pushLocal({ sender: myUid, text: text.trim(), fileURL: null, type: "text", status: "sending" });
      }

      // Upload files to Firebase Storage
      const uploaded = [];
      for (const f of files) {
        const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${f.name}`);
        const task = uploadBytesResumable(sRef, f);
        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            () => {},
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              uploaded.push({ fileName: f.name, url, type: f.type.startsWith("image/") ? "image" : "file" });
              resolve();
            }
          );
        });
      }

      const msgCol = collection(db, "chats", chatId, "messages");

      for (const u of uploaded) {
        await addDoc(msgCol, {
          sender: myUid,
          text: "",
          fileURL: u.url,
          fileName: u.fileName,
          type: u.type,
          createdAt: serverTimestamp(),
          status: "sent",
        });
      }

      if (text && text.trim()) {
        await addDoc(msgCol, {
          sender: myUid,
          text: text.trim(),
          fileURL: null,
          fileName: null,
          type: "text",
          createdAt: serverTimestamp(),
          status: "sent",
        });
      }

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text?.trim() || uploaded[0]?.fileName || "",
        lastMessageAt: serverTimestamp(),
      });

      setLocalMessages([]);
      setText("");
      setFiles([]);
      setPreviews([]);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
      alert("Failed to send. Check your connection.");
    } finally {
      setUploading(false);
    }
  };

  const combined = [...messages, ...localMessages];
  const handleBack = () => navigate("/chat");
  const openProfile = () => friendInfo && navigate(`/profile/${friendInfo.id}`);
  const handleVoiceCall = () => navigate(`/call/${chatId}`);
  const handleVideoCall = () => navigate(`/video-call/${chatId}`);

  if (!chatInfo) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#fff" : "#000" }}>
        Loading chat...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#121212" : "#f5f5f5", color: isDark ? "#fff" : "#000" }}>

      {/* Header */}
      <div style={{ background: isDark ? "#1e1e1e" : "#fff", padding: "12px 18px", display: "flex", alignItems: "center", borderBottom: "1px solid #ccc", position: "sticky", top: 0, zIndex: 2 }}>
        <button onClick={handleBack} style={{ background: "transparent", border: "none", fontSize: "22px", cursor: "pointer", marginRight: "10px" }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} onClick={openProfile} />
        <div style={{ marginLeft: "10px" }}>
          <h4 style={{ margin: 0 }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</h4>
          <small style={{ color: "#34B7F1" }}>{friendTyping ? "typing..." : formatLastSeen(friendInfo?.lastSeen, friendInfo?.isOnline)}</small>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={handleVoiceCall} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>📞</button>
          <button onClick={handleVideoCall} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>🎥</button>
          <button style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer" }}>⋮</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {combined.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender === myUid ? "flex-end" : "flex-start", marginBottom: "6px" }}>
            <div style={{ background: m.sender === myUid ? "#34B7F1" : "#e5e5ea", color: m.sender === myUid ? "#fff" : "#000", padding: "8px 12px", borderRadius: "15px", maxWidth: "70%", wordBreak: "break-word" }}>
              {m.type === "text" && m.text}
              {m.type === "image" && <img src={m.fileURL} alt="sent" style={{ width: "150px", borderRadius: "10px" }} />}
              <div style={{ fontSize: "10px", textAlign: "right" }}><MessageStatus status={m.status} /></div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: "10px", display: "flex", gap: 6, borderTop: "1px solid #ccc" }}>
        <input type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} id="fileInput" />
        <label htmlFor="fileInput" style={{ cursor: "pointer" }}>📎</label>
        <input type="text" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "20px", border: "1px solid #ccc" }} />
        <button onClick={handleSend} disabled={uploading} style={{ background: "#34B7F1", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "20px", cursor: "pointer" }}>Send</button>
      </div>

      {/* File previews */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 6, overflowX: "auto" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {p ? <img src={p} alt="preview" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "10px" }} /> : <span>{files[idx]?.name}</span>}
              <button onClick={() => removeFileAt(idx)} style={{ position: "absolute", top: -5, right: -5, background: "#ff4d4f", border: "none", borderRadius: "50%", color: "#fff", cursor: "pointer", width: 18, height: 18 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}