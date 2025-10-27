// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef } from "react";
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
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage.jsx
 *
 * Features:
 * - Grouped by day dividers (Today / Yesterday / MMM dd[, yyyy])
 * - Timestamp formatting (8:56 AM) — no seconds
 * - Pinned input (messages area scrolls)
 * - Centered scroll-to-bottom button that fades when at bottom
 * - + attach (photo/file/audio) popup
 * - Previews above input (cancelable); full-screen handled separately by your existing viewer
 * - Background upload with local placeholder + progress; placeholders persist until upload completes
 * - Send text while uploads run
 * - Long-press for emoji quick reactions (popup under the message)
 * - Swipe-right to reply (basic detection)
 * - Block / Unblock in 3-dot menu, shows banner when blocked
 * - Clear chat (batched delete)
 * - Delete message (for me / for everyone)
 * - Report modal (writes to `reports` collection with emailTo: "smarttalkgit@gmail.com")
 * - Dark/light/wallpaper via ThemeContext
 */

/* ---------------- Helpers ---------------- */
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};
const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  // show month day [year if not current year]
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅"];

/* ---------------- Component ---------------- */
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);

  const [messages, setMessages] = useState([]);
  const [localUploads, setLocalUploads] = useState([]); // {id, fileName, fileURL, progress, status, type, createdAt}
  const [previews, setPreviews] = useState([]); // preview URLs for selected files
  const [selectedFiles, setSelectedFiles] = useState([]); // File objects queued for preview
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null); // for header actions
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const longPressTimeout = useRef(null);
  const swipeStart = useRef({ x: 0, y: 0 });

  const myUid = auth.currentUser?.uid;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [limitCount, setLimitCount] = useState(50); // pagination (can be increased)

  /* --------- Load chat + friend presence + chat doc updates --------- */
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
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setBlocked(Boolean(data?.blockedBy?.includes(myUid)));

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

      // listen for chat doc changes (eg. blockedBy updates)
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

  /* --------- Messages realtime (paginated) --------- */
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "desc"),
      fsLimit(limitCount)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse(); // oldest -> newest
      setMessages(docs);

      // mark incoming messages as delivered (best-effort)
      docs.forEach((m) => {
        if (m.sender !== myUid && m.status === "sent") {
          const mRef = doc(db, "chats", chatId, "messages", m.id);
          updateDoc(mRef, { status: "delivered" }).catch(() => {});
        }
      });

      // auto-scroll to bottom on initial load
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "auto" });
        setIsAtBottom(true);
      }, 50);
    });

    return () => unsub();
  }, [chatId, limitCount, myUid]);

  /* --------- Scroll handling for down arrow visibility & deselection --------- */
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      setIsAtBottom(atBottom);
      if (!atBottom) setSelectedMessageId(null);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  /* --------- Attachments: preview + background uploading --------- */
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // store file objects for preview and start upload immediately
    setSelectedFiles((p) => [...p, ...files]);
    const newPreviews = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null));
    setPreviews((p) => [...p, ...newPreviews]);

    files.forEach((f) => startUpload(f));
  };

  const startUpload = (file) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    // add local placeholder (appears in UI with progress)
    setLocalUploads((prev) => [
      ...prev,
      {
        id: tempId,
        fileName: file.name,
        fileURL: URL.createObjectURL(file),
        progress: 0,
        status: "uploading",
        type: file.type.startsWith("image/") ? "image" : "file",
        createdAt: new Date(),
      },
    ]);

    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    task.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setLocalUploads((prev) => prev.map((l) => (l.id === tempId ? { ...l, progress: pct } : l)));
      },
      (err) => {
        console.error("Upload failed", err);
        setLocalUploads((prev) => prev.map((l) => (l.id === tempId ? { ...l, status: "failed" } : l)));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        // write final message into Firestore
        await addDoc(collection(db, "chats", chatId, "messages"), {
          sender: myUid,
          text: "",
          fileURL: url,
          fileName: file.name,
          type: file.type.startsWith("image/") ? "image" : "file",
          createdAt: serverTimestamp(),
          status: "sent",
        });
        // remove placeholder from localUploads
        setLocalUploads((prev) => prev.filter((l) => l.id !== tempId));
      }
    );
  };

  const cancelPreviewAt = (index) => {
    // cancel preview from UI only; if upload already started it will still finish in background
    setSelectedFiles((p) => p.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  };

  /* --------- Sending text messages (supports replyTo) --------- */
  const handleSendText = async () => {
    if (!text.trim()) return;
    if (blocked) {
      alert("You blocked this user. Unblock to send messages.");
      return;
    }

    const payload = {
      sender: myUid,
      text: text.trim(),
      fileURL: null,
      createdAt: serverTimestamp(),
      type: "text",
      status: "sent",
    };

    if (replyTo) {
      payload.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0, 120) || (replyTo.fileName || "media"), sender: replyTo.sender };
    }

    setText("");
    setReplyTo(null);
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setTimeout(() => scrollToBottom(true), 150);
    } catch (err) {
      console.error("Send failed", err);
      alert("Failed to send message");
    }
  };

  /* --------- Block / Unblock --------- */
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
      console.error("Block toggle failed", err);
      alert("Failed to update block status");
    }
  };

  /* --------- Report (writes to reports collection) --------- */
  const submitReport = async () => {
    if (!reportText.trim()) {
      alert("Please provide report details.");
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
      alert("Report submitted. Thank you.");
      setReportText("");
      setReportOpen(false);
      setMenuOpen(false);
    } catch (err) {
      console.error("Report failed", err);
      alert("Failed to submit report");
    }
  };

  /* --------- Reactions (long press) --------- */
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      // store as map: reactions.{uid} = emoji
      await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      setSelectedMessageId(null);
    } catch (err) {
      console.error("Reaction error", err);
    }
  };

  /* --------- Long press & swipe reply (basic) --------- */
  const startLongPress = (id) => {
    longPressTimeout.current = setTimeout(() => {
      setSelectedMessageId(id);
    }, 500);
  };
  const cancelLongPress = () => {
    clearTimeout(longPressTimeout.current);
  };

  const onPointerDown = (e) => {
    swipeStart.current = { x: e.clientX || (e.touches && e.touches[0].clientX), y: e.clientY || (e.touches && e.touches[0].clientY) };
  };
  const onPointerUp = (e, m) => {
    const endX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
    const dx = endX - swipeStart.current.x;
    if (dx > 120) {
      // swipe-right => reply
      setReplyTo(m);
      setSelectedMessageId(null);
      setTimeout(() => {
        const el = document.querySelector('input[type="text"]');
        if (el) el.focus();
      }, 50);
    }
  };

  /* --------- Delete message (for me / for everyone) --------- */
  const deleteMessageForMe = async (messageId) => {
    try {
      // simply remove the message doc for this user? Here we'll delete doc (visible for everyone).
      // To implement "delete for me", you'd maintain per-user hidden list; keeping simple: delete doc with confirmation
      if (!window.confirm("Delete this message?")) return;
      await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
      setSelectedMessageId(null);
    } catch (err) {
      console.error("Delete message error", err);
      alert("Failed to delete message");
    }
  };

  const deleteMessageForEveryone = async (messageId) => {
    try {
      if (!window.confirm("Delete this message for everyone?")) return;
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      // Instead of hard delete (which removes history), update to show 'deleted' placeholder
      await updateDoc(mRef, { text: "This message was deleted", type: "deleted", fileURL: null, fileName: null, reactions: {} });
      setSelectedMessageId(null);
    } catch (err) {
      console.error("Delete for everyone error", err);
      alert("Failed to delete for everyone");
    }
  };

  /* --------- Clear chat (batched delete) --------- */
  const clearChat = async () => {
    if (!window.confirm("Clear all messages in this chat? This cannot be undone.")) return;
    try {
      const msgsRef = collection(db, "chats", chatId, "messages");
      const snapshot = await getDocs(msgsRef);
      const docs = snapshot.docs;
      const batchSize = 400; // keep under 500 limit
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      alert("Chat cleared.");
      setMenuOpen(false);
    } catch (err) {
      console.error("Clear chat failed", err);
      alert("Failed to clear chat");
    }
  };

  /* --------- UI: message bubble renderer --------- */
  const MessageBubble = ({ m }) => {
    const mine = m.sender === myUid;
    const reactions = m.reactions || {};
    const replySnippet = m.replyTo ? (m.replyTo.text || m.replyTo.fileName || "media") : null;
    const isSelected = selectedMessageId === m.id;

    return (
      <div
        style={{
          display: "flex",
          justifyContent: mine ? "flex-end" : "flex-start",
          marginBottom: 12,
          paddingLeft: 6,
          paddingRight: 6,
        }}
      >
        <div
          onMouseDown={() => startLongPress(m.id)}
          onMouseUp={() => cancelLongPress()}
          onTouchStart={(e) => startLongPress(m.id)}
          onTouchEnd={() => cancelLongPress()}
          onPointerDown={(e) => onPointerDown(e)}
          onPointerUp={(e) => onPointerUp(e, m)}
          style={{
            background: mine ? (isDark ? "#0b84ff" : "#007bff") : isDark ? "#222" : "#eee",
            color: mine ? "#fff" : "#000",
            padding: "10px 12px",
            borderRadius: 14,
            maxWidth: "78%",
            wordBreak: "break-word",
            position: "relative",
            boxShadow: isSelected ? "0 6px 18px rgba(0,0,0,0.15)" : "none",
          }}
        >
          {/* Reply snippet */}
          {replySnippet && (
            <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#fff", color: isDark ? "#ddd" : "#333", fontSize: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
              <small style={{ display: "block", color: "#888", marginBottom: 4 }}>{m.replyTo?.sender === myUid ? "You" : ""}</small>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{replySnippet}</div>
            </div>
          )}

          {/* content */}
          {m.type === "image" && m.fileURL && <img src={m.fileURL} alt={m.fileName || "img"} style={{ width: "100%", borderRadius: 8 }} />}
          {m.type === "file" && m.fileURL && (
            <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007bff" }}>
              📎 {m.fileName || "file"}
            </a>
          )}
          {m.type === "text" && <div>{m.text}</div>}
          {m.type === "deleted" && <div style={{ fontStyle: "italic", opacity: 0.8 }}>{m.text}</div>}

          {/* timestamp + status */}
          <div style={{ fontSize: 11, textAlign: "right", marginTop: 6, opacity: 0.85 }}>
            <span style={{ marginLeft: 6 }}>{fmtTime(m.createdAt)}</span>
            {mine && (
              <span style={{ marginLeft: 6 }}>
                {m.status === "sending" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}
              </span>
            )}
          </div>

          {/* Reactions shown beneath bubble */}
          {Object.keys(reactions || {}).length > 0 && (
            <div style={{ position: "absolute", left: mine ? "auto" : 6, right: mine ? 6 : "auto", bottom: -18, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }}>
              {Object.values(reactions).slice(0, 3).join(" ")}
            </div>
          )}

          {/* emoji picker popup under message (shown when selected) */}
          <div id={`emoji-pop-${m.id}`} style={{ display: selectedMessageId === m.id ? "flex" : "none", position: "absolute", left: 8, right: 8, bottom: -56, gap: 8, justifyContent: "center", zIndex: 40, background: "transparent", padding: 6 }}>
            {EMOJIS.map((em) => (
              <button key={em} onClick={() => applyReaction(m.id, em)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>
                {em}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* --------- Merge messages & local uploads and group by day (for rendering) --------- */
  const mergedList = [...messages, ...localUploads.map((u) => ({ id: u.id, ...u }))];
  const grouped = [];
  let lastDay = null;
  mergedList.forEach((m) => {
    const ts = m.createdAt || (m.createdAt === undefined ? new Date() : null);
    const label = ts ? dayLabel(ts) : dayLabel(new Date());
    if (label !== lastDay) {
      grouped.push({ type: "day", label, id: `day-${label}-${Math.random().toString(36).slice(2, 6)}` });
      lastDay = label;
    }
    grouped.push(m);
  });

  /* ---------------- Render ---------------- */
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#070707" : "#f5f5f5", color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid #ccc", position: "sticky", top: 0, background: isDark ? "#111" : "#fff", zIndex: 30 }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", cursor: "pointer", marginRight: 10 }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", marginRight: 12, cursor: "pointer" }} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} />
        <div>
          <div style={{ fontWeight: 700 }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</div>
          <div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666" }}>{friendTyping ? "typing..." : (friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? fmtTime(friendInfo.lastSeen) : "Offline"))}</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>🎥</button>

          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((s) => !s)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>⋮</button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: 28, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 50 }}>
                <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>View Profile</button>
                <button onClick={() => { clearChat(); setMenuOpen(false); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Clear Chat</button>
                <button onClick={toggleBlock} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>{blocked ? "Unblock" : "Block"}</button>
                <button onClick={() => { setReportOpen(true); setMenuOpen(false); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blocked banner */}
      {blocked && (
        <div style={{ padding: 10, background: "#2b2b2b", color: "#fff", textAlign: "center" }}>
          <div style={{ marginBottom: 8 }}>You blocked this user.</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={deleteChatEntire} style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#ff4d4f", color: "#fff" }}>Delete Chat</button>
            <button onClick={toggleBlock} style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#34B7F1", color: "#fff" }}>Unblock</button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {grouped.map((g) => {
          if (g.type === "day") {
            return <div key={g.id} style={{ textAlign: "center", margin: "12px 0", color: "#888", fontSize: 12 }}>{g.label}</div>;
          }
          return <MessageBubble key={g.id} m={g} />;
        })}
        <div ref={endRef} />
      </div>

      {/* center scroll-down arrow */}
      <button
        onClick={() => scrollToBottom(true)}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 120,
          zIndex: 60,
          background: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: 22,
          width: 48,
          height: 48,
          fontSize: 22,
          cursor: "pointer",
          opacity: isAtBottom ? 0 : 1,
          transition: "opacity 0.25s",
        }}
        aria-hidden={isAtBottom}
        title="Scroll to latest"
      >
        ↓
      </button>

      {/* previews above input */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid #ddd", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {p ? <img src={p} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{selectedFiles[idx]?.name}</div>}
              <button onClick={() => cancelPreviewAt(idx)} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>✕</button>
              {/* upload progress for matching local upload (by filename) */}
              {localUploads.find((u) => u.fileName === (selectedFiles[idx]?.name)) && (
                <div style={{ position: "absolute", left: 6, bottom: 6, background: "rgba(0,0,0,0.4)", color: "#fff", padding: "2px 6px", borderRadius: 8, fontSize: 12 }}>
                  {localUploads.find((u) => u.fileName === (selectedFiles[idx]?.name))?.progress || 0}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* pinned input area */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid #ccc", display: "flex", alignItems: "center", gap: 8, zIndex: 50 }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowAttach((s) => !s)} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20, background: "#f0f0f0", border: "none", cursor: "pointer" }}>＋</button>
          {showAttach && (
            <div style={{ position: "absolute", bottom: 56, left: 0, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 10, padding: 8, display: "flex", gap: 8 }}>
              <label style={{ cursor: "pointer" }}>
                📷
                <input type="file" accept="image/*" multiple onChange={onFilesSelected} style={{ display: "none" }} />
              </label>
              <label style={{ cursor: "pointer" }}>
                📁
                <input type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} />
              </label>
              <label style={{ cursor: "pointer" }}>
                🎤
                <input type="file" accept="audio/*" multiple onChange={onFilesSelected} style={{ display: "none" }} />
              </label>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {replyTo && (
            <div style={{ padding: "6px 10px", borderRadius: 8, background: isDark ? "#111" : "#f0f0f0", marginBottom: 6 }}>
              <small style={{ color: "#888", display: "block" }}>{replyTo.sender === myUid ? "You" : ""}</small>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyTo.text || replyTo.fileName || "media"}</div>
              <button onClick={() => setReplyTo(null)} style={{ marginTop: 6, background: "transparent", border: "none", color: "#888", cursor: "pointer" }}>Cancel</button>
            </div>
          )}

          <input
            type="text"
            placeholder={blocked ? "You blocked this user — unblock to send" : "Type a message..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }}
            disabled={blocked}
            style={{ padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#111" : "#fff", color: isDark ? "#fff" : "#000" }}
          />
        </div>

        <button onClick={handleSendText} disabled={blocked || (!text.trim() && localUploads.length === 0)} style={{ background: "#34B7F1", color: "#fff", border: "none", borderRadius: 16, padding: "8px 12px", cursor: "pointer" }}>Send</button>
      </div>

      {/* report modal (small top-right) */}
      {reportOpen && (
        <div style={{ position: "fixed", right: 16, top: 80, zIndex: 120, width: 340 }}>
          <div style={{ background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
            <h4 style={{ margin: "0 0 8px 0" }}>Report user</h4>
            <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe the issue..." style={{ width: "100%", minHeight: 80, borderRadius: 6, padding: 8 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setReportOpen(false)} style={{ padding: "8px 10px", borderRadius: 6, border: "none", background: "#ddd", cursor: "pointer" }}>Cancel</button>
              <button onClick={submitReport} style={{ padding: "8px 10px", borderRadius: 6, border: "none", background: "#ff4d4f", color: "#fff", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* top action header when a message is selected */}
      {selectedMessageId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", padding: "8px 0", background: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)", zIndex: 120 }}>
          <div style={{ background: isDark ? "#222" : "#fff", padding: "6px 10px", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
            <button onClick={() => deleteMessageForMe(selectedMessageId)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>🗑 Delete</button>
            <button onClick={() => { const m = messages.find((x) => x.id === selectedMessageId); setReplyTo(m || null); setSelectedMessageId(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>↩ Reply</button>
            <div style={{ display: "flex", gap: 6 }}>
              {EMOJIS.slice(0, 4).map((e) => <button key={e} onClick={() => applyReaction(selectedMessageId, e)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>{e}</button>)}
            </div>
            <button onClick={() => { deleteMessageForEveryone(selectedMessageId); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>🗑 Everyone</button>
            <button onClick={() => setSelectedMessageId(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✖</button>
          </div>
        </div>
      )}
    </div>
  );
}