// ChatConversationPage.jsx
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

/*
  Features:
   - multi-file preview + remove
   - resumable uploads with progress
   - optimistic local messages while uploading
   - message status lifecycle via Firestore: sending|sent|delivered|seen
   - typing indicator (updates users/{uid}.typing[chatId])
   - best-effort presence (writes users/{uid}.isOnline / lastSeen on unload)
*/

function MessageStatus({ status }) {
  if (status === "sending") return <span style={{ marginLeft: 6 }}>⌛</span>;
  if (status === "sent") return <span style={{ marginLeft: 6 }}>✔</span>;
  if (status === "delivered") return <span style={{ marginLeft: 6 }}>✔✔</span>;
  if (status === "seen") return <span style={{ marginLeft: 6, color: "#34B7F1" }}>✔✔</span>;
  return null;
}

function formatLastSeen(ts, isOnline) {
  if (isOnline) return "Online";
  if (!ts) return "";
  const last = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now - last) / 1000 / 60);
  if (now.toDateString() === last.toDateString()) {
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString();
}

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]); // remote messages from Firestore
  const [localMessages, setLocalMessages] = useState([]); // optimistic messages
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // File objects user selected
  const [previews, setPreviews] = useState([]); // preview URLs for images
  const [uploading, setUploading] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const endRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  // auto scroll on messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, localMessages]);

  // best-effort presence: mark online and on unload update lastSeen
  useEffect(() => {
    if (!myUid) return;
    const userRef = doc(db, "users", myUid);
    updateDoc(userRef, { isOnline: true }).catch(() => {});

    const handleUnload = async () => {
      try {
        await updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
      } catch (e) {
        // best-effort
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [myUid]);

  // load chat meta + friend info (real-time for friend)
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend = null;

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        alert("Chat not found");
        navigate("/chat");
        return;
      }
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      // friend id
      const friendId = data.participants?.find((p) => p !== myUid);
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

    return () => {
      if (unsubFriend) unsubFriend();
    };
  }, [chatId, myUid, navigate]);

  // listen to messages (remote)
  useEffect(() => {
    if (!chatId) return;
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // mark incoming sent -> delivered (we are viewing)
      const incoming = msgs.filter((m) => m.sender !== myUid && m.status === "sent");
      for (const m of incoming) {
        try {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
        } catch (e) {}
      }
    });
    return () => unsub();
  }, [chatId, myUid]);

  // mark delivered -> seen for messages (we are viewing the conversation)
  useEffect(() => {
    if (!chatId) return;
    const toMark = messages.filter((m) => m.sender !== myUid && m.status === "delivered");
    for (const m of toMark) {
      updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "seen" }).catch(() => {});
    }
  }, [messages, chatId, myUid]);

  // typing indicator: set typing flag on my user doc when typing
  useEffect(() => {
    if (!myUid) return;
    const userRef = doc(db, "users", myUid);
    let timer = null;
    if (text && text.length > 0) {
      // set typing true and debounce set false after 1.2s idle
      updateDoc(userRef, { [`typing.${chatId}`]: true }).catch(() => {});
      clearTimeout(timer);
      timer = setTimeout(() => {
        updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
      }, 1200);
    } else {
      updateDoc(userRef, { [`typing.${chatId}`]: false }).catch(() => {});
    }
    return () => clearTimeout(timer);
  }, [text, myUid, chatId]);

  // file selection
  const onFilesSelected = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setFiles((prev) => [...prev, ...chosen]);
    setPreviews((p) => [
      ...p,
      ...chosen.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    ]);
  };

  const removeFileAt = (index) => {
    setFiles((s) => s.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  };

  // optimistic local message helper
  const pushLocal = (payload) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const localMsg = { id: tempId, ...payload, createdAt: new Date(), status: "sending", local: true };
    setLocalMessages((prev) => [...prev, localMsg]);
    return tempId;
  };
  const removeLocal = (tempId) => setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));

  // handle send: upload files (resumable) then add message docs
  const handleSend = async () => {
    if ((!text || !text.trim()) && files.length === 0) return;
    if (!myUid) return;

    setUploading(true);

    // Prepare optimistic messages (preview)
    const tempIds = [];
    try {
      // Add previews for files
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        pushLocal({
          sender: myUid,
          text: f.type.startsWith("image/") ? "" : "",
          fileURL: previews[i] || null,
          fileName: f.name,
          type: f.type.startsWith("image/") ? "image" : "file",
          status: "sending",
        });
      }
      // add text optimistic
      if (text && text.trim()) {
        pushLocal({
          sender: myUid,
          text: text.trim(),
          fileURL: null,
          type: "text",
          status: "sending",
        });
      }

      // Upload files sequentially (reliable & easy to follow)
      const uploaded = [];
      for (const f of files) {
        const sRef = storageRef(storage, `chatFiles/${chatId}/${Date.now()}_${f.name}`);
        const task = uploadBytesResumable(sRef, f);

        // await completion with promise
        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              // could expose progress: snap.bytesTransferred / snap.totalBytes
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              uploaded.push({
                fileName: f.name,
                url,
                type: f.type.startsWith("image/") ? "image" : "file",
              });
              resolve();
            }
          );
        });
      }

      // Create messages in Firestore for uploaded files (preserve order)
      const msgCol = collection(db, "chats", chatId, "messages");
      const createdMessages = [];

      for (const u of uploaded) {
        const payload = {
          sender: myUid,
          text: "",
          fileURL: u.url,
          fileName: u.fileName,
          type: u.type,
          createdAt: serverTimestamp(),
          status: "sent",
        };
        const docRef = await addDoc(msgCol, payload);
        createdMessages.push({ id: docRef.id, ...payload });
      }

      // Text msg
      if (text && text.trim()) {
        const payload = {
          sender: myUid,
          text: text.trim(),
          fileURL: null,
          fileName: null,
          type: "text",
          createdAt: serverTimestamp(),
          status: "sent",
        };
        const docRef = await addDoc(msgCol, payload);
        createdMessages.push({ id: docRef.id, ...payload });
      }

      // update chat preview
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text?.trim() || (createdMessages[0]?.fileName || ""),
        lastMessageAt: serverTimestamp(),
      });

      // clear optimistic local ones
      setLocalMessages([]);
      setText("");
      setFiles([]);
      setPreviews([]);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("Send failed", err);
      alert("Failed to send. Check connection.");
      // keep local messages to allow retry
    } finally {
      setUploading(false);
    }
  };

  // combined list: remote messages plus local optimistic at end
  const combined = [...messages, ...localMessages];

  const openProfile = () => friendInfo && navigate(`/profile/${friendInfo.id}`);
  const openMedia = () => navigate(`/media/${chatId}`);

  const handleBack = () => navigate("/chat");

  if (!chatInfo) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#fff" : "#000" }}>
        Loading chat...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#121212" : "#f5f5f5", color: isDark ? "#fff" : "#000" }}>
      {/* header */}
      <div style={{ background: isDark ? "#1e1e1e" : "#fff", padding: "12px 18px", display: "flex", alignItems: "center", borderBottom: "1px solid #ccc", position: "sticky", top: 0, zIndex: 2 }}>
        <button onClick={handleBack} style={{ background: "transparent", border: "none", fontSize: "22px", cursor: "pointer", marginRight: "10px" }}>←</button>
        <img src={friendInfo?.photoURL || "/default-avatar.png"} alt="avatar" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ccc", cursor: "pointer" }} onClick={openProfile} />
        <div style={{ marginLeft: "10px" }}>
          <h4 style={{ margin: 0 }}>{friendInfo?.displayName || chatInfo?.name || "Chat"}</h4>
          <small style={{ color: "#888" }}>{formatLastSeen(friendInfo?.lastSeen, friendInfo?.isOnline)}</small>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>📞</button>
          <button style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>🎥</button>
          <button style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }} onClick={() => openMedia()}>⋮</button>
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "120px" }}>
        {combined.map((m) => {
          const mine = m.sender === myUid;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "75%" }}>
              <div style={{ padding: "10px", borderRadius: 10, background: mine ? (isDark ? "#1f6feb" : "#007bff") : (isDark ? "#2b2b2b" : "#fff"), color: mine ? "#fff" : "#000", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                {!mine && <div style={{ fontWeight: "600", marginBottom: 6, fontSize: 13 }}>{friendInfo?.displayName || "Friend"}</div>}

                {m.type === "image" && <img src={m.fileURL} alt={m.fileName} style={{ width: "100%", borderRadius: 8 }} />}
                {m.type === "file" && <a href={m.fileURL} target="_blank" rel="noreferrer" style={{ color: mine ? "#fff" : "#007BFF" }}>📎 {m.fileName}</a>}
                {m.type === "text" && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}

                <div style={{ fontSize: 11, textAlign: "right", opacity: 0.85, marginTop: 6 }}>
                  <span>{m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (m.createdAt instanceof Date ? m.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Sending...")}</span>
                  {mine && <MessageStatus status={m.status || (m.local ? "sending" : "sent")} />}
                </div>
              </div>
            </div>
          );
        })}

        {/* bottom ref */}
        <div ref={endRef} />
      </div>

      {/* file previews strip + input (fixed) */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: 10, background: isDark ? "#111" : "#fff", borderTop: "1px solid #ccc", display: "flex", alignItems: "center", gap: 8 }}>
        <label htmlFor="fileInput" style={{ cursor: "pointer", fontSize: 22 }}>📎</label>
        <input id="fileInput" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={onFilesSelected} />

        <div style={{ display: "flex", gap: 8, overflowX: "auto", maxWidth: 240 }}>
          {previews.map((p, i) => (
            <div key={i} style={{ position: "relative", width: 56, height: 56, borderRadius: 8, overflow: "hidden" }}>
              {p ? <img src={p} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ background: "#eee", width: "100%", height: "100%" }} />}
              <button onClick={() => removeFileAt(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#fff", border: "none", cursor: "pointer" }}>✖</button>
            </div>
          ))}
        </div>

        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Type a message..." style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc", resize: "none", minHeight: 40, maxHeight: 120, background: isDark ? "#222" : "#fff", color: isDark ? "#fff" : "#000" }} />

        <button onClick={handleSend} disabled={uploading} style={{ padding: "10px 12px", borderRadius: 8, background: uploading ? "#999" : "#007BFF", color: "#fff", border: "none", cursor: uploading ? "not-allowed" : "pointer" }}>{uploading ? "⌛" : "Send"}</button>
      </div>
    </div>
  );
}