// src/components/ChatConversationPage.jsx
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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

const tickSize = 16;

// Message status icon (WhatsApp-like)
function MessageStatusIcon({ status }) {
  const base = { width: tickSize, height: tickSize, display: "inline-block" };
  if (status === "sending")
    return (
      <svg style={base} viewBox="0 0 24 24" fill="none" className="inline-block">
        <circle cx="12" cy="12" r="10" stroke="#999" strokeWidth="1.5" />
        <path d="M12 8v5l4 2" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "sent")
    return (
      <svg style={base} viewBox="0 0 24 24" fill="none" className="inline-block">
        <path d="M4 12l5 5L20 6" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "delivered")
    return (
      <svg style={base} viewBox="0 0 24 24" fill="none" className="inline-block">
        <path d="M3 12l5 5L21 5" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l5 5L23 5" stroke="#888" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "seen")
    return (
      <svg style={base} viewBox="0 0 24 24" fill="none" className="inline-block">
        <path d="M3 12l5 5L21 5" stroke="#34B7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l5 5L23 5" stroke="#34B7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return null;
}

// Format last seen (Online / today -> minutes/hours ago / Yesterday / Date)
function formatLastSeen(lastSeen, isOnline) {
  if (isOnline) return "Online";
  if (!lastSeen) return "";
  const now = new Date();
  const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = Math.floor((now - last) / 1000);
  const mins = Math.floor(diff / 60);
  const hrs = Math.floor(mins / 60);

  if (now.toDateString() === last.toDateString()) {
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
    return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chat, setChat] = useState(null);
  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]); // remote messages
  const [localMessages, setLocalMessages] = useState([]); // optimistic local only
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]); // File objects pending to send
  const [previews, setPreviews] = useState([]); // preview URLs (null for non-image file)
  const [sending, setSending] = useState(false);
  const [fullImage, setFullImage] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const localUid = auth.currentUser?.uid;

  // scroll to bottom whenever messages + localMessages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, localMessages]);

  // Presence: set isOnline true on mount, false + lastSeen on unload (best-effort)
  useEffect(() => {
    if (!localUid) return;

    const userRef = doc(db, "users", localUid);
    // set online true
    updateDoc(userRef, { isOnline: true }).catch(() => {});

    const beforeUnload = async () => {
      try {
        await updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
      } catch (_) {}
    };
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      // component unmount (best-effort)
      updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [localUid]);

  // load chat meta and friend info
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    getDoc(chatRef).then((snap) => {
      if (!snap.exists()) {
        navigate("/chat");
        return;
      }
      const data = snap.data();
      setChat({ id: snap.id, ...data });

      const friendId = data.participants?.find((id) => id !== localUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        const unsubFriend = onSnapshot(friendRef, (fsnap) => {
          if (fsnap.exists()) {
            setFriend({ id: fsnap.id, ...fsnap.data() });
            setFriendTyping(Boolean(fsnap.data()?.typing?.[chatId]));
          }
        });
        // cleanup on unmount
        return () => unsubFriend();
      }
    });
  }, [chatId, localUid, navigate]);

  // messages listener (remote)
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // mark incoming sent -> delivered
      const incomingToDeliver = msgs.filter((m) => m.sender !== localUid && m.status === "sent");
      for (const m of incomingToDeliver) {
        try {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
        } catch (_) {}
      }
    });
    return () => unsub();
  }, [chatId, localUid]);

  // mark delivered -> seen while chat is open
  useEffect(() => {
    if (!chatId) return;
    const toMark = messages.filter((m) => m.sender !== localUid && m.status === "delivered");
    for (const m of toMark) {
      updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "seen" }).catch(() => {});
    }
  }, [messages, chatId, localUid]);

  // Typing: update my users/{uid}.typing[chatId] when input changes (debounced stop)
  useEffect(() => {
    if (!localUid) return;
    const userRef = doc(db, "users", localUid);
    let timer = null;

    const setTypingTrue = async () => {
      try {
        await updateDoc(userRef, { [`typing.${chatId}`]: true });
      } catch (_) {}
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await updateDoc(userRef, { [`typing.${chatId}`]: false });
        } catch (_) {}
      }, 1200);
    };

    if (input && input.length > 0) setTypingTrue();
    else {
      updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
      clearTimeout(timer);
    }

    return () => clearTimeout(timer);
  }, [input, chatId, localUid]);

  // handle file selection (multiple)
  const onFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setFiles((s) => [...s, ...selected]);
    setPreviews((p) => [...p, ...selected.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null))]);
  };

  const removePreview = (index) => {
    setFiles((s) => s.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  };

  // create optimistic local message
  const pushLocalMessage = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const localMsg = { id: tempId, ...payload, createdAt: new Date(), status: "sending", local: true };
    setLocalMessages((prev) => [...prev, localMsg]);
    return tempId;
  };

  // remove local message by temp id
  const removeLocalMessage = (tempId) => {
    setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
  };

  // send: optimistic UI + upload files + add docs
  const handleSend = async () => {
    if ((!input || !input.trim()) && files.length === 0) return;
    if (!localUid) return;
    setSending(true);

    // create optimistic local items: for files -> preview then text
    const tempIds = [];

    try {
      // for each file create local message preview
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const payload = {
          sender: localUid,
          text: f.type.startsWith("image/") ? "" : "",
          fileURL: previews[i] || null, // local preview
          fileName: f.name,
          type: f.type.startsWith("image/") ? "image" : "file",
          createdAt: new Date(),
          status: "sending",
        };
        const t = pushLocalMessage(payload);
        tempIds.push(t);
      }

      // if text exists, push local text message
      let textTempId = null;
      if (input && input.trim()) {
        textTempId = pushLocalMessage({
          sender: localUid,
          text: input.trim(),
          fileURL: null,
          fileName: null,
          type: "text",
          createdAt: new Date(),
          status: "sending",
        });
        tempIds.push(textTempId);
      }

      // 1) Upload files sequentially (could be parallel, but sequential is reliable)
      const uploadedItems = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const storageRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${f.name}`);
        await uploadBytes(storageRef, f);
        const url = await getDownloadURL(storageRef);
        uploadedItems.push({ fileURL: url, fileName: f.name, type: f.type.startsWith("image/") ? "image" : "file" });
      }

      // 2) Create Firestore messages (files first to preserve order)
      const msgRef = collection(db, "chats", chatId, "messages");
      const created = [];

      for (const u of uploadedItems) {
        const payload = {
          sender: localUid,
          text: "",
          fileURL: u.fileURL,
          fileName: u.fileName,
          type: u.type,
          createdAt: serverTimestamp(),
          status: "sent",
        };
        const docRef = await addDoc(msgRef, payload);
        created.push({ id: docRef.id, ...payload });
      }

      // text message
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

      // update chat summary
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: input?.trim() || created[0]?.fileName || "",
        lastMessageAt: serverTimestamp(),
      });

      // remove local temp messages
      tempIds.forEach((id) => removeLocalMessage(id));

      // clear input + files
      setInput("");
      setFiles([]);
      setPreviews([]);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("Send failed", err);
      // show error and keep local messages so user can retry
      alert("Failed to send message. Check your connection.");
    } finally {
      setSending(false);
    }
  };

  // build combined message list: remote messages followed by localMessages that are not yet replaced
  const combinedMessages = [...messages, ...localMessages];

  // small menu actions
  const openProfile = () => friend && navigate(`/profile/${friend.id}`);
  const openMedia = () => navigate(`/media/${chatId}`);
  const toggleMute = () => { alert("Mute toggled — implement preference store"); setMenuOpen(false); };
  const handleDeleteChat = () => { if (confirm("Delete chat for you?")) navigate("/chat"); setMenuOpen(false); };
  const handleBlock = () => { if (confirm("Block user?")) alert("Blocked — implement server-side"); setMenuOpen(false); };

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
      {/* header */}
      <div className={`flex items-center px-4 py-3 border-b ${isDark ? "border-gray-800" : "border-gray-200"} sticky top-0 z-30 bg-opacity-90 ${isDark ? "bg-gray-900" : "bg-white"}`}>
        <button onClick={() => navigate("/chat")} className="mr-3 text-xl">←</button>

        <img
          src={friend?.photoURL || "/default-avatar.png"}
          alt="avatar"
          className="w-12 h-12 rounded-full object-cover cursor-pointer"
          onClick={openProfile}
        />

        <div className="ml-3 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold m-0">{friend?.displayName || chat?.name || "Chat"}</h4>
            {friendTyping && <span className="text-sm text-blue-400">typing…</span>}
          </div>
          <div className="text-xs text-gray-400">{formatLastSeen(friend?.lastSeen, friend?.isOnline)}</div>
        </div>

        <div className="relative">
          <button onClick={() => setMenuOpen((s) => !s)} className="px-2 py-1 text-xl">⋮</button>
          {menuOpen && (
            <div className={`absolute right-0 top-full mt-2 w-48 rounded-md shadow-lg overflow-hidden ${isDark ? "bg-gray-800" : "bg-white"}`}>
              <button onClick={openProfile} className={`w-full text-left px-4 py-2 ${isDark ? "text-white" : "text-black"}`}>View Profile</button>
              <button onClick={openMedia} className={`w-full text-left px-4 py-2 ${isDark ? "text-white" : "text-black"}`}>View Shared Media</button>
              <button onClick={toggleMute} className={`w-full text-left px-4 py-2 ${isDark ? "text-white" : "text-black"}`}>Mute Notifications</button>
              <button onClick={handleDeleteChat} className={`w-full text-left px-4 py-2 ${isDark ? "text-white" : "text-black"}`}>Delete Chat</button>
              <button onClick={handleBlock} className={`w-full text-left px-4 py-2 ${isDark ? "text-white" : "text-black"}`}>Block User</button>
            </div>
          )}
        </div>
      </div>

      {/* messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {combinedMessages.map((m) => {
          const mine = m.sender === localUid;
          return (
            <div key={m.id} className={`${mine ? "ml-auto" : "mr-auto"} max-w-[75%]`}>
              <div className={`p-3 rounded-xl ${mine ? "bg-blue-600 text-white" : isDark ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"}`}>
                {/* If message from other, show sender name (friend displayName) */}
                {!mine && <div className="font-semibold text-sm mb-1">{friend?.displayName || "Friend"}</div>}

                {/* content */}
                {m.type === "text" && <div className="whitespace-pre-wrap">{m.text}</div>}

                {/* image */}
                {m.type === "image" && (
                  <img
                    src={m.fileURL}
                    alt={m.fileName || "image"}
                    className="mt-1 rounded-md max-w-full cursor-pointer"
                    onClick={() => setFullImage(m.fileURL)}
                  />
                )}

                {/* file */}
                {m.type === "file" && (
                  <a href={m.fileURL} target="_blank" rel="noreferrer" className={`${mine ? "text-white" : "text-blue-600"} underline`}>
                    📎 {m.fileName}
                  </a>
                )}

                {/* time + status */}
                <div className="text-xs text-gray-300 flex items-center justify-end gap-2 mt-2">
                  <span className={`${mine ? "text-gray-100" : "text-gray-500"}`}>
                    {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (m.createdAt instanceof Date ? m.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Sending...")}
                  </span>
                  {mine && <MessageStatusIcon status={m.status || (m.local ? "sending" : "sent")} />}
                </div>
              </div>
            </div>
          );
        })}

        {/* sending indicator */}
        {sending && (
          <div className="ml-auto max-w-[60%]">
            <div className="p-3 rounded-xl bg-blue-600 text-white opacity-80">Sending...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* previews strip */}
      {previews.length > 0 && (
        <div className={`px-3 py-2 border-t ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"} flex gap-3 overflow-x-auto`}>
          {previews.map((p, i) => (
            <div key={i} className="relative">
              {p ? (
                <img src={p} alt="preview" className="h-20 w-20 object-cover rounded-md" />
              ) : (
                <div className="h-20 w-20 rounded-md bg-gray-200 flex items-center justify-center">📎</div>
              )}
              <button onClick={() => removePreview(i)} className="absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full text-sm">✖</button>
            </div>
          ))}
        </div>
      )}

      {/* input bar */}
      <div className={`fixed bottom-0 left-0 right-0 p-3 ${isDark ? "bg-gray-900 border-t border-gray-800" : "bg-white border-t border-gray-200"}`}>
        <div className="flex items-center gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className={`flex-1 rounded-full px-4 py-2 outline-none ${isDark ? "bg-gray-800 text-white border border-gray-700" : "bg-gray-100 text-gray-900 border border-gray-200"}`}
          />
          <input id="fileInput" type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" multiple onChange={onFileChange} />
          <label htmlFor="fileInput" className="cursor-pointer text-2xl">📎</label>
          <button onClick={handleSend} disabled={sending} className={`px-4 py-2 rounded-full ${sending ? "bg-gray-500" : "bg-blue-600 text-white"}`}>{sending ? "..." : "Send"}</button>
        </div>
      </div>

      {/* full image lightbox */}
      {fullImage && (
        <div onClick={() => setFullImage(null)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <img src={fullImage} alt="full" className="max-h-[90%] max-w-[90%] rounded-lg" />
          <button onClick={() => setFullImage(null)} className="absolute top-6 right-6 bg-white text-black rounded-full w-9 h-9">✖</button>
        </div>
      )}
    </div>
  );
}