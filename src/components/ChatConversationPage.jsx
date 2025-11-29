// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  startAfter,
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";

// -------------------- Helpers --------------------
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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Pagination
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;

  // -------------------- Load chat & friend --------------------
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

          // find friend id
          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const userRef = doc(db, "users", friendId);
            unsubUser = onSnapshot(userRef, (s) => {
              if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
            });
          }
        }

        unsubChat = onSnapshot(cRef, (s) => {
          if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => {
      if (unsubChat) unsubChat();
      if (unsubUser) unsubUser();
    };
  }, [chatId, myUid]);

  // -------------------- Load latest messages --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), fsLimit(pageSize));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !(m.deletedFor?.includes(myUid)));

      setMessages(docs.reverse());
      setLastVisible(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === pageSize);
      setLoadingMsgs(false);

      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });

      // mark delivered
      docs.forEach(async m => {
        if (m.senderId !== myUid && m.status === "sent") {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), { status: "delivered" });
        }
      });
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Load older messages --------------------
  const loadOlderMessages = async () => {
    if (!hasMore || !lastVisible) return;
    setLoadingMsgs(true);
    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(
        messagesRef,
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        fsLimit(pageSize)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMore(false);
        return;
      }

      const older = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !(m.deletedFor?.includes(myUid)));

      setMessages((prev) => [...older.reverse(), ...prev]);
      setLastVisible(snap.docs[snap.docs.length - 1]);
    } catch (e) {
      console.error("Error loading older messages:", e);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);

      if (el.scrollTop < 100 && hasMore && !loadingMsgs) {
        loadOlderMessages();
      }
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingMsgs]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // -------------------- Send text message --------------------
  const sendTextMessage = async () => {
    if ((chatInfo?.blockedBy || []).includes(myUid)) return alert("You are blocked in this chat.");
    if (selectedFiles.length > 0) return; // handled by ChatInput
    if (!text.trim()) return;

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
      scrollToBottom();
    } catch (e) {
      console.error(e);
      alert("Failed to send");
    }
  };

  // -------------------- JSX --------------------
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <ChatHeader
        chatInfo={chatInfo}
        friendInfo={friendInfo}
        myUid={myUid}
        theme={theme}
        wallpaper={wallpaper}
        headerMenuOpen={headerMenuOpen}
        setHeaderMenuOpen={setHeaderMenuOpen}
        clearChat={() => alert("Clear chat")}
        toggleBlock={() => alert("Toggle block")}
      />

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: 12 }}>Loading...</div>}
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            chatId={chatId}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        chatId={chatId}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />
    </div>
  );
}