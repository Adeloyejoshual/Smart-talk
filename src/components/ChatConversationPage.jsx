// File: src/components/ChatConversationPage.jsx
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

/* Components (you created these) */
import Header from "./Chat/Header";
import ThreeDotMenu from "./Chat/ThreeDotMenu";
import LongPressToolbar from "./Chat/LongPressToolbar";
import MessageList from "./Chat/MessageList";
import MessageInput from "./Chat/MessageInput";
import VoiceNotePlayer from "./Chat/VoiceNotePlayer";
import ImagePreview from "./Chat/ImagePreview";
import MessageDayDivider from "./Chat/MessageDayDivider";
import MessageBubble from "./Chat/MessageBubble";

/* Popups & small UIs */
import ArchiveConfirmation from "./Chat/ArchiveConfirmation";
import ArchivePopup from "./Chat/ArchivePopup";
import BlockPopup from "./Chat/BlockPopup";
import BlockedBanner from "./Chat/BlockedBanner";
import DeleteMessagePopup from "./Chat/DeleteMessagePopup";
import DeletePopup from "./Chat/DeletePopup";
import ForwardMessage from "./Chat/ForwardMessage";
import ForwardMessagePopup from "./Chat/ForwardMessagePopup";
import ForwardPage from "./Chat/ForwardPage";
import ForwardPopup from "./Chat/ForwardPopup";
import MutePopup from "./Chat/MutePopup";
import PinBanner from "./Chat/PinBanner";
import ProfessionalPopup from "./Chat/ProfessionalPopup";
import ReportPopup from "./Chat/ReportPopup";
import ReportUserPopup from "./Chat/ReportUserPopup";
import SearchBar from "./Chat/SearchBar";
import SearchMessages from "./Chat/SearchMessages";
import SearchResults from "./Chat/SearchResults";
import UpdatePinPopup from "./Chat/UpdatePinPopup";

