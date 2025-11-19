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
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

// ---------- Helpers ----------
const dayLabel = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// ---------- Message Bubble ----------
const MessageBubble = ({ m, myUid }) => {
  const isMine = m.senderId === myUid;
  return (
    <div
      id={`msg-${m.id}`}
      style={{
        margin: "6px 0",
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "70%",
          padding: "8px 12px",
          borderRadius: 16,
          background: isMine ? "#34B7F1" : "#e5e5ea",
          color: isMine ? "#fff" : "#000",
          wordBreak: "break-word",
        }}
      >
        {m.text || (m.mediaType ? `[${m.mediaType}]` : "")}
      </div>
    </div>
  );
};

// ---------- Component ----------
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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const menuBtnStyle = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  };

  // ---------- Load chat and friend info ----------
  useEffect(() => {
    if (!chatId) return;

    const load = async () => {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (snap.exists()) {
        const data = snap.data();
        setChatInfo({ id: snap.id, ...data });
        const friendId = data.participants?.find((p) => p !== myUid);
        if (friendId) {
          const userSnap = await getDoc(doc(db, "users", friendId));
          if (userSnap.exists()) setFriendInfo({ id: userSnap.id, ...userSnap.data() });
        }
      }
    };
    load();
  }, [chatId, myUid]);

  // ---------- Messages listener ----------
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
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });

    return () => unsub();
  }, [chatId, myUid]);

  // ---------- Group messages by day ----------
  const groupedMessages = (() => {
    const out = [];
    let lastDay = null;
    messages.forEach((m) => {
      const lbl = dayLabel(m.createdAt || new Date());
      if (lbl !== lastDay)
        out.push({
          type: "day",
          label: lbl,
          id: `day-${lbl}-${Math.random().toString(36).slice(2)}`,
        }),
          (lastDay = lbl);
      out.push(m);
    });
    return out;
  })();

  // ---------- Send message ----------
  const sendMessage = async () => {
    if (!text.trim()) return;
    const msg = {
      senderId: myUid,
      text: text.trim(),
      createdAt: new Date(),
      status: "sent",
    };
    await addDoc(collection(db, "chats", chatId, "messages"), msg);
    setText("");
    setReplyTo(null);
  };

  // ---------- Clear chat ----------
  const clearChat = async () => {
    if (!window.confirm("Clear all messages?")) return;
    const msgsRef = collection(db, "chats", chatId, "messages");
    const snap = await getDocs(msgsRef);
    const batch = snap.docs.map((d) => updateDoc(d.ref, { deletedFor: arrayUnion(myUid) }));
    await Promise.all(batch);
  };

  // ---------- Render ----------
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: wallpaper
          ? `url(${wallpaper}) center/cover no-repeat`
          : isDark
          ? "#070707"
          : "#f5f5f5",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
          background: "#1877F2",
          color: "#fff",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <button
          onClick={() => navigate("/chat")}
          style={{ fontSize: 20, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
        >
          ←
        </button>
        <img
          src={friendInfo?.photoURL || chatInfo?.photoURL || "/default-avatar.png"}
          alt="avatar"
          onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)}
          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
        />
        <div onClick={() => friendInfo && navigate(`/user-profile/${friendInfo.id}`)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {friendInfo?.displayName || chatInfo?.name || "Chat"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            {friendInfo?.isOnline ? "Online" : "Offline"}
          </div>
        </div>
        <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>
          📞
        </button>
        <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>
          🎥
        </button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setHeaderMenuOpen((s) => !s)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>
            ⋮
          </button>
          {headerMenuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 36,
                background: isDark ? "#111" : "#fff",
                color: isDark ? "#fff" : "#000",
                padding: 8,
                borderRadius: 10,
                boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
                minWidth: 160,
                zIndex: 999,
              }}
            >
              <button
                onClick={() => {
                  setHeaderMenuOpen(false);
                  navigate(`/user-profile/${friendInfo?.id}`);
                }}
                style={menuBtnStyle}
              >
                👤 View Profile
              </button>
              <button onClick={clearChat} style={menuBtnStyle}>
                🗑️ Clear Chat
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: 24 }}>Loading messages…</div>}
        {groupedMessages.map((item) =>
          item.type === "day" ? (
            <div key={item.id} style={{ textAlign: "center", margin: "12px 0", color: isDark ? "#aaa" : "#555", fontSize: 12 }}>
              {item.label}
            </div>
          ) : (
            <MessageBubble key={item.id} m={item} myUid={myUid} />
          )
        )}
        <div ref={endRef} />
      </main>

      {/* Reply Preview */}
      {replyTo && (
        <div style={{ position: "sticky", bottom: 84, left: 12, right: 12, display: "flex", justifyContent: "space-between", background: isDark ? "#101010" : "#fff", padding: 8, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 90 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden" }}>
            <div style={{ width: 4, height: 40, background: "#34B7F1", borderRadius: 4 }} />
            <div style={{ maxWidth: "85%" }}>
              <div style={{ fontSize: 12, color: "#888" }}>{replyTo.senderId === myUid ? "You" : "Them"}</div>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {replyTo.text || replyTo.mediaType || "media"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { const el = document.getElementById(`msg-${replyTo.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); setReplyTo(null); }} style={{ border: "none", background: "transparent", cursor: "pointer" }}>Go</button>
            <button onClick={() => setReplyTo(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", padding: 12, gap: 8, borderTop: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#101010" : "#fff" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: 8, borderRadius: 16, border: `1px solid ${isDark ? "#333" : "#ccc"}`, background: isDark ? "#222" : "#f9f9f9", color: isDark ? "#fff" : "#000" }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage} style={{ padding: "8px 12px", borderRadius: 16, border: "none", background: "#34B7F1", color: "#fff", cursor: "pointer" }}>Send</button>
      </div>
    </div>
  );
}