// src/components/ChatConversationPage.jsx
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

/* ---------- small UI helpers ---------- */
const formatLastSeen = (ts, isOnline) => {
  if (isOnline) return "Online";
  if (!ts) return "Offline";
  const last = ts.toDate ? ts.toDate() : new Date(ts);
  const mins = Math.floor((Date.now() - last) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return last.toLocaleDateString();
};

const formatDayLabel = (d) => {
  if (!d) return "";
  const date = d.toDate ? d.toDate() : new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString();
};

/* ---------- component ---------- */
export default function ChatConversationPage() {
  const { chatId } = useParams(); // route param name: /chat/:chatId
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]); // messages from Firestore
  const [localMessages, setLocalMessages] = useState([]); // optimistic messages (uploads / sending)
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // selected files still uploading
  const [filePreviews, setFilePreviews] = useState([]); // preview urls
  const [sending, setSending] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  // scroll & UI state
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);

  const myUid = auth.currentUser?.uid;

  /* ---------- Chat & Friend loading ---------- */
  useEffect(() => {
    if (!chatId) return;
    let unsubFriend = null;
    let unsubChat = null;

    const load = async () => {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        alert("Chat not found");
        navigate("/chat");
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      setChatInfo(data);

      // friend is the other participant
      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriendInfo({ id: fsnap.id, ...fsnap.data() });
            // typing flag structure assumed: typing: { [chatId]: true }
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
          }
        });
      }
    };

    load();

    return () => {
      if (unsubFriend) unsubFriend();
      if (unsubChat) unsubChat();
    };
  }, [chatId, myUid, navigate]);

  /* ---------- Real-time messages listener ---------- */
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      // mark delivered for incoming sent messages (simple optimistic update)
      docs.forEach(async (m) => {
        if (m.sender !== myUid && m.status === "sent") {
          try {
            const mDoc = doc(db, "chats", chatId, "messages", m.id);
            await updateDoc(mDoc, { status: "delivered" });
          } catch (e) {
            /* ignore */
          }
        }
      });
    });
    return () => unsub();
  }, [chatId, myUid]);

  /* ---------- Scroll handling ---------- */
  // on new messages: auto-scroll only if at bottom
  useEffect(() => {
    if (isAtBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, localMessages, isAtBottom]);

  // detect manual scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const tolerance = 20;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    // initial check
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () =>
    endRef.current?.scrollIntoView({ behavior: "smooth" });

  /* ---------- Image viewer ---------- */
  const openViewer = (src) => {
    setViewerImage(src);
    setShowImageViewer(true);
  };
  const closeViewer = () => {
    setShowImageViewer(false);
    setViewerImage(null);
  };

  /* ---------- File selection & optimistic upload ---------- */
  const handleFilesSelected = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    // create local previews and kick off uploads
    const newPreviews = chosen.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : null
    );
    setFilePreviews((p) => [...p, ...newPreviews]);
    setFiles((p) => [...p, ...chosen]);
    chosen.forEach((file) => uploadFile(file));
  };

  const pushLocalMessage = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLocalMessages((prev) => [...prev, { id: tempId, ...payload }]);
    return tempId;
  };

  const uploadFile = (file) => {
    if (!chatId) return;
    const tempId = pushLocalMessage({
      sender: myUid,
      text: "",
      fileURL: URL.createObjectURL(file),
      fileName: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
      status: "uploading",
      progress: 0,
      createdAt: new Date(),
    });

    const sref = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sref, file);

    task.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, progress: pct } : m))
        );
      },
      (error) => {
        console.error("upload error", error);
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "error" } : m))
        );
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          // add message to Firestore (serverTimestamp)
          const docRef = await addDoc(collection(db, "chats", chatId, "messages"), {
            sender: myUid,
            text: "",
            fileURL: url,
            fileName: file.name,
            type: file.type.startsWith("image/") ? "image" : "file",
            createdAt: serverTimestamp(),
            status: "sent",
          });
          // remove local placeholder
          setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
          // cleanup previews for that file (we can't know exact mapping reliably here)
          // just remove first matching preview if exists
          setFilePreviews((prev) => {
            const next = [...prev];
            const idx = next.findIndex((u) => u && u.includes(file.name.split(".")[0]));
            if (idx >= 0) next.splice(idx, 1);
            return next;
          });
        } catch (err) {
          console.error(err);
          setLocalMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "error" } : m))
          );
        }
      }
    );
  };

  /* ---------- Send text message ---------- */
  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const tempId = pushLocalMessage({
      sender: myUid,
      text: text.trim(),
      type: "text",
      status: "sending",
      createdAt: new Date(),
    });
    setText("");

    try {
      const docRef = await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: myUid,
        text: text.trim(),
        fileURL: null,
        type: "text",
        createdAt: serverTimestamp(),
        status: "sent",
      });
      // remove local placeholder
      setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch (err) {
      console.error("send text error", err);
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "error" } : m))
      );
    } finally {
      setSending(false);
    }
  };

  /* ---------- Helper to render combined message list and group by day ---------- */
  const allMessages = [...messages, ...localMessages].sort((a, b) => {
    const aT = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt?.getTime?.() || new Date(a.createdAt).getTime();
    const bT = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt?.getTime?.() || new Date(b.createdAt).getTime();
    return aT - bT;
  });

  // group by day labels
  const grouped = [];
  let lastLabel = "";
  allMessages.forEach((m) => {
    const label = formatDayLabel(m.createdAt);
    if (label !== lastLabel) {
      grouped.push({ type: "day", id: `day-${label}`, label });
      lastLabel = label;
    }
    grouped.push({ type: "msg", ...m });
  });

  /* ---------- cleanup of preview URLs when component unmounts ---------- */
  useEffect(() => {
    return () => {
      filePreviews.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch (e) {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- UI render ---------- */
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#0f0f10" : "#f5f5f5",
      color: isDark ? "#fff" : "#000",
    }}>
      {/* HEADER (fixed) */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        background: isDark ? "#121214" : "#fff",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}>
        <button onClick={() => navigate("/chat")} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 12, color: isDark ? "#9aa" : "#666" }}>
            {friendTyping ? "typing..." : formatLastSeen(friendInfo?.lastSeen, friendInfo?.isOnline)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button title="Voice call" onClick={() => navigate(`/call?chatId=${chatId}&type=voice`)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18 }}>📞</button>
          <button title="Video call" onClick={() => navigate(`/call?chatId=${chatId}&type=video`)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18 }}>🎥</button>
        </div>
      </div>

      {/* MESSAGES (scrollable area) */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {grouped.map((item) => {
          if (item.type === "day") {
            return <div key={item.id} style={{ textAlign: "center", margin: "10px 0", color: isDark ? "#99a" : "#666", fontSize: 12 }}>{item.label}</div>;
          }
          const m = item;
          const mine = m.sender === myUid;
          const bubbleBg = mine ? (isDark ? "#1f6feb" : "#007bff") : (isDark ? "#2a2a2a" : "#e9e9ea");
          const textColor = mine ? "#fff" : (isDark ? "#fff" : "#000");
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div style={{ maxWidth: "72%", background: bubbleBg, color: textColor, padding: 10, borderRadius: 12, wordBreak: "break-word" }}>
                {/* file or image */}
                {m.type === "image" && m.fileURL && (
                  <img
                    src={m.fileURL}
                    alt={m.fileName || "image"}
                    style={{ width: "100%", borderRadius: 8, cursor: "pointer" }}
                    onClick={() => openViewer(m.fileURL)}
                  />
                )}
                {m.type === "file" && m.fileURL && (
                  <div>
                    <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: textColor }}>
                      📎 {m.fileName || "file"}
                    </a>
                  </div>
                )}
                {/* text */}
                {m.type === "text" && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
                {/* progress and status */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, fontSize: 11, marginTop: 6 }}>
                  {m.progress != null && <span>{m.progress}%</span>}
                  {m.status === "sending" && <span>⌛</span>}
                  {m.status === "uploading" && <span>⬆️</span>}
                  {m.status === "sent" && <span>✔</span>}
                  {m.status === "delivered" && <span>✔✔</span>}
                  {m.status === "seen" && <span style={{ color: "#34B7F1" }}>✔✔</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* DOWN ARROW (fixed above input) */}
      <button
        onClick={scrollToBottom}
        title="Scroll to latest"
        style={{
          position: "fixed",
          right: 20,
          bottom: 96,
          zIndex: 30,
          width: 44,
          height: 44,
          borderRadius: 22,
          border: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDark ? "#0b72d6" : "#007bff",
          color: "#fff",
          cursor: "pointer",
          opacity: isAtBottom ? 0 : 1,
          transition: "opacity 250ms ease",
        }}
      >
        ⬇
      </button>

      {/* PREVIEW STRIP (if any selected files not yet uploaded) */}
      {filePreviews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", background: isDark ? "#0f0f10" : "#fff" }}>
          {filePreviews.map((p, idx) => (
            <div key={idx} style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {p ? <img src={p} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 12 }}>{files[idx]?.name}</span>}
            </div>
          ))}
        </div>
      )}

      {/* INPUT (fixed) */}
      <div style={{
        display: "flex",
        gap: 8,
        padding: 10,
        borderTop: "1px solid rgba(0,0,0,0.08)",
        background: isDark ? "#0f0f10" : "#fff",
        alignItems: "center",
        position: "sticky",
        bottom: 0,
        zIndex: 25,
      }}>
        <label htmlFor="fileInput" style={{ cursor: "pointer", fontSize: 20 }}>📎</label>
        <input id="fileInput" type="file" multiple onChange={handleFilesSelected} style={{ display: "none" }} />

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 20,
            border: "1px solid rgba(0,0,0,0.12)",
            outline: "none",
            background: isDark ? "#121214" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
        />
        <button onClick={handleSend} disabled={sending} style={{ padding: "8px 14px", background: "#34B7F1", border: "none", color: "#fff", borderRadius: 20, cursor: "pointer" }}>
          Send
        </button>
      </div>

      {/* IMAGE VIEWER MODAL */}
      {showImageViewer && viewerImage && (
        <div onClick={closeViewer} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "zoom-out"
        }}>
          <img src={viewerImage} alt="full" style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}