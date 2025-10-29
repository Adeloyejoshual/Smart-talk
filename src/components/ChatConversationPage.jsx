// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
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
  arrayUnion,
  arrayRemove,
  getDocs,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage.jsx
 * - Real-time messages, typing, last-seen
 * - Attachment sheet (slide up), previews, fullscreen viewer
 * - No voice note UI (mic removed)
 * - Block/Unblock: if current user blocked friend, hide friend's messages locally
 *
 * Notes:
 * - this file assumes `users` docs hold { isOnline: boolean, lastSeen: Timestamp, typing: { [chatId]: boolean } }
 * - adjust fields if your schema differs.
 */

// ---------- helpers ----------
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext || {});
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;

  // core state
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // File objects waiting for Send
  const [previews, setPreviews] = useState([]); // preview urls (image or name placeholder)
  const [localUploads, setLocalUploads] = useState([]); // {id, progress, type, previewUrl}
  const [downloadMap, setDownloadMap] = useState({}); // { messageId: {status, progress, blobUrl} }

  // UI states
  const [attachOpen, setAttachOpen] = useState(false);
  const [viewer, setViewer] = useState({ open: false, url: null, type: null, fileName: null });
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  // refs
  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const attachRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingUpdate = useRef(0);

  // ---------- load chat + friend live ----------
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
      setBlocked(Boolean(snap.data()?.blockedBy?.includes(myUid)));

      // subscribe to chat doc (for block/unblock, lastMessage updates)
      unsubChat = onSnapshot(chatRef, (c) => {
        if (c.exists()) {
          setChatInfo({ id: c.id, ...c.data() });
          setBlocked(Boolean(c.data()?.blockedBy?.includes(myUid)));
        }
      });

      // discover friend id
      const friendId = snap.data().participants?.find((p) => p !== myUid);
      if (friendId) {
        const fu = doc(db, "users", friendId);
        unsubFriend = onSnapshot(fu, (f) => {
          if (!f.exists()) return;
          setFriendInfo({ id: f.id, ...f.data() });
          // typing & online
          setFriendTyping(Boolean(f.data()?.typing?.[chatId]));
        });
      }
    })();

    return () => { unsubChat && unsubChat(); unsubFriend && unsubFriend(); };
  }, [chatId, myUid, navigate]);

  // ---------- messages realtime ----------
  useEffect(() => {
    if (!chatId) return;
    const msgsQ = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(msgsQ, (snap) => {
      // reverse to ascending
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();

      // If current user blocked friend, hide messages from friend
      let filtered = docs;
      if (blocked && chatInfo?.blockedBy?.includes(myUid)) {
        filtered = docs.filter(m => m.sender === myUid);
      }

      setMessages(filtered);

      // mark delivered for incoming messages
      docs.forEach(m => {
        if (m.sender !== myUid && m.status === "sent") {
          const mRef = doc(db, "chats", chatId, "messages", m.id);
          updateDoc(mRef, { status: "delivered" }).catch(()=>{});
        }
      });

      // queue downloads for attachments
      docs.forEach(m => {
        if ((m.type === "image" || m.type === "file" || m.type === "audio") && m.fileURL) {
          setDownloadMap(prev => {
            if (prev[m.id] && (prev[m.id].status === "downloading" || prev[m.id].status === "done")) return prev;
            return { ...prev, [m.id]: { ...(prev[m.id]||{}), status: "queued", progress: 0, blobUrl: null } };
          });
        }
      });

      // scroll to bottom on first load
      setTimeout(() => { endRef.current?.scrollIntoView({ behavior: "auto" }); setIsAtBottom(true); }, 60);
    });

    return () => unsub();
  }, [chatId, blocked, chatInfo, myUid]);

  // ---------- start downloads for queued attachments ----------
  useEffect(() => {
    Object.entries(downloadMap).forEach(([msgId, info]) => {
      if (info.status === "queued") {
        setDownloadMap(prev => ({ ...prev, [msgId]: { ...prev[msgId], status: "downloading", progress: 0 } }));
        startDownloadForMessage(msgId).catch(err => {
          console.error("download start", err);
          setDownloadMap(prev => ({ ...prev, [msgId]: { ...prev[msgId], status: "failed" } }));
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadMap]);

  // ---------- scroll handler to toggle down arrow ----------
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
      if (!atBottom) setSelectedMessageId(null);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ---------- download streaming with progress (receiver) ----------
  const startDownloadForMessage = async (messageId) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) { setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "failed" } })); return; }
      const m = { id: snap.id, ...snap.data() };
      if (!m.fileURL) {
        setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "done", progress: 100, blobUrl: null } }));
        return;
      }

      const resp = await fetch(m.fileURL);
      if (!resp.ok) throw new Error("fetch failed");
      const contentLength = resp.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : null;
      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) {
          const pct = Math.round((received/total)*100);
          setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "downloading", progress: pct } }));
        } else {
          setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "downloading", progress: Math.min(99, (prev[messageId]?.progress||0) + 6) } }));
        }
      }
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "done", progress: 100, blobUrl } }));
    } catch (err) {
      console.error("download failed", err);
      setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "failed", progress: 0 } }));
      setTimeout(() => setDownloadMap(prev => ({ ...prev, [messageId]: { ...(prev[messageId]||{}), status: "queued" } })), 10000);
    }
  };

  // helper to return best display URL for a message
  const getDisplayUrlForMessage = (m) => {
    const d = downloadMap[m.id];
    if (d && d.blobUrl) return d.blobUrl;
    if (m.fileURL) return m.fileURL;
    const local = localUploads.find(l => l.id === m.id);
    if (local && local.previewUrl) return local.previewUrl;
    return null;
  };

  // ---------- attachments selection (preview stage) ----------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  // ---------- send queued files (when user clicks Send) ----------
  const sendQueuedFiles = async () => {
    if (!selectedFiles.length) return;
    const toSend = [...selectedFiles];
    setSelectedFiles([]); setPreviews([]);

    for (const file of toSend) {
      try {
        const type = file.type.startsWith("image/") ? "image" : (file.type.startsWith("audio/") ? "audio" : "file");
        const placeholder = {
          sender: myUid,
          text: "",
          fileURL: null,
          fileName: file.name,
          type,
          createdAt: serverTimestamp(),
          status: "uploading",
        };
        const docRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);

        // add local placeholder upload UI
        setLocalUploads(prev => [...prev, { id: docRef.id, fileName: file.name, progress: 0, type, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null }]);

        // upload
        const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
        const task = uploadBytesResumable(sRef, file);

        task.on("state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setLocalUploads(prev => prev.map(u => u.id === docRef.id ? { ...u, progress: pct } : u));
          },
          (err) => {
            console.error("upload err", err);
            updateDoc(docRef, { status: "failed" }).catch(()=>{});
            setLocalUploads(prev => prev.map(u => u.id === docRef.id ? { ...u, status: "failed" } : u));
          },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            await updateDoc(docRef, { fileURL: url, status: "sent", sentAt: serverTimestamp() }).catch(()=>{});
            setLocalUploads(prev => prev.filter(u => u.id !== docRef.id));
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
          }
        );
      } catch (err) {
        console.error("send queued failed", err);
      }
    }
  };

  // ---------- send text (and if previews exist send them) ----------
  const handleSend = async () => {
    // if there are queued files, send them first
    if (selectedFiles.length) {
      await sendQueuedFiles();
    }
    if (text.trim()) {
      const payload = {
        sender: myUid,
        text: text.trim(),
        fileURL: null,
        fileName: null,
        type: "text",
        createdAt: serverTimestamp(),
        status: "sent",
      };
      try {
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText("");
        // update chat.lastMessage + lastMessageAt for ChatList UI (optional)
        const chatRef = doc(db, "chats", chatId);
        updateDoc(chatRef, { lastMessage: payload.text, lastMessageAt: serverTimestamp() }).catch(()=>{});
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
      } catch (err) {
        console.error("send text", err);
      }
    }
    // close attachment sheet after send
    setAttachOpen(false);
  };

  // ---------- typing indicator (update our user doc typing map) ----------
  const updateTypingStatus = useCallback((isTyping) => {
    if (!myUid || !chatId) return;
    const userRef = doc(db, "users", myUid);
    // write typing state under users/{myUid}.typing[chatId] = true/false
    updateDoc(userRef, { [`typing.${chatId}`]: isTyping }).catch(()=>{});
  }, [myUid, chatId]);

  useEffect(() => {
    // debounce typing updates
    const now = Date.now();
    if (text.trim()) {
      updateTypingStatus(true);
      lastTypingUpdate.current = now;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 1200);
    } else {
      updateTypingStatus(false);
    }
    // cleanup on unmount
    return () => { if (typingTimer.current) clearTimeout(typingTimer.current); };
  }, [text, updateTypingStatus]);

  // ---------- block/unblock ----------
  const toggleBlock = async () => {
    if (!chatInfo) return;
    const chatRef = doc(db, "chats", chatId);
    try {
      if (blocked) {
        await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
        setBlocked(false);
      } else {
        await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
        setBlocked(true);
      }
      setMenuOpen(false);
    } catch (err) {
      console.error("toggleBlock", err);
      alert("Failed to update block status");
    }
  };

  // ---------- reactions (toggle: remove if same exists) ----------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      // fetch current to decide if remove or set
      const mSnap = await getDoc(mRef);
      if (!mSnap.exists()) return;
      const curr = mSnap.data();
      const existing = curr.reactions?.[myUid];
      if (existing === emoji) {
        // remove reaction
        await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
      setSelectedMessageId(null);
    } catch (err) {
      console.error("reaction", err);
    }
  };

  // ---------- delete message ----------
  const deleteMessage = async (messageId) => {
    if (!window.confirm("Delete message?")) return;
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
      setSelectedMessageId(null);
    } catch (err) {
      console.error("delete", err);
    }
  };

  // ---------- clear chat (batched) ----------
  const clearChat = async () => {
    if (!window.confirm("Clear all messages in this chat? This will delete messages permanently.")) return;
    try {
      const msgsRef = collection(db, "chats", chatId, "messages");
      const snapshot = await getDocs(msgsRef);
      const docs = snapshot.docs;
      const batchSize = 400;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      alert("Chat cleared.");
      setMenuOpen(false);
    } catch (err) {
      console.error("clear chat", err);
    }
  };

  // ---------- helper: open viewer (image/file/audio) ----------
  const openViewer = (url, type, fileName = null) => {
    setViewer({ open: true, url, type, fileName });
  };

  // ---------- UI components ----------
  const MessageBubble = ({ m }) => {
    const mine = m.sender === myUid;
    const displayUrl = getDisplayUrlForMessage(m);
    const dl = downloadMap[m.id];
    const reactionList = m.reactions ? Object.values(m.reactions).filter(Boolean) : [];

    // skip rendering if we filtered earlier (shouldn't happen)
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"} mb-3 px-2`}>
        <div
          onContextMenu={(e) => { e.preventDefault(); setSelectedMessageId(m.id); }}
          onMouseDown={() => { /* can implement long press on mobile separately */ }}
          style={{
            background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#1e1e1e" : "#f3f3f3"),
            color: mine ? "#fff" : (isDark ? "#fff" : "#000"),
            padding: "10px 12px",
            borderRadius: 14,
            maxWidth: "78%",
            position: "relative",
            wordBreak: "break-word",
          }}
        >
          {m.replyTo && (
            <div className={`mb-2 p-2 rounded ${isDark ? "bg-[#111]" : "bg-white"} text-xs`} style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ fontSize: 12 }}>{m.replyTo.sender === myUid ? "You: " : ""}</strong>
              <span>{m.replyTo.text || m.replyTo.fileName || "media"}</span>
            </div>
          )}

          {/* text */}
          {m.type === "text" && <div>{m.text}</div>}

          {/* attachments */}
          {["image", "file", "audio"].includes(m.type) && (
            <div className="flex items-center gap-3 mt-1">
              {m.type === "image" ? (
                <img
                  src={displayUrl || m.fileURL}
                  alt={m.fileName || "image"}
                  className="rounded-md cursor-pointer"
                  style={{ width: 220 }}
                  onClick={() => openViewer(displayUrl || m.fileURL, "image", m.fileName)}
                />
              ) : (
                <div className={`flex items-center gap-3 p-2 rounded ${isDark ? "bg-[#111]" : "bg-white"}`} style={{ maxWidth: 320 }}>
                  <div className="text-2xl">📎</div>
                  <div className="flex-1">
                    <div className="font-semibold">{m.fileName || "file"}</div>
                    <div className="text-xs text-gray-400">{m.type}</div>
                  </div>
                  <div>
                    <a href={displayUrl || m.fileURL} target="_blank" rel="noreferrer" className="text-sm underline">Open</a>
                  </div>
                </div>
              )}
              {/* progress overlay */}
              {(m.status === "uploading" || (dl && (dl.status === "downloading" || dl.status === "queued"))) && (
                <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/40 text-white text-xs">
                    {m.status === "uploading" ? (() => {
                      const u = localUploads.find(x => x.id === m.id);
                      return u ? `${u.progress}%` : "0%";
                    })() : (dl ? `${dl.progress}%` : "0%")}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* time + status */}
          <div className="text-right text-xs mt-2 opacity-90">
            <span>{fmtTime(m.createdAt)}</span>
            {mine && <span className="ml-2">{m.status === "uploading" ? "⌛" : m.status === "sent" ? "✓" : m.status === "delivered" ? "✓✓" : m.status === "seen" ? "✓✓" : ""}</span>}
          </div>

          {/* reactions */}
          {reactionList.length > 0 && (
            <div style={{ position: "absolute", right: 6, bottom: -18 }} className={`p-1 rounded-full ${isDark ? "bg-[#111]" : "bg-white"} shadow`}>
              <div style={{ fontSize: 12 }}>{reactionList.slice(0,3).join(" ")}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------- grouped messages by day ----------
  const grouped = [];
  let lastDay = null;
  messages.forEach(m => {
    const label = dayLabel(m.createdAt || new Date());
    if (label !== lastDay) {
      grouped.push({ type: "day", label, id: `day-${label}-${Math.random().toString(36).slice(2,6)}` });
      lastDay = label;
    }
    grouped.push(m);
  });

  // ---------- attachment sheet outside click (close) ----------
  useEffect(() => {
    const handler = (e) => {
      if (attachOpen && attachRef.current && !attachRef.current.contains(e.target)) {
        setAttachOpen(false);
      }
    };
    if (attachOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [attachOpen]);

  // ensure back arrow visible in dark mode (we use svg + tailwind text color)
  // ---------- render ----------
  return (
    <div className={`flex flex-col min-h-screen ${isDark ? "bg-[#070707] text-white" : "bg-gray-50 text-black"}`} style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : undefined, backgroundSize: "cover" }}>
      {/* Header */}
      <div className={`sticky top-0 z-40 flex items-center gap-3 px-3 py-2 ${isDark ? "bg-[#0b0b0b] border-b border-[#222]" : "bg-white border-b border-gray-200"}`}>
        <button onClick={() => navigate("/chat")} className={`p-2 rounded ${isDark ? "text-white" : "text-gray-700"}`}>
          {/* simple arrow, contrast set by text color */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={isDark ? "#fff" : "#111"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" className="w-11 h-11 rounded-full object-cover cursor-pointer" onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} />
        <div className="flex-1">
          <div className="font-semibold">{friendInfo?.displayName || chatInfo?.name || "Friend"}</div>
          <div className="text-xs opacity-80">
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

        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/voice-call/${chatId}`)} className="p-2">📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} className="p-2">🎥</button>

          <div className="relative">
            <button onClick={() => setMenuOpen(s => !s)} className="p-2">⋮</button>
            {menuOpen && (
              <div className={`absolute right-0 mt-2 w-44 rounded shadow ${isDark ? "bg-[#222] text-white" : "bg-white text-black"}`}>
                <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">View Profile</button>
                <button onClick={() => { clearChat(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">Clear Chat</button>
                <button onClick={toggleBlock} className="w-full text-left px-3 py-2 hover:bg-gray-100">{blocked ? "Unblock" : "Block"}</button>
                <button onClick={() => { setReportOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={messagesRef} className="flex-1 overflow-auto p-3" style={{ scrollbarGutter: "stable" }}>
        {grouped.map(item => {
          if (item.type === "day") return <div key={item.id} className="text-center text-xs text-gray-400 my-3">{item.label}</div>;
          return <MessageBubble key={item.id} m={item} />;
        })}
        <div ref={endRef} />
      </div>

      {/* center scroll button */}
      <button
        onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth" })}
        className={`fixed left-1/2 transform -translate-x-1/2 bottom-28 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${isAtBottom ? "opacity-0 pointer-events-none" : "opacity-100"} transition-opacity`}
        style={{ background: "#007bff", color: "#fff" }}
        aria-hidden={isAtBottom}
        title="Scroll to latest"
      >
        ↓
      </button>

      {/* previews (above input) */}
      {previews.length > 0 && (
        <div className={`flex gap-3 p-3 overflow-x-auto border-t ${isDark ? "bg-[#0b0b0b] border-[#222]" : "bg-white border-gray-200"}`}>
          {previews.map((p, idx) => (
            <div key={idx} className="relative rounded-xl overflow-hidden" style={{ minWidth: 84, minHeight: 84, background: "#f2f2f2" }}>
              {p ? (
                <img src={p} alt="preview" className="w-20 h-20 object-cover rounded-md" onClick={() => openViewer(p, "image", selectedFiles[idx]?.name)} />
              ) : (
                <div className="w-20 h-20 flex items-center justify-center text-sm p-2">{selectedFiles[idx]?.name}</div>
              )}
              <button onClick={() => { setSelectedFiles(s => s.filter((_,i) => i !== idx)); setPreviews(s => s.filter((_,i) => i !== idx)); }} className="absolute -top-3 -right-3 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow">
                ✕
              </button>
            </div>
          ))}

          <div className="flex-1" />
          <div className="flex gap-2">
            <button onClick={sendQueuedFiles} className="bg-blue-500 text-white px-3 py-2 rounded">Send</button>
            <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} className="bg-gray-300 px-3 py-2 rounded">Cancel</button>
          </div>
        </div>
      )}

      {/* bottom input / attachment */}
      <div className={`sticky bottom-0 z-40 p-3 border-t ${isDark ? "bg-[#0b0b0b] border-[#222]" : "bg-white border-gray-200"}`}>
        <div className="flex items-center gap-3">
          {/* + (attachment) */}
          <div ref={attachRef} className="relative">
            <button onClick={() => setAttachOpen(s => !s)} className={`w-12 h-12 rounded-xl ${isDark ? "bg-[#1b1b1b]" : "bg-white"} shadow flex items-center justify-center`}>＋</button>

            {/* attachment sheet (slide up) */}
            {attachOpen && (
              <div className={`absolute left-0 bottom-14 w-[90vw] max-w-sm rounded-xl p-4 shadow-lg ${isDark ? "bg-[#111] text-white" : "bg-white text-black"}`}>
                <div className="flex justify-around">
                  {/* camera: use input captrue for mobile camera where supported */}
                  <label className="flex flex-col items-center cursor-pointer">
                    <div className="text-2xl mb-1">📷</div>
                    <div className="text-xs">Camera</div>
                    <input accept="image/*" capture="environment" type="file" onChange={onFilesSelected} className="hidden" />
                  </label>

                  <label className="flex flex-col items-center cursor-pointer">
                    <div className="text-2xl mb-1">🖼️</div>
                    <div className="text-xs">Photos</div>
                    <input accept="image/*" multiple type="file" onChange={onFilesSelected} className="hidden" />
                  </label>

                  <label className="flex flex-col items-center cursor-pointer">
                    <div className="text-2xl mb-1">📁</div>
                    <div className="text-xs">Files</div>
                    <input accept="*/*" type="file" multiple onChange={onFilesSelected} className="hidden" />
                  </label>

                  <label className="flex flex-col items-center cursor-pointer">
                    <div className="text-2xl mb-1">🎧</div>
                    <div className="text-xs">Audio</div>
                    <input accept="audio/*" type="file" multiple onChange={onFilesSelected} className="hidden" />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* text input */}
          <div className="flex-1">
            { /* reply bar can be added here if replyTo implemented */ }
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Type a message..."
              className={`w-full px-4 py-3 rounded-2xl outline-none ${isDark ? "bg-[#111] text-white placeholder-gray-400" : "bg-gray-100 text-black"}`}
            />
          </div>

          {/* Send button - also sends queued files if present */}
          <button onClick={handleSend} className="bg-blue-500 text-white px-4 py-3 rounded-2xl">Send</button>
        </div>
      </div>

      {/* viewer modal */}
      {viewer.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setViewer({ open: false, url: null })}>
          <div className="max-w-full max-h-full p-4" onClick={(e) => e.stopPropagation()}>
            {viewer.type === "image" && <img src={viewer.url} alt={viewer.fileName} className="max-w-[95vw] max-h-[90vh] object-contain" />}
            {viewer.type === "file" && (
              <div className="bg-white p-4 rounded">
                <div className="font-semibold">{viewer.fileName}</div>
                <a href={viewer.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open / Download</a>
              </div>
            )}
            {viewer.type === "audio" && (
              <audio controls src={viewer.url} className="max-w-full" />
            )}
            <button onClick={() => setViewer({ open: false, url: null })} className="absolute top-4 right-4 text-white text-2xl">✕</button>
          </div>
        </div>
      )}

      {/* report modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className={`w-11/12 max-w-md p-4 rounded ${isDark ? "bg-[#111] text-white" : "bg-white text-black"}`}>
            <h3 className="font-semibold mb-2">Report user</h3>
            <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe issue..." className="w-full h-28 p-2 rounded bg-gray-50 mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReportOpen(false)} className="px-3 py-2 rounded bg-gray-300">Cancel</button>
              <button onClick={async () => {
                if (!reportText.trim()) return alert("Write something");
                await addDoc(collection(db, "reports"), { reporterId: myUid, reportedId: friendInfo?.id || null, chatId, reason: reportText.trim(), createdAt: serverTimestamp() });
                setReportText(""); setReportOpen(false); alert("Report submitted");
              }} className="px-3 py-2 rounded bg-red-500 text-white">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}