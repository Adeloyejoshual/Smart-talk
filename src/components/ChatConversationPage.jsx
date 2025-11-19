// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  getDocs,
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// -------------------- Helpers --------------------
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
  return d.toLocaleDateString();
};

// -------------------- Constants --------------------
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const EXTENDED_EMOJIS = ["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"];
const COLORS = {
  primary: "#34B7F1",
  headerBlue: "#1877F2",
  lightBg: "#f5f5f5",
  darkBg: "#0b0b0b",
  lightText: "#000",
  darkText: "#fff",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  mutedText: "#888",
  reactionBg: "#111",
  edited: "#999",
  grayBorder: "rgba(0,0,0,0.06)",
};
const SPACING = { xs: 4, sm: 8, md: 12, lg: 14, xl: 20, borderRadius: 12 };
const menuBtnStyle = { padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" };

// -------------------- Component --------------------
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // -------------------- Placeholder Handlers --------------------
  const sendTextMessage = async () => { 
    if (!text.trim()) return; 
    console.log("Send message:", text);
    setText(""); 
  };
  const onFilesSelected = (e) => { console.log("Files selected", e.target.files); };
  const holdStart = () => console.log("Recording start");
  const holdEnd = () => console.log("Recording stop");
  const replyToMessage = (m) => setReplyTo(m);
  const editMessage = (m) => console.log("Edit message", m.id);
  const deleteMessageForEveryone = (id) => console.log("Delete for everyone", id);
  const deleteMessageForMe = (id) => console.log("Delete for me", id);
  const forwardMessage = (m) => console.log("Forward message", m.id);
  const pinMessage = (m) => console.log("Pin message", m.id);
  const copyMessageText = (m) => { navigator.clipboard.writeText(m.text || ""); console.log("Copied"); };
  const applyReaction = (msgId, reaction) => console.log("React", msgId, reaction);

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });
          const friendId = data.participants?.find(p => p !== myUid);
          if (friendId) {
            const fRef = doc(db, "users", friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
          }
        }
      } catch (e) { console.error(e); }
    };
    loadMeta();
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      setLoadingMsgs(false);
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    });
    return () => unsub();
  }, [chatId, isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => { setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); };

  // -------------------- Header actions --------------------
  const clearChat = async () => {
    if (!confirm("Clear chat?")) return;
    const snap = await getDocs(query(collection(db, "chats", chatId, "messages"), orderBy("createdAt","asc")));
    for (const d of snap.docs) try { await deleteDoc(d.ref); } catch(e) {}
    setHeaderMenuOpen(false);
    alert("Chat cleared.");
  };
  const toggleBlock = async () => {
    if (!chatInfo) return;
    const chatRef = doc(db, "chats", chatId);
    const blockedBy = chatInfo.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
      setChatInfo(prev => ({ ...prev, blockedBy: blockedBy.filter(id => id !== myUid) }));
      alert("You unblocked this chat.");
    } else {
      await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
      setChatInfo(prev => ({ ...prev, blockedBy: [...blockedBy, myUid] }));
      alert("You blocked this chat.");
    }
    setHeaderMenuOpen(false);
  };

  const goToProfile = () => { if (friendInfo?.id) navigate(`/user/${friendInfo.id}`); };
  const startVoiceCall = () => { if (friendInfo?.id) navigate(`/voicecall/${friendInfo.id}`); };
  const startVideoCall = () => { if (friendInfo?.id) navigate(`/videocall/${friendInfo.id}`); };

  // -------------------- Render message --------------------
  const renderMessage = (m) => {
    const isMine = m.senderId === myUid;
    const showMenu = menuOpenFor === m.id;
    const showReactionPicker = reactionFor === m.id;

    return (
      <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: SPACING.sm }}>
        <div
          style={{
            maxWidth: "70%",
            padding: SPACING.sm,
            borderRadius: SPACING.borderRadius,
            backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
            color: isMine ? "#fff" : isDark ? COLORS.darkText : COLORS.lightText,
            position: "relative",
            cursor: "pointer",
            wordBreak: "break-word"
          }}
        >
          {m.text && <div>{m.text}</div>}
          <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
            {fmtTime(m.createdAt)}
          </div>
        </div>
      </div>
    );
  };

  // -------------------- JSX --------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg), color: isDark ? COLORS.darkText : COLORS.lightText }}>
      
      {/* Header */}
      <div style={{ height: 56, backgroundColor: COLORS.headerBlue, color: "#fff", display: "flex", alignItems: "center", padding: "0 12px", justifyContent: "space-between", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}>←</button>
          <img src={friendInfo?.photoURL || ""} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} onClick={goToProfile} />
          <div>
            <div>{friendInfo?.name || "Chat"}</div>
            <div style={{ fontSize: 12 }}>{friendInfo?.status || ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={startVoiceCall} style={{ background: "transparent", border: "none", color: "#fff" }}>📞</button>
          <button onClick={startVideoCall} style={{ background: "transparent", border: "none", color: "#fff" }}>🎥</button>
          <button onClick={() => setHeaderMenuOpen(prev => !prev)} style={{ background: "transparent", border: "none", color: "#fff" }}>⋮</button>
        </div>
        {headerMenuOpen && (
          <div style={{ position: "absolute", top: 56, right: 12, background: COLORS.lightCard, borderRadius: SPACING.borderRadius, boxShadow: "0 2px 6px rgba(0,0,0,0.2)", zIndex: 20 }}>
            <button style={menuBtnStyle} onClick={clearChat}>Clear Chat</button>
            <button style={menuBtnStyle} onClick={toggleBlock}>{(chatInfo?.blockedBy || []).includes(myUid) ? "Unblock" : "Block"}</button>
            <button style={menuBtnStyle} onClick={() => setHeaderMenuOpen(false)}>Close</button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: SPACING.md }}>Loading...</div>}
        {messages.map(renderMessage)}
        <div ref={endRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{ padding: SPACING.sm, background: isDark ? COLORS.darkCard : COLORS.lightCard, borderTop: `1px solid ${COLORS.grayBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>Replying to: <b>{replyTo.text}</b></div>
          <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: SPACING.sm, display: "flex", alignItems: "center", gap: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: isDark ? COLORS.darkCard : COLORS.lightCard }}>
        <button onClick={() => setShowEmojiPicker(prev => !prev)} style={{ fontSize: 24, background: "transparent", border: "none" }}>😊</button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: `1px solid ${COLORS.grayBorder}`, outline: "none", background: isDark ? COLORS.darkBg : "#fff", color: isDark ? COLORS.darkText : COLORS.lightText }}
          onKeyDown={e => e.key === "Enter" && sendTextMessage()}
        />
        <input type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} id="fileInput" />
        <label htmlFor="fileInput" style={{ cursor: "pointer" }}>📎</label>
        <button onMouseDown={holdStart} onMouseUp={holdEnd} onTouchStart={holdStart} onTouchEnd={holdEnd} onClick={sendTextMessage} style={{ fontSize: 18, background: "transparent", border: "none" }}>📩</button>
      </div>

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div style={{ position: "absolute", bottom: 60, left: 12, background: COLORS.lightCard, borderRadius: SPACING.borderRadius, padding: SPACING.sm, display: "flex", flexWrap: "wrap", maxWidth: 300, gap: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>
          {EXTENDED_EMOJIS.map((e, i) => (
            <span key={i} style={{ cursor: "pointer", fontSize: 20 }} onClick={() => setText(prev => prev + e)}>{e}</span>
          ))}
          <button onClick={() => setShowEmojiPicker(false)} style={{ border: "none", background: "transparent", fontSize: 16 }}>×</button>
        </div>
      )}
    </div>
  );
}