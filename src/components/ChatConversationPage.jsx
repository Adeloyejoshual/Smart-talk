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

// Format message day for grouping
function formatMessageDay(date) {
  const msgDate = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (msgDate.toDateString() === now.toDateString()) return "Today";
  if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
  return msgDate.toLocaleDateString();
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
  const [friendTyping, setFriendTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  const toggleMenu = () => setMenuOpen(!menuOpen);

  // Scroll to bottom
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

  // Delivered -> seen
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

  // Push local message
  const pushLocal = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const localMsg = { id: tempId, ...payload, createdAt: new Date(), status: "sending", local: true };
    setLocalMessages((prev) => [...prev, localMsg]);
    return tempId;
  };

  // Upload single file
  const uploadFile = async (file) => {
    const tempId = pushLocal({
      sender: myUid,
      text: "",
      fileURL: URL.createObjectURL(file),
      fileName: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
      status: "sending",
    });

    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    task.on(
      "state_changed",
      () => {},
      (err) => {
        console.error(err);
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, "chats", chatId, "messages"), {
          sender: myUid,
          text: "",
          fileURL: url,
          fileName: file.name,
          type: file.type.startsWith("image/") ? "image" : "file",
          createdAt: serverTimestamp(),
          status: "sent",
        });
        setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    );
  };

  // File selection
  const onFilesSelected = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setFiles((prev) => [...prev, ...chosen]);
    setPreviews((p) => [...p, ...chosen.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null))]]);
    chosen.forEach(uploadFile);
  };

  // Send text message
  const handleSend = async () => {
    if (!text.trim()) return;
    const msgCol = collection(db, "chats", chatId, "messages");
    pushLocal({ sender: myUid, text: text.trim(), fileURL: null, type: "text", status: "sending" });

    await addDoc(msgCol, {
      sender: myUid,
      text: text.trim(),
      fileURL: null,
      fileName: null,
      type: "text",
      createdAt: serverTimestamp(),
      status: "sent",
    });

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: text.trim(),
      lastMessageAt: serverTimestamp(),
    });
    setText("");
  };

  // Combine all messages
  const allMessages = [...messages, ...localMessages].sort((a, b) => {
    const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt?.getTime();
    const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt?.getTime();
    return aTime - bTime;
  });

  const groupedMessages = [];
  let lastDay = "";
  allMessages.forEach((m) => {
    const dayLabel = formatMessageDay(m.createdAt
const allMessages = [...messages, ...localMessages].sort((a, b) => {
    const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt?.getTime();
    const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt?.getTime();
    return aTime - bTime;
  });

  const groupedMessages = [];
  let lastDay = "";
  allMessages.forEach((m) => {
    const dayLabel = formatMessageDay(m.createdAt);
    if (dayLabel !== lastDay) {
      groupedMessages.push({ type: "day", id: `day-${dayLabel}-${m.id}`, label: dayLabel });
      lastDay = dayLabel;
    }
    groupedMessages.push(m);
  });

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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#121212" : "#f5f5f5",
      color: isDark ? "#fff" : "#000"
    }}>
      {/* Header */}
      <div style={{
        background: isDark ? "#1e1e1e" : "#fff",
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #ccc",
        position: "sticky",
        top: 0,
        zIndex: 2
      }}>
        <button onClick={handleBack} style={{ background: "transparent", border: "none", fontSize: "22px", cursor: "pointer", marginRight: "10px" }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} onClick={openProfile} />
        <div style={{ marginLeft: "10px" }}>
          <h4 style={{ margin: 0 }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</h4>
          <small style={{ color: "#34B7F1" }}>{friendTyping ? "typing..." : formatLastSeen(friendInfo?.lastSeen, friendInfo?.isOnline)}</small>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <button onClick={handleVoiceCall} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", marginRight: 10 }}>📞</button>
          <button onClick={handleVideoCall} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", marginRight: 10 }}>🎥</button>
          {/* Three-dot menu */}
          <div style={{ position: "relative" }}>
            <button onClick={toggleMenu} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer" }}>⋮</button>
            {menuOpen && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "100%",
                background: isDark ? "#333" : "#fff",
                border: "1px solid #ccc",
                borderRadius: 6,
                padding: 8,
                minWidth: 140,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                zIndex: 10
              }}>
                <div style={{ padding: 6, cursor: "pointer" }} onClick={openProfile}>View Profile</div>
                <div style={{ padding: 6, cursor: "pointer" }}>Mute Notifications</div>
                <div style={{ padding: 6, cursor: "pointer" }}>Clear Chat</div>
                <div style={{ padding: 6, cursor: "pointer" }}>Delete Chat</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px", marginBottom: "160px" }}>
        {groupedMessages.map((item) => {
          if (item.type === "day") {
            return (
              <div key={item.id} style={{ textAlign: "center", margin: "10px 0", color: "#888", fontSize: 12, fontWeight: "600" }}>
                {item.label}
              </div>
            );
          }
          const m = item;
          const mine = m.sender === myUid;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 6 }}>
              <div style={{ background: mine ? "#34B7F1" : "#e5e5ea", color: mine ? "#fff" : "#000", padding: "8px 12px", borderRadius: "15px", maxWidth: "70%", wordBreak: "break-word" }}>
                {m.type === "text" && m.text}
                {m.type === "image" && <img src={m.fileURL} alt="sent" style={{ width: "150px", borderRadius: "10px" }} />}
                {m.type === "file" && <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007BFF" }}>📎 {m.fileName}</a>}
                <div style={{ fontSize: 10, textAlign: "right" }}><MessageStatus status={m.status} /></div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Pinned input + file previews */}
      <div style={{ position: "fixed", bottom: 0, left: 0, width: "100%", background: isDark ? "#1e1e1e" : "#fff", borderTop: "1px solid #ccc", padding: 10, zIndex: 5 }}>
        {/* File previews */}
        {previews.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 8, overflowX: "auto" }}>
            {previews.map((p, idx) => p && <img key={idx} src={p} alt="preview" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} />)}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center" }}>
          <input type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} id="fileInput" />
          <label htmlFor="fileInput" style={{ cursor: "pointer", marginRight: 8 }}>📎</label>
          <input
            type="text"
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", marginRight: 8 }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend} style={{ padding: "8px 12px", borderRadius: 20, background: "#34B7F1", border: "none", color: "#fff", cursor: "pointer" }}>Send</button>
        </div>
      </div>
    </div>
  );
}