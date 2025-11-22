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
  serverTimestamp,
  deleteDoc,
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";

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
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// -------------------- Constants --------------------
const COLORS = {
  primary: "#34B7F1",
  darkBg: "#0b0b0b",
  lightBg: "#f5f5f5",
  lightText: "#000",
  darkText: "#fff",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  headerBlue: "#1877F2",
};

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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingIds, setUploadingIds] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // -------------------- Load chat & friend (live) --------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    let unsubUser = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });

          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const userRef = doc(db, "users", friendId);
            unsubUser = onSnapshot(userRef, (s) => {
              if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
            });
          }
        }

        unsubChat = onSnapshot(cRef, (s) => {
          if (s.exists())
            setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => {
      unsubChat?.();
      unsubUser?.();
    };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      fsLimit(2000)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);

      // mark incoming messages as delivered
      docs.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            status: "delivered",
          });
        }
      });

      setLoadingMsgs(false);
      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => {
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // -------------------- Send message --------------------
  const sendTextMessage = async () => {
    if (!chatInfo || (chatInfo.blockedBy || []).includes(myUid))
      return alert("You are blocked in this chat.");
    if (!text && selectedFiles.length === 0) return;

    const newMessages = [];

    // upload files first
    for (let file of selectedFiles) {
      const tempId = Date.now() + "-" + file.name;
      setUploadingIds((prev) => ({ ...prev, [tempId]: true }));

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "0HoyRB6wC0eba-Cbat0nhiIRoa8");
      formData.append("folder", "chatImages");

      try {
        const res = await fetch(
          "https://api.cloudinary.com/v1_1/dtp8wg4e1/image/upload",
          { method: "POST", body: formData }
        );
        const data = await res.json();
        const fileURL = data.secure_url;

        const msgRef = await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: myUid,
          text: "",
          mediaUrl: fileURL,
          mediaType: "image",
          status: "sent",
          createdAt: serverTimestamp(),
          replyTo: replyTo?.id || null,
        });

        newMessages.push(msgRef.id);
        setUploadingIds((prev) => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });
      } catch (e) {
        console.error("File upload error:", e);
      }
    }

    // send text message
    if (text) {
      const msgRef = await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        text: text,
        mediaUrl: null,
        mediaType: null,
        status: "sent",
        createdAt: serverTimestamp(),
        replyTo: replyTo?.id || null,
      });
      newMessages.push(msgRef.id);
    }

    setText("");
    setSelectedFiles([]);
    setReplyTo(null);
    scrollToBottom();
  };

  // -------------------- File select --------------------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg),
        color: isDark ? COLORS.darkText : COLORS.lightText,
      }}
    >
      {/* Header */}
      <ChatHeader
        chatInfo={chatInfo}
        friendInfo={friendInfo}
        myUid={myUid}
        navigate={navigate}
        headerMenuOpen={headerMenuOpen}
        setHeaderMenuOpen={setHeaderMenuOpen}
        clearChat={() => alert("Clear Chat")}
        toggleBlock={() => alert("Block toggle")}
      />

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            myUid={myUid}
            chatId={chatId}
            setMenuOpenFor={setMenuOpenFor}
            menuOpenFor={menuOpenFor}
            setReactionFor={setReactionFor}
            reactionFor={reactionFor}
            replyToMessage={(m) => setReplyTo(m)}
            scrollToBottom={scrollToBottom}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
        onFilesSelected={onFilesSelected}
        selectedFiles={selectedFiles}
        holdStart={() => {}}
        holdEnd={() => {}}
        recording={recording}
        isDark={isDark}
      />
    </div>
  );
}