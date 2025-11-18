import React, { useEffect, useState, useRef, useContext, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc,
  doc, getDoc, arrayUnion, arrayRemove, deleteDoc, limit as fsLimit, getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import MessageBubble from "./MessageBubble";
import HeaderMenu from "./HeaderMenu";
import EmojiPicker from "./EmojiPicker";
import PreviewStrip from "./PreviewStrip";
import { fmtTime, dayLabel, detectFileType, uploadToCloudinary } from "../utils/chatHelpers";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const msgsContainerRef = useRef(null);
  const endRef = useRef(null);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(null);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  // State
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [uploadingIds, setUploadingIds] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Load chat meta and friend info
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
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
        unsubChat = onSnapshot(cRef, s => {
          if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error(e);
      }
    };
    loadMeta();
    return () => unsubChat && unsubChat();
  }, [chatId, myUid]);

  // Realtime messages loading
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(m => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      docs.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          try {
            await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
          } catch {}
        }
      });
      setLoadingMsgs(false);
      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => {
      const el = msgsContainerRef.current;
      if (!el) return;
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };
    const el = msgsContainerRef.current;
    el?.addEventListener("scroll", onScroll);
    return () => el?.removeEventListener("scroll", onScroll);
  }, []);

  // Mark messages seen on visibility
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      const lastIncoming = [...messages].reverse().find(m => m.senderId !== myUid);
      if (lastIncoming && lastIncoming.status !== "seen") {
        try {
          await updateDoc(doc(db, "chats", chatId, "messages", lastIncoming.id), { status: "seen" });
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange();
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [messages, chatId, myUid]);

  // Select files and previews
  const onFilesSelected = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newPreviews = files.map(f => ({
      url: (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null,
      type: detectFileType(f),
      name: f.name,
      file: f,
    }));
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setSelectedPreviewIndex(0);
  }, []);

  // Send message handler
  const sendTextMessage = useCallback(async () => {
    if ((chatInfo?.blockedBy ?? []).includes(myUid)) {
      alert("You are blocked in this chat. You cannot send messages.");
      return;
    }
    // Upload files first
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0);
      for (const file of filesToSend) {
        try {
          const placeholder = {
            senderId: myUid,
            text: "",
            mediaUrl: "",
            mediaType: detectFileType(file),
            fileName: file.name,
            createdAt: serverTimestamp(),
            status: "uploading",
            reactions: {},
          };
          const mRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
          const messageId = mRef.id;
          setUploadingIds(prev => ({ ...prev, [messageId]: 0 }));
          const url = await uploadToCloudinary(file, (pct) => setUploadingIds(prev => ({ ...prev, [messageId]: pct })));
          await updateDoc(doc(db, "chats", chatId, "messages", messageId), { mediaUrl: url, status: "sent", sentAt: serverTimestamp() });
          setTimeout(() => setUploadingIds(prev => { const c = { ...prev }; delete c[messageId]; return c; }), 200);
        } catch (err) {
          console.error("upload error:", err);
        }
      }
      return;
    }
    // Send text message
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
        console.error(e);
        alert("Failed to send");
      }
    }
  }, [chatId, myUid, selectedFiles, text, replyTo, chatInfo?.blockedBy]);

  // Recording handlers extracted separately...

  // ...omitting for brevity but refactor your MediaRecorder usage similarly...

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  }, []);

  // Group messages by day
  const groupedMessages = React.useMemo(() => {
    const out = [];
    let lastDay = null;
    messages.forEach(m => {
      const label = dayLabel(m.createdAt || new Date());
      if (label !== lastDay) {
        out.push({ type: "day", label, id: `day-${label}-${Math.random().toString(36).slice(2, 6)}` });
        lastDay = label;
      }
      out.push(m);
    });
    return out;
  }, [messages]);

  // Render component
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? "#070707" : "#f5f5f5"),
      color: isDark ? "#fff" : "#000"
    }}>
      <HeaderMenu
        friendInfo={friendInfo}
        chatInfo={chatInfo}
        myUid={myUid}
        navigate={navigate}
        headerMenuOpen={headerMenuOpen}
        setHeaderMenuOpen={setHeaderMenuOpen}
        clearChat={() => { /* your clear chat logic here */ }}
        toggleBlock={() => { /* your toggle block logic here */ }}
      />
      <main ref={msgsContainerRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: "center", color: "#888", marginTop: 12 }}>Loading messages…</div>}
        {groupedMessages.map(item => {
          if (item.type === "day") {
            return <div key={item.id} style={{ textAlign: "center", margin: "14px 0", color: "#8a8a8a", fontSize: 12 }}>{item.label}</div>;
          }
          return (
            <MessageBubble
              key={item.id}
              message={item}
              isMine={item.senderId === myUid}
              isDark={isDark}
              myUid={myUid}
              setMenuOpenFor={setMenuOpenFor}
              menuOpenFor={menuOpenFor}
              setReactionFor={setReactionFor}
              reactionFor={reactionFor}
              replyToMessage={setReplyTo}
              applyingReaction={applyReaction} // created separately
            />
          );
        })}
        <div ref={endRef} />
      </main>

      {/* Scroll-to-bottom button */}
      {!isAtBottom && (
        <button onClick={scrollToBottom} style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 120, zIndex: 80,
          background: "#007bff", color: "#fff", border: "none", borderRadius: 22, width: 48, height: 48, fontSize: 22
        }}>↓</button>
      )}

      {/* Reply pinned preview */}
      {replyTo && (
        <div style={{
          position: "sticky", bottom: 84, left: 12, right: 12, display: "flex", justifyContent: "space-between",
          background: isDark ? "#101010" : "#fff", padding: 8, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 90
        }}>
          {/* ... Your reply preview snippet ... */}
        </div>
      )}

      {/* Preview strip of selected media */}
      <PreviewStrip
        previews={previews}
        selectedPreviewIndex={selectedPreviewIndex}
        setSelectedPreviewIndex={setSelectedPreviewIndex}
        setSelectedFiles={setSelectedFiles}
        setPreviews={setPreviews}
      />

      {/* Input */}
      {/* ... Your message input component refactored if needed */}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <EmojiPicker
          isDark={isDark}
          extendedEmojis={["❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩","😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"]}
          onSelect={(emoji) => {
            if (emojiPickerFor) applyReaction(emojiPickerFor, emoji);
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
                    }
