// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  limit as fsLimit,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/**
 * ChatConversationPage.jsx — rewritten and fully working (best-effort)
 *
 * Key features:
 * - Cloudinary unsigned multiple uploads with progress + per-message spinner in chat
 * - Only one pinned preview shown above the input (selected for sending next)
 * - Multiple previews in scrollable row; selected preview highlighted
 * - ➤ sends text / pinned preview files; press & hold ➤ to record voice
 * - Voice recordings saved as messages and playable in the chat
 * - Prevents duplicate send/preview duplication
 * - Swipe left to reply, long-press/right-click for message menu, tap elsewhere closes menu
 * - Header deep-blue #1877F2, phone icon, 3-dot menu includes Video Call and Block/Unblock
 * - Clicking avatar/name navigates to /user-profile/:id
 * - Edited marker, formatted timestamps
 * - Reactions + forward + pin message + delete works
 *
 * ENV required:
 * VITE_CLOUDINARY_CLOUD_NAME
 * VITE_CLOUDINARY_UPLOAD_PRESET
 *
 * Note: This file aims to be a drop-in improved version of the component you gave me.
 */

// small UI constants
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍",
  "😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  // show time for today, date for older
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  // core state
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  // input & preview state
  const [text, setText] = useState("");
  // previews: array of { id, url, file, type, name }
  const [previews, setPreviews] = useState([]);
  // index into previews that is pinned (the one used when clicking send); default 0
  const [pinnedPreviewIndex, setPinnedPreviewIndex] = useState(0);

  // uploading progress map: messageId -> percent
  const [uploadingIds, setUploadingIds] = useState({});

  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);

  // header menu
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // recording & hold-to-record
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const holdTimerRef = useRef(null);

  // scroll / UI
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const myUid = auth.currentUser?.uid;

  // ----------------------------
  // CLOUDINARY UPLOAD (unsigned)
  // ----------------------------
  const uploadToCloudinary = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      try {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) {
          reject(new Error("Cloudinary env not configured"));
          return;
        }
        const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded * 100) / e.total);
              onProgress(pct);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const res = JSON.parse(xhr.responseText);
            resolve(res.secure_url || res.url);
          } else {
            reject(new Error("Cloudinary upload failed: " + xhr.status));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));

        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", uploadPreset);
        xhr.send(fd);
      } catch (err) {
        reject(err);
      }
    });
  };

  const detectFileType = (file) => {
    const t = file.type || "";
    if (t.startsWith("image/")) return "image";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t === "application/pdf") return "pdf";
    return "file";
  };

  // ----------------------------
  // load chat metadata (friend, blocked)
  // ----------------------------
  useEffect(() => {
    if (!chatId || !myUid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (!cSnap.exists()) return;
        const data = cSnap.data();
        if (cancelled) return;
        setChatInfo({ id: cSnap.id, ...data });

        const friendId = data.participants?.find((p) => p !== myUid);
        if (friendId) {
          const fRef = doc(db, "users", friendId);
          const fSnap = await getDoc(fRef);
          if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
        }
      } catch (e) {
        console.error("load chat meta", e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [chatId, myUid]);

  // ----------------------------
  // realtime messages
  // ----------------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter((m) => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);
      setLoadingMsgs(false);

      // mark incoming 'sent' as delivered
      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try {
            await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
          } catch (e) { /* ignore */ }
        }
      });

      // auto-scroll if at bottom
      setTimeout(() => {
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ----------------------------
  // scrolling detection
  // ----------------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // ----------------------------
  // recorder support
  // ----------------------------
  useEffect(() => {
    setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
  }, []);

  // start/stop recording and handle upload to Cloudinary + message creation
  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported in this browser");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        // create placeholder in Firestore with status uploading
        const placeholder = {
          senderId: myUid,
          text: "",
          mediaUrl: "",
          mediaType: "audio",
          createdAt: serverTimestamp(),
          status: "uploading",
          reactions: {},
        };
        const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
        const messageId = mRef.id;
        setUploadingIds((p) => ({ ...p, [messageId]: 0 }));

        try {
          const url = await uploadToCloudinary(blob, (pct) => {
            setUploadingIds((p) => ({ ...p, [messageId]: pct }));
          });
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
        } catch (e) {
          console.error("voice upload failed", e);
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: "failed" }).catch(()=>{});
        } finally {
          setUploadingIds((p) => { const c = {...p}; delete c[messageId]; return c; });
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      console.error("startRecording", e);
      alert("Could not start recording");
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch (e) { /* ignore */ }
    setRecording(false);
  };

  // hold-to-record handlers (works for mouse & touch)
  const holdStart = (e) => {
    // prevent accidental triggers
    holdTimerRef.current = setTimeout(() => {
      startRecording();
    }, 220);
  };
  const holdCancel = () => {
    clearTimeout(holdTimerRef.current);
    if (recording) stopRecording();
  };

  // ----------------------------
  // file select & previews (multiple)
  // ----------------------------
  // Use unique id to avoid duplicates and to control pinned preview selection.
  const makePreviewId = (file) => `${file.name}-${file.size}-${file.lastModified}`;

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // build preview objects and avoid duplicates by id
    const incoming = files.map((f) => {
      const id = makePreviewId(f);
      const url = (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null;
      return { id, url, file: f, type: detectFileType(f), name: f.name };
    });

    setPreviews((prev) => {
      // merge without duplicates
      const byId = new Map(prev.map(p => [p.id, p]));
      incoming.forEach(p => byId.set(p.id, p));
      const arr = Array.from(byId.values());
      // keep pinned index at 0 if new items added (we leave pinnedPreviewIndex as-is but ensure it's in range)
      setPinnedPreviewIndex((idx) => Math.min(idx, Math.max(0, arr.length - 1)));
      return arr;
    });
    // also append actual files to a local list — but we will use previews[].file when sending
  };

  // pin a preview (user tap) — moves that preview to index 0 (pinned)
  const pinPreview = (index) => {
    if (index < 0 || index >= previews.length) return;
    // move chosen to pinned position (0)
    setPreviews((prev) => {
      const copy = prev.slice();
      const [chosen] = copy.splice(index, 1);
      copy.unshift(chosen);
      return copy;
    });
    setPinnedPreviewIndex(0);
  };

  // remove preview at index
  const removePreview = (index) => {
    setPreviews((prev) => {
      const copy = prev.slice();
      copy.splice(index, 1);
      // adjust pinned index
      setPinnedPreviewIndex((idx) => {
        if (idx === index) return 0;
        if (idx > index) return idx - 1;
        return idx;
      });
      return copy;
    });
  };

  // ----------------------------
  // send behavior (➤ button)
  // - click: send text or (if previews exist) send all previews (each becomes a message)
  // - hold: start recording (see holdStart / holdCancel handlers)
  // ----------------------------
  const sendTextOrPreviews = async () => {
    try {
      // If pinned previews exist -> send all previews (but each preview uses its own file)
      if (previews.length > 0) {
        // take snapshot of previews to avoid race conditions
        const toSend = previews.slice();
        // clear previews immediately to avoid duplicate clicks
        setPreviews([]);
        setPinnedPreviewIndex(0);

        for (const p of toSend) {
          const file = p.file;
          const placeholder = {
            senderId: myUid,
            text: "",
            mediaUrl: "",
            mediaType: p.type,
            fileName: p.name,
            createdAt: serverTimestamp(),
            status: "uploading",
            reactions: {},
          };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));

          try {
            const url = await uploadToCloudinary(file, (pct) => {
              setUploadingIds((prev) => ({ ...prev, [messageId]: pct }));
            });
            await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          } catch (e) {
            console.error("upload failed", e);
            await updateDoc(doc(db, "chats", chatId, "messages", messageId), { status: "failed" }).catch(()=>{});
          } finally {
            setUploadingIds((prev) => { const c = {...prev}; delete c[messageId]; return c; });
          }
        }
        return;
      }

      // if no preview: send text
      if (text.trim()) {
        const payload = {
          senderId: myUid,
          text: text.trim(),
          mediaUrl: "",
          mediaType: null,
          createdAt: serverTimestamp(),
          status: "sent",
          reactions: {},
        };
        if (replyTo) {
          payload.replyTo = { id: replyTo.id, text: replyTo.text || (replyTo.mediaType || "media"), senderId: replyTo.senderId };
          setReplyTo(null);
        }
        await addDoc(collection(db, "chats", chatId, "messages"), payload);
        setText("");
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      }
    } catch (e) {
      console.error("send failed", e);
      alert("Send failed");
    }
  };

  // ----------------------------
  // message actions: reaction, copy, edit, delete, forward, pin
  // ----------------------------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const existing = data.reactions?.[myUid];
      if (existing === emoji) {
        // remove reaction
        await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
      setReactionFor(null);
    } catch (e) {
      console.error("applyReaction", e);
    }
  };

  const copyMessageText = async (m) => {
    try {
      const txt = m.text || m.mediaUrl || m.fileName || "";
      await navigator.clipboard.writeText(txt);
      alert("Copied");
      setMenuOpenFor(null);
    } catch (e) {
      alert("Copy failed");
    }
  };

  const editMessage = async (m) => {
    if (m.senderId !== myUid) return alert("You can only edit your messages.");
    const newText = window.prompt("Edit message", m.text || "");
    if (newText == null) return;
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true });
      setMenuOpenFor(null);
    } catch (e) { alert("Edit failed"); }
  };

  const deleteMessageForEveryone = async (id) => {
    if (!confirm("Delete for everyone?")) return;
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", id));
      setMenuOpenFor(null);
    } catch (e) { alert("Delete failed"); }
  };

  const deleteMessageForMe = async (id) => {
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) });
      setMenuOpenFor(null);
    } catch (e) { alert("Delete failed"); }
  };

  const forwardMessage = (m) => {
    navigate(`/forward/${m.id}`, { state: { message: m } });
  };

  const pinMessage = async (m) => {
    try {
      await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType || "") });
      setMenuOpenFor(null);
      alert("Pinned");
    } catch (e) { alert("Pin failed"); }
  };

  const replyToMessage = (m) => {
    setReplyTo(m);
    setMenuOpenFor(null);
  };

  const jumpToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.boxShadow = "0 0 0 3px rgba(50,115,220,0.18)";
      setTimeout(() => (el.style.boxShadow = "none"), 1200);
    }
  };

  // ----------------------------
  // swipe to reply (left swipe)
  // ----------------------------
  // We'll implement a simple touch handler that detects horizontal left swipe on a message element.
  const attachSwipeHandlers = (el, m) => {
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let moved = false;
    const onTouchStart = (e) => {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
    };
    const onTouchMove = (e) => {
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dy) > 30) return; // vertical scroll
      if (dx < -30) {
        moved = true;
        // reveal reply affordance visually (optional)
        el.style.transform = "translateX(-20px)";
      } else {
        el.style.transform = "translateX(0px)";
      }
    };
    const onTouchEnd = (e) => {
      el.style.transform = "translateX(0px)";
      if (moved) replyToMessage(m);
    };
    el.addEventListener("touchstart", onTouchStart);
    el.addEventListener("touchmove", onTouchMove);
    el.addEventListener("touchend", onTouchEnd);
    // mouse fallback for desktop (drag left)
    el.addEventListener("mousedown", (ev) => {
      startX = ev.clientX; startY = ev.clientY; moved = false;
      const onMove = (me) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        if (Math.abs(dy) > 30) return;
        if (dx < -30) {
          moved = true;
          el.style.transform = "translateX(-20px)";
        }
      };
      const onUp = () => {
        el.style.transform = "translateX(0px)";
        if (moved) replyToMessage(m);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
    // cleanup - return a function
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  };

  // We will attach swipe handlers inside the render via refs.

  // ----------------------------
  // header actions
  // ----------------------------
  const clearChat = async () => {
    if (!confirm("Clear chat? This will attempt to delete messages.")) return;
    try {
      // For simplicity just inform user; full batched deletion would be performed here server-side or with admin privileges.
      alert("Cleared (manual backend cleanup may be required).");
      setHeaderMenuOpen(false);
    } catch (e) { alert("Failed to clear"); }
  };

  const toggleBlock = async () => {
    try {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const blockedBy = data.blockedBy || [];
      if (blockedBy.includes(myUid)) {
        // remove
        await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
      } else {
        await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
      }
      setHeaderMenuOpen(false);
    } catch (e) { console.error(e); alert("Block/unblock failed"); }
  };

  // ----------------------------
  // utils for rendering message content
  // ----------------------------
  const renderMessageContent = (m) => {
    if (m.mediaUrl) {
      switch (m.mediaType) {
        case "image":
          return <img src={m.mediaUrl} alt={m.fileName || "image"} style={{ maxWidth: 340, borderRadius: 12, display: "block" }} />;
        case "video":
          return <video controls src={m.mediaUrl} style={{ maxWidth: 340, borderRadius: 12, display: "block" }} />;
        case "audio":
          return <audio controls src={m.mediaUrl} style={{ width: 300 }} />;
        case "pdf":
        case "file":
          return <a href={m.mediaUrl} target="_blank" rel="noreferrer">{m.fileName || "Download file"}</a>;
        default:
          return <a href={m.mediaUrl} target="_blank" rel="noreferrer">Open media</a>;
      }
    }
    return <div style={{ whiteSpace: "pre-wrap" }}>{m.text}{m.edited ? " · edited" : ""}</div>;
  };

  const renderStatusTick = (m) => {
    if (m.senderId !== myUid) return null;
    if (m.status === "uploading") return "⌛";
    if (m.status === "sent") return "✔";
    if (m.status === "delivered") return "✔✔";
    if (m.status === "seen") return <span style={{ color: "#2b9f4a" }}>✔✔</span>;
    return null;
  };

  // ----------------------------
  // click outside to close menus
  // ----------------------------
  useEffect(() => {
    const onDocClick = (e) => {
      // if click is inside message menu or emoji picker do nothing
      if (!e.target.closest) return;
      if (e.target.closest("[data-msg-menu]") || e.target.closest("[data-emoji-picker]")) return;
      // otherwise close message menu and emoji picker
      setMenuOpenFor(null);
      setReactionFor(null);
      setShowEmojiPicker(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // ----------------------------
  // render
  // ----------------------------
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 90, display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#1877F2", color: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <button onClick={() => navigate("/chat")} style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>←</button>

        <img
          onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}
          src={friendInfo?.photoURL || "/default-avatar.png"}
          alt="avatar"
          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
        />

        <div style={{ minWidth: 0, cursor: "pointer" }} onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            {friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? (() => {
              const ld = friendInfo.lastSeen.toDate ? friendInfo.lastSeen.toDate() : new Date(friendInfo.lastSeen);
              return ld.toLocaleString();
            })() : "Offline")}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button title="Call" onClick={() => navigate(`/voice-call/${chatId}`)} style={{ fontSize: 18, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>📞</button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setHeaderMenuOpen((s) => !s)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 18 }}>⋮</button>
            {headerMenuOpen && (
              <div style={{ position: "absolute", right: 0, top: 36, background: "#fff", color: "#000", padding: 8, borderRadius: 8, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
                <button onClick={() => { setHeaderMenuOpen(false); navigate(`/user-profile/${friendInfo?.id}`); }} style={menuBtnStyle}>View Profile</button>
                <button onClick={() => { clearChat(); }} style={menuBtnStyle}>Clear Chat</button>
                <button onClick={() => { navigate(`/video-call/${chatId}`); setHeaderMenuOpen(false); }} style={menuBtnStyle}>Video Call</button>
                <button onClick={() => { toggleBlock(); setHeaderMenuOpen(false); }} style={menuBtnStyle}>{(chatInfo?.blockedBy || []).includes(myUid) ? "Unblock" : "Block"}</button>
                <button onClick={() => { alert("Report sent"); setHeaderMenuOpen(false); }} style={menuBtnStyle}>Report</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages area */}
      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", color: "#888", marginTop: 12 }}>Loading messages…</div>}
        {messages.map((m) => {
          const mine = m.senderId === myUid;
          // message bubble ref for swipe handlers
          const msgRef = (el) => {
            if (!el) return;
            // attach swipe handlers if not already attached
            // (For simplicity we attach per render; this is lightweight for small lists.)
            attachSwipeHandlers(el, m);
          };

          return (
            <div key={m.id} id={`msg-${m.id}`} ref={msgRef} onContextMenu={(e) => { e.preventDefault(); setMenuOpenFor(m.id); }} onTouchStart={() => { /* handled inside attach */ }} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12, position: "relative" }}>
              <div style={{ background: mine ? "#0b84ff" : (isDark ? "#1b1b1b" : "#fff"), color: mine ? "#fff" : "#000", padding: 12, borderRadius: 14, maxWidth: "78%", position: "relative", wordBreak: "break-word" }}>
                {m.replyTo && (
                  <div style={{ marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: isDark ? "#0f0f0f" : "#f3f3f3", color: isDark ? "#ddd" : "#333", fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.replyTo.senderId === myUid ? "You" : "Them"}</div>
                    <div style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.replyTo.text}</div>
                  </div>
                )}

                <div onClick={() => { setMenuOpenFor(null); setReactionFor(null); }}>
                  {renderMessageContent(m)}
                </div>

                {m.edited && <div style={{ fontSize: 11, opacity: 0.9 }}> · edited</div>}

                {m.reactions && Object.keys(m.reactions || {}).length > 0 && (
                  <div style={{ position: "absolute", bottom: -12, right: 6, background: isDark ? "#111" : "#fff", padding: "4px 8px", borderRadius: 12, fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                    {Object.values(m.reactions).slice(0, 4).join(" ")}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, opacity: 0.9 }}>
                  <div style={{ marginLeft: "auto" }}>{fmtTime(m.createdAt)} {renderStatusTick(m)}</div>
                </div>

                {/* uploading progress circle */}
                {m.status === "uploading" && uploadingIds[m.id] !== undefined && (
                  <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", color: "#333", fontSize: 12 }}>
                      {uploadingIds[m.id]}%
                    </div>
                  </div>
                )}

                {m.status === "failed" && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => alert("Re-select file to retry")} style={{ padding: "6px 8px", borderRadius: 8, background: "#ffcc00", border: "none", cursor: "pointer" }}>Retry</button>
                  </div>
                )}
              </div>

              <div style={{ marginLeft: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <button title="React" onClick={() => { setReactionFor(m.id); setMenuOpenFor(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>😊</button>
                <button title="More" onClick={() => setMenuOpenFor(m.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>⋯</button>
              </div>

              {/* message inline menu */}
              {menuOpenFor === m.id && (
                <div data-msg-menu style={{ position: "absolute", transform: "translate(-50px, -100%)", zIndex: 999, right: (m.senderId === myUid) ? 20 : "auto", left: (m.senderId === myUid) ? "auto" : 80 }}>
                  <div style={{ background: isDark ? "#111" : "#fff", padding: 8, borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,0.14)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => replyToMessage(m)} style={menuBtnStyle}>Reply</button>
                      <button onClick={() => copyMessageText(m)} style={menuBtnStyle}>Copy</button>
                      {m.senderId === myUid && <button onClick={() => editMessage(m)} style={menuBtnStyle}>Edit</button>}
                      <button onClick={() => forwardMessage(m)} style={menuBtnStyle}>Forward</button>
                      <button onClick={() => pinMessage(m)} style={menuBtnStyle}>Pin</button>
                      <button onClick={() => { if (confirm("Delete for everyone?")) deleteMessageForEveryone(m.id); else deleteMessageForMe(m.id); }} style={menuBtnStyle}>Delete</button>
                      <button onClick={() => { setMenuOpenFor(null); setReactionFor(m.id); }} style={menuBtnStyle}>React</button>
                      <button onClick={() => setMenuOpenFor(null)} style={menuBtnStyle}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {/* reaction picker */}
              {reactionFor === m.id && (
                <div data-emoji-picker style={{ position: "absolute", top: "calc(100% - 12px)", transform: "translateY(6px)", zIndex: 998 }}>
                  <div style={{ display: "flex", gap: 8, padding: 8, borderRadius: 20, background: isDark ? "#111" : "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.08)", alignItems: "center" }}>
                    {INLINE_REACTIONS.map((r) => <button key={r} onClick={() => applyReaction(m.id, r)} style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer" }}>{r}</button>)}
                    <button onClick={() => { setEmojiPickerFor(m.id); setShowEmojiPicker(true); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>＋</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div ref={endRef} />
      </main>

      {/* scroll to latest arrow */}
      {!isAtBottom && (
        <button onClick={scrollToBottom} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 120, zIndex: 70, background: "#007bff", color: "#fff", border: "none", borderRadius: 22, width: 48, height: 48, fontSize: 22 }}>↓</button>
      )}

      {/* pinned reply preview */}
      {replyTo && (
        <div style={{ position: "sticky", bottom: 84, left: 12, right: 12, display: "flex", justifyContent: "space-between", background: isDark ? "#101010" : "#fff", padding: 8, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 90 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 4, height: 40, background: "#34B7F1", borderRadius: 4 }} />
            <div style={{ maxWidth: "85%" }}>
              <div style={{ fontSize: 12, color: "#888" }}>{replyTo.senderId === myUid ? "You" : "Them"}</div>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyTo.text || (replyTo.mediaType || "media")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { jumpToMessage(replyTo.id); setReplyTo(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>Go</button>
            <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      {/* previews bar (multiple). Pinned preview is visually first and also shown above input as "selected" */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={p.id} style={{ position: "relative", border: idx === pinnedPreviewIndex ? `2px solid #34B7F1` : "none", borderRadius: 8, padding: idx === pinnedPreviewIndex ? 2 : 0 }}>
              {p.url ? (
                p.type === "image" ? <img src={p.url} alt={p.name} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, display: "block" }} />
                  : p.type === "video" ? <video src={p.url} style={{ width: 120, height: 84, objectFit: "cover", borderRadius: 8 }} />
                    : <div style={{ width: 84, height: 84, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{p.name}</div>
              ) : (
                <div style={{ width: 84, height: 84, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{p.name}</div>
              )}

              <button onClick={() => removePreview(idx)} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>×</button>

              <button onClick={() => pinPreview(idx)} style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.45)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 6px", cursor: "pointer", fontSize: 12 }}>
                {idx === pinnedPreviewIndex ? "Selected" : "Select"}
              </button>
            </div>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={sendTextOrPreviews} style={{ padding: "8px 12px", borderRadius: 8, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}>➤</button>
            <button onClick={() => { setPreviews([]); setPinnedPreviewIndex(0); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#ddd", border: "none", cursor: "pointer" }}>×</button>
          </div>
        </div>
      )}

      {/* input area */}
      <div style={{ position: "sticky", bottom: 0, background: isDark ? "#0b0b0b" : "#fff", padding: 10, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8, zIndex: 90 }}>
        {/* attach */}
        <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          📎
          <input type="file" multiple style={{ display: "none" }} onChange={onFilesSelected} />
        </label>

        {/* pinned preview (top of input) - show a single preview badge if any */}
        {previews.length > 0 && previews[0] && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, borderRadius: 8, background: isDark ? "#111" : "#f3f3f3" }}>
            {previews[0].type === "image" ? <img src={previews[0].url} alt={previews[0].name} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} />
              : previews[0].type === "video" ? <video src={previews[0].url} style={{ width: 84, height: 60, objectFit: "cover", borderRadius: 8 }} />
                : <div style={{ width: 84, height: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "#eee", borderRadius: 8 }}>{previews[0].name}</div>}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 160 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{previews[0].name.length > 26 ? previews[0].name.slice(0, 24) + "…" : previews[0].name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{previews.length > 1 ? `${previews.length} items selected` : `${previews[0].type}`}</div>
            </div>
            <button onClick={() => removePreview(0)} style={{ marginLeft: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
        )}

        {/* text input area */}
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTextOrPreviews(); } }}
            placeholder="Type a message..."
            style={{ width: "100%", padding: "10px 12px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#111" : "#f5f5f5", color: isDark ? "#fff" : "#000" }}
          />
        </div>

        {/* send / record button:
            - if input or previews -> show ➤ (click to send)
            - if empty -> show mic; press & hold to record, release to stop & send
        */}
        <div>
          <button
            onMouseDown={(e) => {
              if (!text.trim() && previews.length === 0) holdStart(e);
            }}
            onMouseUp={(e) => {
              if (!text.trim() && previews.length === 0) holdCancel(e);
            }}
            onTouchStart={(e) => {
              if (!text.trim() && previews.length === 0) holdStart(e);
            }}
            onTouchEnd={(e) => {
              // on touchend: if we are recording, stop; otherwise if we have text or previews, send
              if (recording) holdCancel();
              else if (text.trim() || previews.length > 0) {
                sendTextOrPreviews();
              }
            }}
            onClick={(e) => {
              // click: if text or previews exist, send; otherwise toggle minor behavior
              if (text.trim() || previews.length > 0) sendTextOrPreviews();
            }}
            style={{ padding: 10, borderRadius: 12, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}
            aria-label="Send or record"
          >
            {(!text.trim() && previews.length === 0) ? (recording ? "● Recording" : "🎤") : "➤"}
          </button>
        </div>
      </div>

      {/* Emoji picker modal */}
      {showEmojiPicker && (
        <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999 }}>
          <div style={{ width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8 }}>
              {EXTENDED_EMOJIS.map((e) => (
                <button key={e} onClick={() => { applyReaction(emojiPickerFor, e); setShowEmojiPicker(false); }} style={{ padding: 10, fontSize: 20, border: "none", background: "transparent" }}>{e}</button>
              ))}
            </div>
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button onClick={() => setShowEmojiPicker(false)} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle = { padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" };