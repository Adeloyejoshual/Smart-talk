// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";

/**
 * ChatConversationPage.jsx
 * - Tailwind layout (navy/sky-blue accents)
 * - Media sending (image/audio/video/file)
 * - Live lastSeen/online from users doc
 * - Message Reactions (per-user map on message doc)
 * - Delete for Everyone (sender-only): marks message as deleted
 */

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "😅"];

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const myUid = user?.uid;

  // state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [filePreview, setFilePreview] = useState(null); // { file, name, kind, url }
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [receiver, setReceiver] = useState(null);
  const [statusLabel, setStatusLabel] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [actionMenuPos, setActionMenuPos] = useState(null); // {x,y}
  const [replyTo, setReplyTo] = useState(null);
  const [blocked, setBlocked] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Listen messages (ordered asc)
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      // auto-scroll a bit
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });
    return () => unsub();
  }, [chatId]);

  // Load chat doc to get other participant and blocked status, and listen to their user doc for lastSeen
  useEffect(() => {
    if (!chatId || !myUid) return;
    let unsubUser = null;
    (async () => {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) { alert("Chat not found"); navigate("/chat"); return; }
      const chatData = snap.data();
      setBlocked(Boolean(chatData?.blockedBy?.includes(myUid)));
      const friendId = (chatData.participants || []).find(p => p !== myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubUser = onSnapshot(friendRef, fSnap => {
          if (!fSnap.exists()) return;
          const d = { id: fSnap.id, ...fSnap.data() };
          setReceiver(d);
          setStatusLabel(formatLastSeenLabel(d));
        });
      }
    })();
    return () => unsubUser && unsubUser();
  }, [chatId, myUid, navigate]);

  // Format lastSeen / online
  const formatLastSeenLabel = (userDoc) => {
    if (!userDoc) return "";
    if (userDoc.isOnline) return "Online";
    const ts = userDoc.lastSeen;
    if (!ts) return "Offline";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const yesterday = new Date(); yesterday.setDate(new Date().getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Send text or file message
  const handleSend = async () => {
    if ((!input.trim() && !filePreview) || !myUid || !chatId || blocked) return;
    try {
      // If filePreview present -> upload then create message
      if (filePreview) {
        setUploading(true);
        const kind = filePreview.kind; // "image"/"video"/"audio"/"file"
        const placeholder = {
          sender: myUid,
          text: input.trim() || "",
          fileURL: null,
          fileName: filePreview.name,
          type: kind,
          createdAt: serverTimestamp(),
          status: "uploading",
          reactions: {},
        };
        const docRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);

        // upload to storage
        const storagePath = `chatFiles/${chatId}/${Date.now()}_${filePreview.name}`;
        const sRef = storageRef(storage, storagePath);
        const task = uploadBytesResumable(sRef, filePreview.file);

        task.on("state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadProgress(pct);
          },
          async (err) => {
            console.error("upload error", err);
            await updateDoc(doc(db, "chats", chatId, "messages", docRef.id), { status: "failed" }).catch(()=>{});
            setUploading(false);
            setFilePreview(null);
          },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            await updateDoc(doc(db, "chats", chatId, "messages", docRef.id), {
              fileURL: url,
              status: "sent",
              sentAt: serverTimestamp(),
            });
            setUploading(false);
            setFilePreview(null);
            setUploadProgress(0);
          }
        );
      } else {
        // plain text
        await addDoc(collection(db, "chats", chatId, "messages"), {
          sender: myUid,
          text: input.trim(),
          fileURL: null,
          fileName: null,
          type: "text",
          createdAt: serverTimestamp(),
          status: "sent",
          reactions: {},
          replyTo: replyTo ? { id: replyTo.id, text: replyTo.text ? replyTo.text.slice(0,120) : (replyTo.fileName || "media"), sender: replyTo.sender } : null,
        });
        setReplyTo(null);
        setInput("");
        setShowAttach(false);
      }
    } catch (err) {
      console.error("send failed", err);
      alert("Failed to send");
      setUploading(false);
    }
  };

  // File selection handler (used by hidden inputs)
  const onFileSelected = (e, forcedKind) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || "";
    let kind = forcedKind || (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "file");
    const previewUrl = kind === "image" ? URL.createObjectURL(file) : null;
    setFilePreview({ file, name: file.name, kind, url: previewUrl });
    setShowAttachMenu(false);
  };

  // Toggle reaction on a message (set or remove user's reaction)
  const toggleReaction = async (messageId, emoji) => {
    if (!myUid) return;
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const cur = snap.data() || {};
      const reactions = { ...(cur.reactions || {}) };
      if (reactions[myUid] === emoji) {
        // remove reaction for this user
        delete reactions[myUid];
      } else {
        reactions[myUid] = emoji;
      }
      await updateDoc(mRef, { reactions });
    } catch (err) {
      console.error("toggleReaction error", err);
    } finally {
      setSelectedMessageId(null);
    }
  };

  // Delete message locally (delete doc) - only if you created it OR you want to allow deletion of your own
  const deleteMessageLocally = async (messageId) => {
    // For "delete for me" you might remove locally or set a user-specific flag — here we simply delete the doc (if allowed).
    try {
      // Only allow deleting your own message doc
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const m = snap.data();
      if (m.sender !== myUid) {
        alert("You can only delete your own messages.");
        return;
      }
      // safe approach: mark deleted locally (delete doc)
      await updateDoc(mRef, {
        deleted: true,
        deletedBy: myUid,
        deletedAt: serverTimestamp()
      });
      // optionally remove doc: await deleteDoc(mRef)
      setSelectedMessageId(null);
    } catch (err) {
      console.error("delete locally failed", err);
      alert("Failed to delete message");
    }
  };

  // Delete for everyone (sender only) — replace message with "This message was deleted"
  const deleteForEveryone = async (messageId) => {
    try {
      const mRef = doc(db, "chats", chatId, "messages", messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const m = snap.data();
      if (m.sender !== myUid) {
        alert("Only the sender can delete for everyone.");
        return;
      }
      await updateDoc(mRef, {
        text: "This message was deleted",
        fileURL: null,
        fileName: null,
        type: "deleted",
        reactions: {},
        deletedBy: myUid,
        deletedAt: serverTimestamp(),
      });
      setSelectedMessageId(null);
    } catch (err) {
      console.error("deleteForEveryone error", err);
      alert("Failed to delete for everyone");
    }
  };

  // Render a single message bubble
  const MessageBubble = ({ m }) => {
    const mine = m.sender === myUid;
    const reactions = m.reactions || {};
    const reactionList = Object.values(reactions || {});

    // click to open action menu
    const onActionClick = (e) => {
      e.stopPropagation();
      setSelectedMessageId(m.id);
      // position menu roughly near click
      setActionMenuPos({ x: e.clientX, y: e.clientY });
    };

    return (
      <div className={`w-full flex ${mine ? "justify-end" : "justify-start"} mb-3`}>
        <div
          className={`rounded-2xl p-3 max-w-[78%] shadow-sm ${
            m.type === "deleted"
              ? "bg-gray-200 text-gray-600 italic"
              : mine
                ? "bg-sky-600 text-white"
                : "bg-white text-black"
          } relative`}
        >
          {/* reply snippet */}
          {m.replyTo && (
            <div className="mb-2 px-2 py-1 rounded bg-gray-100 text-sm text-gray-600">
              {m.replyTo.text || (m.replyTo.fileName || "media")}
            </div>
          )}

          {/* media / text */}
          {m.type === "image" && m.fileURL && (
            <img src={m.fileURL} alt={m.fileName} className="w-56 rounded-md mb-2 cursor-pointer" onClick={() => window.open(m.fileURL, "_blank")} />
          )}
          {m.type === "video" && m.fileURL && (
            <video controls src={m.fileURL} className="w-56 rounded-md mb-2" />
          )}
          {m.type === "audio" && m.fileURL && (
            <audio controls src={m.fileURL} className="w-full mb-2" />
          )}
          {m.type === "file" && m.fileURL && (
            <a href={m.fileURL} target="_blank" rel="noreferrer" className="underline text-sm block mb-2">{m.fileName || "Download file"}</a>
          )}
          {m.type === "deleted" ? (
            <div>This message was deleted</div>
          ) : (
            m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
          )}

          <div className="flex items-center justify-between mt-2 text-xs opacity-80">
            <div className="flex items-center gap-2">
              {/* reactions displayed */}
              {reactionList.length > 0 && (
                <div className="flex gap-1 bg-white rounded-full px-2 py-0.5 shadow-sm">
                  {reactionList.slice(0,3).map((r, i) => <span key={i}>{r}</span>)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[11px]">{m.createdAt?.toDate ? new Date(m.createdAt.toDate()).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"}) : ""}</div>
              <button onClick={onActionClick} className="text-sm px-2 py-1 rounded hover:bg-white/10">⋯</button>
            </div>
          </div>
        </div>

        {/* Action menu (pop) */}
        {selectedMessageId === m.id && actionMenuPos && (
          <div
            onClick={(e) => { e.stopPropagation(); }}
            style={{ left: actionMenuPos.x, top: actionMenuPos.y }}
            className="fixed z-50 p-2 bg-white rounded shadow-lg w-48"
          >
            <button
              onClick={() => { setReplyTo(m); setSelectedMessageId(null); }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded"
            >
              ↩ Reply
            </button>

            <div className="w-full px-2 py-1">
              <div className="text-xs text-gray-500 mb-1">React</div>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => toggleReaction(m.id, e)} className="px-2 py-1 rounded hover:bg-gray-100">{e}</button>
                ))}
              </div>
            </div>

            {/* Delete for me (sender only) */}
            {m.sender === myUid && (
              <button
                onClick={() => { deleteMessageLocally(m.id); }}
                className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-red-600"
              >
                🗑 Delete (mark)
              </button>
            )}

            {/* Delete for everyone (sender only) */}
            {m.sender === myUid && (
              <button
                onClick={() => { if (window.confirm("Delete this message for everyone?")) deleteForEveryone(m.id); }}
                className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-red-700 font-semibold"
              >
                🗑 Delete for everyone
              </button>
            )}

            <button onClick={() => setSelectedMessageId(null)} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Close</button>
          </div>
        )}
      </div>
    );
  };

  // UI: attach menu toggle helper
  const [showAttach, setShowAttach] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-gray-900">
      {/* header */}
      <div className="flex items-center px-3 py-2 bg-sky-700 text-white">
        <button onClick={() => navigate("/chat")} className="mr-3">←</button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
            {receiver?.photoURL ? <img src={receiver.photoURL} alt="" className="w-full h-full object-cover" /> : null}
          </div>
          <div>
            <div className="font-semibold">{receiver?.displayName || receiver?.name || "Friend"}</div>
            <div className="text-xs opacity-90">{receiver ? statusLabel : "Loading..."}</div>
          </div>
        </div>
      </div>

      {/* messages list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-gray-800">
        {messages.map(m => <MessageBubble key={m.id} m={m} />)}
        <div ref={messagesEndRef} />
      </div>

      {/* attach menu (floating) */}
      {showAttach && (
        <div className="absolute bottom-20 left-4 bg-white rounded-xl p-3 shadow-lg z-40">
          <label className="flex items-center gap-2 cursor-pointer">
            📷 Photo
            <input type="file" accept="image/*" hidden onChange={(e) => onFileSelected(e)} />
          </label>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            🎥 Video
            <input type="file" accept="video/*" hidden onChange={(e) => onFileSelected(e)} />
          </label>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            🎧 Audio
            <input type="file" accept="audio/*" hidden onChange={(e) => onFileSelected(e)} />
          </label>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            📁 File
            <input type="file" hidden onChange={(e) => onFileSelected(e)} />
          </label>
        </div>
      )}

      {/* file preview (if selected) */}
      {filePreview && (
        <div className="flex items-center gap-3 p-3 bg-gray-100 border-t">
          {filePreview.kind === "image" && filePreview.url && <img src={filePreview.url} alt="preview" className="w-20 h-20 object-cover rounded" />}
          <div className="flex-1">
            <div className="font-medium">{filePreview.name}</div>
            {uploading && <div className="text-sm text-gray-500">{uploadProgress}%</div>}
          </div>
          <button className="text-sm text-red-600" onClick={() => setFilePreview(null)}>Remove</button>
        </div>
      )}

      {/* input area */}
      <div className="flex items-center gap-2 p-3 border-t bg-white">
        <button onClick={() => { setShowAttach(s => !s); setShowAttachMenu(false); }} className="text-sky-600 px-2">＋</button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={blocked ? "You blocked this user" : "Type a message"}
          disabled={blocked}
          className="flex-1 px-3 py-2 rounded-full border border-gray-200 focus:outline-none"
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
        />
        <button onClick={handleSend} className="bg-sky-600 px-4 py-2 rounded-full text-white" disabled={uploading || blocked}>
          {uploading ? "Uploading..." : "Send"}
        </button>
      </div>
    </div>
  );
}