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
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/* --- small helpers --- */
const formatLastSeen = (ts, isOnline) => {
  if (isOnline) return "Online";
  if (!ts) return "Offline";
  const last = ts.toDate ? ts.toDate() : new Date(ts);
  const mins = Math.floor((Date.now() - last) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return last.toLocaleDateString();
};

const formatDayLabel = (d) => {
  if (!d) return "";
  const date = d.toDate ? d.toDate() : new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString();
};

const formatTime = (d) => {
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollRef = useRef(null);
  const endRef = useRef(null);

  /* --- load chat and friend info --- */
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend;

    getDoc(chatRef).then((snap) => {
      if (!snap.exists()) {
        navigate("/chat");
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      setChatInfo(data);
      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            const fdata = fsnap.data();
            setFriendInfo({ id: fsnap.id, ...fdata });
            setFriendTyping(Boolean(fdata.typing?.[chatId]));
          }
        });
      }
    });

    return () => unsubFriend && unsubFriend();
  }, [chatId, myUid, navigate]);

  /* --- message listener --- */
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [chatId]);

  /* --- scroll control --- */
  useEffect(() => {
    if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, localMessages, isAtBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const tol = 20;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight <= tol;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () =>
    endRef.current?.scrollIntoView({ behavior: "smooth" });

  /* --- send message --- */
  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const tempId = Date.now();
    setLocalMessages((prev) => [
      ...prev,
      {
        id: tempId,
        text: text.trim(),
        sender: myUid,
        createdAt: new Date(),
        status: "sending",
      },
    ]);
    const toSend = text.trim();
    setText("");
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: myUid,
        text: toSend,
        type: "text",
        createdAt: serverTimestamp(),
        status: "sent",
      });
      setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch {
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "error" } : m))
      );
    } finally {
      setSending(false);
    }
  };

  /* --- combined messages --- */
  const allMessages = [...messages, ...localMessages].sort((a, b) => {
    const aT = a.createdAt?.seconds
      ? a.createdAt.seconds * 1000
      : a.createdAt?.getTime?.() || new Date(a.createdAt).getTime();
    const bT = b.createdAt?.seconds
      ? b.createdAt.seconds * 1000
      : b.createdAt?.getTime?.() || new Date(b.createdAt).getTime();
    return aT - bT;
  });

  const grouped = [];
  let lastDay = "";
  allMessages.forEach((m) => {
    const label = formatDayLabel(m.createdAt);
    if (label !== lastDay) {
      grouped.push({ type: "day", id: `day-${label}`, label });
      lastDay = label;
    }
    grouped.push({ type: "msg", ...m });
  });

  /* --- UI --- */
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: wallpaper
          ? `url(${wallpaper}) center/cover no-repeat`
          : isDark
          ? "#0f0f10"
          : "#f5f5f5",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: isDark ? "#121214" : "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/chat")}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: isDark ? "#fff" : "#000",
            }}
          >
            ←
          </button>
          <img
            src={friendInfo?.photoURL || "/default-avatar.png"}
            alt="avatar"
            onClick={() => navigate(`/user/${friendInfo?.id}`)}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              objectFit: "cover",
              cursor: "pointer",
            }}
          />
          <div>
            <div style={{ fontWeight: 700 }}>
              {friendInfo?.displayName || "Chat"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: isDark ? "#9aa" : "#666",
              }}
            >
              {friendTyping
                ? "typing..."
                : formatLastSeen(friendInfo?.lastSeen, friendInfo?.isOnline)}
            </div>
          </div>
        </div>

        {/* 3-dot menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: isDark ? "#fff" : "#000",
            }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: isDark ? "#1c1c1e" : "#fff",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 99,
              }}
            >
              <div
                onClick={() => navigate(`/user/${friendInfo?.id}`)}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                View profile
              </div>
              <div
                onClick={() => alert("Clear chat coming soon")}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Clear chat
              </div>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Close
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
          scrollBehavior: "smooth",
        }}
      >
        {grouped.map((item) => {
          if (item.type === "day") {
            return (
              <div
                key={item.id}
                style={{
                  textAlign: "center",
                  margin: "10px 0",
                  color: isDark ? "#999" : "#666",
                  fontSize: 12,
                }}
              >
                {item.label}
              </div>
            );
          }
          const m = item;
          const mine = m.sender === myUid;
          const bubbleBg = mine
            ? isDark
              ? "#1f6feb"
              : "#007bff"
            : isDark
            ? "#2a2a2a"
            : "#e9e9ea";
          const textColor = mine ? "#fff" : isDark ? "#fff" : "#000";
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  background: bubbleBg,
                  color: textColor,
                  padding: 10,
                  borderRadius: 12,
                  wordBreak: "break-word",
                }}
              >
                {m.type === "text" && (
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    marginTop: 4,
                    textAlign: "right",
                    opacity: 0.8,
                  }}
                >
                  {formatTime(m.createdAt)}{" "}
                  {m.status === "sending" && "⌛"}
                  {m.status === "sent" && "✔"}
                  {m.status === "delivered" && "✔✔"}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Down arrow */}
      <button
        onClick={scrollToBottom}
        style={{
          position: "fixed",
          right: 20,
          bottom: 96,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#007bff",
          border: "none",
          color: "#fff",
          boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
          cursor: "pointer",
          opacity: isAtBottom ? 0 : 1,
          transition: "opacity 0.3s",
        }}
      >
        ⬇
      </button>

      {/* Input */}
      <div
        style={{
          display: "flex",
          padding: 10,
          borderTop: "1px solid rgba(0,0,0,0.1)",
          background: isDark ? "#0f0f10" : "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 10,
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message"
          style={{
            flex: 1,
            borderRadius: 20,
            border: "1px solid rgba(0,0,0,0.12)",
            padding: "10px 14px",
            outline: "none",
            background: isDark ? "#121214" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            marginLeft: 8,
            background: "#34B7F1",
            color: "#fff",
            border: "none",
            borderRadius: 20,
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}