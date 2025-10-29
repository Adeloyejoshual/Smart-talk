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
  limit as fsLimit,
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
 * ChatConversationPage.jsx (Tailwind)
 * - Attachment bottom sheet (Camera, Photos, Files) — slides from bottom and closes on outside tap
 * - No voice note recording (but audio files are supported)
 * - Image previews above input; Send commits them to chat
 * - Placeholder -> upload -> update doc flow
 * - Reaction toggle (add/remove)
 * - Live last seen rendering
 */

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅"];

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const fmtLastSeen = (ts) => {
  if (!ts) return "";
  if (ts === "Online") return "Online";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [limitCount] = useState(75);

  // UI states
  const [selectedFiles, setSelectedFiles] = useState([]); // File objects (preview stage)
  const [previews, setPreviews] = useState([]); // preview URLs (images) or null for non-image
  const [localUploads, setLocalUploads] = useState([]); // placeholders for local upload progress
  const [downloadMap, setDownloadMap] = useState({}); // { messageId: {status, progress, blobUrl} }
  const [text, setText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  const [previewModal, setPreviewModal] = useState(null); // { type: 'image'|'file'|'audio', url, name }
  const [isAtBottom, setIsAtBottom] = useState(true);

  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const attachRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  // ---------- load chat info and friend (live) ----------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend = null;
    let unsubChat = null;

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        alert("Chat not found");
        navigate("/chat");
        return;
      }
      setChatInfo({ id: snap.id, ...snap.data() });
      setBlocked(Boolean(snap.data()?.blockedBy?.includes(myUid)));

      const friendId = snap.data().participants?.find((p) => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (uSnap) => {
          if (!uSnap.exists()) return;
          const data = uSnap.data();
          setFriendInfo({ id: uSnap.id, ...data });
          setFriendTyping(Boolean(data?.typing?.[chatId]));
        });
      }

      unsubChat = onSnapshot(chatRef, (cSnap) => {
        if (cSnap.exists()) {
          setChatInfo((prev) => ({ ...(prev || {}), ...cSnap.data() }));
          setBlocked(Boolean(cSnap.data()?.blockedBy?.includes(myUid)));
        }
      });
    })();

    return () => {
      unsubFriend && unsubFriend();
      unsubChat && unsubChat();
    };
  }, [chatId, myUid, navigate]);

  // ---------- realtime messages ----------
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), fsLimit(limitCount));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
      setMessages(docs);

      // auto mark delivered for incoming (best-effort)
      docs.forEach((m) => {
        if (m.sender !== myUid && m.status === "sent") {
          const mRef = doc(db, "chats", chatId, "messages", m.id);
          updateDoc(mRef, { status: "delivered" }).catch(() => {});
        }
      });

      // queue downloads for attachments
      docs.forEach((m) => {
        if ((m.type === "image" || m.type === "file" || m.type === "audio") && m.fileURL) {
          setDownloadMap((prev) => {
            if (prev[m.id] && (prev[m.id].status === "done" || prev[m.id].status === "downloading")) return prev;
            return { ...prev, [m.id]: { ...(prev[m.id] || {}), status: "queued", progress: 0, blobUrl: null } };
          });
        }
      });

      // scroll to bottom on first load
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "auto" });
        setIsAtBottom(true);
      }, 30);
    });

    return () => unsub();
  }, [chatId, limitCount, myUid]);

  // ---------- start downloads for queued attachments ----------
  useEffect(() => {
    Object.entries(downloadMap).forEach(([msgId, info]) => {
      if (info.status === "queued") {
        setDownloadMap((prev) => ({ ...prev, [msgId]: { ...prev[msgId], status: "downloading", progress: 0 } }));
        startDownloadForMessage(msgId).catch((err) => {
          console.error("download start error", err);
          setDownloadMap((prev) => ({ ...prev, [msgId]: { ...prev[msgId], status: "failed" } }));
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadMap]);

  // ---------- scroll handler ----------
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

  const scrollToBottom = (smooth = true) => endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });

  // ---------- file selection (pictures & files) ----------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null));
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  // ---------- send queued previews ----------
  const sendQueuedFiles = async () => {
    if (!selectedFiles.length) return;
    const filesToSend = [...selectedFiles];
    setSelectedFiles([]);
    setPreviews([]);

    for (const file of filesToSend) {
      try {
        const placeholder = {
          sender: myUid,
          text: "",
          fileURL: null,
          fileName: file.name,
          type: file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file",
          createdAt: serverTimestamp(),
          status: "uploading",
        };
        const docRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);

        // local placeholder UI
        const previewUrl = URL.createObjectURL(file);
        setLocalUploads((prev) => [...prev, { id: docRef.id, fileName: file.name, progress: 0, type: placeholder.type, previewUrl }]);

        // upload
        const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
        const task = uploadBytesResumable(sRef, file);

        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setLocalUploads((prev) => prev.map((l) => (l.id === docRef.id ? { ...l, progress: pct } : l)));
          },
          (err) => {
            console.error("upload error", err);
            updateDoc(docRef, { status: "failed" }).catch(() => {});
            setLocalUploads((prev) => prev.map((l) => (l.id === docRef.id ? { ...l, status: "failed" } : l)));
          },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            await updateDoc(docRef, { fileURL: url, status: "sent", sentAt: serverTimestamp() }).catch(() => {});
            setLocalUploads((prev) => prev.filter((l) => l.id !== docRef.id));
            setTimeout(() => scrollToBottom(true), 120);
          }
        );
      } catch (err) {
        console.error("send queued file failed", err);
      }
    }
  };

  // ---------- receiver download: stream with progress ----------
  const startDownloadForMessage = async (messageId) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const mSnap = await getDoc(mRef);
      if (!mSnap.exists()) {
        setDownloadMap((prev) => ({ ...prev, [messageId]: { ...prev[messageId], status: "failed" } }));
        return;
      }
      const m = { id: mSnap.id, ...mSnap.data() };
      if (!m.fileURL) {
        setDownloadMap((prev) => ({ ...prev, [messageId]: { ...prev[messageId], status: "done", progress: 100, blobUrl: null } }));
        return;
      }

      // fetch stream (best-effort; Firebase download links usually return quickly)
      const resp = await fetch(m.fileURL);
      if (!resp.ok) throw new Error("Download failed: " + resp.status);
      const contentLength = resp.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength, 10) : null;
      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length || value.byteLength || 0;
        if (total) {
          const pct = Math.round((received / total) * 100);
          setDownloadMap((prev) => ({ ...prev, [messageId]: { ...prev[messageId], status: "downloading", progress: pct } }));
        } else {
          setDownloadMap((prev) => ({ ...prev, [messageId]: { ...prev[messageId], status: "downloading", progress: Math.min(99, (prev[messageId]?.progress || 0) + 5) } }));
        }
      }
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      setDownloadMap((prev) => ({ ...prev, [messageId]: { ...prev[messageId], status: "done", progress: 100, blobUrl } }));
    } catch (err) {
      console.error("download failed", err);
      setDownloadMap((prev) => ({ ...prev, [messageId]: { ...prev[messageId], status: "failed", progress: 0 } }));
      setTimeout(() => setDownloadMap((prev) => ({ ...prev, [messageId]: { ...(prev[messageId] || {}), status: "queued" } })), 10000);
    }
  };

  const getDisplayUrlForMessage = (m) => {
    const d = downloadMap[m.id];
    if (d && d.blobUrl) return d.blobUrl;
    if (m.fileURL) return m.fileURL;
    const local = localUploads.find((l) => l.id === m.id);
    if (local && local.previewUrl) return local.previewUrl;
    return null;
  };

  // ---------- send text ----------
  const handleSendText = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;
    if (blocked) {
      alert("You blocked this user — unblock to send.");
      return;
    }

    if (selectedFiles.length > 0) {
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
      if (replyTo) {
        payload.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0, 120) || (replyTo.fileName || "media"), sender: replyTo.sender };
        setReplyTo(null);
      }
      setText("");
      try {
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setTimeout(() => scrollToBottom(true), 150);
      } catch (err) {
        console.error("send text failed", err);
        alert("Failed to send message");
      }
    }
  };

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

  // ---------- report ----------
  const submitReport = async () => {
    if (!reportText.trim()) {
      alert("Please write report details.");
      return;
    }
    try {
      await addDoc(collection(db, "reports"), {
        reporterId: myUid,
        reportedId: friendInfo?.id || null,
        chatId,
        reason: reportText.trim(),
        createdAt: serverTimestamp(),
        emailTo: "smarttalkgit@gmail.com",
      });
      setReportText("");
      setReportOpen(false);
      setMenuOpen(false);
      alert("Report submitted. Thank you.");
    } catch (err) {
      console.error("report submit", err);
      alert("Failed to submit report");
    }
  };

  // ---------- delete message ----------
  const deleteMessage = async (messageId) => {
    if (!window.confirm("Delete message?")) return;
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
      setSelectedMessageId(null);
    } catch (err) {
      console.error("delete message", err);
      alert("Failed to delete message");
    }
  };

  // ---------- clear chat ----------
  const clearChat = async () => {
    if (!window.confirm("Clear all messages in this chat? This will delete messages permanently.")) return;
    try {
      const msgsRef = collection(db, "chats", chatId, "messages");
      const snapshot = await getDocs(msgsRef);
      const docs = snapshot.docs;
      const batchSize = 400;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      alert("Chat cleared.");
      setMenuOpen(false);
    } catch (err) {
      console.error("clear chat", err);
      alert("Failed to clear chat");
    }
  };

  // ---------- reactions toggle (add / remove your reaction) ----------
  const toggleReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const cur = snap.data();
      const curReactions = cur.reactions || {};
      if (curReactions[myUid] === emoji) {
        await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
      setSelectedMessageId(null);
    } catch (err) {
      console.error("reaction error", err);
    }
  };

  // ---------- long press select & swipe-to-reply ----------
  const longPressTimeout = useRef(null);
  const startLongPress = (id) => {
    longPressTimeout.current = setTimeout(() => setSelectedMessageId(id), 450);
  };
  const cancelLongPress = () => clearTimeout(longPressTimeout.current);

  const swipeStart = useRef({ x: 0, y: 0 });
  const onPointerDown = (e) =>
    (swipeStart.current = { x: e.clientX || (e.touches && e.touches[0].clientX), y: e.clientY || (e.touches && e.touches[0].clientY) });
  const onPointerUpForReply = (e, m) => {
    const endX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
    const dx = endX - swipeStart.current.x;
    if (dx > 110) {
      setReplyTo(m);
      setSelectedMessageId(null);
      setTimeout(() => {
        const el = document.querySelector('input[type="text"]');
        if (el) el.focus();
      }, 50);
    }
  };

  // ---------- merge & group messages by day ----------
  const merged = [...messages];
  const grouped = [];
  let lastDay = null;
  merged.forEach((m) => {
    const label = (() => {
      if (!m.createdAt) return "";
      const d = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      const now = new Date();
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === now.toDateString()) return "Today";
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    })();
    if (label !== lastDay) {
      grouped.push({ type: "day", label, id: `day-${label}-${Math.random().toString(36).slice(2, 6)}` });
      lastDay = label;
    }
    grouped.push(m);
  });

  // ---------- small spinner component ----------
  function Spinner({ percent = 0 }) {
    return (
      <div className="w-11 h-11 flex items-center justify-center relative">
        <svg viewBox="0 0 36 36" className="w-9 h-9">
          <path d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831" fill="none" stroke="#eee" strokeWidth="2" />
          <path
            d="M18 2.0845a15.9155 15.9155 0 1 0 0 31.831"
            fill="none"
            stroke="#34B7F1"
            strokeWidth="2"
            strokeDasharray={`${percent},100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute text-[10px] font-semibold text-white">{Math.min(100, Math.round(percent))}%</div>
      </div>
    );
  }

  // ---------- attach outside click to close ----------
  useEffect(() => {
    const handler = (e) => {
      if (attachOpen && attachRef.current && !attachRef.current.contains(e.target)) {
        setAttachOpen(false);
      }
    };
    if (attachOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [attachOpen]);

  // ---------- Message bubble ----------
  const MessageBubble = ({ m }) => {
    const mine = m.sender === myUid;
    const replySnippet = m.replyTo ? (m.replyTo.text || (m.replyTo.fileName || "media")) : null;
    const displayUrl = getDisplayUrlForMessage(m);
    const downloadInfo = downloadMap[m.id];

    const bubbleBg = mine ? (isDark ? "bg-blue-600" : "bg-blue-500") : isDark ? "bg-gray-800" : "bg-gray-100";
    const bubbleText = mine ? "text-white" : isDark ? "text-gray-200" : "text-gray-900";

    return (
      <div className={`w-full flex ${mine ? "justify-end" : "justify-start"} mb-3 px-1`}>
        <div
          className={`rounded-lg max-w-[78%] break-words relative p-3 ${bubbleBg} ${bubbleText}`}
          onMouseDown={() => startLongPress(m.id)}
          onMouseUp={() => cancelLongPress()}
          onTouchStart={() => startLongPress(m.id)}
          onTouchEnd={() => cancelLongPress()}
          onPointerDown={(e) => onPointerDown(e)}
          onPointerUp={(e) => onPointerUpForReply(e, m)}
        >
          {replySnippet && (
            <div className={`mb-2 p-2 rounded-md ${isDark ? "bg-gray-900 text-gray-300" : "bg-white text-gray-600"} text-sm`}>
              <span className="block truncate max-w-[220px]">{replySnippet}</span>
            </div>
          )}

          {m.type === "text" && <div className="whitespace-pre-wrap">{m.text}</div>}

          {["image", "file", "audio"].includes(m.type) && (
            <div className="relative flex items-center gap-3">
              {m.type === "image" ? (
                <img
                  src={displayUrl || m.fileURL || ""}
                  alt={m.fileName || "image"}
                  onClick={() =>
                    setPreviewModal({
                      type: "image",
                      url: displayUrl || m.fileURL,
                      name: m.fileName,
                    })
                  }
                  className={`w-[220px] h-auto rounded-md block ${((downloadInfo && downloadInfo.status === "downloading") || m.status === "uploading") ? "filter blur-sm" : ""}`}
                />
              ) : m.type === "audio" ? (
                <div className="flex items-center gap-3 p-2 rounded-md bg-white/5 text-sm">
                  <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center">🎵</div>
                  <div className="max-w-[180px]">
                    <div className={`font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>{m.fileName || "audio"}</div>
                    <button
                      onClick={() =>
                        setPreviewModal({
                          type: "audio",
                          url: displayUrl || m.fileURL,
                          name: m.fileName,
                        })
                      }
                      className="mt-1 text-xs underline"
                    >
                      Play
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-2 rounded-md bg-white/5">
                  <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center">📎</div>
                  <div className="max-w-[180px]">
                    <div className={`font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}>{m.fileName || "file"}</div>
                    <div className="text-xs text-gray-500">{m.type}</div>
                    {displayUrl && (
                      <a href={displayUrl} download={m.fileName} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline">
                        Download
                      </a>
                    )}
                  </div>
                </div>
              )}

              {(m.status === "uploading" || (downloadInfo && (downloadInfo.status === "downloading" || downloadInfo.status === "queued"))) && (
                <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                  <Spinner
                    percent={
                      m.status === "uploading"
                        ? (() => {
                            const u = localUploads.find((x) => x.id === m.id);
                            return u ? u.progress : 0;
                          })()
                        : downloadInfo
                        ? downloadInfo.progress
                        : 0
                    }
                  />
                </div>
              )}

              {downloadInfo && downloadInfo.status === "failed" && (
                <div className="ml-3">
                  <button
                    onClick={() => setDownloadMap((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), status: "queued", progress: 0 } }))}
                    className="px-3 py-1 rounded-md bg-yellow-400 text-black"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="text-[11px] text-right mt-2 opacity-90">
            <span>{fmtTime(m.createdAt)}</span>
            {mine && <span className="ml-2">{m.status === "uploading" ? "⌛" : m.status === "sent" ? "✓" : m.status === "delivered" ? "✓✓" : m.status === "seen" ? "✓✓" : ""}</span>}
          </div>

          {m.reactions && Object.keys(m.reactions).length > 0 && (
            <div className={`absolute -bottom-5 right-2 px-2 py-1 rounded-full text-sm shadow ${isDark ? "bg-gray-900" : "bg-white"}`}>
              {Object.values(m.reactions).slice(0, 3).join(" ")}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : undefined }}>
      {/* header */}
      <div className={`flex items-center p-3 border-b ${isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"} sticky top-0 z-40`}>
        <button
          onClick={() => navigate("/chat")}
          aria-label="Back"
          className="mr-3 p-1 rounded-md hover:bg-gray-200/50"
        >
          {/* Back arrow; ensure legible in dark mode */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke={isDark ? "#fff" : "#111"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <img
          src={friendInfo?.photoURL || "/default-avatar.png"}
          alt="avatar"
          onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}
          className="w-11 h-11 rounded-full object-cover mr-3 cursor-pointer"
        />

        <div>
          <div className="font-semibold">{friendInfo?.displayName || chatInfo?.name || "Friend"}</div>
          <div className={`text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>{friendTyping ? "typing..." : fmtLastSeen(friendInfo?.isOnline ? "Online" : friendInfo?.lastSeen)}</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate(`/voice-call/${chatId}`)} className="p-2 rounded hover:bg-gray-200/50">📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} className="p-2 rounded hover:bg-gray-200/50">🎥</button>

          <div className="relative">
            <button onClick={() => setMenuOpen((s) => !s)} className="p-2 rounded hover:bg-gray-200/50">⋮</button>
            {menuOpen && (
              <div className={`absolute right-0 top-10 w-56 rounded-md shadow-lg ${isDark ? "bg-gray-800" : "bg-white"} border ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">View Profile</button>
                <button onClick={() => { clearChat(); setMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">Clear Chat</button>
                <button onClick={toggleBlock} className="w-full text-left px-4 py-2 hover:bg-gray-100">{blocked ? "Unblock" : "Block"}</button>
                <button onClick={() => { setReportOpen(true); setMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-100">Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* messages list */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-3 py-4" style={{ scrollbarGutter: "stable" }}>
        {grouped.map((g) =>
          g.type === "day" ? (
            <div key={g.id} className="text-center my-3 text-sm text-gray-400">
              {g.label}
            </div>
          ) : (
            <MessageBubble key={g.id} m={g} />
          )
        )}

        {localUploads.map((u) => (
          <div key={u.id} className="flex justify-end mb-3 px-1">
            <div className="bg-blue-500 text-white p-3 rounded-lg max-w-[78%] relative">
              {u.type === "image" ? <img src={u.previewUrl} alt={u.fileName} className="w-[220px] rounded-md blur-sm" /> : <div className="flex items-center gap-3"><div>📎</div><div>{u.fileName}</div></div>}
              <div className="mt-2 text-xs text-right"><span>⌛</span> <span className="ml-2">{u.progress}%</span></div>
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                <Spinner percent={u.progress} />
              </div>
            </div>
          </div>
        ))}

        <div ref={endRef} />
      </div>

      {/* scroll-to-bottom */}
      <button
        onClick={() => scrollToBottom(true)}
        className={`fixed left-1/2 transform -translate-x-1/2 bottom-28 z-50 w-12 h-12 rounded-full flex items-center justify-center text-white ${isAtBottom ? "opacity-0 pointer-events-none" : "opacity-100"} transition-opacity`}
        style={{ background: "#007bff" }}
        title="Scroll to latest"
        aria-hidden={isAtBottom}
      >
        ↓
      </button>

      {/* previews (above input) */}
      {previews.length > 0 && (
        <div className={`flex gap-3 p-2 overflow-x-auto items-center border-t ${isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
          {previews.map((p, idx) => (
            <div key={idx} className="relative">
              {p ? <img src={p} alt="preview" className="w-20 h-20 object-cover rounded-md" /> : <div className="w-20 h-20 flex items-center justify-center rounded-md bg-gray-100">{selectedFiles[idx]?.name}</div>}
              <button
                onClick={() => {
                  setSelectedFiles((s) => s.filter((_, i) => i !== idx));
                  setPreviews((s) => s.filter((_, i) => i !== idx));
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="ml-auto flex gap-2">
            <button onClick={sendQueuedFiles} className="px-3 py-1 rounded bg-sky-500 text-white">Send</button>
            <button onClick={() => { setSelectedFiles([]); setPreviews([]); }} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* pinned input */}
      <div className={`sticky bottom-0 z-40 p-3 border-t ${isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
        <div className="flex items-center gap-3">
          <div ref={attachRef} className="relative">
            <button
              onClick={() => setAttachOpen((s) => !s)}
              className="w-11 h-11 rounded-lg flex items-center justify-center text-2xl bg-gray-100 hover:bg-gray-200"
            >
              ＋
            </button>
          </div>

          <div className="flex-1 flex flex-col">
            {replyTo && (
              <div className={`p-2 rounded-md mb-2 ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
                <small className="text-xs text-gray-400">{replyTo.sender === myUid ? "You" : ""}</small>
                <div className="truncate">{replyTo.text || replyTo.fileName || "media"}</div>
                <button onClick={() => setReplyTo(null)} className="text-xs text-gray-500 mt-1">Cancel</button>
              </div>
            )}

            <input
              type="text"
              placeholder={blocked ? "You blocked this user — unblock to send" : "Type a message..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }}
              disabled={blocked}
              className={`rounded-full px-4 py-2 border focus:outline-none ${isDark ? "bg-gray-800 text-white border-gray-700" : "bg-white text-black border-gray-200"}`}
            />
          </div>

          <button
            onClick={handleSendText}
            disabled={blocked || (!text.trim() && localUploads.length === 0 && selectedFiles.length === 0)}
            className="rounded-md px-4 py-2 bg-sky-400 text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {/* attachment bottom sheet */}
      {attachOpen && (
        <>
          <div onClick={() => setAttachOpen(false)} className="fixed inset-0 bg-black/30 z-40" />
          <div className={`fixed left-0 right-0 bottom-0 z-50 rounded-t-xl p-4 ${isDark ? "bg-gray-900" : "bg-white"} shadow-lg transform transition-transform`}>
            <div className="flex justify-around items-center gap-6">
              <div className="flex flex-col items-center cursor-pointer" onClick={() => { imageInputRef.current?.click(); setAttachOpen(false); }}>
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${isDark ? "bg-gray-800" : "bg-gray-100"} text-3xl`}>📷</div>
                <div className="text-xs mt-2">Camera</div>
              </div>

              <div className="flex flex-col items-center cursor-pointer" onClick={() => { imageInputRef.current?.click(); setAttachOpen(false); }}>
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${isDark ? "bg-gray-800" : "bg-gray-100"} text-3xl`}>🖼️</div>
                <div className="text-xs mt-2">Photos</div>
              </div>

              <div className="flex flex-col items-center cursor-pointer" onClick={() => { fileInputRef.current?.click(); setAttachOpen(false); }}>
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${isDark ? "bg-gray-800" : "bg-gray-100"} text-3xl`}>📁</div>
                <div className="text-xs mt-2">File</div>
              </div>
            </div>

            <div className="mt-3 text-center text-xs text-gray-400">Tap to attach</div>

            {/* hidden inputs */}
            <input ref={imageInputRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={(e) => onFilesSelected(e)} />
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => onFilesSelected(e)} />
          </div>
        </>
      )}

      {/* report modal */}
      {reportOpen && (
        <div className="fixed right-4 top-20 z-60 w-80">
          <div className={`p-4 rounded-md ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
            <h4 className="mb-2 font-semibold">Report user</h4>
            <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe the issue..." className="w-full min-h-[80px] rounded p-2 mb-3" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReportOpen(false)} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
              <button onClick={submitReport} className="px-3 py-1 rounded bg-red-500 text-white">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* header action when message selected */}
      {selectedMessageId && (
        <div className={`fixed top-0 left-0 right-0 flex justify-center py-2 ${isDark ? "bg-black/50" : "bg-white/90"} z-60`}>
          <div className={`p-2 rounded-md flex items-center gap-3 ${isDark ? "bg-gray-800" : "bg-white"} shadow`}>
            <button onClick={() => deleteMessage(selectedMessageId)}>🗑 Delete</button>
            <button onClick={() => { const m = messages.find((x) => x.id === selectedMessageId); setReplyTo(m || null); setSelectedMessageId(null); }}>↩ Reply</button>
            <div className="flex gap-2">
              {EMOJIS.slice(0, 4).map((e) => <button key={e} onClick={() => toggleReaction(selectedMessageId, e)}>{e}</button>)}
            </div>
            <button onClick={() => setSelectedMessageId(null)}>✖</button>
          </div>
        </div>
      )}

      {/* preview modal (image / audio / file) */}
      {previewModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80">
          <div className="max-w-[90vw] max-h-[90vh] bg-transparent relative">
            <button onClick={() => setPreviewModal(null)} className="absolute top-2 right-2 z-80 text-white text-xl">✕</button>

            {previewModal.type === "image" && <img src={previewModal.url} alt={previewModal.name} className="max-w-[90vw] max-h-[90vh] object-contain" />}
            {previewModal.type === "audio" && (
              <div className="p-4 bg-white rounded">
                <div className="font-semibold mb-2">{previewModal.name}</div>
                <audio controls src={previewModal.url} className="w-[80vw]" />
              </div>
            )}
            {previewModal.type === "file" && (
              <div className="p-4 bg-white rounded">
                <div className="font-semibold mb-2">{previewModal.name}</div>
                <a href={previewModal.url} download={previewModal.name} className="underline">Download</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}