/* Styles note:
   If you have a global CSS file (e.g. src/styles/chat.css) import it in your root or here:
   import '../styles/chat.css';
   Or keep styling in each component as you already have.
*/

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  // chat state
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  // input + preview state
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [uploadingIds, setUploadingIds] = useState({});

  // UI state
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null); // message id
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerMenuExpanded, setHeaderMenuExpanded] = useState(false);
  const [reactionFor, setReactionFor] = useState(null);
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // recorder
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);

  // popups
  const [showArchivePopup, setShowArchivePopup] = useState(false);
  const [showBlockPopup, setShowBlockPopup] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [showDeleteMessagePopup, setShowDeleteMessagePopup] = useState(false);
  const [showForwardPopup, setShowForwardPopup] = useState(false);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [showReportUserPopup, setShowReportUserPopup] = useState(false);
  const [showMutePopup, setShowMutePopup] = useState(false);
  const [showPinBanner, setShowPinBanner] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // small flags loaded from chat doc
  const [muted, setMuted] = useState(false);
  const [archived, setArchived] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [blocked, setBlocked] = useState(false);

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
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // ---------- load chat & friend ----------
  useEffect(() => {
    if (!chatId) return;
    let unsub = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });
          setMuted((data.mutedFor || []).includes(myUid));
          setArchived((data.archivedBy || []).includes(myUid));
          setPinned(Boolean(data.pinnedChatFor && data.pinnedChatFor.includes(myUid)));
          setBlocked((data.blockedBy || []).includes(myUid));
          // friend detection
          const friendId = data.participants?.find(p => p !== myUid);
          if (friendId) {
            const fRef = doc(db, "users", friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
            else setFriendInfo({ id: friendId });
          }
        }
        unsub = onSnapshot(cRef, s => {
          if (s.exists()) {
            const d = s.data();
            setChatInfo(prev => ({ ...(prev || {}), ...d }));
            setMuted((d.mutedFor || []).includes(myUid));
            setArchived((d.archivedBy || []).includes(myUid));
            setPinned(Boolean(d.pinnedChatFor && d.pinnedChatFor.includes(myUid)));
            setBlocked((d.blockedBy || []).includes(myUid));
          }
        });
      } catch (err) {
        console.error("loadMeta error", err);
      }
    };

    loadMeta();
    return () => { if (unsub) unsub(); };
  }, [chatId, myUid]);

  // ---------- messages realtime ----------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter(m => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);
      // mark delivered
      filtered.forEach(async m => {
        if (m.senderId !== myUid && m.status === "sent") {
          try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" }); } catch (e) {}
        }
      });
      setLoadingMsgs(false);
      // autoscroll if at bottom
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- scrolling detection ----------
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

  // ---------- mark seen ----------
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].slice().reverse().find(m => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        try { await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" }); } catch (e) {}
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [messages, chatId, myUid]);

  // ---------- recorder availability ----------
  useEffect(() => { setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder)); }, []);

  // ---------- file select & previews ----------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map(f => ({
      url: (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null,
      type: f.type,
      name: f.name,
      file: f
    }));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setSelectedPreviewIndex(prev => prev >= 0 ? prev : 0);
  };

  // ---------- send message (files or text) ----------
  const sendTextMessage = async () => {
    // blocked?
    const blockedBy = chatInfo?.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      alert("You are blocked in this chat. You cannot send messages.");
      return;
    }

    // handle files
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = {
            senderId: myUid,
            text: "",
            mediaUrl: "",
            mediaType: file.type.split("/")[0],
            fileName: file.name,
            createdAt: serverTimestamp(),
            status: "uploading",
            reactions: {},
          };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          // YOU: upload to storage/cloudinary here and then update mediaUrl and status
          // Example placeholder (no upload implemented here)
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: "", status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
        } catch (err) {
          console.error("upload error:", err);
        }
      }
      return;
    }

    // text
    if (text.trim()) {
      try {
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
      } catch (e) {
        console.error(e); alert("Failed to send");
      }
    }
  };

  // ---------- recording ----------
  const startRecording = async () => {
    if (!recorderAvailable) return alert("Recording not supported in this browser");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: "audio/webm" });
        try {
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
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          // upload blob to storage/cloud and update message.mediaUrl & status
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: "", status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
        } catch (err) {
          console.error("voice upload failed", err);
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error(err); alert("Could not start recording");
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    } catch (e) {}
    setRecording(false);
  };

  // ---------- message actions ----------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const existing = data.reactions?.[myUid];
      if (existing === emoji) await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      else await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      setReactionFor(null);
    } catch (e) { console.error(e); }
  };

  const copyMessageText = async (m) => {
    try { await navigator.clipboard.writeText(m.text || m.mediaUrl || ""); alert("Copied"); setMenuOpenFor(null); }
    catch (e) { alert("Copy failed"); }
  };

  const editMessage = async (m) => {
    if (m.senderId !== myUid) return alert("You can only edit your messages.");
    const newText = window.prompt("Edit message", m.text || "");
    if (newText == null) return;
    await updateDoc(doc(db, "chats", chatId, "messages", m.id), { text: newText, edited: true });
    setMenuOpenFor(null);
  };

  const deleteMessageForEveryone = async (id) => {
    if (!confirm("Delete for everyone?")) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", id));
    setMenuOpenFor(null);
  };
  const deleteMessageForMe = async (id) => {
    await updateDoc(doc(db, "chats", chatId, "messages", id), { deletedFor: arrayUnion(myUid) });
    setMenuOpenFor(null);
  };

  const forwardMessage = (m) => {
    setShowForwardPopup(true);
    // Forward popup component should read the provided message via prop or shared context
  };

  const pinMessage = async (m) => {
    await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id, pinnedMessageText: m.text || (m.mediaType || "") });
    setShowPinBanner(true);
    setMenuOpenFor(null);
  };

  const replyToMessage = (m) => {
    setReplyTo(m);
    setMenuOpenFor(null);
  };

  // ---------- header actions ----------
  const openProfile = () => {
    if (!friendInfo?.id) return alert("Profile not found");
    navigate(`/profile/${friendInfo.id}`);
    setHeaderMenuOpen(false);
  };
  const startVoiceCall = () => { if (!friendInfo?.id) return alert("User not available"); navigate(`/voicecall/${friendInfo.id}`); };
  const startVideoCall = () => { if (!friendInfo?.id) return alert("User not available"); navigate(`/videocall/${friendInfo.id}`); };

  // header menu actions (primary + more)
  const headerPrimary = [
    { id: "view-profile", label: "View Profile", action: openProfile },
    { id: "mute", label: muted ? "Unmute Notifications" : "Mute Notifications", action: () => setShowMutePopup(true) },
    { id: "block", label: blocked ? "Unblock User" : "Block User", action: () => setShowBlockPopup(true) },
    { id: "delete", label: "Delete Chat", action: async () => { if (!confirm("Delete chat?")) return; const msgsRef = collection(db, "chats", chatId, "messages"); const snap = await getDocs(query(msgsRef, orderBy("createdAt", "asc"))); for (const d of snap.docs) { try { await deleteDoc(d.ref); } catch (e) {} } await deleteDoc(doc(db, "chats", chatId)); navigate("/chat"); } },
    { id: "clear", label: "Clear Messages", action: async () => { if (!confirm("Clear chat?")) return; const msgsRef = collection(db, "chats", chatId, "messages"); const snap = await getDocs(query(msgsRef, orderBy("createdAt", "asc"))); for (const d of snap.docs) { try { await deleteDoc(d.ref); } catch (e) {} } } },
    { id: "archive", label: archived ? "Unarchive Chat" : "Archive Chat", action: () => setShowArchivePopup(true) }
  ];
  const headerMore = [
    { id: "search", label: "Search", action: () => setSearchOpen(true) },
    { id: "wallpaper", label: "Wallpaper / Theme", action: () => alert("Wallpaper picker not implemented") },
    { id: "report", label: "Report", action: () => setShowReportUserPopup(true) }
  ];

  // ---------- UI render ----------
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"),
      color: isDark ? "#fff" : "#000"
    }}>
      {/* Header */}
      <Header
        friendInfo={friendInfo}
        onBack={() => navigate("/chat")}
        onOpenProfile={openProfile}
        onVoiceCall={startVoiceCall}
        onVideoCall={startVideoCall}
        onOpenMenu={() => { setHeaderMenuOpen(s => !s); setHeaderMenuExpanded(false); }}
        isDark={isDark}
      />

      {/* header 3-dot menu anchored */}
      <div style={{ position: "relative" }}>
        {headerMenuOpen && (
          <div style={{ position: "absolute", right: 12, top: 8 }}>
            <ThreeDotMenu
              open={headerMenuOpen}
              primaryActions={headerPrimary}
              moreActions={headerMore}
              onClose={() => setHeaderMenuOpen(false)}
              expanded={headerMenuExpanded}
              setExpanded={setHeaderMenuExpanded}
            />
          </div>
        )}
      </div>

      {/* optional banners */}
      {blocked && <BlockedBanner onUnblock={() => setShowBlockPopup(true)} />}
      {showPinBanner && <PinBanner onClose={() => setShowPinBanner(false)} />}

      {/* Search overlay */}
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} onSearch={(term) => { /* implement search - you have SearchMessages component */ }} />}

      {/* Messages */}
      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", color: "#888", marginTop: 12 }}>Loading messages…</div>}

        {/* message list component will render day dividers / bubbles */}
        <MessageList
          messages={messages}
          myUid={myUid}
          friendInfo={friendInfo}
          isDark={isDark}
          onLongPress={(m, e) => { /* long press -> show reactions toolbar near bottom */ setReactionFor(m.id); }}
          onOpenMenu={(m) => setMenuOpenFor(m.id)}
          onReact={(m) => setReactionFor(m.id)}
        />

        <div ref={endRef} />
      </main>

      {/* floating "scroll to bottom" */}
      {!isAtBottom && (
        <button onClick={() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); }} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 120, zIndex: 80, background: "#007bff", color: "#fff", border: "none", borderRadius: 22, width: 48, height: 48, fontSize: 22 }}>↓</button>
      )}

      {/* pinned reply preview */}
      {replyTo && (
        <div style={{ position: "sticky", bottom: 84, left: 12, right: 12, display: "flex", justifyContent: "space-between", background: isDark ? "#101010" : "#fff", padding: 8, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 90 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 4, height: 40, background: "#34B7F1", borderRadius: 4 }} />
            <div style={{ maxWidth: "85%" }}>
              <div style={{ fontSize: 12, color: "#888" }}>{replyTo.senderId === myUid ? "You" : "Them"}</div>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyTo.text || (replyTo.mediaType || 'media')}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { const id = replyTo.id; const el = document.getElementById(`msg-${id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); setReplyTo(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>Go</button>
            <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      {/* previews strip */}
      {previews.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: 8, overflowX: "auto", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", background: isDark ? "#0b0b0b" : "#fff" }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: "relative", cursor: "pointer", border: idx === selectedPreviewIndex ? `2px solid #34B7F1` : "none", borderRadius: 8 }}>
              {p.url ? (p.type.startsWith("image/") ? <img onClick={() => setSelectedPreviewIndex(idx)} src={p.url} alt={p.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} /> : <video onClick={() => setSelectedPreviewIndex(idx)} src={p.url} style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 8 }} />) : (<div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#eee" }}>{p.name}</div>)}
              <button onClick={() => { setSelectedFiles(sf => sf.filter((_,i) => i !== idx)); setPreviews(ps => { const copy = ps.filter((_,i) => i !== idx); setSelectedPreviewIndex(prev => Math.max(0, Math.min(prev, copy.length - 1))); return copy; }); }} style={{ position: "absolute", top: -6, right: -6, background: "#ff4d4f", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", cursor: "pointer" }}>×</button>
            </div>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={sendTextMessage} style={{ padding: "8px 12px", borderRadius: 8, background: "#34B7F1", color: "#fff", border: "none", cursor: "pointer" }}>➤</button>
            <button onClick={() => { setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#ddd", border: "none", cursor: "pointer" }}>×</button>
          </div>
        </div>
      )}

      {/* Message input */}
      <MessageInput
        text={text}
        setText={setText}
        onAttach={(e) => onFilesSelected(e)}
        onSend={sendTextMessage}
        previews={previews}
        setPreviews={setPreviews}
        startRecording={startRecording}
        recording={recording}
        stopRecording={stopRecording}
      />

      {/* Long-press reactions toolbar */}
      <LongPressToolbar open={!!reactionFor} onSelectReaction={(r) => { if (reactionFor) applyReaction(reactionFor, r); setReactionFor(null); }} reactions={INLINE_REACTIONS} onClose={() => setReactionFor(null)} />

      {/* emoji picker (if you have a component you can replace this) */}
      {emojiPickerOpen && (
        <div style={{ position: "fixed", left: 0, right: 0, top: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999 }}>
          <div style={{ width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto" }}>
            {/* simple emoji grid */}
            {["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎"].map(e => <button key={e} onClick={() => { if (emojiPickerFor) applyReaction(emojiPickerFor, e); setEmojiPickerOpen(false); }} style={{ fontSize: 20, padding: 8, border: "none", background: "transparent" }}>{e}</button>)}
            <div style={{ textAlign: "right", marginTop: 8 }}><button onClick={() => setEmojiPickerOpen(false)} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd" }}>Close</button></div>
          </div>
        </div>
      )}

      {/* Popups - render each popup and control visibility */}
      {showArchivePopup && <ArchivePopup onClose={() => setShowArchivePopup(false)} onConfirm={() => { /* implement archive logic */ setShowArchivePopup(false); }} />}
      {showBlockPopup && <BlockPopup onClose={() => setShowBlockPopup(false)} onConfirm={() => { /* implement block logic */ setShowBlockPopup(false); }} />}
      {showDeletePopup && <DeletePopup onClose={() => setShowDeletePopup(false)} onConfirm={() => { /* delete chat */ setShowDeletePopup(false); }} />}
      {showDeleteMessagePopup && <DeleteMessagePopup onClose={() => setShowDeleteMessagePopup(false)} onConfirm={() => { /* delete message */ setShowDeleteMessagePopup(false); }} />}
      {showForwardPopup && <ForwardMessagePopup onClose={() => setShowForwardPopup(false)} />}
      {showReportPopup && <ReportPopup onClose={() => setShowReportPopup(false)} />}
      {showReportUserPopup && <ReportUserPopup onClose={() => setShowReportUserPopup(false)} onConfirm={() => { /* send report */ setShowReportUserPopup(false); }} />}
      {showMutePopup && <MutePopup onClose={() => setShowMutePopup(false)} onConfirm={() => { /* mute toggle */ setShowMutePopup(false); }} />}
      {showPinBanner && <UpdatePinPopup onClose={() => setShowPinBanner(false)} />}

    </div>
  );
}
