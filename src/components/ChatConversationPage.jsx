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
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/* -------------------------
  Helpers
------------------------- */
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const dayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅", "🙏", "😎", "🎉", "🤝"];

/* -------------------------
  Component
------------------------- */
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);

  const [limitCount, setLimitCount] = useState(30);
  const [messages, setMessages] = useState([]);
  const [localUploads, setLocalUploads] = useState([]); // local placeholders for uploads
  const [text, setText] = useState("");
  const [previews, setPreviews] = useState([]); // preview URLs for selected files
  const [selectedFiles, setSelectedFiles] = useState([]); // original File objects (queued)
  const [showAttach, setShowAttach] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  // scroll tracking
  const [isAtBottom, setIsAtBottom] = useState(true);

  /* -------------------------
     Load chat & friend (metadata)
  ------------------------- */
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

      // listen chat for block changes
      unsubChat = onSnapshot(chatRef, (s) => {
        if (s.exists()) {
          setChatInfo({ id: s.id, ...s.data() });
          setBlocked(Boolean(s.data()?.blockedBy?.includes(myUid)));
        }
      });

      // friend profile listener
      const friendId = snap.data().participants?.find((p) => p !== myUid);
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
      unsubChat && unsubChat();
      unsubFriend && unsubFriend();
    };
  }, [chatId, myUid, navigate]);

  /* -------------------------
     Messages realtime + pagination
  ------------------------- */
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "desc"),
      fsLimit(limitCount)
    );
    const unsub = onSnapshot(q, (snap) => {
      // newest first from query -> reverse to show oldest -> newest
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
      setMessages(docs);

      // best-effort mark delivered for incoming messages
      docs.forEach((m) => {
        if (m.sender !== myUid && m.status === "sent") {
          const mRef = doc(db, "chats", chatId, "messages", m.id);
          updateDoc(mRef, { status: "delivered" }).catch(() => {});
        }
      });

      // initial scroll to bottom
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "auto" });
        setIsAtBottom(true);
      }, 40);
    });

    return () => unsub();
  }, [chatId, limitCount, myUid]);

  /* -------------------------
     Scrolling behaviour
  ------------------------- */
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // auto-scroll when new messages arrive only if user is at bottom
  useEffect(() => {
    if (isAtBottom) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages, localUploads, isAtBottom]);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    setIsAtBottom(true);
  };

  /* -------------------------
     Pagination
  ------------------------- */
  const loadMore = () => setLimitCount((p) => p + 20);

  /* -------------------------
     Attachments + background upload
  ------------------------- */
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles((p) => [...p, ...files]);
    const newPreviews = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null));
    setPreviews((p) => [...p, ...newPreviews]);

    // start uploads immediately
    files.forEach((file) => startUpload(file));
    setShowAttach(false);
  };

  const startUpload = (file) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setLocalUploads((prev) => [
      ...prev,
      {
        id: tempId,
        fileName: file.name,
        progress: 0,
        fileURL: URL.createObjectURL(file),
        type: file.type.startsWith("image/") ? "image" : "file",
        status: "uploading",
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
        // write message to firestore
        await addDoc(collection(db, "chats", chatId, "messages"), {
          sender: myUid,
          text: "",
          fileURL: url,
          fileName: file.name,
          type: file.type.startsWith("image/") ? "image" : "file",
          createdAt: serverTimestamp(),
          status: "sent",
        });
        // remove local placeholder
        setLocalUploads((prev) => prev.filter((l) => l.id !== tempId));
      }
    );
  };

  const cancelPreviewAt = (index) => {
    setSelectedFiles((p) => p.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
    // note: upload already started - we don't abort here (could add abort)
  };

  /* -------------------------
     Sending text
  ------------------------- */
  const handleSendText = async () => {
    if (!text.trim()) return;
    if (blocked) {
      alert("You cannot send messages — this chat is blocked.");
      return;
    }
    const msg = text.trim();
    setText("");
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: myUid,
        text: msg,
        fileURL: null,
        createdAt: serverTimestamp(),
        type: "text",
        status: "sent",
      });
      if (isAtBottom) scrollToBottom(true);
    } catch (err) {
      console.error("Send failed", err);
      alert("Failed to send message");
    }
  };

  /* -------------------------
     Block / Report
  ------------------------- */
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

  const reportUser = async () => {
    const reason = prompt("Please describe the problem (this will be sent to admins):", "Inappropriate messages");
    if (!reason) return;
    try {
      await addDoc(collection(db, "reports"), {
        reporterId: myUid,
        reportedId: friendInfo?.id || null,
        chatId,
        reason,
        createdAt: serverTimestamp(),
      });
      alert("Report submitted. Admins will review.");
      setMenuOpen(false);
    } catch (err) {
      console.error("Report error", err);
      alert("Failed to send report");
    }
  };

  /* -------------------------
     Reactions (long press)
  ------------------------- */
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(mRef, {
        [`reactions.${myUid}`]: emoji,
      });
    } catch (err) {
      console.error("Reaction error", err);
    }
  };

  const longPressTimeout = useRef(null);
  const startLongPress = (id) => {
    longPressTimeout.current = setTimeout(() => {
      const el = document.getElementById(`emoji-pop-${id}`);
      if (el) el.style.display = "flex";
    }, 500);
  };
  const cancelLongPress = (id) => {
    clearTimeout(longPressTimeout.current);
    const el = document.getElementById(`emoji-pop-${id}`);
    if (el) el.style.display = "none";
  };

  /* -------------------------
     Merged message list (server + local uploads)
  ------------------------- */
  const mergedList = [...messages, ...localUploads.map((u) => ({ id: u.id, ...u }))];

  // Build grouped array with day dividers
  const grouped = [];
  let lastGroup = null;
  mergedList.forEach((m) => {
    const ts = m.createdAt || (m.createdAt === undefined ? new Date() : null);
    const label = ts ? dayLabel(ts) : dayLabel(new Date());
    if (label !== lastGroup) {
      grouped.push({ type: "day", label, id: `day-${label}-${Math.random().toString(36).slice(2,6)}` });
      lastGroup = label;
    }
    grouped.push(m);
  });

  /* -------------------------
     Small UI pieces: Message bubble
  ------------------------- */
  const MessageBubble = ({ m }) => {
    const mine = m.sender === myUid;
    const reactions = m.reactions || {};
    const myReaction = reactions[myUid];

    return (
      <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
        <div
          onMouseDown={() => startLongPress(m.id)}
          onMouseUp={() => cancelLongPress(m.id)}
          onTouchStart={() => startLongPress(m.id)}
          onTouchEnd={() => cancelLongPress(m.id)}
          style={{
            background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#222" : "#eee"),
            color: mine ? "#fff" : "#000",
            padding: "8px 12px",
            borderRadius: 12,
            maxWidth: "75%",
            wordBreak: "break-word",
            position: "relative",
          }}
        >
          {/* File / Image / Text */}
          {m.type === "image" && m.fileURL && (
            <img src={m.fileURL} alt={m.fileName || "img"} style={{ width: "100%", borderRadius: 8 }} />
          )}

          {m.type === "file" && m.fileURL && (
            <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007bff" }}>
              📎 {m.fileName || "file"}
            </a>
          )}

          {m.type === "text" && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}

          {/* Upload progress / status */}
          {m.status === "uploading" && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              {/* circular basic progress */}
              <div style={{ width: 20, height: 20, borderRadius: 10, border: "2px solid rgba(255,255,255,0.3)", position: "relative", overflow: "hidden" }}>
                <div style={{
                  background: "#34B7F1",
                  height: "100%",
                  width: `${m.progress || 0}%`,
                  transition: "width 200ms linear"
                }} />
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{m.progress || 0}%</div>
            </div>
          )}

          {m.status === "failed" && (
            <div style={{ marginTop: 6, color: "#ff4d4f", fontSize: 12 }}>Upload failed — retry later</div>
          )}

          {/* Sender meta (time + ticks) - only for sent messages (server) */}
          {mine && (
            <div style={{ fontSize: 11, textAlign: "right", marginTop: 6, opacity: 0.9 }}>
              {m.status === "sending" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}
              <span style={{ marginLeft: 6, fontSize: 10 }}>{fmtTime(m.createdAt)}</span>
            </div>
          )}

          {/* Reactions */}
          {Object.keys(reactions || {}).length > 0 && (
            <div style={{ position: "absolute", bottom: -12, right: mine ? 4 : "auto", left: mine ? "auto" : 4, background: isDark ? "#111" : "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              {Object.values(reactions).slice(0, 3).join(" ")}
            </div>
          )}

          {/* Small emoji quick-picker (hidden by default) */}
          <div id={`emoji-pop-${m.id}`} style={{ display: "none", position: "absolute", top: -44, left: 6, gap: 6, zIndex: 60, background: isDark ? "#222" : "#fff", padding: 6, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            {EMOJIS.slice(0, 8).map((em) => (
              <button key={em} onClick={() => { applyReaction(m.id, em); const el = document.getElementById(`emoji-pop-${m.id}`); if (el) el.style.display = "none"; }} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer" }}>{em}</button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------
     Render
  ------------------------- */
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#0b0b0b" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)", position: "sticky", top: 0, background: isDark ? "#111" : "#fff", zIndex: 30 }}>
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
                <button onClick={toggleBlock} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>{blocked ? "Unblock user" : "Block user"}</button>
                <button onClick={() => reportUser()} style={{ display: "block", padding: "8px 14px", width: 220, textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        <div style={{ textAlign: "center", margin: "8px 0" }}>
          <button onClick={loadMore} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", background: isDark ? "#111" : "#fff" }}>Load more</button>
        </div>

        {grouped.map((g) => {
          if (g.type === "day") {
            return <div key={g.id} style={{ textAlign: "center", margin: "12px 0", color: "#888", fontSize: 12 }}>{g.label}</div>;
          }
          return <MessageBubble key={g.id} m={g} />;
        })}

        <div ref={endRef} />
      </div>

      {/* Down arrow */}
      <button
        onClick={() => scrollToBottom(true)}
        style={{
          position: "fixed",
          right: 90,
          bottom: 140,
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
          transition: "opacity 0.25s",
        }}
        aria-hidden={isAtBottom}
        title="Scroll to latest"
      >
        ↓
      </button>

      {/* Previews bar (above input) */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid #ddd", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {p ? <img src={p} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{selectedFiles[idx]?.name}</div>}
              <button onClick={() => cancelPreviewAt(idx)} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Fixed input / controls (pinned) */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid #ccc", display: "flex", alignItems: "center", gap: 8, zIndex: 60 }}>
        {/* Attach popup */}
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

        {/* Emoji picker toggle */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setEmojiPickerOpen((s) => !s)} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20, background: "#f0f0f0", border: "none", cursor: "pointer" }}>🙂</button>
          {emojiPickerOpen && (
            <div style={{ position: "absolute", bottom: 56, left: 0, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 10, padding: 8, display: "flex", gap: 6, flexWrap: "wrap", width: 260 }}>
              {EMOJIS.map((em) => (
                <button key={em} onClick={() => { setText((t) => t + em); setEmojiPickerOpen(false); }} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>{em}</button>
              ))}
            </div>
          )}
        </div>

        {/* Text input */}
        <input
          type="text"
          placeholder={blocked ? "You cannot send messages — chat is blocked" : "Type a message..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }}
          disabled={blocked}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#111" : "#fff", color: isDark ? "#fff" : "#000" }}
        />

        <button onClick={handleSendText} disabled={blocked || (!text.trim() && localUploads.length === 0)} style={{ background: "#34B7F1", color: "#fff", border: "none", borderRadius: 16, padding: "8px 12px", cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
}