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
  deleteDoc,
  getDocs,
  updateDoc,
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
 * - WhatsApp style emoji / attachment panel (slides up)
 * - Preview bar with upload progress & retry/remove
 * - Background uploads while text sending continues
 * - Down-arrow appears when scrolled up (fades at bottom)
 * - 3-dot menu: View profile, Block/Unblock, Clear chat, Media
 */

const SIMPLE_EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","😘","😎","😢","😭",
  "😅","😇","😜","🤔","👍","👎","🙏","🔥","🎉","💯",
];

const formatTime = (ts) => {
  if (!ts) return "";
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]); // remote messages
  const [localMessages, setLocalMessages] = useState([]); // optimistic local messages
  const [text, setText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false); // emoji/attach panel
  const [selectedFiles, setSelectedFiles] = useState([]); // files chosen (File objects)
  const [previews, setPreviews] = useState([]); // preview URLs or null for non-image
  const [uploads, setUploads] = useState({}); // { tempId: { progress, status, retryFn } }
  const [friendTyping, setFriendTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [sharedMedia, setSharedMedia] = useState([]);
  const [blocked, setBlocked] = useState(false);

  const listRef = useRef(null);
  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  // track whether user scrolled up
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // --- Load chat and friend info ---
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
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });

      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriendInfo({ id: fsnap.id, ...fsnap.data() });
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
            setBlocked(Boolean(fsnap.data()?.blockedBy?.includes(myUid))); // optional field meaning
          }
        });
      }
    })();
    return () => unsubFriend && unsubFriend();
  }, [chatId, myUid, navigate]);

  // --- Real-time messages ---
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      // mark delivered when appropriate
      msgs
        .filter((m) => m.sender !== myUid && (!m.status || m.status === "sent"))
        .forEach((m) => {
          // best effort: update status to delivered
          try {
            const mRef = doc(db, "chats", chatId, "messages", m.id);
            updateDoc(mRef, { status: "delivered" }).catch(() => {});
          } catch (e) {}
        });
    });
    return () => unsub();
  }, [chatId, myUid]);

  // --- scroll handling to show/hide down arrow ---
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120; // threshold
      setUserScrolledUp(!nearBottom);
    };
    el.addEventListener("scroll", onScroll);
    // initial:
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages, localMessages]);

  // --- helper: scroll to bottom ---
  const scrollToBottom = (smooth = true) => {
    if (!listRef.current) return;
    try {
      if (smooth)
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      else listRef.current.scrollTop = listRef.current.scrollHeight;
      setUserScrolledUp(false);
    } catch (e) {}
  };

  // When new remote messages arrive, auto scroll only if user is near bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) scrollToBottom(true);
  }, [messages]);

  // --- Utility: push local optimistic message ---
  const pushLocalMessage = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLocalMessages((p) => [...p, { id: tempId, ...payload }]);
    // keep at bottom unless user scrolled up
    if (!userScrolledUp) setTimeout(() => scrollToBottom(true), 50);
    return tempId;
  };

  // --- Attach files and start upload in background ---
  const handleFilesChosen = (filesArray) => {
    const chosen = Array.from(filesArray || []);
    if (!chosen.length) return;
    // Add previews
    const newPreviews = chosen.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null));
    setSelectedFiles((p) => [...p, ...chosen]);
    setPreviews((p) => [...p, ...newPreviews]);

    // Start upload for each
    chosen.forEach((file) => startUpload(file));
  };

  const startUpload = (file) => {
    const tempId = pushLocalMessage({
      sender: myUid,
      text: "",
      fileName: file.name,
      fileURL: URL.createObjectURL(file),
      type: file.type.startsWith("image/") ? "image" : "file",
      createdAt: new Date(),
      status: "uploading",
      local: true,
    });

    // create storage ref
    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);

    // register upload
    setUploads((u) => ({ ...u, [tempId]: { progress: 0, status: "uploading" } }));

    task.on(
      "state_changed",
      (snap) => {
        const progress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploads((u) => ({ ...u, [tempId]: { ...(u[tempId] || {}), progress } }));
      },
      (err) => {
        console.error("Upload error", err);
        setUploads((u) => ({ ...u, [tempId]: { ...(u[tempId] || {}), status: "error" } }));
        // mark local message as failed
        setLocalMessages((lm) => lm.map((m) => (m.id === tempId ? { ...m, status: "error" } : m)));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        // write message to firestore
        try {
          await addDoc(collection(db, "chats", chatId, "messages"), {
            sender: myUid,
            text: "",
            fileURL: url,
            fileName: file.name,
            type: file.type.startsWith("image/") ? "image" : "file",
            createdAt: serverTimestamp(),
            status: "sent",
          });
        } catch (e) {
          console.error("Write message error", e);
        } finally {
          // remove local placeholder
          setLocalMessages((lm) => lm.filter((m) => m.id !== tempId));
          setUploads((u) => {
            const copy = { ...u };
            delete copy[tempId];
            return copy;
          });
          // update shared media (will also be fetched via query if needed)
          setSharedMedia((s) => [...s, { fileName: file.name, fileURL: url }]);
        }
      }
    );
  };

  // retry upload for a failed local message (we stored file in uploads? not - re-ask user to re-select, but we provide a retry that uses a saved File if available)
  const retryLocalUpload = (localId) => {
    // find the local message which contains temporary fileURL pointing to objectURL - we can't get original File back from objectURL reliably.
    // Simplest: show an alert to re-attach file or remove. We'll provide remove and prompt to reupload.
    if (!window.confirm("Retries are supported by re-attaching the file. Remove failed preview?")) {
      return;
    }
    setLocalMessages((lm) => lm.filter((m) => m.id !== localId));
    setUploads((u) => {
      const copy = { ...u };
      delete copy[localId];
      return copy;
    });
  };

  // --- Send text message (works while uploads in progress) ---
  const handleSendText = async () => {
    if (!text.trim()) return;
    const tempId = pushLocalMessage({
      sender: myUid,
      text: text.trim(),
      type: "text",
      createdAt: new Date(),
      status: "sending",
    });
    setText("");
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: myUid,
        text: tempId ? text.trim() : text.trim(),
        type: "text",
        createdAt: serverTimestamp(),
        status: "sent",
      });
      // remove local placeholder (remote listener will pull real message)
      setLocalMessages((lm) => lm.filter((m) => m.id !== tempId));
    } catch (e) {
      console.error("Send text error", e);
      setLocalMessages((lm) => lm.map((m) => (m.id === tempId ? { ...m, status: "error" } : m)));
    }
  };

  // --- Merge messages for rendering and group by day ---
  const allMessages = [...messages, ...localMessages].sort((a, b) => {
    const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt?.getTime?.() || new Date(a.createdAt).getTime();
    const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt?.getTime?.() || new Date(b.createdAt).getTime();
    return aTime - bTime;
  });

  const grouped = [];
  let lastDay = "";
  allMessages.forEach((m) => {
    const d = m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000) : new Date(m.createdAt || Date.now());
    const dayLabel = d.toDateString() === new Date().toDateString() ? "Today" : d.toLocaleDateString();
    if (dayLabel !== lastDay) {
      grouped.push({ type: "day", id: `day-${dayLabel}`, label: dayLabel });
      lastDay = dayLabel;
    }
    grouped.push(m);
  });

  // --- 3-dot menu actions ---
  const toggleBlock = async () => {
    if (!friendInfo) return;
    const friendRef = doc(db, "users", friendInfo.id);
    try {
      // naive toggle: store array field blockedBy in friend doc (or blockedUsers in current user) - adjust to your data model
      const isBlocked = blocked;
      if (!isBlocked) {
        // add myUid to their blockedBy array (optional)
        await updateDoc(friendRef, { blockedBy: (friendInfo.blockedBy || []).concat(myUid) });
        setBlocked(true);
      } else {
        const newBlockedBy = (friendInfo.blockedBy || []).filter((id) => id !== myUid);
        await updateDoc(friendRef, { blockedBy: newBlockedBy });
        setBlocked(false);
      }
      setMenuOpen(false);
    } catch (e) {
      console.error("Block/unblock error", e);
      alert("Error toggling block");
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Clear all messages in this chat? This cannot be undone.")) return;
    try {
      const msgsSnap = await getDocs(collection(db, "chats", chatId, "messages"));
      const batch = writeBatch(db);
      msgsSnap.forEach((d) => batch.delete(doc(db, "chats", chatId, "messages", d.id)));
      await batch.commit();
      // local state cleanup
      setMessages([]);
      setLocalMessages([]);
      setMenuOpen(false);
      scrollToBottom(false);
    } catch (e) {
      console.error("Clear chat error", e);
      alert("Error clearing chat");
    }
  };

  const openSharedMedia = async () => {
    // fetch media messages from firestore (we can show cached state too)
    try {
      const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const media = snap.docs
        .map((d) => d.data())
        .filter((m) => m.fileURL)
        .map((m) => ({ fileName: m.fileName, fileURL: m.fileURL }));
      setSharedMedia(media);
      setMediaModalOpen(true);
      setMenuOpen(false);
    } catch (e) {
      console.error("Fetch media error", e);
      alert("Error fetching media");
    }
  };

  // --- When user clicks avatar to go to profile ---
  const goToProfile = () => {
    if (!friendInfo) return;
    navigate(`/user-profile/${friendInfo.id}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#121212" : "#f5f5f5",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #ddd", position: "sticky", top: 0, zIndex: 5, background: isDark ? "#1a1a1a" : "#fff" }}>
        <button onClick={() => navigate("/chat")} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", marginRight: 8 }}>←</button>

        <img
          src={friendInfo?.photoURL || "/default-avatar.png"}
          alt="avatar"
          onClick={goToProfile}
          style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", cursor: "pointer", border: "2px solid #ddd" }}
        />
        <div style={{ marginLeft: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 16 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</strong>
            {/* three-dot menu toggle */}
            <div style={{ marginLeft: 8, position: "relative" }}>
              <button onClick={() => setMenuOpen((s) => !s)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18 }}>⋮</button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 28, background: isDark ? "#2c2c2c" : "#fff", color: isDark ? "#fff" : "#000", border: "1px solid #ccc", borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", minWidth: 160, zIndex: 50 }}>
                  <button onClick={() => { goToProfile(); setMenuOpen(false); }} style={{ display: "block", width: "100%", padding: "10px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer" }}>View Profile</button>
                  <button onClick={toggleBlock} style={{ display: "block", width: "100%", padding: "10px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer" }}>{blocked ? "Unblock" : "Block"}</button>
                  <button onClick={clearChat} style={{ display: "block", width: "100%", padding: "10px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer" }}>Clear Chat</button>
                  <button onClick={openSharedMedia} style={{ display: "block", width: "100%", padding: "10px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer" }}>Media</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 12, color: isDark ? "#aaa" : "#666" }}>
            {friendTyping ? "typing..." : (friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? `Last seen ${new Date(friendInfo.lastSeen.seconds * 1000).toLocaleString()}` : "Offline"))}
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {grouped.map((item) => {
          if (item.type === "day") {
            return <div key={item.id} style={{ textAlign: "center", color: "#888", margin: "8px 0", fontSize: 12 }}>{item.label}</div>;
          }
          const m = item;
          const mine = m.sender === myUid;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div style={{ background: mine ? (isDark ? "#0b84ff" : "#007bff") : (isDark ? "#2b2b2b" : "#eee"), color: mine ? "#fff" : "#000", padding: "8px 12px", borderRadius: 12, maxWidth: "78%", position: "relative" }}>
                {m.type === "image" && m.fileURL && <img src={m.fileURL} alt="" style={{ width: "100%", borderRadius: 8 }} />}
                {m.type === "file" && m.fileURL && <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007bff", textDecoration: "underline" }}>📎 {m.fileName}</a>}
                {m.type === "text" && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
                {/* status + time */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
                  <small style={{ fontSize: 11, opacity: 0.9 }}>{formatTime(m.createdAt)}</small>
                  <small style={{ fontSize: 12 }}>{m.status === "sending" ? "⌛" : m.status === "sent" ? "✔" : m.status === "delivered" ? "✔✔" : m.status === "seen" ? "✔✔" : ""}</small>
                </div>
                {/* if local error show retry */}
                {m.status === "error" && (
                  <div style={{ marginTop: 6 }}>
                    <small style={{ color: "red" }}>Failed</small>
                    <button onClick={() => retryLocalUpload(m.id)} style={{ marginLeft: 8 }}>Retry</button>
                    <button onClick={() => setLocalMessages((lm) => lm.filter((x) => x.id !== m.id))} style={{ marginLeft: 6 }}>Remove</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* preview thumbnails for selected attachments (scrolls horizontally) */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", overflowX: "auto", background: isDark ? "#111" : "#fff" }}>
          {previews.map((p, i) => (
            <div key={i} style={{ position: "relative" }}>
              {p ? <img src={p} alt="preview" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#f0f0f0" }}>{selectedFiles[i]?.name}</div>}
              <button onClick={() => {
                setSelectedFiles((s) => s.filter((_, idx) => idx !== i));
                setPreviews((s) => s.filter((_, idx) => idx !== i));
              }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", borderRadius: "50%", width: 22, height: 22 }}>✖</button>
            </div>
          ))}
        </div>
      )}

      {/* permanent footer (input + controls). Only this footer is fixed — messages scroll above */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#111" : "#fff", padding: 10, borderTop: "1px solid #ddd", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setPanelOpen((s) => !s)} style={{ padding: 8, borderRadius: 8, border: "none", cursor: "pointer", background: isDark ? "#222" : "#f0f0f0" }}>＋</button>

          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendText(); }} placeholder="Type a message" style={{ flex: 1, padding: "10px 12px", borderRadius: 20, border: "1px solid #ccc", outline: "none", background: isDark ? "#222" : "#fff", color: isDark ? "#fff" : "#000" }} />

          <button onClick={handleSendText} style={{ marginLeft: 8, padding: "10px 14px", borderRadius: 20, border: "none", background: "#34B7F1", color: "#fff", cursor: "pointer" }}>Send</button>
        </div>

        {/* slide-up emoji/attach panel (WhatsApp style) */}
        {panelOpen && (
          <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: isDark ? "#181818" : "#fff", boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SIMPLE_EMOJIS.map((em) => (
                  <button key={em} onClick={() => setText((t) => t + em)} style={{ fontSize: 18, padding: 6, border: "none", background: "transparent", cursor: "pointer" }}>{em}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: isDark ? "#222" : "#fafafa" }}>
                📷 Photo(s)
                <input type="file" accept="image/*" multiple onChange={(e) => handleFilesChosen(e.target.files)} style={{ display: "none" }} />
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: isDark ? "#222" : "#fafafa" }}>
                📎 File(s)
                <input type="file" multiple onChange={(e) => handleFilesChosen(e.target.files)} style={{ display: "none" }} />
              </label>

              <button onClick={() => { setPanelOpen(false); }} style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 8, border: "none", background: "#f0f0f0", cursor: "pointer" }}>Close</button>
            </div>
          </div>
        )}
      </div>

      {/* floating down arrow — visible when user scrolled up */}
      <div style={{ position: "fixed", right: 18, bottom: 100, zIndex: 60 }}>
        <button onClick={() => scrollToBottom(true)} style={{
          opacity: userScrolledUp ? 1 : 0,
          transition: "opacity 200ms",
          pointerEvents: userScrolledUp ? "auto" : "none",
          background: "#34B7F1",
          border: "none",
          color: "#fff",
          padding: 10,
          borderRadius: "50%",
          boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
          cursor: "pointer",
        }}>⬇</button>
      </div>

      {/* media modal */}
      {mediaModalOpen && (
        <div style={{ position: "fixed", left: 0, top: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", zIndex: 90, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: "90%", maxWidth: 720, maxHeight: "80%", overflowY: "auto", borderRadius: 12, background: isDark ? "#111" : "#fff", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Shared Media</h3>
              <button onClick={() => setMediaModalOpen(false)} style={{ border: "none", background: "transparent", fontSize: 20 }}>✖</button>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 12 }}>
              {sharedMedia.length === 0 && <div style={{ color: "#999" }}>No media yet.</div>}
              {sharedMedia.map((m, idx) => (
                <div key={idx} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}>
                  <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <div style={{ height: 100, background: "#f7f7f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={m.fileURL} alt={m.fileName} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ padding: 8, fontSize: 13 }}>{m.fileName}</div>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}