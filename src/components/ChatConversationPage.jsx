// src/components/Chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
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
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { profilePic, profileName } = useContext(UserContext);
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
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // ---------------- Load chat info ----------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsubChat = onSnapshot(chatRef, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });

      // Load friend info
      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        const unsubUser = onSnapshot(userRef, (s) => {
          if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
        });
      }
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // ---------------- Real-time messages ----------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      const pinned = docs.find((m) => m.pinned);
      setPinnedMessage(pinned || null);
      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
      setLoadingMsgs(false);
    });

    return () => unsub();
  }, [chatId, isAtBottom]);

  // ---------------- Send message ----------------
  const sendTextMessage = async () => {
    if (!text.trim() && !selectedFiles.length) return;

    const payload = {
      senderId: myUid,
      text: text.trim(),
      mediaUrl: "",
      mediaType: null,
      createdAt: serverTimestamp(),
      reactions: {},
    };

    if (replyTo) {
      payload.replyTo = {
        id: replyTo.id,
        text: replyTo.text || replyTo.mediaType || "media",
        senderId: replyTo.senderId,
      };
    }

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
      setReplyTo(null);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- Scroll detection ----------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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
        friendId={friendInfo?.id}
        friendName={friendInfo?.name || profileName}
        friendPic={friendInfo?.profilePic || profilePic}
        lastSeen={friendInfo?.lastSeen}
        isOnline={friendInfo?.isOnline}
        onClearChat={() => {}}
        onSearch={() => {}}
        onBlock={() => {}}
        onMute={() => {}}
      />

      {/* Pinned message */}
      {pinnedMessage && (
        <div
          style={{
            background: "#f39c12",
            color: "#fff",
            padding: 6,
            borderRadius: 8,
            margin: 8,
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={() => setPinnedMessage(null)}
        >
          📌 {pinnedMessage.text || pinnedMessage.mediaType || "Media"}
        </div>
      )}

      {/* Messages list */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: 12 }}>Loading...</div>}

        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            chatId={chatId}
            setReplyTo={setReplyTo}
            pinnedMessage={pinnedMessage}
            setPinnedMessage={setPinnedMessage}
          />
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div style={{ fontSize: 12, color: "#888", margin: 4 }}>
            {typingUsers.join(", ")} typing...
          </div>
        )}

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
      />
    </div>
  );
}