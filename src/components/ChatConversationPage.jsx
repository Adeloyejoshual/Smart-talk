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
  writeBatch,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/* ----------------------------- helpers ----------------------------- */
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
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅"];

/* --------------------------- component ----------------------------- */
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);

  const [messages, setMessages] = useState([]);
  const [limitCount, setLimitCount] = useState(50);

  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // queued previews
  const [previews, setPreviews] = useState([]);
  const [localUploads, setLocalUploads] = useState([]); // placeholders with progress

  const [showAttach, setShowAttach] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  // for swipe-to-reply
  const touchStartX = useRef(null);
  const [replyTo, setReplyTo] = useState(null); // message object being replied to

  // for full image preview modal
  const [modalImage, setModalImage] = useState(null);

  // scroll tracking
  const [isAtBottom, setIsAtBottom] = useState(true);

  /* -------------------- load chat & friend -------------------- */
  useEffect(() => {
    if (!chatId) return;
    const cRef = doc(db, "chats", chatId);
    let unsubChat = null, unsubFriend = null;

    (async () => {
      const snap = await getDoc(cRef);
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
        const fRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(fRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriendInfo({ id: fsnap.id, ...fsnap.data() });
            // example typing indicator field shape: typing: { [chatId]: true }
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
          }
        });
      }

      unsubChat = onSnapshot(cRef, (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setChatInfo((prev) => ({ ...(prev || {}), ...d }));
          setBlocked(Boolean(d?.blockedBy?.includes(myUid)));
        }
      });
    })();

    return () => {
      unsubChat && unsubChat();
      unsubFriend && unsubFriend();
    };
  }, [chatId, myUid, navigate]);

  /* -------------------- messages realtime (paginated) -------------------- */
  useEffect(() => {
    if (!chatId) return;
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "desc"), fsLimit(limitCount));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      setMessages(docs);
      // mark incoming messages delivered
      docs.forEach(m => {
        if (m.sender !== myUid && m.status === "sent") {
          const mRef = doc(db, "chats", chatId, "messages", m.id);
          updateDoc(mRef, { status: "delivered" }).catch(() => {});
        }
      });
      // scroll to bottom on first load
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "auto" });
        setIsAtBottom(true);
      }, 50);
    });
    return () => unsub();
  }, [chatId, limitCount, myUid]);

  /* -------------------- scroll handling -------------------- */
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setIsAtBottom(atBottom);
      // if user scrolls near top, increase limit to load older messages
      if (el.scrollTop < 40) {
        setLimitCount((p) => Math.min(p + 30, 1000));
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  /* -------------------- attachments & uploads -------------------- */
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setPreviews((prev) => [...prev, ...newPreviews]);
    files.forEach(startUpload);
  };

  const startUpload = (file) => {
    const tmpId = `local-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    setLocalUploads(prev => [...prev, {
      id: tmpId,
      fileName: file.name,
      progress: 0,
      fileURL: URL.createObjectURL(file),
      type: file.type.startsWith("image/") ? "image" : "file",
      status: "uploading",
    }]);

    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    task.on("state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setLocalUploads(prev => prev.map(p => p.id === tmpId ? { ...p, progress: pct } : p));
      },
      (err) => {
        console.error("Upload failed", err);
        setLocalUploads(prev => prev.map(p => p.id === tmpId ? { ...p, status: "failed" } : p));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        // write message
        await addDoc(collection(db, "chats", chatId, "messages"), {
          sender: myUid,
          text: "",
          fileURL: url,
          fileName: file.name,
          type: file.type.startsWith("image/") ? "image" : "file",
          createdAt: serverTimestamp(),
          status: "sent",
        });
        // remove placeholder
        setLocalUploads(prev => prev.filter(p => p.id !== tmpId));
      }
    );
  };

  const cancelPreviewAt = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    // note: upload already started — we don't cancel active upload here
  };

  /* -------------------- send text -------------------- */
  const handleSendText = async () => {
    if (!text.trim()) return;
    if (blocked) {
      alert("You cannot send messages — this chat is blocked.");
      return;
    }
    const replyMeta = replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text || replyTo.fileName || "Attachment", sender: replyTo.sender } } : null;
    const msg = text.trim();
    setText("");
    setReplyTo(null);
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: myUid,
        text: msg,
        fileURL: null,
        createdAt: serverTimestamp(),
        type: "text",
        status: "sent",
        ...(replyMeta ? { replyTo: replyMeta } : {}),
      });
      setTimeout(() => scrollToBottom(true), 120);
    } catch (err) {
      console.error("Send failed", err);
      alert("Failed to send message");
    }
  };

  /* -------------------- reactions -------------------- */
  const toggleReaction = async (messageId, emoji, current) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      if (current === emoji) {
        // remove
        await updateDoc(mRef, { [`reactions.${myUid}`]: null }); // set to null doesn't delete field; better to use update with delete via server SDK — but client-side we can set to null
        // To actually remove property we'd need server-side or patch; leaving as practical approach
        await updateDoc(mRef, { [`reactions.${myUid}`]: "" });
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
    } catch (err) {
      console.error("Reaction error", err);
    }
  };

  /* -------------------- delete & clear chat -------------------- */
  // delete single message (either set to removed or remove)
  const deleteMessageForMe = async (messageId) => {
    try {
      // remove doc locally (only visible to current user) — easiest approach: set flag 'deletedFor' array
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(mRef, { deletedFor: arrayUnion(myUid) });
    } catch (err) {
      console.error("Delete for me failed", err);
      alert("Failed to delete message for you");
    }
  };
  const deleteMessageForEveryone = async (messageId) => {
    try {
      // Prefer updating message to "Message removed" rather than deleting doc to keep ordering stable
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(mRef, { text: "This message was deleted", fileURL: null, fileName: null, type: "deleted", removedAt: serverTimestamp(), reactions: {} });
    } catch (err) {
      console.error("Delete for everyone failed", err);
      alert("Failed to delete for everyone");
    }
  };

  // clear chat: batch delete messages in chat.messages collection and update chat doc (use with caution)
  const clearChat = async () => {
    if (!confirm("Clear all messages in this chat? This cannot be undone.")) return;
    try {
      const batch = writeBatch(db);
      const msgsRef = collection(db, "chats", chatId, "messages");
      const snap = await getDocs(query(msgsRef)); // all messages (small chats ok)
      snap.docs.forEach(d => batch.delete(doc(db, "chats", chatId, "messages", d.id)));
      // optionally update chat doc metadata
      batch.update(doc(db, "chats", chatId), { lastMessage: "", lastMessageAt: serverTimestamp() });
      await batch.commit();
      alert("Chat cleared.");
    } catch (err) {
      console.error("Clear chat failed", err);
      alert("Failed to clear chat");
    }
  };

  /* -------------------- block / report / unblock -------------------- */
  const toggleBlock = async () => {
    const cRef = doc(db, "chats", chatId);
    try {
      if (blocked) {
        await updateDoc(cRef, { blockedBy: arrayRemove(myUid) });
        setBlocked(false);
      } else {
        await updateDoc(cRef, { blockedBy: arrayUnion(myUid) });
        setBlocked(true);
      }
      setMenuOpen(false);
    } catch (err) {
      console.error("Block toggle failed", err);
      alert("Failed to update block status");
    }
  };

  const reportUser = async () => {
    const reason = prompt("Please describe the problem (this will be saved and opened for email):", "Inappropriate messages");
    if (!reason) return;
    try {
      await addDoc(collection(db, "reports"), {
        reporterId: myUid,
        reportedId: friendInfo?.id || null,
        chatId,
        reason,
        createdAt: serverTimestamp(),
      });
      // open mailto for admin email (frontend trigger only)
      const subject = encodeURIComponent("Report from SmartTalk");
      const body = encodeURIComponent(`Reporter: ${myUid}\nReported: ${friendInfo?.id || "unknown"}\nChat: ${chatId}\nReason: ${reason}`);
      window.open(`mailto:smarttalkgit@gmail.com?subject=${subject}&body=${body}`, "_blank");
      alert("Report submitted.");
      setMenuOpen(false);
    } catch (err) {
      console.error("Report error", err);
      alert("Failed to submit report");
    }
  };

  /* -------------------- swipe to reply helpers -------------------- */
  const onTouchStart = (e, m) => {
    touchStartX.current = e.touches?.[0]?.clientX || null;
  };
  const onTouchEnd = (e, m) => {
    if (!touchStartX.current) return;
    const endX = e.changedTouches?.[0]?.clientX || null;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 80) {
      // consider it a reply swipe
      setReplyTo(m);
      // scroll input into view
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 100);
    }
  };

  /* -------------------- utilities & UI small components -------------------- */
  const MessageBubble = ({ m }) => {
    // hide messages deleted for me
    if (m.deletedFor && m.deletedFor.includes(myUid)) return null;
    const mine = m.sender === myUid;
    const reactions = m.reactions || {};
    const myReaction = reactions[myUid];

    const showReply = m.replyTo;

    return (
      <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
        <div
          onMouseDown={() => { /* placeholder to support desktop long-press if desired */ }}
          onTouchStart={(e) => onTouchStart(e, m)}
          onTouchEnd={(e) => onTouchEnd(e, m)}
          style={{
            background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#202020" : "#f1f1f1"),
            color: mine ? "#fff" : "#000",
            padding: 10,
            borderRadius: 12,
            maxWidth: "76%",
            position: "relative",
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          {/* Reply preview block */}
          {showReply && (
            <div style={{ background: isDark ? "#111" : "#fff", padding: "6px 8px", borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${mine ? "#007bff" : "#888"}`, fontSize: 12 }}>
              <strong style={{ display: "block", fontSize: 12 }}>{showReply.sender === myUid ? "You" : (friendInfo?.displayName || "Friend")}</strong>
              <div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{showReply.text}</div>
            </div>
          )}

          {/* content */}
          {m.type === "image" && m.fileURL && (
            <img
              src={m.fileURL}
              alt={m.fileName || "image"}
              style={{ width: "100%", borderRadius: 8, cursor: "pointer" }}
              onClick={() => setModalImage(m.fileURL)}
            />
          )}
          {m.type === "file" && m.fileURL && (
            <a href={m.fileURL} rel="noreferrer" target="_blank" style={{ color: mine ? "#fff" : "#007bff", textDecoration: "underline" }}>{m.fileName || "file"}</a>
          )}
          {m.type === "text" && m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
          {m.type === "deleted" && <div style={{ fontStyle: "italic", color: isDark ? "#aaa" : "#666" }}>This message was deleted</div>}

          {/* timestamp & status -->
              show time for both sides; show status icon for sender */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{fmtTime(m.createdAt)}</div>
            {mine && (
              <div style={{ fontSize: 12 }}>
                {m.status === "sending" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? <span style={{ color: "#34B7F1" }}>✔✔</span> : ""}
              </div>
            )}
          </div>

          {/* reactions under the bubble */}
          {Object.keys(reactions || {}).length > 0 && (
            <div style={{ position: "absolute", bottom: -12, left: mine ? "auto" : 6, right: mine ? 6 : "auto", background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
              {Object.values(reactions).filter(Boolean).slice(0, 4).join(" ")}
            </div>
          )}

          {/* long-press UI (small header that shows actions) */}
          <div style={{ position: "absolute", top: -28, right: 6, display: "none" }} id={`msg-actions-${m.id}`}>
            {/* left for custom actions; we rely on long-press (touch handlers above) to show emoji popup below */}
          </div>

          {/* emoji quick pop (render hidden by default, toggled via long-press) */}
          <div id={`emoji-pop-${m.id}`} style={{ display: "none", position: "absolute", top: -44, left: 6, gap: 6, zIndex: 40, background: isDark ? "#222" : "#fff", padding: 6, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
            {EMOJIS.map(em => (
              <button key={em} onClick={async () => {
                // toggle reaction (if same -> remove)
                const current = m.reactions?.[myUid];
                await toggleReaction(m.id, em, current);
                const el = document.getElementById(`emoji-pop-${m.id}`);
                if (el) el.style.display = "none";
              }} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}>{em}</button>
            ))}
          </div>

        </div>

        {/* message action overlay for long-press (desktop) */}
      </div>
    );
  };

  /* -------------------- UI rendering -------------------- */
  // group messages by day and include local uploads placeholder
  const merged = [...messages, ...localUploads.map(u => ({ id: u.id, ...u }))];
  merged.sort((a, b) => {
    const aT = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt instanceof Date ? a.createdAt.getTime() : Date.now());
    const bT = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt instanceof Date ? b.createdAt.getTime() : Date.now());
    return aT - bT;
  });

  const grouped = [];
  let lastDay = null;
  merged.forEach(m => {
    const ts = m.createdAt || (m.createdAt === undefined ? new Date() : null);
    const label = ts ? dayLabel(ts) : dayLabel(new Date());
    if (label !== lastDay) {
      grouped.push({ type: "day", id: `day-${label}-${Math.random().toString(36).slice(2,6)}`, label });
      lastDay = label;
    }
    grouped.push(m);
  });

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#050505" : "#f5f5f5"),
      color: isDark ? "#fff" : "#000"
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid #ccc", position: "sticky", top: 0, background: isDark ? "#0b0b0b" : "#fff", zIndex: 20 }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, marginRight: 10, background: "transparent", border: "none", cursor: "pointer" }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 44, height: 44, borderRadius: 999, objectFit: "cover", marginRight: 12, cursor: "pointer" }} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} />
        <div>
          <div style={{ fontWeight: 700 }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</div>
          <div style={{ fontSize: 12, color: isDark ? "#bbb" : "#666" }}>
            {friendTyping ? "typing..." : (friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? (new Date(friendInfo.lastSeen.seconds * 1000).toDateString() === new Date().toDateString() ? fmtTime(friendInfo.lastSeen) : dayLabel(friendInfo.lastSeen)) : "Offline"))}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>🎥</button>

          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen(s => !s)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>⋮</button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: 28, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 50 }}>
                <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>View profile</button>
                <button onClick={() => { setMenuOpen(false); toggleBlock(); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>{blocked ? "Unblock user" : "Block user"}</button>
                <button onClick={() => { setMenuOpen(false); clearChat(); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Clear chat</button>
                <button onClick={() => { setMenuOpen(false); reportUser(); }} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* blocked notice */}
      {blocked && (
        <div style={{ padding: 10, textAlign: "center", background: isDark ? "#111" : "#fff", color: isDark ? "#ddd" : "#333" }}>
          You blocked this user. <button onClick={toggleBlock} style={{ marginLeft: 8, textDecoration: "underline", background: "transparent", border: "none", color: "#007bff", cursor: "pointer" }}>Tap to unblock</button>
        </div>
      )}

      {/* messages list (scrollable) */}
      <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {grouped.map(item => {
          if (item.type === "day") {
            return <div key={item.id} style={{ textAlign: "center", margin: "12px 0", color: "#888", fontSize: 12 }}>{item.label}</div>;
          }
          return <MessageBubble key={item.id} m={item} />;
        })}
        <div ref={endRef} />
      </div>

      {/* center scroll-to-bottom arrow */}
      <button
        onClick={() => scrollToBottom(true)}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 100,
          zIndex: 40,
          background: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: 22,
          width: 44,
          height: 44,
          fontSize: 20,
          cursor: "pointer",
          opacity: isAtBottom ? 0 : 1,
          transition: "opacity 0.25s"
        }}
        title="Scroll to latest"
      >
        ↓
      </button>

      {/* previews (above input) */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid #ddd", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {p ? (
                <img src={p} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, cursor: "pointer" }} onClick={() => setModalImage(p)} />
              ) : (
                <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{selectedFiles[idx]?.name}</div>
              )}
              <button onClick={() => cancelPreviewAt(idx)} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>✕</button>
            </div>
          ))}

          {/* show local upload progress placeholders */}
          {localUploads.map(u => (
            <div key={u.id} style={{ width: 80, height: 80, borderRadius: 8, background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              {u.type === "image" ? <img src={u.fileURL} alt={u.fileName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} /> : <div style={{ fontSize: 12, padding: 6 }}>{u.fileName}</div>}
              <div style={{ position: "absolute", bottom: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, padding: "2px 6px", borderRadius: 12 }}>{u.progress}%</div>
            </div>
          ))}
        </div>
      )}

      {/* pinned input */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid #ccc", display: "flex", alignItems: "center", gap: 8, zIndex: 60 }}>
        {/* attach popup */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowAttach(s => !s)} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20, background: "#f0f0f0", border: "none", cursor: "pointer" }}>＋</button>
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
            <div style={{ background: isDark ? "#111" : "#f2f2f2", padding: "6px 8px", borderRadius: 8, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: isDark ? "#ddd" : "#333" }}>{(replyTo.sender === myUid ? "You" : (friendInfo?.displayName || "Friend"))}: {replyTo.text || replyTo.fileName || ""}</div>
              <button onClick={() => setReplyTo(null)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          )}
          <input
            type="text"
            placeholder={blocked ? "You cannot send messages — chat is blocked" : (replyTo ? `Replying to ${replyTo.sender===myUid ? "You" : (friendInfo?.displayName||"Friend")}` : "Type a message...")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }}
            disabled={blocked}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#111" : "#fff", color: isDark ? "#fff" : "#000" }}
          />
        </div>

        <button onClick={handleSendText} disabled={blocked || (!text.trim() && localUploads.length === 0)} style={{ background: "#34B7F1", color: "#fff", border: "none", borderRadius: 16, padding: "8px 12px", cursor: "pointer" }}>Send</button>
      </div>

      {/* full-screen image preview modal */}
      {modalImage && (
        <div onClick={() => setModalImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
          <img src={modalImage} alt="preview" style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}