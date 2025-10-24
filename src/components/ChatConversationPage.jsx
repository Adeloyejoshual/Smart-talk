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
  deleteField,
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
 * - header + input fixed
 * - messages scrollable
 * - fixed "scroll to bottom" button that fades when at bottom
 * - reaction popup (single emoji per user, no counts) opened via long-press or click
 */

const DEFAULT_EMOJIS = ["❤️", "😂", "👍", "🔥", "😢", "👏"];

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [friendTyping, setFriendTyping] = useState(false);

  // reaction popup
  const [reactionOpenFor, setReactionOpenFor] = useState(null); // { msgId, x, y }
  // scrolling
  const messagesRef = useRef(null);
  const endRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);

  const myUid = auth.currentUser?.uid;

  // ---------- Helpers ----------
  const scrollToBottom = (smooth = true) => {
    try {
      if (messagesRef.current) {
        messagesRef.current.scrollTo({
          top: messagesRef.current.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      } else {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (e) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // track scroll position -> show/hide down button
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 80;
      const isAtBottomNow =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setAtBottom(isAtBottomNow);
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ---------- Load chat + friend info ----------
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
      const data = { id: snap.id, ...snap.data() };
      setChatInfo(data);

      const friendId =
        (data.participants && data.participants.find((p) => p !== myUid)) ||
        null;
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
    return () => unsubFriend && unsubFriend();
  }, [chatId, myUid, navigate]);

  // ---------- Real-time messages ----------
  useEffect(() => {
    if (!chatId) return;
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      // mark delivered for unread messages (light approach)
      msgs
        .filter((m) => m.sender !== myUid && m.status === "sent")
        .forEach((m) => {
          // best-effort: update to delivered
          updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            status: "delivered",
          }).catch(() => {});
        });
      // if user is at bottom, auto scroll
      if (atBottom) scrollToBottom(true);
    });
    return () => unsub();
  }, [chatId, myUid, atBottom]);

  // ---------- Local optimistic msgs (pushLocal) ----------
  const pushLocal = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLocalMessages((p) => [...p, { id: tempId, ...payload }]);
    return tempId;
  };

  // ---------- File upload ----------
  const uploadFile = (file) => {
    const tempId = pushLocal({
      sender: myUid,
      text: "",
      fileURL: URL.createObjectURL(file),
      fileName: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
      status: "sending",
      createdAt: new Date(),
    });

    const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);
    task.on(
      "state_changed",
      null,
      (err) => {
        console.error("upload error", err);
        setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
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
        setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    );
  };

  // ---------- File selector ----------
  const onFilesSelected = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setFiles((p) => [...p, ...chosen]);
    setPreviews((p) => [...p, ...chosen.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null))]);
    chosen.forEach(uploadFile);
  };

  // ---------- Send text ----------
  const handleSend = async () => {
    const txt = text?.trim();
    if (!txt && files.length === 0) return;
    if (txt) {
      pushLocal({ sender: myUid, text: txt, type: "text", status: "sending", createdAt: new Date() });
      await addDoc(collection(db, "chats", chatId, "messages"), {
        sender: myUid,
        text: txt,
        type: "text",
        fileURL: null,
        createdAt: serverTimestamp(),
        status: "sent",
      });
    }
    setText("");
    setFiles([]);
    setPreviews([]);
    // after send go to bottom
    setTimeout(() => scrollToBottom(true), 200);
  };

  // ---------- Reactions ----------
  // openReactionPicker(msgId, clientX, clientY) -> opens a popup anchored to those coords
  const openReactionPicker = (msgId, clientX, clientY) => {
    const containerRect = messagesRef.current?.getBoundingClientRect();
    let x = clientX;
    let y = clientY;
    if (containerRect) {
      x = clientX - containerRect.left;
      y = clientY - containerRect.top;
    }
    setReactionOpenFor({ msgId, x, y });
  };

  const closeReactionPicker = () => setReactionOpenFor(null);

  // set or remove reaction
  const toggleReaction = async (msg, emoji) => {
    if (!myUid) return;
    const msgRef = doc(db, "chats", chatId, "messages", msg.id);
    const current = msg.reactions || {};
    const currentForMe = current[myUid];
    try {
      if (currentForMe === emoji) {
        // remove
        await updateDoc(msgRef, { [`reactions.${myUid}`]: deleteField() });
      } else {
        await updateDoc(msgRef, { [`reactions.${myUid}`]: emoji });
      }
    } catch (err) {
      console.error("reaction error", err);
    } finally {
      closeReactionPicker();
    }
  };

  // ---------- Utilities: combine messages + local and group days ----------
  const allMessages = React.useMemo(() => {
    const merged = [...messages, ...localMessages];
    merged.sort((a, b) => {
      const aT = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt?.getTime?.() || new Date(a.createdAt).getTime?.?.() || 0;
      const bT = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt?.getTime?.() || new Date(b.createdAt).getTime?.?.() || 0;
      return aT - bT;
    });
    return merged;
  }, [messages, localMessages]);

  const grouped = React.useMemo(() => {
    const res = [];
    let lastDay = "";
    allMessages.forEach((m) => {
      const d = m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000) : m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt || Date.now());
      const dayLabel = d.toDateString();
      if (dayLabel !== lastDay) {
        res.push({ type: "day", label: dayLabel, id: `day-${dayLabel}` });
        lastDay = dayLabel;
      }
      res.push({ type: "msg", payload: m });
    });
    return res;
  }, [allMessages]);

  // ---------- Long-press handling (for mobile) ----------
  const longPressTimer = useRef(null);
  const handleMsgMouseDown = (e, msg) => {
    // start timer for long-press
    longPressTimer.current = setTimeout(() => {
      openReactionPicker(msg.id, e.clientX || (e.touches && e.touches[0]?.clientX), e.clientY || (e.touches && e.touches[0]?.clientY));
    }, 500);
  };
  const clearLongPress = () => {
    clearTimeout(longPressTimer.current);
  };

  // ---------- When chatId changes, scroll down after a small delay ----------
  useEffect(() => {
    setTimeout(() => scrollToBottom(false), 300);
  }, [chatId]);

  // When messages update and user is at bottom we scroll
  useEffect(() => {
    if (atBottom) scrollToBottom(true);
  }, [messages]);

  // ---------- JSX ----------
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#121212" : "#f5f5f5"),
      color: isDark ? "#fff" : "#000"
    }}>
      {/* Header (fixed) */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        position: "sticky",
        top: 0,
        zIndex: 4,
        background: isDark ? "#111" : "#fff"
      }}>
        <button onClick={() => navigate("/chat")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20 }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 12, color: isDark ? "#cfd8dc" : "#666" }}>
            {friendTyping ? "typing..." : (friendInfo?.isOnline ? "Online" : (friendInfo?.lastSeen ? `Last seen ${new Date(friendInfo.lastSeen.seconds * 1000).toLocaleString()}` : "Offline"))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => navigate(`/voice-call/${chatId}`)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20 }}>📞</button>
          <button onClick={() => navigate(`/video-call/${chatId}`)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20 }}>🎥</button>
        </div>
      </div>

      {/* Messages container (scrollable) */}
      <div
        ref={messagesRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
          gap: 8,
        }}
      >
        {grouped.map((item) => {
          if (item.type === "day") {
            const dt = new Date(item.label);
            const label = dt.toDateString() === new Date().toDateString() ? "Today" : dt.toLocaleDateString();
            return <div key={item.id} style={{ textAlign: "center", margin: "12px 0", color: "#888", fontSize: 12 }}>{label}</div>;
          }
          const m = item.payload;
          const mine = m.sender === myUid;
          const reactions = m.reactions || {};
          const uniqueEmojis = Array.from(new Set(Object.values(reactions || {}))).filter(Boolean);
          return (
            <div
              key={m.id}
              onMouseDown={(e) => handleMsgMouseDown(e, m)}
              onMouseUp={clearLongPress}
              onMouseLeave={clearLongPress}
              onTouchStart={(e) => handleMsgMouseDown(e, m)}
              onTouchEnd={clearLongPress}
              onClick={(e) => {
                // quick click opens reaction picker (desktop)
                // allow long-press to work without opening immediately
                if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;
                openReactionPicker(m.id, e.clientX, e.clientY);
              }}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}
            >
              <div style={{
                background: mine ? (isDark ? "#3a9efc" : "#007bff") : (isDark ? "#2b2b2b" : "#eaeaea"),
                color: mine ? "#fff" : "#000",
                padding: "8px 12px",
                borderRadius: 14,
                maxWidth: "78%",
                wordBreak: "break-word",
                position: "relative"
              }}>
                {/* message content */}
                {m.type === "image" && m.fileURL && <img src={m.fileURL} alt="sent" style={{ width: "100%", borderRadius: 10 }} />}
                {m.type === "file" && m.fileURL && <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007bff" }}>📎 {m.fileName || "file"}</a>}
                {m.type === "text" && <div>{m.text}</div>}

                {/* reactions (unique set, single per user no counts) */}
                {uniqueEmojis.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    {uniqueEmojis.map((em, idx) => (
                      <div key={idx} style={{
                        background: "rgba(0,0,0,0.06)",
                        padding: "2px 6px",
                        borderRadius: 12,
                        fontSize: 14
                      }}>{em}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reaction picker popup (absolute over messages area) */}
      {reactionOpenFor && (
        <div
          onClick={closeReactionPicker}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 50,
          }}
        >
          <div
            style={{
              position: "absolute",
              // position within messagesRef container
              left: (messagesRef.current?.getBoundingClientRect()?.left || 0) + (reactionOpenFor.x || 20),
              top: (messagesRef.current?.getBoundingClientRect()?.top || 0) + (reactionOpenFor.y || 20),
              transform: "translate(-50%, -120%)",
              background: isDark ? "#222" : "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: 8,
              display: "flex",
              gap: 8,
              boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
            }}
          >
            {DEFAULT_EMOJIS.map((em) => (
              <button
                key={em}
                onClick={async (e) => {
                  e.stopPropagation();
                  const msg = messages.find((x) => x.id === reactionOpenFor.msgId) || localMessages.find((x) => x.id === reactionOpenFor.msgId);
                  if (!msg) { closeReactionPicker(); return; }
                  await toggleReaction(msg, em);
                }}
                style={{
                  fontSize: 20,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area (fixed) */}
      <div style={{
        display: "flex",
        gap: 8,
        padding: 10,
        borderTop: "1px solid rgba(0,0,0,0.08)",
        position: "sticky",
        bottom: 0,
        zIndex: 5,
        background: isDark ? "#111" : "#fff",
        alignItems: "center"
      }}>
        <input id="fileInput" type="file" multiple onChange={onFilesSelected} style={{ display: "none" }} />
        <label htmlFor="fileInput" style={{ cursor: "pointer", fontSize: 20 }}>📎</label>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 20,
            border: "1px solid rgba(0,0,0,0.12)",
            outline: "none",
            background: isDark ? "#1b1b1b" : "#fff",
            color: isDark ? "#fff" : "#000"
          }}
        />
        <button onClick={handleSend} style={{ background: "#34B7F1", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 20, cursor: "pointer" }}>Send</button>
      </div>

      {/* Fixed down button (fades when at bottom) */}
      <button
        onClick={() => scrollToBottom(true)}
        aria-label="Scroll to bottom"
        style={{
          position: "fixed",
          right: 18,
          bottom: 96,
          width: 52,
          height: 52,
          borderRadius: 26,
          border: "none",
          fontSize: 20,
          background: "#007bff",
          color: "#fff",
          boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
          zIndex: 60,
          opacity: atBottom ? 0 : 1,
          transform: atBottom ? "translateY(10px)" : "translateY(0)",
          transition: "opacity 220ms ease, transform 220ms ease",
          cursor: "pointer"
        }}
      >
        ⬇️
      </button>
    </div>
  );
}