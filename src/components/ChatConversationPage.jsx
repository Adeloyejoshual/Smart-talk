// src/components/ChatConversationPage.jsx
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
  const [pinnedMessageId, setPinnedMessageId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // -------------------- Load chat info --------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    let unsubUser = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        unsubChat = onSnapshot(cRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setChatInfo({ id: snap.id, ...data });

            const friendId = data.participants?.find((p) => p !== myUid);
            if (friendId) {
              const userRef = doc(db, "users", friendId);
              unsubUser = onSnapshot(userRef, (s) => {
                if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
              });
            }
          }
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

  // -------------------- Real-time messages --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !(m.deletedFor?.includes(myUid)));

      setMessages(docs);

      // Find pinned message
      const pinned = docs.find((m) => m.pinned);
      if (pinned) setPinnedMessageId(pinned.id);

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
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // -------------------- Send text message --------------------
  const sendTextMessage = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;

    try {
      const payload = {
        senderId: myUid,
        text: text.trim(),
        mediaUrl: selectedFiles[0]?.url || "",
        mediaType: selectedFiles[0]?.type || null,
        fileName: selectedFiles[0]?.name || "",
        createdAt: serverTimestamp(),
        status: "sent",
        reactions: {},
      };
      if (replyTo) {
        payload.replyTo = {
          id: replyTo.id,
          text: replyTo.text || replyTo.mediaType || "media",
          senderId: replyTo.senderId,
        };
        setReplyTo(null);
      }

      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: payload.text || payload.mediaType,
        lastMessageAt: serverTimestamp(),
        lastMessageSender: myUid,
        lastMessageStatus: "sent",
      });

      setText("");
      setSelectedFiles([]);
      scrollToBottom();
    } catch (e) {
      console.error(e);
      alert("Failed to send");
    }
  };

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
        onClearChat={() => alert("Clear chat")}
        onSearch={() => alert("Search")}
        onBlock={() => alert("Block")}
        onMute={() => alert("Mute")}
      />

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: 12 }}>Loading...</div>}

        {/* Pinned message */}
        {pinnedMessageId && (
          <MessageItem
            key={pinnedMessageId}
            message={messages.find((m) => m.id === pinnedMessageId)}
            myUid={myUid}
            isDark={isDark}
            chatId={chatId}
            setReplyTo={setReplyTo}
            pinnedMessageId={pinnedMessageId}
            setPinnedMessageId={setPinnedMessageId}
          />
        )}

        {/* Other messages */}
        {messages
          .filter((m) => m.id !== pinnedMessageId)
          .map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              myUid={myUid}
              isDark={isDark}
              chatId={chatId}
              setReplyTo={setReplyTo}
              pinnedMessageId={pinnedMessageId}
              setPinnedMessageId={setPinnedMessageId}
            />
          ))}

        {/* Typing indicator */}
        {typing && (
          <div style={{ fontSize: 12, color: "#888", margin: "4px 0" }}>
            Typing...
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
        chatId={chatId}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        setTyping={setTyping}
      />
    </div>
  );
}