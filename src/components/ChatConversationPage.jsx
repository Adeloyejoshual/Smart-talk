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
  writeBatch,
  getDocs,
  limit,
  startAfter,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage
 * - Pagination (load older messages on scroll up)
 * - Upload progress + background uploads
 * - Batched delete (handles >500 docs)
 * - Voice/video call redirects: /voice-call/:chatId and /video-call/:chatId
 * - Time formatting: today / yesterday / DD/MM/YYYY
 * - Attach button (photo, file, audio) only
 * - Emoji picker appears on long-press (simple grid)
 * - Delivered ticks show only on sender side
 * - Optimistic local preview area above footer (not inserted into chat until send)
 */

const PAGE_SIZE = 25; // messages per page

const EMOJIS = ["😀","😁","😂","🤣","😊","😍","😘","😎","😢","😭","😅","😇","😜","🤔","👍","🙏","🔥","🎉","💯"];

function formatMessageDate(ts) {
  if (!ts) return "";
  const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === y.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (isYesterday) {
    return "Yesterday";
  } else {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
}

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]); // remote messages loaded
  const [localPlaceholders, setLocalPlaceholders] = useState([]); // previews waiting for upload/send
  const [text, setText] = useState("");

  // pagination state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastVisibleRef = useRef(null);
  const listRef = useRef(null);
  const endRef = useRef(null);

  // upload state keyed by tempId
  const [uploads, setUploads] = useState({});

  const [panelOpen, setPanelOpen] = useState(false); // not emoji; we won't show emoji panel here
  const [emojiModal, setEmojiModal] = useState({ open: false, targetMessageId: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [sharedMedia, setSharedMedia] = useState([]);
  const [clickCount, setClickCount] = useState(0);

  const myUid = auth.currentUser?.uid;

  // scroll position — show down arrow when scrolled up
  const [scrolledUp, setScrolledUp] = useState(false);

  // ---------- Load chat & friend ----------
  useEffect(() => {
    if (!chatId) return;
    let unsubFriend = null;
    (async () => {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        alert("Chat not found");
        navigate("/chat");
        return;
      }
      setChatInfo({ id: snap.id, ...snap.data() });

      const friendId = (snap.data().participants || []).find((p) => p !== myUid);
      if (friendId) {
        const frRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(frRef, (fsnap) => {
          if (fsnap.exists()) setFriendInfo({ id: fsnap.id, ...fsnap.data() });
        });
      }
    })();

    return () => unsubFriend && unsubFriend();
  }, [chatId, myUid, navigate]);

  // ---------- Pagination: initial load & live subscription for newest page ----------
  useEffect(() => {
    if (!chatId) return;
    // load latest PAGE_SIZE messages (sorted asc for UI).
    // We'll query desc and then reverse so we can use startAfter for pagination.
    let unsub = null;
    (async () => {
      const baseRef = collection(db, "chats", chatId, "messages");
      const qLatest = query(baseRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      const snap = await getDocs(qLatest);
      if (snap.docs.length === 0) {
        setMessages([]);
        setHasMore(false);
        lastVisibleRef.current = null;
        return;
      }
      // lastVisible for older pages
      lastVisibleRef.current = snap.docs[snap.docs.length - 1];
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
      setMessages(docs);

      // live listener for NEW messages (those with createdAt >= newest loaded)
      const newest = snap.docs[0];
      const qLive = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
      unsub = onSnapshot(qLive, (fullSnap) => {
        // only update when new docs available beyond our loaded set (simple merge)
        const all = fullSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages((prev) => {
          // merge without duplication: use id map
          const map = {};
          prev.forEach((m) => (map[m.id] = m));
          all.forEach((m) => (map[m.id] = m));
          const merged = Object.values(map).sort((a, b) => {
            const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
            const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
            return ta - tb;
          });
          return merged;
        });
      });
    })();
    return () => unsub && unsub();
  }, [chatId]);

  // load older page when requested
  const loadOlder = async () => {
    if (!chatId || !lastVisibleRef.current || loadingMore === true) return;
    setLoadingMore(true);
    try {
      const qOlder = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("createdAt", "desc"),
        startAfter(lastVisibleRef.current),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(qOlder);
      if (snap.empty) {
        setHasMore(false);
        lastVisibleRef.current = null;
      } else {
        lastVisibleRef.current = snap.docs[snap.docs.length - 1];
        const older = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
        setMessages((prev) => [...older, ...prev]);
      }
    } catch (e) {
      console.error("load older error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  // ---------- scroll listener to detect top/bottom ----------
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      // detect top for loading older
      if (el.scrollTop < 120 && hasMore && !loadingMore) {
        loadOlder();
      }
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setScrolledUp(!nearBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingMore, messages]);

  // scroll to bottom when messages change if user at bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
      setScrolledUp(false);
    }
  }, [messages]);

  // ---------- Helpers for optimistic placeholders, upload, preview ----------
  const pushPlaceholder = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLocalPlaceholders((p) => [...p, { id: tempId, ...payload }]);
    return tempId;
  };

  const removePlaceholder = (id) => setLocalPlaceholders((p) => p.filter((x) => x.id !== id));

  // attach only photo/file/audio
  const handleAttach = (files) => {
    const arr = Array.from(files || []);
    arr.forEach((file) => startUpload(file));
  };

  const startUpload = (file) => {
    // create local preview placeholder
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file";
    const localUrl = URL.createObjectURL(file);
    const tempId = pushPlaceholder({
      sender: myUid,
      text: "",
      fileName: file.name,
      fileURL: localUrl,
      type,
      status: "uploading",
      progress: 0,
      createdAt: new Date(),
    });

    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    setUploads((u) => ({ ...u, [tempId]: { progress: 0, status: "uploading" } }));

    task.on(
      "state_changed",
      (snap) => {
        const prog = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploads((u) => ({ ...u, [tempId]: { ...(u[tempId] || {}), progress: prog } }));
        setLocalPlaceholders((lp) => lp.map((m) => (m.id === tempId ? { ...m, progress: prog } : m)));
      },
      (err) => {
        console.error("upload err", err);
        setUploads((u) => ({ ...u, [tempId]: { ...(u[tempId] || {}), status: "error" } }));
        setLocalPlaceholders((lp) => lp.map((m) => (m.id === tempId ? { ...m, status: "error" } : m)));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          // write message doc
          await addDoc(collection(db, "chats", chatId, "messages"), {
            sender: myUid,
            text: "",
            fileURL: url,
            fileName: file.name,
            type,
            createdAt: serverTimestamp(),
            status: "sent",
          });
        } catch (e) {
          console.error("write msg err", e);
          setLocalPlaceholders((lp) => lp.map((m) => (m.id === tempId ? { ...m, status: "error" } : m)));
        } finally {
          // remove placeholder (remote listener will pick up the stored message)
          removePlaceholder(tempId);
          setUploads((u) => {
            const copy = { ...u };
            delete copy[tempId];
            return copy;
          });
        }
      }
    );
  };

  // send text message (also supports sending when uploads active)
  const sendText = async () => {
    if (!text.trim()) return;
    const tempId = pushPlaceholder({ sender: myUid, text: text.trim(), type: "text", status: "sending", createdAt: new Date() });
    setText("");
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: myUid,
        text: text.trim(),
        type: "text",
        createdAt: serverTimestamp(),
        status: "sent",
      });
    } catch (e) {
      console.error("send text err", e);
      setLocalPlaceholders((lp) => lp.map((m) => (m.id === tempId ? { ...m, status: "error" } : m)));
    } finally {
      // remove placeholder; remote listener will display real message
      removePlaceholder(tempId);
    }
  };

  // long press / right click on message -> show emoji modal for reaction / insert
  const handleLongPress = (messageId) => {
    setEmojiModal({ open: true, targetMessageId: messageId });
  };

  // batched delete (handles >500). We'll loop and delete pages of 500.
  const batchedDeleteAllMessages = async () => {
    if (!window.confirm("Delete all messages in this chat? This operation will permanently remove all messages.")) return;
    try {
      const collRef = collection(db, "chats", chatId, "messages");
      // fetch all message ids in pages
      let last = null;
      while (true) {
        // query page
        const q = last ? query(collRef, orderBy("createdAt"), startAfter(last), limit(500)) : query(collRef, orderBy("createdAt"), limit(500));
        const snap = await getDocs(q);
        if (snap.empty) break;
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 500) break;
      }
      // clean local state
      setMessages([]);
      setLocalPlaceholders([]);
      alert("All messages deleted.");
    } catch (e) {
      console.error("batched delete error", e);
      alert("Error deleting messages.");
    }
  };

  // open media modal (pull file messages)
  const openMediaModal = async () => {
    try {
      const snap = await getDocs(query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), limit(500)));
      const media = snap.docs.map(d => d.data()).filter(m => m.fileURL).map(m => ({ fileName: m.fileName, fileURL: m.fileURL }));
      setSharedMedia(media);
      setMediaModalOpen(true);
    } catch (e) {
      console.error("media error", e);
      alert("Error loading media.");
    }
  };

  // call handlers
  const startVoiceCall = () => navigate(`/voice-call/${chatId}`);
  const startVideoCall = () => navigate(`/video-call/${chatId}`);

  // helper: scroll to bottom
  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#121212" : "#f5f5f5", color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: 12, borderBottom: "1px solid #ccc", position: "sticky", top: 0, zIndex: 10, background: isDark ? "#111" : "#fff" }}>
        <button onClick={() => navigate("/chat")} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", marginRight: 8 }}>←</button>

        <img src={friendInfo?.photoURL || "/default-avatar.png"} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }} />
        <div style={{ marginLeft: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{friendInfo?.displayName || chatInfo?.name || "Chat"}</strong>
            <small style={{ color: isDark ? "#aaa" : "#666", fontSize: 12 }}>{friendInfo?.isOnline ? "Online" : friendInfo?.lastSeen ? `Last seen ${new Date(friendInfo.lastSeen.seconds * 1000).toLocaleString()}` : "Offline"}</small>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={startVoiceCall} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>📞</button>
          <button onClick={startVideoCall} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>🎥</button>

          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((s) => !s)} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>⋮</button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: 26, background: isDark ? "#222" : "#fff", color: isDark ? "#fff" : "#000", border: "1px solid #ccc", borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                <button onClick={() => { navigate(`/user-profile/${friendInfo?.id}`); setMenuOpen(false); }} style={menuBtnStyle}>View Profile</button>
                <button onClick={() => { batchedDeleteAllMessages(); setMenuOpen(false); }} style={menuBtnStyle}>Clear Chat (batch)</button>
                <button onClick={() => { openMediaModal(); setMenuOpen(false); }} style={menuBtnStyle}>Media</button>
                <button onClick={() => { setClickCount(c => c + 1); alert(`Click count: ${clickCount + 1}`); setMenuOpen(false); }} style={menuBtnStyle}>Clicks: {clickCount}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {/* loading older indicator */}
        {loadingMore && <div style={{ textAlign: "center", color: "#888", margin: 8 }}>Loading older messages...</div>}

        {/* render messages */}
        {messages.map((m) => {
          const mine = m.sender === myUid;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div onContextMenu={(e) => { e.preventDefault(); handleLongPress(m.id); }} onDoubleClick={() => handleLongPress(m.id)} style={{ maxWidth: "78%", background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#222" : "#eee"), color: mine ? "#fff" : "#000", padding: 10, borderRadius: 12 }}>
                {m.type === "image" && m.fileURL && <img src={m.fileURL} alt="" style={{ width: "100%", borderRadius: 8 }} />}
                {m.type === "file" && m.fileURL && <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007bff", textDecoration: "underline" }}>📎 {m.fileName}</a>}
                {m.type === "text" && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
                  <small style={{ fontSize: 11, opacity: 0.9 }}>{formatMessageDate(m.createdAt)}</small>
                  {/* delivered ticks only on sender side */}
                  {mine && <small style={{ fontSize: 12 }}>{m.status === "sending" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}</small>}
                </div>
              </div>
            </div>
          );
        })}

        {/* local placeholders (previews waiting while uploading or text sending placeholder) */}
        {localPlaceholders.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: p.sender === myUid ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ maxWidth: "78%", background: isDark ? "#2b2b2b" : "#f0f0f0", padding: 10, borderRadius: 12, opacity: p.status === "error" ? 0.7 : 1 }}>
              {p.type === "image" && p.fileURL && <img src={p.fileURL} alt="" style={{ width: "100%", borderRadius: 8 }} />}
              {p.type === "file" && <div>📎 {p.fileName}</div>}
              {p.type === "text" && <div>{p.text}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <small style={{ fontSize: 11 }}>{formatMessageDate(p.createdAt)}</small>
                <small style={{ fontSize: 12 }}>{p.status === "uploading" ? `${p.progress || 0}%` : p.status === "sending" ? "⌛" : p.status === "error" ? "⚠️" : ""}</small>
              </div>
            </div>
          </div>
        ))}

        <div ref={endRef} />
      </div>

      {/* previews area above footer (not in chat). This lets user review files before or while uploading */}
      <div style={{ padding: 8, background: isDark ? "#0f0f0f" : "#fff", borderTop: "1px solid #ddd" }}>
        {/* Show current uploads/progress and allow cancel / expand */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {Object.entries(uploads).map(([tempId, u]) => (
            <div key={tempId} style={{ minWidth: 120, border: "1px solid #ddd", padding: 8, borderRadius: 8, background: isDark ? "#111" : "#fafafa" }}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>{u.fileName || "Uploading..."}</div>

              <div style={{ height: 6, background: "#eee", borderRadius: 6 }}>
                <div style={{ width: `${u.progress}%`, height: "100%", background: "#34B7F1", borderRadius: 6 }} />
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                {u.status === "error" ? <button onClick={() => alert("Reattach to retry")} style={tinyBtn}>Retry</button> : null}
                <button onClick={() => { /* allow cancel: not trivial to cancel resumable easily; we'll just remove placeholder if exists */ alert("To cancel, remove from preview"); }} style={tinyBtn}>Cancel</button>
              </div>
            </div>
          ))}

          {localPlaceholders.map((p) => p.status === "uploading" && (
            <div key={p.id} style={{ minWidth: 120, border: "1px solid #ddd", padding: 8, borderRadius: 8 }}>
              <div style={{ fontSize: 12 }}>{p.fileName}</div>
              <div style={{ height: 6, background: "#eee", borderRadius: 6, marginTop: 6 }}>
                <div style={{ width: `${p.progress || 0}%`, height: "100%", background: "#34B7F1", borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* footer with attach (photo/file/audio) and send */}
      <div style={{ padding: 10, borderTop: "1px solid #ddd", display: "flex", gap: 8, alignItems: "center", background: isDark ? "#0d0d0d" : "#fff" }}>
        {/* attach only: photo, file, audio */}
        <label style={attachBtnStyle}>
          📷
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleAttach(e.target.files)} />
        </label>
        <label style={attachBtnStyle}>
          📎
          <input type="file" multiple style={{ display: "none" }} onChange={(e) => handleAttach(e.target.files)} />
        </label>
        <label style={attachBtnStyle}>
          🎵
          <input type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => handleAttach(e.target.files)} />
        </label>

        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendText(); }} placeholder="Type a message" style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#111" : "#fff", color: isDark ? "#fff" : "#000" }} />

        <button onClick={sendText} style={{ background: "#34B7F1", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 20, cursor: "pointer" }}>Send</button>

        {/* down arrow */}
        <button onClick={() => { scrollToBottom(); }} style={{ marginLeft: 6, opacity: scrolledUp ? 1 : 0.3, transition: "opacity 200ms", border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>⬇</button>
      </div>

      {/* Emoji modal (shows after long press) */}
      {emojiModal.open && (
        <div style={modalOverlay}>
          <div style={{ width: 280, background: isDark ? "#111" : "#fff", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EMOJIS.map((em) => <button key={em} onClick={() => { setText((t) => t + em); setEmojiModal({ open: false, targetMessageId: null }); }} style={{ fontSize: 20, padding: 6, border: "none", background: "transparent", cursor: "pointer" }}>{em}</button>)}
            </div>
            <div style={{ marginTop: 10, textAlign: "right" }}>
              <button onClick={() => setEmojiModal({ open: false, targetMessageId: null })} style={tinyBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* media modal */}
      {mediaModalOpen && (
        <div style={modalOverlay} onClick={() => setMediaModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "90%", maxWidth: 900, maxHeight: "80%", overflowY: "auto", background: isDark ? "#111" : "#fff", padding: 12, borderRadius: 8 }}>
            <h3>Shared media</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10 }}>
              {sharedMedia.length === 0 && <div style={{ color: "#999" }}>No media</div>}
              {sharedMedia.map((m, i) => (
                <a key={i} href={m.fileURL} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}>
                  <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f7" }}>
                    <img src={m.fileURL} alt={m.fileName} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: 8 }}>{m.fileName}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// small styles
const menuBtnStyle = { display: "block", padding: "8px 12px", width: 200, textAlign: "left", border: "none", background: "transparent", cursor: "pointer" };
const tinyBtn = { padding: "6px 8px", border: "none", borderRadius: 6, background: "#eee", cursor: "pointer" };
const attachBtnStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", background: "transparent" };
const modalOverlay = { position: "fixed", left: 0, top: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 };