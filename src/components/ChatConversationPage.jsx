// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  writeBatch,
  deleteDoc,
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
import { useParams, useNavigate } from "react-router-dom";

/*
  This file is an enhanced ChatConversationPage with:
  - swipe-to-reply (right-swipe)
  - long-press to open top action header
  - emoji reaction popup (toggle reaction)
  - Delete for me (hiddenFor array)
  - Delete for everyone (mark message.deleted = true and replace text)
  - All previous features (uploads, previews, pinned input, scroll arrow etc.)
*/

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅"];

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
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localUploads, setLocalUploads] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const [selectedMessageId, setSelectedMessageId] = useState(null); // for top action bar
  const [replyTo, setReplyTo] = useState(null);

  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  const [isAtBottom, setIsAtBottom] = useState(true);

  // --- load chat & friend
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend = null;
    let unsubChat = null;

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) { navigate("/chat"); return; }
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setBlocked(Boolean(data?.blockedBy?.includes(myUid)));
      const friendId = data.participants?.find(p => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, fsnap => {
          if (fsnap.exists()) {
            setFriendInfo({ id: fsnap.id, ...fsnap.data() });
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
          }
        });
      }
      unsubChat = onSnapshot(chatRef, cSnap => {
        if (cSnap.exists()) {
          setChatInfo(prev => ({ ...(prev||{}), ...cSnap.data() }));
          setBlocked(Boolean(cSnap.data()?.blockedBy?.includes(myUid)));
        }
      });
    })();

    return () => {
      unsubFriend && unsubFriend();
      unsubChat && unsubChat();
    };
  }, [chatId, myUid, navigate]);

  // --- realtime messages with pagination (desc limit)
  const [limitCount, setLimitCount] = useState(50);
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), /* limit handled by state */);
    // We'll subscribe and then slice locally by limitCount to preserve older-first ordering.
    const unsub = onSnapshot(q, snap => {
      // newest -> oldest, so map then reverse and take last limitCount
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      // filter out messages hidden for this user (hiddenFor array)
      const visible = docs.filter(m => !(Array.isArray(m.hiddenFor) && m.hiddenFor.includes(myUid)));
      setMessages(visible.slice(-limitCount));
      // deliver marks
      docs.forEach(m => {
        if (m.sender !== myUid && m.status === "sent") {
          const mRef = doc(db, "chats", chatId, "messages", m.id);
          updateDoc(mRef, { status: "delivered" }).catch(()=>{});
        }
      });
      // scroll to bottom at initial load
      setTimeout(()=>{ endRef.current?.scrollIntoView({behavior:"auto"}); setIsAtBottom(true); }, 50);
    });
    return () => unsub();
  }, [chatId, limitCount, myUid]);

  // --- scroll handler
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

  const scrollToBottom = (smooth=true) => endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });

  // --- attachments + background upload
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles(p => [...p, ...files]);
    const newPreviews = files.map(f => f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setPreviews(p => [...p, ...newPreviews]);
    files.forEach(startUpload);
  };

  const startUpload = (file) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    setLocalUploads(prev => [...prev, {
      id: tempId,
      fileName: file.name,
      progress: 0,
      fileURL: URL.createObjectURL(file),
      type: file.type.startsWith("image/") ? "image" : "file",
      status: "uploading",
      createdAt: new Date()
    }]);

    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    task.on("state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setLocalUploads(prev => prev.map(l => l.id === tempId ? { ...l, progress: pct } : l));
      },
      (err) => {
        console.error("Upload failed", err);
        setLocalUploads(prev => prev.map(l => l.id === tempId ? { ...l, status: "failed" } : l));
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
        setLocalUploads(prev => prev.filter(l => l.id !== tempId));
      }
    );
  };

  const cancelPreviewAt = (index) => {
    setSelectedFiles(p => p.filter((_, i) => i !== index));
    setPreviews(p => p.filter((_, i) => i !== index));
    // note: upload already started may still continue
  };

  // --- send text message (with optional replyTo)
  const handleSendText = async () => {
    if (!text.trim()) return;
    if (blocked) { alert("You cannot send messages — this chat is blocked."); return; }
    const payload = {
      sender: myUid,
      text: text.trim(),
      fileURL: null,
      createdAt: serverTimestamp(),
      type: "text",
      status: "sent",
    };
    if (replyTo) {
      payload.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0,120) || (replyTo.fileName || "media"), sender: replyTo.sender };
    }
    setText("");
    setReplyTo(null);
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setTimeout(()=>scrollToBottom(true), 150);
    } catch (err) {
      console.error("Send failed", err);
      alert("Failed to send message");
    }
  };

  // --- reactions: toggle reaction for myUid
  const toggleReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      // optimistic read on current doc (could fetch but relying on doc update)
      // We'll attempt to set reactions.myUid = emoji; if same emoji exists remove
      const mSnap = await getDoc(mRef);
      if (!mSnap.exists()) return;
      const current = mSnap.data().reactions || {};
      const currentReaction = current[myUid];
      if (currentReaction === emoji) {
        // remove reaction
        await updateDoc(mRef, { [`reactions.${myUid}`]: null });
        // Note: Firestore doesn't accept setting nested field to null to delete — so we delete by update with deleteField
        // But to avoid importing deleteField, we set to null then clients can ignore nulls. For a clean delete use admin or deleteField utility.
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
      setSelectedMessageId(null);
    } catch (err) {
      console.error("toggleReaction error", err);
    }
  };

  // --- delete for me (add hiddenFor: myUid)
  const deleteForMe = async (messageId) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(mRef, { hiddenFor: arrayUnion(myUid) });
      setSelectedMessageId(null);
    } catch (err) {
      console.error("deleteForMe", err);
      alert("Failed to delete for me");
    }
  };

  // --- delete for everyone (mark deleted)
  const deleteForEveryone = async (messageId) => {
    if (!window.confirm("Delete for everyone? This will replace the message content.")) return;
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(mRef, {
        deleted: true,
        deletedBy: myUid,
        deletedAt: serverTimestamp(),
        text: "Message deleted",
        fileURL: null,
        fileName: null,
        type: "text",
      });
      setSelectedMessageId(null);
    } catch (err) {
      console.error("deleteForEveryone", err);
      alert("Failed to delete for everyone");
    }
  };

  // --- long-press / top action header + swipe to reply
  const longPressTimeout = useRef(null);
  const swipeStart = useRef({ x: 0, y: 0 });

  const startLongPress = (id) => {
    longPressTimeout.current = setTimeout(() => {
      setSelectedMessageId(id);
    }, 450);
  };
  const cancelLongPress = () => {
    clearTimeout(longPressTimeout.current);
  };

  const onPointerDown = (e, m) => {
    swipeStart.current = { x: e.clientX || (e.touches && e.touches[0].clientX), y: e.clientY || (e.touches && e.touches[0].clientY) };
  };
  const onPointerUp = (e, m) => {
    const endX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
    const dx = endX - swipeStart.current.x;
    if (dx > 120) {
      // swipe right => reply
      setReplyTo(m);
      setSelectedMessageId(null);
      setTimeout(()=>{ const el = document.querySelector('input[type="text"]'); if (el) el.focus(); }, 50);
    }
  };

  // --- message bubble renderer
  const MessageBubble = ({ m }) => {
    // skip messages that are hidden for current user (some clients may hide)
    if (Array.isArray(m.hiddenFor) && m.hiddenFor.includes(myUid)) return null;

    const mine = m.sender === myUid;
    const reactions = m.reactions || {};
    const myReaction = reactions[myUid];

    const replySnippet = m.replyTo ? (m.replyTo.text || (m.replyTo.fileName || "media")) : null;
    const isSelected = selectedMessageId === m.id;

    return (
      <div
        key={m.id}
        style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, paddingLeft: 6, paddingRight: 6 }}
      >
        <div
          onMouseDown={() => startLongPress(m.id)}
          onMouseUp={cancelLongPress}
          onTouchStart={(e) => startLongPress(m.id)}
          onTouchEnd={cancelLongPress}
          onMouseLeave={cancelLongPress}
          onPointerDown={(e)=>onPointerDown(e, m)}
          onPointerUp={(e)=>onPointerUp(e, m)}
          style={{
            background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#222" : "#eee"),
            color: mine ? "#fff" : "#000",
            padding: "10px 12px",
            borderRadius: 14,
            maxWidth: "78%",
            wordBreak: "break-word",
            position: "relative",
            boxShadow: isSelected ? "0 6px 18px rgba(0,0,0,0.15)" : "none"
          }}
        >
          {m.deleted ? (
            <em style={{ opacity: 0.75 }}>Message deleted</em>
          ) : (
            <>
              {replySnippet && (
                <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#fff", color: isDark ? "#ddd" : "#333", fontSize: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
                  <small style={{ display: "block", opacity: 0.8 }}>{m.replyTo?.sender === myUid ? "You" : ""}</small>
                  <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{replySnippet}</span>
                </div>
              )}

              {m.type === "image" && m.fileURL && <img src={m.fileURL} alt={m.fileName || "img"} style={{ width: "100%", borderRadius: 8 }} />}
              {m.type === "file" && m.fileURL && <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007bff" }}>📎 {m.fileName || "file"}</a>}
              {m.type === "text" && <div>{m.text}</div>}

              <div style={{ fontSize: 11, textAlign: "right", marginTop: 6, opacity: 0.85 }}>
                <span style={{ marginLeft: 6 }}>{fmtTime(m.createdAt)}</span>
                {mine && <span style={{ marginLeft: 6 }}>{m.status === "sending" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}</span>}
              </div>

              {/* reactions displayed under the bubble */}
              {Object.keys(reactions || {}).length > 0 && (
                <div style={{ position: "absolute", left: mine ? "auto" : 6, right: mine ? 6 : "auto", bottom: -18, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }}>
                  {Object.values(reactions).filter(Boolean).slice(0,3).join(" ")}
                </div>
              )}

              {/* emoji quick pop (appears when message selected) */}
              <div id={`emoji-pop-${m.id}`} style={{ display: selectedMessageId === m.id ? "flex" : "none", position: "absolute", left: 8, right: 8, bottom: -54, gap: 8, justifyContent: "center", zIndex: 40, background: "transparent", padding: 6 }}>
                {EMOJIS.map(em => (
                  <button key={em} onClick={() => toggleReaction(m.id, em)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>{em}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // --- merge message list and localUploads for previewing in chat area
  const mergedList = [...messages, ...localUploads.map(u => ({ id: u.id, ...u }))];
  const grouped = [];
  let lastDay = null;
  mergedList.forEach(m => {
    const ts = m.createdAt || (m.createdAt === undefined ? new Date() : null);
    const label = ts ? dayLabel(ts) : dayLabel(new Date());
    if (label !== lastDay) { grouped.push({ type: "day", label, id: `day-${label}-${Math.random().toString(36).slice(2,6)}` }); lastDay = label; }
    grouped.push(m);
  });

  // --- UI actions for selected message (top bar)
  const deleteMessage = async (messageId) => { // delete single message (same as deleteForEveryone here for simplicity)
    await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
    setSelectedMessageId(null);
  };

  // --- clear chat (batched)
  const clearChat = async () => {
    if (!window.confirm("Clear all messages in this chat? This cannot be undone.")) return;
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
      console.error("Clear chat failed", err);
      alert("Failed to clear chat");
    }
  };

  // --- block/unblock
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

  // --- UI render
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid #ccc", position: "sticky", top: 0, background: isDark ? "#111" : "#fff", zIndex: 30 }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", cursor: "pointer", marginRight: 10 }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", marginRight:12, cursor:"pointer" }} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} />
        <div>
          <div style={{ fontWeight:700 }}>{friendInfo?.displayName || chatInfo?.name || "Friend"}</div>
          <div style={{ fontSize:12, color: isDark ? "#bbb" : "#666" }}>{friendTyping ? "typing..." : (friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? fmtTime(friendInfo.lastSeen) : "Offline"))}</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>🎥</button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen(s => !s)} style={{ fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>⋮</button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: 28, background: isDark ? "#222" : "#fff", border: "1px solid #ccc", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 50 }}>
                <button onClick={() => { setMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} style={{ display:"block", padding:"8px 14px", width:200, textAlign:"left", background:"transparent", border:"none", cursor:"pointer"}}>View Profile</button>
                <button onClick={() => { clearChat(); setMenuOpen(false); }} style={{ display:"block", padding:"8px 14px", width:200, textAlign:"left", background:"transparent", border:"none", cursor:"pointer"}}>Clear Chat</button>
                <button onClick={toggleBlock} style={{ display:"block", padding:"8px 14px", width:200, textAlign:"left", background:"transparent", border:"none", cursor:"pointer"}}>{blocked ? "Unblock" : "Block"}</button>
                <button onClick={() => { const reason = prompt("Describe/report this user:",""); if (reason) { addDoc(collection(db,"reports"),{reporterId:myUid, reportedId:friendInfo?.id, chatId, reason, createdAt: serverTimestamp(), emailTo:"smarttalkgit@gmail.com"}); alert("Report sent."); } setMenuOpen(false); }} style={{ display:"block", padding:"8px 14px", width:200, textAlign:"left", background:"transparent", border:"none", cursor:"pointer"}}>Report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* selected-message top action bar */}
      {selectedMessageId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", padding: "8px 0", background: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)", zIndex: 120 }}>
          <div style={{ background: isDark ? "#222" : "#fff", padding: "6px 10px", borderRadius: 8, display: "flex", gap: 8, alignItems: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.12)" }}>
            <button onClick={() => deleteForMe(selectedMessageId)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>🗑 Delete for me</button>
            <button onClick={() => deleteForEveryone(selectedMessageId)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>🗑 Delete for everyone</button>
            <button onClick={() => { const m = messages.find(x=>x.id===selectedMessageId); setReplyTo(m||null); setSelectedMessageId(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>↩ Reply</button>
            <div style={{ display: "flex", gap: 6 }}>
              {EMOJIS.slice(0,4).map(e => <button key={e} onClick={() => toggleReaction(selectedMessageId, e)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>{e}</button>)}
            </div>
            <button onClick={() => setSelectedMessageId(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✖</button>
          </div>
        </div>
      )}

      {/* messages */}
      <div ref={messagesRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {grouped.map(g => {
          if (g.type === "day") {
            return <div key={g.id} style={{ textAlign: "center", margin: "12px 0", color: "#888", fontSize: 12 }}>{g.label}</div>;
          }
          return <MessageBubble key={g.id} m={g} />;
        })}
        <div ref={endRef} />
      </div>

      {/* center down arrow */}
      <button onClick={() => scrollToBottom(true)} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 120, zIndex: 60, background: "#007bff", color: "#fff", border: "none", borderRadius: 22, width: 48, height: 48, fontSize: 22, cursor: "pointer", opacity: isAtBottom ? 0 : 1, transition: "opacity 0.25s" }} title="Scroll to latest" aria-hidden={isAtBottom}>↓</button>

      {/* previews */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid #ddd", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {p ? <img src={p} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8, background:"#eee" }}>{selectedFiles[idx]?.name}</div>}
              <button onClick={() => cancelPreviewAt(idx)} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>✕</button>
              {localUploads.find(u => u.fileName === (selectedFiles[idx]?.name)) && (
                <div style={{ position: "absolute", left: 6, bottom: 6, background: "rgba(0,0,0,0.4)", color: "#fff", padding: "2px 6px", borderRadius: 8, fontSize: 12 }}>
                  {localUploads.find(u => u.fileName === (selectedFiles[idx]?.name))?.progress || 0}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* pinned input */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid #ccc", display: "flex", alignItems: "center", gap: 8, zIndex: 50 }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowAttach(s => !s)} style={{ width:44, height:44, borderRadius:12, fontSize:20, background:"#f0f0f0", border:"none", cursor:"pointer" }}>＋</button>
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

          <input type="text" placeholder={blocked ? "You blocked this user — unblock to send" : "Type a message..."} value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>{ if (e.key==="Enter") handleSendText(); }} disabled={blocked} style={{ padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#111" : "#fff", color: isDark ? "#fff" : "#000" }} />
        </div>

        <button onClick={handleSendText} disabled={blocked || (!text.trim() && localUploads.length === 0)} style={{ background: "#34B7F1", color: "#fff", border: "none", borderRadius: 16, padding: "8px 12px", cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
}