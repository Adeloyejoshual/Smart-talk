// ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
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
  where,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

/* ---------------- helper: last-seen formatting ---------------- */
const formatLastSeen = (lastSeen, isOnline) => {
  if (isOnline) return "Online";
  if (!lastSeen) return "";
  const now = new Date();
  const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = (now - last) / 1000;
  const min = Math.floor(diff / 60);
  const hr = Math.floor(min / 60);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (now.toDateString() === last.toDateString()) {
    if (min < 1) return "just now";
    if (min < 60) return `${min} minute${min > 1 ? "s" : ""} ago`;
    return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  }
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

/* ---------------- MessageStatusIcon: WhatsApp-style ticks ---------------- */
const MessageStatusIcon = ({ status }) => {
  const baseStyle = { width: 16, height: 16, verticalAlign: "middle", marginLeft: 6 };
  if (status === "sending")
    return (
      <svg style={baseStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#999" strokeWidth="1.5" />
        <path d="M12 8v5l4 2" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "sent")
    return (
      <svg style={baseStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12l5 5L20 6" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "delivered")
    return (
      <svg style={baseStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 12l5 5L21 5" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l5 5L23 5" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "seen")
    return (
      <svg style={baseStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 12l5 5L21 5" stroke="#34B7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l5 5L23 5" stroke="#34B7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return null;
};

/* ---------------- debounce helper ---------------- */
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ---------------- ChatConversationPage ---------------- */
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chat, setChat] = useState(null);
  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]); // File objects
  const [previews, setPreviews] = useState([]); // preview URLs for images (null for non-image)
  const [sending, setSending] = useState(false);
  const [fullImage, setFullImage] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const localUid = auth.currentUser?.uid;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  // load chat meta and friend
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend = null;
    getDoc(chatRef).then((snap) => {
      if (!snap.exists()) {
        navigate("/chat");
        return;
      }
      const chatData = snap.data();
      setChat(chatData);

      const friendId = chatData.participants?.find((id) => id !== localUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriend({ id: fsnap.id, ...fsnap.data() });
            // listen to typing flag for this chat
            const typingFlag = fsnap.data()?.typing?.[chatId];
            setFriendTyping(Boolean(typingFlag));
          }
        });
      }
    });

    return () => {
      if (unsubFriend) unsubFriend();
    };
  }, [chatId, localUid, navigate]);

  // listen messages + set delivered when opening chat (messages with status 'sent' -> 'delivered')
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // When this client opens the chat, mark incoming 'sent' messages as 'delivered'
      const incomingToDeliver = msgs.filter((m) => m.sender !== localUid && m.status === "sent");
      for (const m of incomingToDeliver) {
        try {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
        } catch (e) {
          // ignore
        }
      }
    });
    return () => unsub();
  }, [chatId, localUid]);

  // when messages change, mark delivered -> seen
  useEffect(() => {
    if (!chatId) return;
    const markSeen = async () => {
      const toMark = messages.filter((m) => m.sender !== localUid && m.status === "delivered");
      for (const m of toMark) {
        try {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "seen" });
        } catch (e) {
          // ignore
        }
      }
    };
    if (messages.length) markSeen();
  }, [messages, chatId, localUid]);

  // typing: update my user doc typing[chatId] = true/false
  useEffect(() => {
    if (!localUid) return;
    const userRef = doc(db, "users", localUid);

    // debounced stop typing
    const stopTyping = debounce(async () => {
      try {
        await updateDoc(userRef, { [`typing.${chatId}`]: false });
      } catch (e) {}
    }, 1200);

    // when input changes set typing true then schedule stop
    if (input.length > 0) {
      updateDoc(userRef, { [`typing.${chatId}`]: true }).catch(() => {});
      stopTyping();
    } else {
      // if cleared input mark false
      updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
    }

    return () => {
      // on unmount ensure false
      updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, chatId, localUid]);

  // file selection (multiple)
  const onFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setFiles((prev) => [...prev, ...selected]);
    setPreviews((prev) => [
      ...prev,
      ...selected.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    ]);
  };

  const removePreview = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // send message: upload files then add messages to Firestore with status 'sent'
  const handleSend = async () => {
    if ((!input || !input.trim()) && files.length === 0) return;
    if (!localUid) return;

    setSending(true);

    try {
      const msgRef = collection(db, "chats", chatId, "messages");
      const created = [];

      // upload files first, push messages for each file
      for (const f of files) {
        const storageRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${f.name}`);
        await uploadBytes(storageRef, f);
        const url = await getDownloadURL(storageRef);
        const payload = {
          sender: localUid,
          text: "",
          fileURL: url,
          fileName: f.name,
          type: f.type.startsWith("image/") ? "image" : "file",
          createdAt: serverTimestamp(),
          status: "sent",
        };
        const docRef = await addDoc(msgRef, payload);
        created.push({ id: docRef.id, ...payload });
      }

      // text message after (or before) — here after files, order can be changed
      if (input && input.trim()) {
        const payload = {
          sender: localUid,
          text: input.trim(),
          fileURL: null,
          fileName: null,
          type: "text",
          createdAt: serverTimestamp(),
          status: "sent",
        };
        const docRef = await addDoc(msgRef, payload);
        created.push({ id: docRef.id, ...payload });
      }

      // update chat document summary
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: input?.trim() || created[0]?.fileName || "",
        lastMessageAt: serverTimestamp(),
      });

      setInput("");
      setFiles([]);
      setPreviews([]);
      scrollToBottom();
    } catch (err) {
      console.error("send error", err);
      alert("Error sending message");
    } finally {
      setSending(false);
    }
  };

  // 3-dot menu handlers
  const openProfilePage = () => {
    if (!friend?.id) return;
    navigate(`/profile/${friend.id}`);
    setDropdownOpen(false);
  };
  const openMediaPage = () => {
    navigate(`/media/${chatId}`);
    setDropdownOpen(false);
  };
  const toggleMute = async () => {
    // placeholder: implement mute preference if you have a user settings collection
    alert("Mute notifications toggled (implement server-side preference).");
    setDropdownOpen(false);
  };
  const deleteChat = async () => {
    // destructive; implement as you need (could delete chat doc or remove current user from participants)
    const ok = window.confirm("Delete this chat locally? This will remove chat for you.");
    if (!ok) return;
    try {
      // here we simply navigate away; actual deletion may need cloud function/permission
      navigate("/chat");
    } catch (e) {
      console.error(e);
    } finally {
      setDropdownOpen(false);
    }
  };
  const blockUser = async () => {
    const ok = window.confirm("Block this user?");
    if (!ok) return;
    // implement block logic (e.g., add to blockedUsers subcollection)
    alert("User blocked (implement server-side list).");
    setDropdownOpen(false);
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
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          background: isDark ? "#1f1f1f" : "#fff",
          borderBottom: "1px solid #ccc",
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        <button
          onClick={() => navigate("/chat")}
          style={{ background: "none", border: "none", fontSize: 20, marginRight: 10, cursor: "pointer", color: isDark ? "#fff" : "#000" }}
        >
          ←
        </button>

        <img
          src={friend?.photoURL || "/default-avatar.png"}
          alt="avatar"
          style={{ width: 45, height: 45, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
          onClick={() => navigate(`/profile/${friend?.id}`)}
        />

        <div style={{ marginLeft: 10, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h4 style={{ margin: 0 }}>{friend?.displayName || "User"}</h4>
            {friendTyping && <small style={{ color: "#0b84ff", fontSize: 12 }}>typing…</small>}
          </div>
          <small style={{ color: "#888", fontSize: 12 }}>{formatLastSeen(friend?.lastSeen, friend?.isOnline)}</small>
        </div>

        {/* 3-dot menu trigger */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen((s) => !s)}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: isDark ? "#fff" : "#000" }}
          >
            ⋮
          </button>

          {/* dropdown small menu (A) */}
          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "110%",
                background: isDark ? "#222" : "#fff",
                boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                borderRadius: 8,
                overflow: "hidden",
                minWidth: 180,
                zIndex: 60,
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <button onClick={openProfilePage} style={menuBtnStyle(isDark)}>View Profile</button>
              <button onClick={openMediaPage} style={menuBtnStyle(isDark)}>View Shared Media</button>
              <button onClick={toggleMute} style={menuBtnStyle(isDark)}>Mute Notifications</button>
              <button onClick={deleteChat} style={menuBtnStyle(isDark)}>Delete Chat</button>
              <button onClick={blockUser} style={menuBtnStyle(isDark)}>Block User</button>
            </div>
          )}
        </div>
      </div>

      {/* messages list */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 120 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === localUid ? "flex-end" : "flex-start",
              background: m.sender === localUid ? "#007bff" : isDark ? "#2e2e2e" : "#e9e9e9",
              color: m.sender === localUid ? "#fff" : "#000",
              padding: 10,
              borderRadius: 12,
              maxWidth: "75%",
              wordBreak: "break-word",
              position: "relative",
            }}
          >
            {m.type === "text" && <div>{m.text}</div>}
            {m.type === "image" && (
              <img
                src={m.fileURL}
                alt={m.fileName || "image"}
                style={{ maxWidth: "100%", borderRadius: 8, cursor: "pointer" }}
                onClick={() => setFullImage(m.fileURL)}
              />
            )}
            {m.type === "file" && (
              <a href={m.fileURL} rel="noreferrer" target="_blank" style={{ color: m.sender === localUid ? "#fff" : "#007bff", textDecoration: "underline" }}>
                📎 {m.fileName}
              </a>
            )}

            <div style={{ fontSize: 11, textAlign: "right", opacity: 0.8, marginTop: 6 }}>
              {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Sending..."}
              {m.sender === localUid && <MessageStatusIcon status={m.status || "sent"} />}
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ alignSelf: "flex-end", background: "#007bff", color: "#fff", padding: "8px 12px", borderRadius: 10, opacity: 0.85 }}>
            Sending...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* previews strip */}
      {previews.length > 0 && (
        <div style={{ padding: 10, display: "flex", gap: 10, overflowX: "auto", borderTop: "1px solid #ccc", background: isDark ? "#111" : "#fff" }}>
          {previews.map((p, i) => (
            <div key={i} style={{ position: "relative" }}>
              {p ? (
                <img src={p} alt="preview" style={{ height: 70, borderRadius: 8, objectFit: "cover" }} />
              ) : (
                <div style={{ height: 70, width: 70, borderRadius: 8, background: "#ddd", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  📎
                </div>
              )}
              <button onClick={() => removePreview(i)} style={{ position: "absolute", top: -6, right: -6, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer" }}>✖</button>
            </div>
          ))}
        </div>
      )}

      {/* input bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, width: "100%", display: "flex", gap: 8, alignItems: "center", padding: 10, background: isDark ? "#1f1f1f" : "#fff", borderTop: "1px solid #ccc" }}>
        <input
          type="text"
          value={input}
          placeholder="Type a message..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc", outline: "none", background: isDark ? "#222" : "#fff", color: isDark ? "#fff" : "#000" }}
        />
        <input id="fileInput" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={onFileChange} />
        <label htmlFor="fileInput" style={{ fontSize: 22, cursor: "pointer" }}>📎</label>
        <button onClick={handleSend} disabled={sending} style={{ padding: "10px 14px", background: sending ? "#888" : "#007bff", color: "#fff", border: "none", borderRadius: 10 }}>
          {sending ? "..." : "Send"}
        </button>
      </div>

      {/* full-image lightbox */}
      {fullImage && (
        <div onClick={() => setFullImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <img src={fullImage} alt="full" style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 8 }} />
          <button onClick={() => setFullImage(null)} style={{ position: "absolute", top: 20, right: 20, background: "#fff", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer" }}>✖</button>
        </div>
      )}
    </div>
  );
}

/* small menu button style */
const menuBtnStyle = (isDark) => ({
  display: "block",
  width: "100%",
  padding: "10px 14px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
  color: isDark ? "#fff" : "#000",
});